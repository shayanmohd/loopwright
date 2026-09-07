/* Focused probes for the two things 02-edges could only see the symptoms of:
   re-entering startTake across its awaits, and three fast taps on Play. */
const { installHum, URL } = require('./lib/mic');

module.exports = async ({ page, wait, click, log, errors }) => {
  await installHum(page, URL);
  await wait(500);
  await page.evaluate(() => { Store.markIntro(); Store.setGuide(5); document.querySelector('#introSheet').hidden = true; App.setView('pad'); Store.set('countIn', 2); });
  await wait(200);

  // one drum layer so overdub is possible
  await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#shelf .vtile'), e => e.getAttribute('data-v') === 'kit').click());
  await click('#pad'); await wait(9000);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(3000);
  log('layers:', await page.evaluate(() => Store.current(App.project()).layers.length));

  // --- triple tap on play, watched step by step ---------------------------
  const steps = await page.evaluate(async () => {
    const b = document.querySelector('#btnPlay');
    const out = [];
    out.push('disabled=' + b.disabled + ' playing=' + Engine.playing());
    b.click(); out.push('after1 playing=' + Engine.playing());
    b.click(); out.push('after2 playing=' + Engine.playing());
    b.click(); out.push('after3 playing=' + Engine.playing());
    await new Promise(r => setTimeout(r, 1500));
    out.push('settled playing=' + Engine.playing() + ' nodes=' + Engine.nodeCount?.());
    return out;
  });
  log(steps.join(' | '));

  // --- double tap on the pad -----------------------------------------------
  await page.evaluate(() => Engine.stop());
  const pad = await page.evaluate(async () => {
    const p = document.querySelector('#pad');
    p.click(); p.click();
    await new Promise(r => setTimeout(r, 1200));
    return document.querySelector('#padNote').textContent + ' // ' + document.querySelector('#padBig').textContent;
  });
  log('pad after double tap:', pad);
  await page.evaluate(() => App.back());
  await wait(400);
  log('page errors:', errors.length);
};
