/* A fake microphone that actually hums.

   Chrome's own fake device (--use-fake-device-for-media-stream) is a 20 millisecond
   beep every half second: a fine beatbox, useless as a melody. So the melodic tests
   install this instead, which is the same trick store/shots.json uses for the
   screenshots: a synthesised voice-shaped tone playing a fixed phrase in F minor,
   handed to the page as a MediaStream. Everything downstream of getUserMedia is the
   real app. */
exports.HUM = `(function () {
  var C = window.AudioContext || window.webkitAudioContext;
  if (!C || !navigator.mediaDevices) return;
  var G = new C();
  var dest = G.createMediaStreamDestination();
  var MEL = [349.2, 415.3, 466.2, 415.3, 523.3, 466.2, 415.3, 349.2];
  function note(t, f, dur) {
    var o = G.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
    var lp = G.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    var g = G.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.05);
    g.gain.setValueAtTime(0.5, t + dur - 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var next = G.currentTime + 0.2;
  function fill() {
    while (next < G.currentTime + 2) {
      for (var i = 0; i < 8; i++) note(next + i * 0.625, MEL[i], 0.56);
      next += 5;
    }
  }
  fill();
  setInterval(fill, 400);
  navigator.mediaDevices.getUserMedia = function () { return Promise.resolve(dest.stream); };
})();`;

/** Install the hum, then load the page fresh so the app never sees the real fake device. */
exports.installHum = async (page, url) => {
  await page.evaluateOnNewDocument(exports.HUM);
  await page.goto(url, { waitUntil: 'networkidle0' });
};

exports.URL = 'http://127.0.0.1:8825/index.html';
