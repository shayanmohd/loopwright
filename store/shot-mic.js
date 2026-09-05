/* A synthetic hum, so the screenshot of the recording screen is a photograph of
   the app actually recording rather than a mock-up of it. Only used by the
   screenshot run; it never ships. */
(function () {
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
})();
