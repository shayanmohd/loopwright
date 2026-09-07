/* Safe areas. The shell injects --sat and --sab; with a tall status bar and a
   gesture bar nothing may sit under either. Every screen and every sheet is shot
   with the insets applied and then measured against the two bands. */
const { installHum, URL } = require('./review-lib');
const SAT = 48, SAB = 34;

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  await page.evaluateOnNewDocument((sat, sab) => {
    addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--sat', sat + 'px');
      document.documentElement.style.setProperty('--sab', sab + 'px');
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;left:0;right:0;top:0;height:' + sat +
        'px;background:rgba(255,0,80,.34);z-index:999;pointer-events:none';
      const nav = document.createElement('div');
      nav.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:' + sab +
        'px;background:rgba(255,0,80,.34);z-index:999;pointer-events:none';
      document.body.append(bar, nav);
    });
  }, SAT, SAB);
  await require('./review-lib').installHum(page, URL);
  await wait(700);

  /* What is actually painted inside the two bands. Sampling the bands with
     elementFromPoint answers the real question, which the DOM rectangles do not:
     a control scrolled out of a clipped scroller is not under the bar, and a
     panel that reaches the bar is only a fault if a control sits in it. */
  const clash = () => page.evaluate((sat, sab) => {
    const hits = new Set();
    const look = y => {
      for (let x = 8; x < innerWidth; x += 26) {
        const el = document.elementFromPoint(x, y);
        if (!el) continue;
        const chrome = el.closest('#topbar, #tabs');
        if (chrome) continue;
        if (el.classList && el.classList.contains('sheet')) continue;   // the scrim itself
        const name = el.id || (typeof el.className === 'string' && el.className) || el.tagName;
        const r = el.getBoundingClientRect();
        // ignore backgrounds that merely pass under the bar with nothing in them
        const inked = el.textContent.trim().length || el.tagName === 'SVG' ||
          el.tagName === 'svg' || el.tagName === 'path' || el.tagName === 'INPUT' ||
          el.tagName === 'BUTTON' || el.closest('button');
        if (inked) hits.add(name + ' [' + Math.round(r.top) + ',' + Math.round(r.bottom) + ']');
      }
    };
    for (let y = 2; y < sat; y += 10) look(y);
    for (let y = innerHeight - sab + 2; y < innerHeight; y += 10) look(y);
    return Array.from(hits).slice(0, 10);
  }, SAT, SAB);

  await click('#introGo');
  await wait(400);
  await shot('01-pad-insets');
  log('pad clashes:', JSON.stringify(await clash()));

  await page.evaluate(() => Store.set('countIn', 0));
  await click('#pad');
  await wait(5400);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2800);
  await shot('02-pad-recorded-insets');
  log('pad with a layer and the coach card:', JSON.stringify(await clash()));

  await page.evaluate(() => App.openLayerSheet(Store.current(App.project()).layers[0].id));
  await wait(400);
  await shot('03-layer-sheet-insets');
  log('layer sheet:', JSON.stringify(await clash()));
  await page.evaluate(() => App.back());

  await click('#tbKey'); await wait(400);
  await shot('04-key-sheet-insets');
  log('key sheet:', JSON.stringify(await clash()));
  await page.evaluate(() => App.back());

  await click('#tbTitle'); await wait(400);
  await shot('05-name-sheet-insets');
  log('name sheet:', JSON.stringify(await clash()));
  await page.evaluate(() => App.back());

  await page.evaluate(() => App.setView('arrange'));
  await wait(400);
  await shot('06-arrange-insets');
  log('arrange top:', JSON.stringify(await clash()));
  await page.evaluate(() => document.querySelector('#v-arrange .scroller').scrollTop = 9999);
  await wait(400);
  await shot('07-arrange-bottom-insets');
  log('arrange scrolled to the end:', JSON.stringify(await clash()));

  await page.evaluate(() => App.setView('library'));
  await wait(500);
  await shot('08-library-insets');
  log('library top:', JSON.stringify(await clash()));
  await page.evaluate(() => document.querySelector('#v-library .scroller').scrollTop = 9999);
  await wait(400);
  await shot('09-library-bottom-insets');
  log('library scrolled to the end:', JSON.stringify(await clash()));

  // the intro sheet is the very first thing a new phone shows
  await page.evaluate(() => { localStorage.removeItem('loopwright.v1'); });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(900);
  await shot('10-intro-insets');
  log('intro sheet:', JSON.stringify(await clash()));
  log('page errors:', errors.length);
};
