/* window.App.back() on every nested surface, and the shell's pause and resume.
   back() must consume the gesture on a sheet, a running take, a playing song and
   a non-root tab, and only refuse at the root. onPause must stop the clock, the
   mic and the take; onResume must bring the clock back without throwing. */
const { installHum, URL } = require('./review-lib');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  await installHum(page, URL);
  await wait(700);

  const back = () => page.evaluate(() => App.back());
  const state = () => page.evaluate(() => ({
    sheet: Array.prototype.filter.call(document.querySelectorAll('.sheet'), s => !s.hidden).map(s => s.id),
    view: Array.prototype.filter.call(document.querySelectorAll('.view'), v => !v.hidden).map(v => v.id),
    busy: !document.querySelector('#busy').hidden
  }));

  log('intro sheet open, back ->', await back(), JSON.stringify(await state()));
  log('intro marked seen:', await page.evaluate(() => Store.seenIntro()));
  log('root, back ->', await back());

  // record something so the nested surfaces have content
  await page.evaluate(() => Store.set('countIn', 0));
  await click('#pad');
  await wait(1400);
  log('mid take, back ->', await back(), '| padState idle again:',
      await page.evaluate(() => document.querySelector('#padBig').textContent));
  await wait(500);

  await click('#pad');
  await wait(5200);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2600);
  log('layers:', await page.evaluate(() => Store.current(App.project()).layers.length));

  await page.evaluate(() => App.openLayerSheet(Store.current(App.project()).layers[0].id));
  await wait(300);
  log('layer sheet, back ->', await back(), JSON.stringify(await state()));
  await click('#tbKey'); await wait(300);
  log('key sheet, back ->', await back(), JSON.stringify(await state()));
  await click('#tbTitle'); await wait(300);
  log('name sheet, back ->', await back(), JSON.stringify(await state()));

  await page.evaluate(() => App.setView('arrange'));
  await wait(300);
  log('on arrange, back ->', await back(), JSON.stringify(await state()));
  await page.evaluate(() => App.setView('library'));
  await wait(300);
  log('on library, back ->', await back(), JSON.stringify(await state()));
  log('back at root ->', await back());

  // a playing song is consumed by back before the tab is
  await page.evaluate(() => App.setView('arrange'));
  await wait(300);
  await click('#playSong');
  await wait(5000);
  log('song playing:', await page.evaluate(() => document.querySelector('#playSong').textContent));
  log('song playing, back ->', await back(),
      '| button now:', await page.evaluate(() => document.querySelector('#playSong').textContent));
  await page.evaluate(() => App.setView('pad'));
  await wait(300);

  // pause and resume, including in the middle of a take
  await page.evaluate(() => document.querySelector('#btnPlay').click());
  await wait(1200);
  const ctxBefore = await page.evaluate(() => Engine.ready().state + '/' + Engine.playing());
  const pause = await page.evaluate(() => { try { App.onPause(); return 'ok'; } catch (e) { return 'threw ' + e.message; } });
  await wait(500);
  const ctxPaused = await page.evaluate(() => Engine.ready ? (Engine.playing() + '') : '?');
  const rawState = await page.evaluate(() => {
    const C = window.AudioContext; return 'checked';
  });
  const resume = await page.evaluate(() => { try { App.onResume(); return 'ok'; } catch (e) { return 'threw ' + e.message; } });
  await wait(600);
  log('before pause (ctx/playing):', ctxBefore);
  log('onPause:', pause, '| transport after pause:', ctxPaused);
  log('onResume:', resume, '| ctx after resume:', await page.evaluate(() => Engine.ready().state));
  log('mic released:', await page.evaluate(() => !Engine.recording()));

  await click('#pad');
  await wait(900);
  log('pause during a take:', await page.evaluate(() => { try { App.onPause(); return 'ok'; } catch (e) { return 'threw ' + e.message; } }));
  await wait(700);
  log('pad state after pause:', await page.evaluate(() => document.querySelector('#padBig').textContent));
  log('resume after that:', await page.evaluate(() => { try { App.onResume(); return 'ok'; } catch (e) { return 'threw ' + e.message; } }));
  await wait(500);
  await shot('01-after-pause-resume');

  // and the pad still works afterwards
  await click('#pad');
  await wait(5200);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2600);
  log('layers after a pause and resume cycle:',
      await page.evaluate(() => Store.current(App.project()).layers.length));
  await shot('02-recording-after-resume');

  // the browser's own visibility path, which is what the WebView fires
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await wait(400);
  log('ctx while hidden:', await page.evaluate(() => (window.__ctxstate = Engine.ready().state)));
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await wait(500);
  log('ctx after visible again:', await page.evaluate(() => Engine.ready().state));
  log('page errors:', errors.length);
};
