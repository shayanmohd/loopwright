/* Reviewer's own harness bits. Same fake hum trick as test/lib/mic.js, but the
   review runs on its own port so it can never be confused with the improver's. */
const { HUM } = require('./lib/mic');

exports.URL = 'http://127.0.0.1:8925/index.html';
exports.HUM = HUM;
exports.installHum = async (page, url) => {
  await page.evaluateOnNewDocument(HUM);
  await page.goto(url || exports.URL, { waitUntil: 'networkidle0' });
};
/* A native bridge that records what it was handed, so an export can be proved
   rather than assumed. */
exports.MOCK_NATIVE = `(function () {
  window.__saved = [];
  window.Native = {
    isNative: true,
    vibrate: function () {}, vibratePattern: function () {}, cancelVibration: function () {},
    hasAmplitudeControl: function () { return true; }, keepAwake: function () {},
    saveFile: function (n, m, b64) { window.__saved.push({ n: n, m: m, b64: b64 }); return 'content://x/' + n; },
    shareText: function () {}, shareUri: function () {}
  };
})();`;
