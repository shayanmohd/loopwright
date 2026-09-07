/* Upgrade from the shipped 1.0.0.

   test/fixtures/v100-store.json holds what the 1.0.0 build actually wrote:
   localStorage byte for byte, plus its IndexedDB recordings. Seed both before the
   page loads, then check that every song, scene, layer, arrangement and setting
   comes back, that the audio still renders, and that saving again does not corrupt
   anything. Nothing here may be lost. */
const fs = require('fs');
const path = require('path');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'v100-store.json'), 'utf8'));

  await page.evaluateOnNewDocument((store, hums) => {
    localStorage.setItem('loopwright.v1', store);
    const req = indexedDB.open('loopwright', 1);
    req.onupgradeneeded = () => { try { req.result.createObjectStore('hums'); } catch (e) {} };
    req.onsuccess = () => {
      try {
        const t = req.result.transaction('hums', 'readwrite');
        const st = t.objectStore('hums');
        hums.forEach(h => st.put({ sr: h.sr, pcm: Int16Array.from(h.pcm) }, h.key));
      } catch (e) {}
    };
  }, fx.store, fx.hums);

  await page.goto('http://127.0.0.1:8825/index.html', { waitUntil: 'networkidle0' });
  await wait(1200);

  const before = JSON.parse(fx.store);
  const after = await page.evaluate(() => ({
    projects: Store.projects().map(p => ({
      id: p.id, title: p.title, bpm: p.bpm, beats: p.beats, tonic: p.tonic, mode: p.mode,
      scenes: p.scenes.map(s => ({ name: s.name, layers: s.layers.map(l => ({ voice: l.voice, kind: l.kind, n: l.src.length, hum: l.hum, tighten: l.tighten, octave: l.octave })) })),
      strip: p.strip.length
    })),
    settings: Store.settings(),
    open: Store.lastOpen(),
    intro: document.querySelector('#introSheet').hidden === false
  }));

  const b = before.projects.map(p => ({ id: p.id, title: p.title, bpm: p.bpm, beats: p.beats,
    layers: p.scenes.reduce((n, s) => n + s.layers.length, 0), strip: p.strip.length }));
  const a = after.projects.map(p => ({ id: p.id, title: p.title, bpm: p.bpm, beats: p.beats,
    layers: p.scenes.reduce((n, s) => n + s.layers.length, 0), strip: p.strip }));
  b.sort((x, y) => x.id < y.id ? -1 : 1); a.sort((x, y) => x.id < y.id ? -1 : 1);
  log('1.0.0 projects:', JSON.stringify(b));
  log('1.0.1 projects:', JSON.stringify(a));
  log('projects identical:', JSON.stringify(b) === JSON.stringify(a));
  log('settings before:', JSON.stringify(before.settings));
  log('settings after: ', JSON.stringify(after.settings));
  log('lastOpen kept:', after.open === before.lastOpen);
  log('intro sheet shown again (want false):', after.intro);

  await shot('40-upgraded-pad');
  await page.evaluate(() => App.setView('library'));
  await wait(500);
  await shot('41-upgraded-library');
  await page.evaluate(() => App.setView('arrange'));
  await wait(500);
  await shot('42-upgraded-arrange');

  // The old layers must still make sound and still render to a file.
  await page.evaluate(() => App.setView('pad'));
  await wait(300);
  const rendered = await page.evaluate(async () => {
    const p = Store.projects().find(x => x.title === 'Bus Window');
    Store.open(p.id);
    const buf = await Engine.renderSong(p);
    let peak = 0;
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 7) peak = Math.max(peak, Math.abs(d[i]));
    return { seconds: +buf.duration.toFixed(2), peak: +peak.toFixed(3) };
  });
  log('1.0.0 song still renders:', JSON.stringify(rendered));

  // and the 1.0.0 hum recordings still come back for the A/B toggle
  const hum = await page.evaluate(async () => {
    const p = Store.projects().find(x => x.title === 'Bus Window');
    const l = p.scenes[0].layers[0];
    const rec = await Hums.get(l.hum);
    return rec ? rec.pcm.length + ' samples at ' + rec.sr : 'missing';
  });
  log('1.0.0 recording readable:', hum);

  // write once more and re-read: nothing may be dropped by the new writer
  await page.evaluate(() => { const p = Store.projects()[0]; Store.touch(p); });
  const roundTrip = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('loopwright.v1'));
    return { projects: raw.projects.length, keys: Object.keys(raw).sort().join(','),
             layerKeys: Object.keys(raw.projects.find(p => p.scenes[0].layers.length).scenes[0].layers[0]).sort().join(',') };
  });
  log('after re-save:', JSON.stringify(roundTrip));
  log('page errors:', errors.length);
};
