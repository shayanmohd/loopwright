/* The landing page, with the refreshed screenshots in it. Every image must load
   and the page must be clean. */
module.exports = async ({ page, shot, wait, log, errors }) => {
  await page.goto('http://127.0.0.1:8927/index.html', { waitUntil: 'networkidle0' });
  await wait(600);
  const imgs = await page.evaluate(() => Array.prototype.map.call(document.images,
    i => ({ src: i.getAttribute('src'), ok: i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight })));
  imgs.forEach(i => log((i.ok ? 'ok   ' : 'BROKEN ') + i.src + ' ' + i.w + 'x' + i.h));
  await page.setViewport({ width: 1180, height: 900, deviceScaleFactor: 1 });
  await wait(400);
  await shot('01-landing-top');
  await page.evaluate(() => scrollTo(0, 1400)); await wait(400); await shot('02-landing-how');
  await page.evaluate(() => scrollTo(0, 3200)); await wait(400); await shot('03-landing-voices');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await wait(400);
  await shot('04-landing-end');
  log('privacy policy reachable:', await page.evaluate(async () =>
    (await fetch('privacy-policy.html')).status));
  log('browser build reachable:', await page.evaluate(async () =>
    (await fetch('play/index.html')).status));
  log('page errors:', errors.length);
};
