/* Capture what the shipped 1.0.0 actually writes. The 1.0.0 tree is served from
   its own port straight out of git, driven through a real first song (hummed
   melody, beatboxed overdub, a copied scene, an arrangement, a named song and
   changed settings), and both stores are dumped to a fixture the upgrade test
   replays into the new build. Nothing here is hand-written data. */
const fs = require('fs');
const path = require('path');
const { HUM } = require('./review-lib');
const URL100 = 'http://127.0.0.1:8926/index.html';

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  await page.evaluateOnNewDocument(HUM);
  await page.goto(URL100, { waitUntil: 'networkidle0' });
  await wait(700);
  await click('#introGo');
  await wait(400);

  await page.evaluate(() => Store.set('countIn', 4));
  await click('#pad');
  await wait(6200);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2800);
  log('1.0.0 first take:', await page.evaluate(() => Store.current(App.project()).layers.length + ' layers'));

  await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
  await page.evaluate(() => {
    Array.prototype.find.call(document.querySelectorAll('#shelf .vtile'),
      e => e.getAttribute('data-v') === 'kit').click();
  });
  await wait(300);
  await click('#pad');
  await wait(13000);
  log('1.0.0 after overdub:', await page.evaluate(() => Store.current(App.project()).layers.length + ' layers'));

  // a full record: a second scene, an arrangement, a name, non default settings,
  // a muted layer, a chorded layer and an A/B layer
  await click('#btnScene');
  await wait(600);
  await page.evaluate(() => {
    const p = App.project();
    const sc = Store.current(p);
    sc.layers[0].muted = true;
    sc.layers[0].chords = true;
    sc.layers[0].octave = -1;
    sc.layers[0].vol = 0.55;
    sc.layers[0].tighten = 0.35;
    if (sc.layers[0].hum) sc.layers[0].ab = true;
    p.title = 'Old song from 1.0.0';
    p.strip = [{ scene: p.scenes[0].id, repeats: 2 }, { scene: p.scenes[1].id, repeats: 3 }];
    p.keyLocked = true;
    Store.touch(p);
    Store.set('tighten', 0.4);
    Store.set('countIn', 2);
    Store.set('haptics', false);
    Store.setGuide(2);
  });
  await wait(400);
  await shot('100-pad');

  const dump = await page.evaluate(async () => {
    const ls = localStorage.getItem('loopwright.v1');
    const keys = [];
    const d = await new Promise(res => {
      const r = indexedDB.open('loopwright', 1);
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    });
    const hums = {};
    if (d) {
      await new Promise(res => {
        const t = d.transaction('hums', 'readonly');
        const st = t.objectStore('hums');
        const kr = st.getAllKeys();
        kr.onsuccess = () => { keys.push.apply(keys, kr.result); };
        t.oncomplete = res; t.onerror = res; t.onabort = res;
      });
      for (const k of keys) {
        const rec = await new Promise(res => {
          const t = d.transaction('hums', 'readonly');
          const r = t.objectStore('hums').get(k);
          r.onsuccess = () => res(r.result); t.onerror = () => res(null);
        });
        if (rec) hums[k] = { sr: rec.sr, pcm: Array.from(rec.pcm) };
      }
    }
    return { ls: ls, hums: hums };
  });

  // the stored takes are trimmed to a second and a half on the way into the
  // fixture: the record's shape is what the upgrade has to survive, not its length
  const out = path.join(__dirname, 'fixtures', 'review-v100.json');
  Object.keys(dump.hums).forEach(k => { dump.hums[k].pcm = dump.hums[k].pcm.slice(0, 24000); });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(dump));
  const parsed = JSON.parse(dump.ls);
  log('captured localStorage bytes:', dump.ls.length);
  log('projects:', parsed.projects.length,
      'scenes:', parsed.projects[0].scenes.length,
      'layers:', parsed.projects[0].scenes.reduce((n, s) => n + s.layers.length, 0));
  log('layer keys:', Object.keys(parsed.projects[0].scenes[0].layers[0]).join(','));
  log('hums captured:', Object.keys(dump.hums).length);
  log('written to', out);
  log('page errors:', errors.length);
};
