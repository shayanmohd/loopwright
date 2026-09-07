/* Runs the shipped 1.0.0 build and writes what it actually stores to
   test/fixtures/v100-store.json, so the upgrade test seeds real 1.0.0 bytes
   rather than a guess at their shape. Only ever run against the 1.0.0 tree. */
const fs = require('fs');
const path = require('path');
const { installHum, URL } = require('./lib/mic');

module.exports = async ({ page, wait, click, log }) => {
  await installHum(page, URL);
  await wait(500);
  await click('#introGo');
  await wait(400);

  // one melodic take
  await page.evaluate(() => Store.set('countIn', 2));
  await click('#pad');
  await wait(6000);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2500);

  // one drum overdub on Chrome's own beep device
  await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
  await page.evaluate(() => {
    Array.prototype.find.call(document.querySelectorAll('#shelf .vtile'), e => e.getAttribute('data-v') === 'card').click();
  });
  await click('#pad');
  await wait(12000);

  // a second scene, a strip, a title, changed settings
  await page.evaluate(() => {
    document.querySelector('#btnScene').click();
    App.project().title = 'Bus Window';
    App.suggestShape();
    Store.set('tighten', 0.6);
    Store.set('countIn', 8);
    Store.set('haptics', false);
  });
  await wait(600);
  await page.evaluate(() => { App.setView('library'); document.querySelector('#newSong').click(); });
  await wait(500);

  const dump = await page.evaluate(async () => {
    const store = localStorage.getItem('loopwright.v1');
    const hums = await new Promise(res => {
      const out = [];
      const req = indexedDB.open('loopwright', 1);
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction('hums', 'readonly');
        const st = t.objectStore('hums');
        const c = st.openCursor();
        c.onsuccess = e => {
          const cur = e.target.result;
          if (!cur) return;
          out.push({ key: cur.key, sr: cur.value.sr, pcm: Array.from(cur.value.pcm) });
          cur.continue();
        };
        t.oncomplete = () => res(out);
        t.onerror = () => res(out);
      };
      req.onerror = () => res([]);
    });
    return { store, hums };
  });
  const file = path.join(__dirname, 'fixtures', 'v100-store.json');
  fs.writeFileSync(file, JSON.stringify(dump));
  const d = JSON.parse(dump.store);
  log('captured', d.projects.length, 'projects,', dump.hums.length, 'hums ->', file);
  log('shape:', Object.keys(d).join(','), '| project keys:', Object.keys(d.projects[0]).join(','));
  log('layer keys:', Object.keys(d.projects[0].scenes[0].layers[0] || {}).join(','));
};
