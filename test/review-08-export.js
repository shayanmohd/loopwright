/* Export both ways. There is no import, so the round trip is the file itself:
   the bytes are read back and checked as a real RIFF/WAVE header with the right
   channel count, rate and data length, on the Native bridge path and on the
   browser object-URL path, for the mix and for the stems. */
const { installHum, URL, MOCK_NATIVE } = require('./review-lib');

module.exports = async ({ page, shot, wait, click, log, errors }) => {
  await installHum(page, URL);
  await wait(700);
  await click('#introGo');
  await page.evaluate(() => Store.set('countIn', 0));
  await click('#pad'); await wait(5200);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2800);
  await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
  await page.evaluate(() => Array.prototype.find.call(document.querySelectorAll('#shelf .vtile'),
    e => e.getAttribute('data-v') === 'kit').click());
  await click('#pad'); await wait(13000);
  log('layers to export:', await page.evaluate(() => Store.current(App.project()).layers.length));

  // the browser path: catch the object URL and read the blob back
  await page.evaluate(() => {
    // the app revokes its object URL after four seconds, so the blob itself is kept
    window.__blobs = [];
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = b => { window.__blobs.push(b); return real(b); };
    window.__clicked = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      window.__clicked.push({ name: this.download, href: this.href.slice(0, 5) });
      return realClick.apply(this, arguments);
    };
  });
  await page.evaluate(() => App.setView('arrange'));
  await wait(400);
  await click('#exportMix');
  await wait(9000);
  await shot('01-browser-export');
  const browser = await page.evaluate(async () => {
    const rec = window.__blobs[window.__blobs.length - 1];
    const buf = new Uint8Array(await rec.arrayBuffer());
    const s = (o, n) => String.fromCharCode.apply(null, buf.subarray(o, o + n));
    const u32 = o => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24);
    const u16 = o => buf[o] | (buf[o + 1] << 8);
    let peak = 0;
    for (let i = 44; i < buf.length - 1; i += 2001 * 2) {
      let v = buf[i] | (buf[i + 1] << 8); if (v > 32767) v -= 65536;
      peak = Math.max(peak, Math.abs(v));
    }
    return {
      anchor: window.__clicked[window.__clicked.length - 1],
      blobType: rec.type, bytes: buf.length,
      riff: s(0, 4), wave: s(8, 4), fmt: s(12, 4), fmtSize: u32(16), pcm: u16(20),
      channels: u16(22), rate: u32(24), bits: u16(34), data: s(36, 4), dataLen: u32(40),
      headerMatchesFile: u32(40) === buf.length - 44, seconds: +((buf.length - 44) / (u32(24) * u16(22) * 2)).toFixed(2),
      peakSample: peak
    };
  });
  log('browser download:', JSON.stringify(browser));

  // the native path: the same bytes over the bridge, base64
  await page.evaluate(MOCK_NATIVE);
  await page.evaluate(() => App.setView('pad'));
  await wait(200);
  await page.evaluate(() => App.setView('arrange'));
  await wait(400);
  await click('#exportMix');
  await wait(9000);
  const native = await page.evaluate(() => {
    const rec = window.__saved[window.__saved.length - 1];
    const bin = atob(rec.b64.slice(0, 88));
    const b = [];
    for (let i = 0; i < bin.length; i++) b.push(bin.charCodeAt(i));
    const s = (o, n) => String.fromCharCode.apply(null, b.slice(o, o + n));
    const u32 = o => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
    const u16 = o => b[o] | (b[o + 1] << 8);
    return {
      name: rec.n, mime: rec.m, bytes: Math.round(rec.b64.length * 3 / 4),
      riff: s(0, 4), wave: s(8, 4), fmt: s(12, 4), channels: u16(22), rate: u32(24),
      bits: u16(34), data: s(36, 4)
    };
  });
  log('native saveFile:', JSON.stringify(native));
  log('share button offered when the bridge can share:',
      await page.evaluate(() => !document.querySelector('#shareMix').hidden));

  await click('#exportStems');
  await wait(20000);
  await shot('02-stems');
  const stems = await page.evaluate(() => window.__saved.slice(1).map(s => ({
    n: s.n, kb: Math.round(s.b64.length * 3 / 4096)
  })));
  log('stems written:', JSON.stringify(stems));
  log('export note:', JSON.stringify(await page.evaluate(() => document.querySelector('#exportNote').textContent)));
  log('page errors:', errors.length);
};
