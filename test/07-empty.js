/* Every empty state, on a phone with nothing on it. */
module.exports = async ({ page, shot, wait, log, errors }) => {
  await page.goto('http://127.0.0.1:8825/index.html', { waitUntil: 'networkidle0' });
  await wait(700);
  await shot('70-empty-intro');
  await page.evaluate(() => { document.querySelector('#introGo').click(); Store.setGuide(5); App.setView('pad'); });
  await wait(500);
  await shot('71-empty-pad');
  await page.evaluate(() => App.setView('arrange')); await wait(500); await shot('72-empty-arrange');
  await page.evaluate(() => App.setView('library')); await wait(500); await shot('73-empty-library');
  // and the inline refusals rather than a silent nothing
  await page.evaluate(() => { App.setView('arrange'); document.querySelector('#playSong').click(); document.querySelector('#exportMix').click(); });
  await wait(500);
  await shot('74-empty-refusals');
  log('song error:', await page.evaluate(() => document.querySelector('#songErr').textContent));
  log('export note:', await page.evaluate(() => document.querySelector('#exportNote').textContent));
  log('page errors:', errors.length);
};
