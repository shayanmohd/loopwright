/* The other half of export: no Native bridge, so the file has to leave through an
   object URL and an anchor. Also checks the bytes really are a RIFF WAVE, and that
   an arrangement long enough to break the renderer is refused before it starts. */
const fs = require('fs');
const path = require('path');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'v100-store.json'), 'utf8'));
  const seed = JSON.parse(fx.store);
  seed.lastOpen = seed.projects.find(p => p.scenes.some(s => s.layers.length)).id;
  seed.guide = 5;
  await page.evaluateOnNewDocument(store => localStorage.setItem('loopwright.v1', store), JSON.stringify(seed));
  await page.evaluateOnNewDocument(() => {
    window.__dl = [];
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = b => {
      const r = new FileReader();
      r.onload = () => {
        const u8 = new Uint8Array(r.result);
        const tag = s => String.fromCharCode.apply(null, u8.subarray(s, s + 4));
        window.__dl.push({ size: b.size, type: b.type, riff: tag(0), wave: tag(8), fmt: tag(12), data: tag(36) });
      };
      r.readAsArrayBuffer(b.slice(0, 48));
      return realCreate(b);
    };
    // an anchor click in headless would try to navigate; record it instead
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.hasAttribute('download')) { window.__name = this.getAttribute('download'); return; }
      return realClick.call(this);
    };
  });
  await page.goto('http://127.0.0.1:8825/index.html', { waitUntil: 'networkidle0' });
  await wait(900);

  log('Native bridge present (want false):', await page.evaluate(() => !!window.Native));
  await page.evaluate(() => App.setView('arrange'));
  await wait(500);
  await click('#exportMix');
  await wait(9000);
  await shot('90-download-mix');
  log('downloaded:', await page.evaluate(() => JSON.stringify(window.__dl)));
  log('file name:', await page.evaluate(() => window.__name));
  log('note under the buttons:', await page.evaluate(() => document.querySelector('#exportNote').textContent));

  // stems: one file per layer, still through the same path
  await page.evaluate(() => { window.__dl = []; });
  await click('#exportStems');
  await wait(20000);
  log('stem files:', await page.evaluate(() => window.__dl.length));
  log('stem sizes:', await page.evaluate(() => window.__dl.map(d => d.size).join(',')));
  await shot('91-download-stems');

  // an arrangement too long to render must say so instead of trying
  await page.evaluate(() => {
    const p = App.project();
    p.strip = [];
    for (let i = 0; i < 8; i++) p.strip.push({ scene: p.scenes[0].id, repeats: 16 });
    Store.touch(p);
    App.renderArrange();
    document.querySelector('#playSong').click();
    document.querySelector('#exportMix').click();
  });
  await wait(900);
  await shot('92-too-long');
  log('song length:', await page.evaluate(() => Store.clock(Store.songSeconds(App.project()))));
  log('play refusal:', await page.evaluate(() => document.querySelector('#songErr').textContent));
  log('export refusal:', await page.evaluate(() => document.querySelector('#exportNote').textContent));
  log('page errors:', errors.length);
};
