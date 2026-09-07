/* A quick look at the surfaces that carry the identity, populated from the
   1.0.0 fixture, with no recording needed. */
const fs = require('fs');
const path = require('path');

module.exports = async ({ page, shot, wait, log, errors }) => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'v100-store.json'), 'utf8'));
  const seed = JSON.parse(fx.store);
  seed.lastOpen = seed.projects.find(p => p.scenes.some(s => s.layers.length)).id;
  seed.guide = 5;
  await page.evaluateOnNewDocument(store => localStorage.setItem('loopwright.v1', store), JSON.stringify(seed));
  await page.goto('http://127.0.0.1:8825/index.html', { waitUntil: 'networkidle0' });
  await wait(900);
  await shot('60-pad');
  await page.evaluate(() => App.setView('arrange')); await wait(600); await shot('61-arrange');
  await page.evaluate(() => App.setView('library')); await wait(600); await shot('62-library');
  await page.evaluate(() => { document.querySelector('#v-library .scroller').scrollTop = 460; }); await wait(300); await shot('63-settings');
  await page.evaluate(() => { App.setView('pad'); App.openLayerSheet(Store.current(App.project()).layers[0].id); }); await wait(500); await shot('64-layer-sheet');
  await page.evaluate(() => { App.back(); App.openKeySheet(); }); await wait(500); await shot('65-key-sheet');
  await page.evaluate(() => { App.back(); App.sheet('#introSheet', true); }); await wait(500); await shot('66-intro');
  await page.evaluate(() => { App.back(); Store.eraseAll(); location.reload(); }); await wait(1400);
  await page.evaluate(() => { document.querySelector('#introSheet').hidden = true; App.setView('arrange'); }); await wait(500); await shot('67-arrange-empty');
  await page.evaluate(() => App.setView('library')); await wait(500); await shot('68-library-empty');
  log('page errors:', errors.length);
};
