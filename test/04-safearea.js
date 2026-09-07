/* Safe areas. The shell injects --sat and --sab; nothing may sit under either bar.
   Populated from the 1.0.0 fixture so every screen has something in it. */
const fs = require('fs');
const path = require('path');

module.exports = async ({ page, shot, wait, log, errors }) => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'v100-store.json'), 'utf8'));
  const seed = JSON.parse(fx.store);
  seed.lastOpen = seed.projects.find(p => p.scenes.some(s => s.layers.length)).id;
  await page.evaluateOnNewDocument(store => localStorage.setItem('loopwright.v1', store), JSON.stringify(seed));
  await page.goto('http://127.0.0.1:8825/index.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--sat', '48px');
    document.documentElement.style.setProperty('--sab', '34px');
    const bars = document.createElement('style');
    // paint the two system bars so anything hiding under them is obvious
    bars.textContent = '#sysbars{position:fixed;inset:0;z-index:999;pointer-events:none}' +
      '#sysbars i{position:absolute;left:0;right:0;background:rgba(255,0,110,.34)}' +
      '#sysbars i.t{top:0;height:48px}#sysbars i.b{bottom:0;height:34px}';
    document.head.appendChild(bars);
    const d = document.createElement('div');
    d.id = 'sysbars'; d.innerHTML = '<i class="t"></i><i class="b"></i>';
    document.body.appendChild(d);
  });
  await wait(900);

  await shot('50-sa-pad');
  await page.evaluate(() => App.setView('arrange')); await wait(500); await shot('51-sa-arrange');
  await page.evaluate(() => { document.querySelector('#v-arrange .scroller').scrollTop = 9999; }); await wait(300); await shot('52-sa-arrange-bottom');
  await page.evaluate(() => App.setView('library')); await wait(500); await shot('53-sa-library');
  await page.evaluate(() => { document.querySelector('#v-library .scroller').scrollTop = 9999; }); await wait(300); await shot('54-sa-library-bottom');
  await page.evaluate(() => { App.setView('pad'); App.openLayerSheet(Store.current(App.project()).layers[0].id); }); await wait(500); await shot('55-sa-layer-sheet');
  await page.evaluate(() => { App.back(); App.openKeySheet(); }); await wait(500); await shot('56-sa-key-sheet');
  await page.evaluate(() => { App.back(); App.sheet('#introSheet', true); }); await wait(500); await shot('57-sa-intro');
  await page.evaluate(() => { App.back(); Store.setGuide(0); App.setView('pad'); }); await wait(600); await shot('58-sa-coach');
  await page.evaluate(() => App.toast('Saved to Downloads.')); await wait(400); await shot('59-sa-toast');

  const overlaps = await page.evaluate(() => {
    const SAT = 48, SAB = 34, H = innerHeight;
    const bad = [];
    document.querySelectorAll('button, input, select, .h1, .h2, .lede, .card b, .toast, .coach-text, .pad-big').forEach(el => {
      if (el.closest('#sysbars')) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (r.top < SAT || r.bottom > H - SAB) {
        bad.push((el.id || el.className || el.tagName) + ' top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom));
      }
    });
    return bad;
  });
  log('elements under a system bar:', overlaps.length ? overlaps.join(' | ') : 'none');
  log('page errors:', errors.length);
};
