/* Edges: empty exports, the back gesture on every nested surface, pause and resume,
   rapid double taps, long and empty titles, duplicate names, the key sheet with
   nothing recorded, tap tempo, and erase everything. */
const { installHum, URL } = require('./lib/mic');

module.exports = async ({ page, shot, wait, click, type, log, errors }) => {
  await installHum(page, URL);
  await wait(500);
  await page.evaluate(() => { Store.markIntro(); Store.setGuide(5); document.querySelector('#introSheet').hidden = true; App.setView('pad'); });
  await wait(300);

  // --- back() must be false only at the root -------------------------------
  const backAtRoot = await page.evaluate(() => App.back());
  log('back() at pad root (want false):', backAtRoot);

  for (const v of ['arrange', 'library']) {
    const r = await page.evaluate(v => { App.setView(v); return App.back(); }, v);
    log('back() from ' + v + ' (want true):', r);
  }
  const sheets = await page.evaluate(async () => {
    const out = {};
    App.setView('pad');
    App.openKeySheet(); out.key = App.back();
    App.sheet('#nameSheet', true); out.name = App.back();
    App.sheet('#introSheet', true); out.intro = App.back();
    return out;
  });
  log('back() closes sheets (want all true):', JSON.stringify(sheets));

  // --- empty state exports and plays --------------------------------------
  await page.evaluate(() => App.setView('arrange'));
  await wait(300);
  await shot('20-arrange-empty');
  await click('#playSong'); await wait(400);
  await click('#exportMix'); await wait(400);
  await click('#exportStems'); await wait(400);
  await click('#shapeBtn'); await wait(600);
  await shot('21-arrange-empty-after-taps');
  log('toast:', await page.evaluate(() => document.querySelector('#toast').textContent));

  await page.evaluate(() => App.setView('library'));
  await wait(300);
  await shot('22-library-empty');

  // --- key sheet with nothing recorded ------------------------------------
  await page.evaluate(() => { App.setView('pad'); App.openKeySheet(); });
  await wait(300);
  await shot('23-key-sheet-empty');
  await page.evaluate(() => {
    document.querySelector('#ksTonics button[data-t="3"]').click();
    document.querySelector('#keySheet .mode[data-mode="major"]').click();
    for (let i = 0; i < 6; i++) document.querySelector('#ksFaster').click();
    for (let i = 0; i < 40; i++) document.querySelector('#ksSlower').click();
  });
  await wait(300);
  await shot('24-key-sheet-edges');
  log('bpm after 40 slower taps (floor is 50):', await page.evaluate(() => App.project().bpm));
  log('key now:', await page.evaluate(() => Store.keyName(App.project())));

  // tap tempo, four taps at 500ms
  for (let i = 0; i < 4; i++) { await page.evaluate(() => document.querySelector('#ksTap').click()); await wait(500); }
  log('tap tempo says:', await page.evaluate(() => document.querySelector('#ksTapNote').textContent));
  await shot('25-tap-tempo');
  await page.evaluate(() => App.back());

  // --- titles: empty, very long, duplicate --------------------------------
  await page.evaluate(() => { App.project().title = ''; });
  await page.evaluate(() => document.querySelector('#tbTitle').click());
  await wait(300);
  await type('#nsInput', 'A'.repeat(80));
  await click('#nsSave');
  await wait(300);
  log('title length after typing 80 chars:', await page.evaluate(() => App.project().title.length));
  await shot('26-long-title');

  await page.evaluate(() => document.querySelector('#tbTitle').click());
  await wait(200);
  await page.evaluate(() => { document.querySelector('#nsInput').value = '   '; document.querySelector('#nsSave').click(); });
  await wait(300);
  log('title after whitespace-only:', JSON.stringify(await page.evaluate(() => App.project().title)));
  log('shown title:', await page.evaluate(() => document.querySelector('#tbTitleText').textContent));

  // --- rapid double taps on every primary button --------------------------
  await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
  await page.evaluate(() => Store.set('countIn', 2));
  // record one drum layer so overdubs are possible
  await page.evaluate(() => {
    const t = Array.prototype.find.call(document.querySelectorAll('#shelf .vtile'), e => e.getAttribute('data-v') === 'kit');
    t.click();
  });
  await click('#pad'); await wait(9000);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(3000);
  log('layers after one drum take:', await page.evaluate(() => Store.current(App.project()).layers.length));
  await shot('27-drum-layer');

  // now double tap the pad fast: a second take must not start on top of the first
  await page.evaluate(() => { const p = document.querySelector('#pad'); p.click(); p.click(); p.click(); });
  await wait(1500);
  await shot('28-rapid-pad-taps');
  log('pad face after triple tap:', await page.evaluate(() => document.querySelector('#padBig').textContent + ' / ' + document.querySelector('#padSub').textContent));
  log('padNote:', await page.evaluate(() => document.querySelector('#padNote').textContent));
  await page.evaluate(() => App.back());
  await wait(600);

  await page.evaluate(() => { const b = document.querySelector('#btnPlay'); b.click(); b.click(); b.click(); });
  await wait(1200);
  log('playing after triple play tap:', await page.evaluate(() => Engine.playing()));
  await shot('29-triple-play');

  await page.evaluate(() => { const b = document.querySelector('#btnScene'); b.click(); b.click(); });
  await wait(400);
  log('scenes after double copy:', await page.evaluate(() => App.project().scenes.length));

  await page.evaluate(() => { const b = document.querySelector('#btnUndo'); b.click(); b.click(); b.click(); });
  await wait(400);
  log('layers after triple undo:', await page.evaluate(() => Store.current(App.project()).layers.length));
  await shot('30-after-undo');

  // --- pause and resume ----------------------------------------------------
  await page.evaluate(() => Engine.play(App.project(), App.project().openScene));
  await wait(800);
  const paused = await page.evaluate(() => {
    App.onPause();
    return { playing: Engine.playing(), recording: Engine.recording(), ctx: Engine.ready().state };
  });
  log('after onPause:', JSON.stringify(paused));
  await page.evaluate(() => App.onResume());
  await wait(400);
  log('after onResume, ctx:', await page.evaluate(() => Engine.ready().state));

  // --- rotating through screens quickly ------------------------------------
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) { App.setView(['pad', 'arrange', 'library'][i % 3]); }
  });
  await wait(500);
  await shot('31-after-fast-switching');

  // --- erase everything -----------------------------------------------------
  await page.evaluate(() => App.setView('library'));
  await wait(300);
  await page.evaluate(() => { const b = document.querySelector('#eraseBtn'); b.click(); b.click(); });
  await wait(600);
  await shot('32-erased');
  log('projects after erase:', await page.evaluate(() => Store.projects().length));
  log('page errors:', errors.length);
};
