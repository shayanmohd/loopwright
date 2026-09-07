/* Edges. Rapid double taps on everything that creates something, an empty and a
   very long name, the eight layer and eight scene ceilings, an arrangement long
   enough to sink an offline render, deleting the song that is open, erasing
   everything, and switching screens faster than anything can finish. */
const { installHum, URL, MOCK_NATIVE } = require('./review-lib');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  await installHum(page, URL);
  await wait(700);
  await click('#introGo');
  await wait(300);
  await page.evaluate(() => Store.set('countIn', 0));

  const dbl = sel => page.evaluate(s => {
    const el = document.querySelector(s);
    el.click(); el.click();
  }, sel);

  // a fumbled double tap on the pad must not arm two takes
  await dbl('#pad');
  await wait(1500);
  log('after a double tap on the pad, note reads:',
      JSON.stringify(await page.evaluate(() => document.querySelector('#padNote').textContent)));
  log('pad shows:', await page.evaluate(() => document.querySelector('#padBig').textContent));
  await wait(4200);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2800);
  log('layers after the double tap take:',
      await page.evaluate(() => Store.current(App.project()).layers.length));

  // double tap on copy scene, on new scene, on new song
  await dbl('#btnScene');
  await wait(900);
  log('scenes after a double tap on copy scene (want 2):',
      await page.evaluate(() => App.project().scenes.length));
  await page.evaluate(() => {
    const el = Array.prototype.find.call(document.querySelectorAll('#sceneRow .scenechip'), e => e.getAttribute('data-add'));
    el.click(); el.click();
  });
  await wait(900);
  log('scenes after a double tap on new scene (want 3):',
      await page.evaluate(() => App.project().scenes.length));

  // the ceilings
  await page.evaluate(() => {
    const p = App.project();
    while (p.scenes.length < 8) Store.addScene(p, p.scenes[0]);
    App.renderPad();
  });
  await wait(300);
  await page.evaluate(() => {
    const el = Array.prototype.find.call(document.querySelectorAll('#sceneRow .scenechip'), e => e.getAttribute('data-add'));
    el.click();
  });
  await wait(500);
  log('scene ceiling holds at', await page.evaluate(() => App.project().scenes.length),
      '| said:', JSON.stringify(await page.evaluate(() => document.querySelector('#toast').textContent)));
  await shot('01-scene-ceiling');

  await page.evaluate(() => {
    const p = App.project();
    const sc = Store.current(p);
    const src = sc.layers[0];
    while (sc.layers.length < 8) Store.addLayer(p, sc, JSON.parse(JSON.stringify({
      kind: src.kind, voice: src.voice, src: src.src, swing: src.swing, octave: src.octave,
      tighten: src.tighten, hum: null, humDur: 0
    })));
    App.renderPad();
  });
  await wait(400);
  await shot('02-eight-layers');
  log('pad face at eight layers:', await page.evaluate(() => document.querySelector('#padBig').textContent));
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(1200);
  log('tapping a full pad says:', JSON.stringify(await page.evaluate(() => document.querySelector('#padNote').textContent)));
  log('layers still:', await page.evaluate(() => Store.current(App.project()).layers.length));

  // names: empty, spaces, very long, markup
  await click('#tbTitle'); await wait(300);
  await page.evaluate(() => { document.querySelector('#nsInput').value = '   '; });
  await click('#nsSave'); await wait(300);
  log('a whitespace name falls back to:', await page.evaluate(() => Store.title(App.project())));
  await click('#tbTitle'); await wait(300);
  await page.evaluate(() => {
    const i = document.querySelector('#nsInput');
    i.value = '<img src=x onerror=alert(1)> ' + 'very long name '.repeat(6);
  });
  await click('#nsSave'); await wait(400);
  await shot('03-long-name');
  log('long name stored as:', JSON.stringify((await page.evaluate(() => Store.title(App.project()))).slice(0, 50)));
  log('topbar did not break:', await page.evaluate(() =>
    document.querySelector('#topbar').getBoundingClientRect().height));
  log('no injected node:', await page.evaluate(() => !document.querySelector('#topbar img')));

  // an arrangement too long to render
  await page.evaluate(() => App.setView('arrange'));
  await wait(400);
  await page.evaluate(() => {
    const p = App.project();
    p.strip = [];
    for (let i = 0; i < 8; i++) p.strip.push({ scene: p.scenes[i % p.scenes.length].id, repeats: 16 });
    Store.touch(p); App.renderArrange();
  });
  await wait(400);
  await click('#playSong');
  await wait(900);
  await shot('04-too-long');
  log('play refuses inline:', JSON.stringify(await page.evaluate(() => document.querySelector('#songErr').textContent)));
  log('refusal is visible:', await page.evaluate(() => !document.querySelector('#songErr').hidden));
  await click('#exportMix');
  await wait(900);
  log('export refuses inline:', JSON.stringify(await page.evaluate(() => document.querySelector('#exportNote').textContent)));
  await click('#exportStems');
  await wait(900);
  log('stems refuse inline:', JSON.stringify(await page.evaluate(() => document.querySelector('#exportNote').textContent)));
  log('busy overlay is not stuck:', await page.evaluate(() => document.querySelector('#busy').hidden));

  // rapid screen switching while something is playing
  await page.evaluate(() => { App.project().strip = [{ scene: App.project().scenes[0].id, repeats: 2 }]; Store.touch(App.project()); App.renderArrange(); });
  await wait(300);
  await click('#playSong');
  await wait(500);
  for (const v of ['pad', 'library', 'arrange', 'pad', 'arrange', 'library']) {
    await page.evaluate(x => App.setView(x), v);
    await wait(90);
  }
  await wait(600);
  await shot('05-after-fast-switching');
  log('after fast switching, view:', await page.evaluate(() =>
    Array.prototype.filter.call(document.querySelectorAll('.view'), v => !v.hidden).map(v => v.id).join()));

  // delete the song that is open, then reload
  await page.evaluate(() => { App.setView('library'); });
  await wait(500);
  await page.evaluate(() => {
    const p = Store.create();       // a second song, so there is something to fall back to
    p.title = 'Second song';
    Store.touch(p);
  });
  await page.evaluate(() => App.renderLibrary());
  await wait(400);
  const openId = await page.evaluate(() => App.project().id);
  await page.evaluate(id => {
    const b = document.querySelector('[data-del="' + id + '"]');
    b.click(); b.click();
  }, openId);
  await wait(800);
  await shot('06-deleted-open-song');
  const afterDel = await page.evaluate(() => ({ open: App.project().id, last: Store.lastOpen(), n: Store.projects().length }));
  log('after deleting the open song:', JSON.stringify(afterDel));
  log('lastOpen points at the song on screen:', afterDel.open === afterDel.last);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1200);
  log('reload opens the same song:', await page.evaluate(() => App.project().id) === afterDel.open);

  // erase everything, twice armed
  await page.evaluate(() => App.setView('library'));
  await wait(400);
  await page.evaluate(() => { const b = document.querySelector('#eraseBtn'); b.click(); b.click(); });
  await wait(700);
  await shot('07-erased');
  log('after erase, songs:', await page.evaluate(() => Store.projects().length),
      '| layers:', await page.evaluate(() => Store.layerCount(App.project())));
  log('library empty state drawn:', await page.evaluate(() => !!document.querySelector('#cards .blank svg')));
  log('lede:', JSON.stringify(await page.evaluate(() => document.querySelector('#libLede').textContent)));

  // double tap on start a new song
  await page.evaluate(() => { const b = document.querySelector('#newSong'); b.click(); b.click(); });
  await wait(700);
  log('songs after a double tap on start a new song:', await page.evaluate(() => Store.projects().length));
  log('page errors:', errors.length);
};
