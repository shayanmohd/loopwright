/* Upgrade from the shipped 1.0.0. The fixture is what the 1.0.0 tree itself
   wrote (test/review-02-capture100.js drives that build out of git), replayed
   into a fresh profile before the new build's scripts ever run. Every project,
   scene, layer, arrangement, setting and stored take must come back identically,
   the old song must still render to audio, and re-saving must not drop a field. */
const fs = require('fs');
const path = require('path');
const { URL } = require('./review-lib');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'review-v100.json'), 'utf8'));

module.exports = async ({ page, shot, wait, log, errors }) => {
  // Seed on the origin, then load the new build fresh: the fixture is in place
  // before the scripts of the run under test read it.
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await wait(400);
  await page.evaluate(async (fx) => {
    localStorage.setItem('loopwright.v1', fx.ls);
    const d = await new Promise(res => {
      const r = indexedDB.open('loopwright', 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore('hums'); } catch (e) {} };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    });
    if (!d) return 'no idb';
    for (const k of Object.keys(fx.hums)) {
      const rec = { sr: fx.hums[k].sr, pcm: new Int16Array(fx.hums[k].pcm) };
      await new Promise(res => {
        const t = d.transaction('hums', 'readwrite');
        t.objectStore('hums').put(rec, k);
        t.oncomplete = res; t.onerror = res; t.onabort = res;
      });
    }
    return 'seeded';
  }, FIX);

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await wait(1400);
  await shot('01-upgraded-pad');

  const before = JSON.parse(FIX.ls);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('loopwright.v1')));
  const deep = (a, b, p, out) => {
    if (a === b) return;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const keys = new Set(Object.keys(a).concat(Object.keys(b)));
      keys.forEach(k => deep(a[k], b[k], p + '.' + k, out));
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(p + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b));
  };

  // 1. the new build read it without rewriting anything unasked
  const drift0 = [];
  deep(before, after, 'store', drift0);
  log('drift on load (expected: nothing):', JSON.stringify(drift0));

  // 2. it is on screen, in full
  const shown = await page.evaluate(() => {
    const p = App.project();
    return {
      openTitle: Store.title(p), bpm: Math.round(p.bpm), beats: p.beats,
      key: Store.keyName(p), scenes: p.scenes.length,
      layers: Store.layerCount(p), strip: p.strip.length,
      openScene: Store.current(p).name,
      guide: Store.guide(), settings: Store.settings(),
      muted: p.scenes[1].layers[0].muted, chords: p.scenes[1].layers[0].chords,
      octave: p.scenes[1].layers[0].octave, ab: p.scenes[1].layers[0].ab,
      tighten: p.scenes[1].layers[0].tighten, vol: p.scenes[1].layers[0].vol
    };
  });
  log('read back:', JSON.stringify(shown));
  const want = before.projects[0];
  log('title matches:', shown.openTitle === want.title,
      '| bpm matches:', shown.bpm === Math.round(want.bpm),
      '| layers match:', shown.layers === want.scenes.reduce((n, s) => n + s.layers.length, 0),
      '| strip matches:', shown.strip === want.strip.length);

  // 3. the old song still makes sound, including the stored take on the A/B layer
  const audio = await page.evaluate(async () => {
    const p = App.project();
    const buf = await Engine.renderSong(p);
    let peak = 0;
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i += 37) peak = Math.max(peak, Math.abs(ch[i]));
    let humOk = 'no ab layer';
    let l = null;
    p.scenes.forEach(s => s.layers.forEach(x => { if (!l && x.ab && x.hum) l = x; }));
    if (l) {
      const b = await Engine.layerBuffer(p, l, 44100);
      let hp = 0; const c2 = b.getChannelData(0);
      for (let i = 0; i < c2.length; i += 11) hp = Math.max(hp, Math.abs(c2[i]));
      humOk = 'ab layer peak ' + hp.toFixed(3);
    }
    return { seconds: +buf.duration.toFixed(2), peak: +peak.toFixed(3), humOk };
  });
  log('old song renders:', JSON.stringify(audio));

  // 4. touching it and saving again keeps every field the 1.0.0 record had
  await page.evaluate(() => { Store.touch(App.project()); Store.save(); });
  const resaved = await page.evaluate(() => JSON.parse(localStorage.getItem('loopwright.v1')));
  const drift1 = [];
  deep(before, resaved, 'store', drift1);
  log('drift after a re-save (updated timestamps only):', JSON.stringify(drift1));

  const lost = [];
  const walk = (a, b, p) => {
    if (a && typeof a === 'object' && !Array.isArray(a)) {
      Object.keys(a).forEach(k => {
        if (k.charAt(0) === '_') return;
        if (!(k in (b || {}))) lost.push(p + '.' + k);
        else walk(a[k], b[k], p + '.' + k);
      });
    } else if (Array.isArray(a)) {
      a.forEach((v, i) => walk(v, (b || [])[i], p + '[' + i + ']'));
    }
  };
  walk(before, resaved, 'store');
  log('fields dropped by the re-save:', JSON.stringify(lost));

  await page.evaluate(() => App.setView('library'));
  await wait(700);
  await shot('02-upgraded-library');
  await page.evaluate(() => App.setView('arrange'));
  await wait(500);
  await shot('03-upgraded-arrange');
  log('page errors:', errors.length);
};
