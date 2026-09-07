/* A plain look at every surface with real content in it, for the design read.
   Run it again with --reduced-motion and at a short viewport: the shapes must
   survive both. */
const { installHum, URL } = require('./review-lib');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  await installHum(page, URL);
  await wait(700);
  await shot('01-intro');
  await click('#introGo');
  await wait(400);
  await shot('02-pad-empty');

  await page.evaluate(() => Store.set('countIn', 4));
  await click('#pad');
  await wait(1500);
  await shot('03-countin');
  await wait(4200);
  await shot('04-recording');
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2800);
  await shot('05-one-layer');

  await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#shelf .vtile'),
    e => e.getAttribute('data-v') === 'kit').click());
  await click('#pad');
  await wait(14000);
  await shot('06-two-layers');
  await page.evaluate(() => document.querySelector('#layerStrip .lchip').click());
  await wait(400);
  await shot('07-one-muted');
  await page.evaluate(() => document.querySelector('#layerStrip .lchip').click());
  await wait(300);

  await page.evaluate(() => App.openLayerSheet(Store.current(App.project()).layers[0].id));
  await wait(500);
  await shot('08-layer-sheet');
  await page.evaluate(() => App.back());
  await click('#tbKey');
  await wait(500);
  await shot('09-key-sheet');
  await page.evaluate(() => App.back());

  await click('#btnScene');
  await wait(600);
  await page.evaluate(() => App.setView('arrange'));
  await wait(400);
  await shot('10-arrange-empty');
  await click('#shapeBtn');
  await wait(3200);
  await shot('11-arrange-full');

  await page.evaluate(() => App.setView('library'));
  await wait(600);
  await shot('12-library');
  await page.evaluate(() => document.querySelector('#v-library .scroller').scrollTop = 620);
  await wait(400);
  await shot('13-settings');

  // the empty library, which is what a fresh phone shows
  await page.evaluate(() => { localStorage.removeItem('loopwright.v1'); });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(900);
  await page.evaluate(() => { App.sheet('#introSheet', false); App.setView('library'); });
  await wait(500);
  await shot('14-library-empty');
  log('page errors:', errors.length);
};
