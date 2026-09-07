/* The landing page, at a laptop width and at a phone width. */
module.exports = async ({ page, shot, wait, log, errors }) => {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(700);
  await shot('80-landing-top');
  await page.evaluate(() => window.scrollTo(0, 1500)); await wait(400); await shot('81-landing-compare');
  await page.evaluate(() => document.querySelector('#voices').scrollIntoView()); await wait(400); await shot('82-landing-voices');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(400); await shot('83-landing-end');
  log('page errors:', errors.length);
};
