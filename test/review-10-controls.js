/* The controls that change a recorded layer while the loop is running: the key,
   the tempo, the voice, the octave, chords, the compare toggle, the tighten
   slider, delete and undo. Each one must change the stored song, keep the
   transport alive and leave the audio renderable. */
const { installHum, URL } = require('./review-lib');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  await installHum(page, URL);
  await wait(700);
  await click('#introGo');
  await page.evaluate(() => Store.set('countIn', 0));
  await click('#pad'); await wait(5400);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2800);
  const layers = () => page.evaluate(() => Store.current(App.project()).layers.length);
  log('layers:', await layers(), '| playing:', await page.evaluate(() => Engine.playing()));

  const render = () => page.evaluate(async () => {
    const b = await Engine.layerBuffer(App.project(), Store.current(App.project()).layers[0], 44100);
    let peak = 0; const ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i += 97) peak = Math.max(peak, Math.abs(ch[i]));
    return +peak.toFixed(3);
  });

  // key and mode
  await click('#tbKey'); await wait(300);
  await page.evaluate(() => document.querySelector('#ksTonics [data-t="2"]').click());
  await wait(500);
  log('key now', await page.evaluate(() => Store.keyName(App.project())),
      '| topbar says', await page.evaluate(() => document.querySelector('#tbKeyName').textContent),
      '| layer still renders at peak', await render());
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#keySheet .mode'),
    e => e.getAttribute('data-mode') === 'major').click());
  await wait(500);
  log('mode now', await page.evaluate(() => Store.keyName(App.project())), '| peak', await render());
  await click('#ksFaster'); await click('#ksFaster');
  await wait(400);
  log('tempo now', await page.evaluate(() => Math.round(App.project().bpm)),
      '| playing:', await page.evaluate(() => Engine.playing()));
  for (let i = 0; i < 4; i++) { await click('#ksTap'); await wait(430); }
  log('tap tempo:', await page.evaluate(() => document.querySelector('#ksTapNote').textContent));
  await shot('01-key-sheet');
  await page.evaluate(() => App.back());
  await wait(300);

  // the layer sheet's own controls
  await page.evaluate(() => App.openLayerSheet(Store.current(App.project()).layers[0].id));
  await wait(400);
  await click('#lsOctDown'); await wait(400);
  await click('#lsOctUp'); await click('#lsOctUp'); await wait(500);
  log('octave now', await page.evaluate(() => Store.current(App.project()).layers[0].octave),
      '| peak', await render());
  await page.evaluate(() => { const c = document.querySelector('#lsChords'); c.checked = true; c.dispatchEvent(new Event('change')); });
  await wait(700);
  log('chords on:', await page.evaluate(() => Store.current(App.project()).layers[0].chords),
      '| events now', await page.evaluate(() => Engine.derive(App.project(), Store.current(App.project()).layers[0]).length));
  await page.evaluate(() => {
    const r = document.querySelector('#lsTight'); r.value = '10';
    r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));
  });
  await wait(600);
  log('tighten now', await page.evaluate(() => Store.current(App.project()).layers[0].tighten),
      '| peak', await render());
  await page.evaluate(() => {
    const r = document.querySelector('#lsVol'); r.value = '35'; r.dispatchEvent(new Event('input'));
  });
  await wait(400);
  log('volume now', await page.evaluate(() => Store.current(App.project()).layers[0].vol));
  const hasHum = await page.evaluate(() => !!Store.current(App.project()).layers[0].hum);
  if (hasHum) {
    await page.evaluate(() => { const c = document.querySelector('#lsAb'); c.checked = true; c.dispatchEvent(new Event('change')); });
    await wait(900);
    log('compare on:', await page.evaluate(() => Store.current(App.project()).layers[0].ab),
        '| the recorded take renders at peak', await render());
    await page.evaluate(() => { const c = document.querySelector('#lsAb'); c.checked = false; c.dispatchEvent(new Event('change')); });
    await wait(700);
  } else log('no stored take on this layer');
  // change the voice from the sheet
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#lsVoices .vtile'),
    e => e.getAttribute('data-v') === 'glass').click());
  await wait(800);
  log('voice now', await page.evaluate(() => Store.current(App.project()).layers[0].voice),
      '| peak', await render());
  await shot('02-layer-sheet-changed');
  await click('#lsDelete');
  await wait(600);
  log('after delete, layers:', await layers(), '| playing:', await page.evaluate(() => Engine.playing()));

  // undo on an empty scene must not throw
  await page.evaluate(() => document.querySelector('#btnUndo').click());
  await wait(400);
  log('undo with nothing left, layers:', await layers());
  await shot('03-back-to-empty');
  log('page errors:', errors.length);
};
