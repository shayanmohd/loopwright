/* Believable songs for the store screenshots and for driving the app without a
   microphone. Layers hold what was heard, unquantised, exactly as a real take
   would: slightly early, slightly late, never on the grid. */
(function () {
  var KEY = 'loopwright.v1';
  if (localStorage.getItem(KEY)) return;

  var s = 0;
  function rnd() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }
  function j(t, amt) { return Math.round((t + (rnd() * 2 - 1) * (amt === undefined ? 0.045 : amt)) * 1000) / 1000; }
  var id = 0;
  function uid(p) { return p + (++id).toString(36) + 'seed'; }

  function mel(pairs, vel) {
    return pairs.map(function (n) {
      return { p: n[0] + (rnd() * 0.5 - 0.25), t: j(n[1]), d: n[2], v: (vel || 0.85) + rnd() * 0.12 };
    });
  }
  function hits(list) {
    return list.map(function (h) { return { lane: h[0], t: j(h[1], 0.03), v: 0.72 + rnd() * 0.24 }; });
  }
  function layer(o) {
    return Object.assign({
      id: uid('l'), kind: 'melodic', voice: 'felt', src: [], vol: 0.85, muted: false,
      tighten: 0.85, swing: 0, chords: false, ab: false, octave: 0, hum: null, humDur: 0,
      created: Date.now()
    }, o);
  }

  var groove = [];
  [0, 2, 4, 6.5].forEach(function (t) { groove.push([0, t]); });
  [1, 3, 5, 7].forEach(function (t) { groove.push([1, t]); });
  for (var k = 0; k < 16; k++) groove.push([2, k * 0.5]);
  groove.sort(function (a, b) { return a[1] - b[1]; });

  var tune = [[65, 0, 0.9], [68, 1, 0.42], [70, 1.5, 0.85], [68, 2.5, 0.42],
              [72, 3, 1.35], [70, 4.5, 0.42], [68, 5, 0.85], [65, 6, 1.75]];
  var bass = [[41, 0, 1.8], [41, 2, 0.85], [44, 3, 0.9], [46, 4, 1.8], [41, 6, 1.8]];
  var spark = [[77, 0.5, 0.35], [80, 2.5, 0.35], [84, 4.5, 0.35], [77, 6.5, 0.8]];
  var pad = [[53, 0, 3.8], [56, 4, 3.8]];

  /* A real recording behind the A/B toggle: the same 16 bit mono shape a take
     leaves behind, written into the same store the app reads from. Without it the
     toggle is correctly hidden, and the screenshot would miss the best part. */
  var HUM = 'hseed1';
  (function () {
    try {
      var req = indexedDB.open('loopwright', 1);
      req.onupgradeneeded = function () {
        try { req.result.createObjectStore('hums'); } catch (e) {}
      };
      req.onsuccess = function () {
        var db = req.result, sr = 16000, n = sr * 5, pcm = new Int16Array(n);
        var f = [349.2, 415.3, 466.2, 415.3, 523.3, 466.2, 415.3, 349.2];
        var ph = 0;
        for (var i = 0; i < n; i++) {
          var t = i / sr, k = Math.min(7, Math.floor(t / 0.625)), u = t - k * 0.625;
          var hz = f[k] * (1 + 0.006 * Math.sin(2 * Math.PI * 5.1 * t));
          ph += 2 * Math.PI * hz / sr;
          var v = Math.sin(ph) + 0.28 * Math.sin(ph * 2) + 0.11 * Math.sin(ph * 3);
          var env = Math.min(1, u / 0.05) * Math.min(1, (0.56 - u) / 0.08);
          pcm[i] = Math.max(-1, Math.min(1, v * Math.max(0, env) * 0.35)) * 32000;
        }
        try {
          var t2 = db.transaction('hums', 'readwrite');
          t2.objectStore('hums').put({ sr: sr, pcm: pcm }, HUM);
        } catch (e) {}
      };
    } catch (e) {}
  })();

  var a1 = layer({ voice: 'felt', src: mel(tune), hum: HUM, humDur: 5.0 });
  var a2 = layer({ voice: 'kit', kind: 'drum', src: hits(groove), vol: 0.8 });
  var a3 = layer({ voice: 'upright', src: mel(bass, 0.9), octave: 0, vol: 0.9 });
  var a4 = layer({ voice: 'glass', src: mel(spark, 0.7), vol: 0.6 });

  var b1 = layer({ voice: 'felt', src: mel(tune), muted: true, hum: HUM, humDur: 5.0 });
  var b2 = layer({ voice: 'kit', kind: 'drum', src: hits(groove), vol: 0.85 });
  var b3 = layer({ voice: 'upright', src: mel(bass, 0.9), vol: 0.9 });
  var b4 = layer({ voice: 'choir', src: mel(pad, 0.8), chords: true, vol: 0.7 });

  var sA = { id: uid('s'), name: 'A', layers: [a1, a2, a3, a4] };
  var sB = { id: uid('s'), name: 'B', layers: [b1, b2, b3, b4] };

  var day = 86400000, now = 1788000000000;
  var main = {
    id: uid('p'), title: 'Kitchen Window', tonic: 5, mode: 'minor',
    bpm: 96, beats: 8, keyLocked: false,
    scenes: [sA, sB],
    strip: [{ scene: sA.id, repeats: 1 }, { scene: sA.id, repeats: 2 }, { scene: sB.id, repeats: 2 },
            { scene: sA.id, repeats: 2 }, { scene: sB.id, repeats: 2 }, { scene: sA.id, repeats: 1 }],
    openScene: sA.id, created: now - day * 3, updated: now
  };

  function simple(title, tonic, mode, bpm, beats, voices, when) {
    var ls = voices.map(function (v) {
      if (v === 'kit' || v === 'card') return layer({ voice: v, kind: 'drum', src: hits(groove) });
      if (v === 'upright') return layer({ voice: v, src: mel(bass, 0.9) });
      if (v === 'glass') return layer({ voice: v, src: mel(spark, 0.7) });
      return layer({ voice: v, src: mel(tune) });
    });
    var sc = { id: uid('s'), name: 'A', layers: ls };
    return { id: uid('p'), title: title, tonic: tonic, mode: mode, bpm: bpm, beats: beats,
             keyLocked: false, scenes: [sc], strip: [], openScene: sc.id,
             created: when - day, updated: when };
  }

  var db = {
    projects: [
      simple('Two Stops Early', 9, 'minor', 84, 8, ['dust', 'card', 'upright'], now - day * 9),
      simple('', 0, 'major', 118, 6, ['nylon', 'kit'], now - day * 4),
      main,
      simple('Bathroom Tile Reverb', 7, 'major', 104, 8, ['choir', 'glass', 'kit'], now - day * 16)
    ],
    lastOpen: main.id,
    seenIntro: true,
    guide: 5,
    settings: { voice: 'felt', countIn: 4, haptics: true, click: true, tighten: 0.85, headphones: true }
  };
  localStorage.setItem(KEY, JSON.stringify(db));
})();
