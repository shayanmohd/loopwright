/* First run to a finished song: intro, guided first take through the fake hum,
   a beatbox overdub through Chrome's own beep device, mute, scene copy, arrange,
   export through a mocked Native bridge, and a reload that must lose nothing. */
const { installHum, URL } = require('./lib/mic');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  const st = () => page.evaluate(() => ({
    pad: document.querySelector('#padBig').textContent,
    layers: Store.current(App.project()).layers.length,
    bpm: Math.round(App.project().bpm), beats: App.project().beats,
    key: Store.keyName(App.project()),
    note: document.querySelector('#padNote').textContent
  }));

  await installHum(page, URL);
  await wait(600);
  await shot('01-intro');
  log('intro visible:', await page.evaluate(() => !document.querySelector('#introSheet').hidden));

  await click('#introGo');
  await wait(500);
  await shot('02-empty-pad');
  log('empty state', JSON.stringify(await st()));

  await page.evaluate(() => Store.set('countIn', 4));
  await click('#pad');
  await wait(1300);
  await shot('03-countin');
  await wait(1600);
  await shot('04-recording');
  await wait(3600);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2600);
  await shot('05-first-layer');
  log('after first take', JSON.stringify(await st()));

  // Overdub drums. Chrome's own beep device is a clean half-second pulse train.
  await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
  await page.evaluate(() => {
    Array.prototype.find.call(document.querySelectorAll('#shelf .vtile'), e => e.getAttribute('data-v') === 'kit').click();
  });
  await wait(300);
  await shot('06-kit-selected');
  await click('#pad');
  await wait(2000);
  await shot('07-overdub-countin');
  await wait(11000);
  await shot('08-two-layers');
  log('after overdub', JSON.stringify(await st()));

  await page.evaluate(() => document.querySelector('#layerStrip .lchip').click());
  await wait(500);
  await shot('09-muted');
  log('muted?', await page.evaluate(() => Store.current(App.project()).layers[0].muted));

  await page.evaluate(() => App.openLayerSheet(Store.current(App.project()).layers[0].id));
  await wait(500);
  await shot('10-layer-sheet');
  await page.evaluate(() => App.back());
  await wait(300);

  await click('#btnScene');
  await wait(500);
  await shot('11-scene-copied');

  await page.evaluate(() => App.setView('arrange'));
  await wait(400);
  await click('#shapeBtn');
  await wait(700);
  await shot('12-arrange');
  log('strip', await page.evaluate(() => JSON.stringify(App.project().strip)));

  await page.evaluate(() => {
    window.__saved = [];
    window.Native = {
      isNative: true,
      saveFile: (n, m, b64) => { window.__saved.push({ n: n, m: m, bytes: Math.round(b64.length * 3 / 4) }); return 'content://x/' + n; },
      vibrate: function () {}, shareUri: function () {}
    };
  });
  await click('#exportMix');
  await wait(9000);
  await shot('13-exported');
  log('saved', await page.evaluate(() => JSON.stringify(window.__saved)));

  await page.evaluate(() => App.setView('library'));
  await wait(600);
  await shot('14-library');

  const before = await page.evaluate(() => localStorage.getItem('loopwright.v1'));
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1500);
  await shot('15-after-reload');
  log('after reload', JSON.stringify(await st()));
  log('store identical after reload:', before === (await page.evaluate(() => localStorage.getItem('loopwright.v1'))));

  await page.evaluate(() => App.setView('library'));
  await wait(600);
  await shot('16-library-reload');

  // and the hum survives too: the A/B toggle needs the recording back out of IndexedDB
  const ab = await page.evaluate(async () => {
    const p = Store.projects()[0];
    const l = p.scenes[0].layers.find(x => x.hum);
    if (!l) return 'no hum stored';
    const rec = await Hums.get(l.hum);
    return rec && rec.pcm ? 'hum ' + rec.pcm.length + ' samples at ' + rec.sr : 'hum missing';
  });
  log('A/B recording:', ab);
  log('page errors:', errors.length);
};
