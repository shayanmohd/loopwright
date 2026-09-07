/* Reviewer pass 1. First run to a finished song and back again: intro, a hummed
   first take through the synthesised voice, a beatboxed overdub through Chrome's
   own beep device, mute, the layer sheet, a scene copy, the arrange strip, an
   export over a mocked Native bridge, the library, and a reload that must lose
   nothing. Zero page errors is the pass mark. */
const { installHum, URL, MOCK_NATIVE } = require('./review-lib');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  const st = () => page.evaluate(() => ({
    pad: document.querySelector('#padBig').textContent,
    layers: Store.current(App.project()).layers.length,
    scenes: App.project().scenes.length,
    bpm: Math.round(App.project().bpm), beats: App.project().beats,
    key: Store.keyName(App.project()),
    note: document.querySelector('#padNote').textContent
  }));
  // a horizontal scroller is allowed to hold content past the edge; the page itself is not
  const overflow = () => page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - innerWidth,
    body: document.body.scrollWidth - innerWidth
  }));

  await installHum(page, URL);
  await wait(700);
  await shot('01-intro');
  log('intro shown:', await page.evaluate(() => !document.querySelector('#introSheet').hidden));

  await click('#introGo');
  await wait(500);
  await shot('02-empty-pad');
  log('empty pad', JSON.stringify(await st()));
  log('horizontal overflow on pad:', JSON.stringify(await overflow()));

  // first take: hummed melody, closed by hand
  await page.evaluate(() => Store.set('countIn', 4));
  await click('#pad');
  await wait(1200);
  await shot('03-countin');
  await wait(1800);
  await shot('04-recording');
  await wait(3600);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2800);
  await shot('05-first-layer');
  log('after first take', JSON.stringify(await st()));

  // overdub drums on Chrome's own beep device
  await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
  await page.evaluate(() => {
    Array.prototype.find.call(document.querySelectorAll('#shelf .vtile'),
      e => e.getAttribute('data-v') === 'kit').click();
  });
  await wait(400);
  await click('#pad');
  await wait(2000);
  await shot('06-overdub-countin');
  await wait(11000);
  await shot('07-two-layers');
  log('after overdub', JSON.stringify(await st()));
  log('overflow with layers:', JSON.stringify(await overflow()));

  // mute by tapping the chip, then by tapping the ring segment
  await page.evaluate(() => document.querySelector('#layerStrip .lchip').click());
  await wait(400);
  await shot('08-muted');
  log('chip mute ->', await page.evaluate(() => Store.current(App.project()).layers[0].muted));
  await page.evaluate(() => document.querySelector('#ring [data-layer]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await wait(400);
  log('segment mute ->', await page.evaluate(() => Store.current(App.project()).layers[0].muted));

  await page.evaluate(() => App.openLayerSheet(Store.current(App.project()).layers[0].id));
  await wait(500);
  await shot('09-layer-sheet');
  log('back from sheet:', await page.evaluate(() => App.back()));
  await wait(300);

  await click('#btnScene');
  await wait(600);
  await shot('10-scene-copied');
  log('scenes now', await page.evaluate(() => App.project().scenes.length));

  await page.evaluate(() => App.setView('arrange'));
  await wait(400);
  await click('#shapeBtn');
  await wait(700);
  await shot('11-arrange');
  log('strip', await page.evaluate(() => JSON.stringify(App.project().strip)));
  log('overflow on arrange:', JSON.stringify(await overflow()));

  // play the song, then stop it
  await click('#playSong');
  await wait(6000);
  await shot('12-song-playing');
  log('song err text:', await page.evaluate(() => document.querySelector('#songErr').textContent));
  await page.evaluate(() => App.back());
  await wait(300);

  await page.evaluate(MOCK_NATIVE);
  await click('#exportMix');
  await wait(10000);
  await shot('13-exported');
  log('saved', await page.evaluate(() => JSON.stringify((window.__saved || []).map(s => ({ n: s.n, m: s.m, bytes: Math.round(s.b64.length * 3 / 4) })))));

  await page.evaluate(() => App.setView('library'));
  await wait(700);
  await shot('14-library');
  log('overflow on library:', JSON.stringify(await overflow()));

  // key sheet, named song
  await page.evaluate(() => App.setView('pad'));
  await wait(300);
  await click('#tbKey');
  await wait(400);
  await shot('15-key-sheet');
  await page.evaluate(() => App.back());
  await click('#tbTitle');
  await wait(400);
  await page.type('#nsInput', 'Kitchen loop');
  await shot('16-name-sheet');
  await click('#nsSave');
  await wait(400);
  log('title now', await page.evaluate(() => Store.title(App.project())));

  const before = await page.evaluate(() => localStorage.getItem('loopwright.v1'));
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1600);
  await shot('17-after-reload');
  log('after reload', JSON.stringify(await st()));
  log('store byte identical after reload:',
    before === (await page.evaluate(() => localStorage.getItem('loopwright.v1'))));
  log('title survives:', await page.evaluate(() => Store.title(App.project())));

  const ab = await page.evaluate(async () => {
    const p = Store.projects()[0];
    let l = null;
    p.scenes.forEach(s => s.layers.forEach(x => { if (!l && x.hum) l = x; }));
    if (!l) return 'no hum stored';
    const rec = await Hums.get(l.hum);
    return rec && rec.pcm ? 'hum ' + rec.pcm.length + ' samples at ' + rec.sr : 'hum missing';
  });
  log('stored take survives reload:', ab);
  await page.evaluate(() => App.setView('library'));
  await wait(700);
  await shot('18-library-reload');
  log('page errors:', errors.length);
};
