/* Loopwright's screens. Three surfaces: the Pad you play, the Arrange strip that
   turns loops into a song, and the Library that keeps them. Everything below is
   presentation and intent; the listening lives in dsp.js and the sound in
   engine.js and voices.js. */

const App = (() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));

  let project = null;
  let view = 'pad';
  let padState = 'idle';        // idle | counting | recording | thinking
  let openLayer = null;
  let songSrc = null, songStart = 0, songDur = 0;
  let armedProject = null;      // the delete-confirm on a library card
  let taps = [];
  let raf = 0;
  let lastBeat = -1;
  let lastPlaying = false;

  /* ------------------------------------------------------------- helpers */

  let toastTimer = 0;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }
  function busy(on, text) {
    $('#busy').hidden = !on;
    if (text) $('#busyText').textContent = text;
  }
  function buzz(ms, amp) {
    if (!Store.settings().haptics) return;
    try {
      if (window.Native && Native.vibrate) Native.vibrate(ms, amp || 140);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  }
  const isNative = () => !!(window.Native && Native.isNative);

  function sheet(id, on) {
    $(id).hidden = !on;
  }
  const anySheet = () => $$('.sheet').filter(s => !s.hidden)[0] || null;

  /* --------------------------------------------------------------- top bar */

  function renderTop() {
    $('#tbTitleText').textContent = Store.title(project);
    $('#tbBpm').textContent = Math.round(project.bpm);
    $('#tbKeyName').textContent = Store.keyName(project);
  }

  /* ----------------------------------------------------------- the ring */

  function pt(deg, r) {
    const a = (deg - 90) * Math.PI / 180;
    return [150 + r * Math.cos(a), 150 + r * Math.sin(a)];
  }
  function arcD(a0, a1, r) {
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) +
           ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
  }

  function renderRing() {
    const sc = Store.current(project);
    const n = sc.layers.length;
    const R = 127;
    let s = '<circle cx="150" cy="150" r="' + R + '" class="seg seg-bg" stroke-width="9"/>';
    const gap = n > 1 ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const l = sc.layers[i];
      const a0 = i * 360 / n + gap / 2;
      const a1 = (i + 1) * 360 / n - gap / 2;
      const cls = l.muted ? 'seg-off' : (l.kind === 'drum' ? 'seg-drum' : 'seg-on');
      const w = l.muted ? 7 : 10 + Math.round(l.vol * 5);
      s += '<path class="seg ' + cls + '" stroke-width="' + w + '" d="' + arcD(a0, a1, R) + '"/>';
      s += '<path class="seg" stroke="transparent" stroke-width="34" data-layer="' + l.id +
           '" d="' + arcD(a0, a1, R) + '"/>';
    }
    s += '<path id="recArc" class="seg seg-on" stroke-width="3" stroke-dasharray="2 5" d="" opacity="0.85"/>';
    s += '<g id="phg"><line class="playhead" x1="150" y1="' + (150 - R - 11) +
         '" x2="150" y2="' + (150 - R + 11) + '" opacity="0"/></g>';
    $('#ring').innerHTML = s;
    $$('#ring [data-layer]').forEach(el => bindSegment(el, el.getAttribute('data-layer')));
  }

  function bindSegment(el, id) {
    let timer = 0, moved = false, long = false;
    el.addEventListener('pointerdown', e => {
      moved = false; long = false;
      timer = setTimeout(() => { long = true; buzz(14, 90); openLayerSheet(id); }, 450);
      e.preventDefault();
    });
    el.addEventListener('pointermove', () => { moved = true; });
    el.addEventListener('pointerup', () => {
      clearTimeout(timer);
      if (!long && !moved) toggleMute(id);
    });
    el.addEventListener('pointercancel', () => clearTimeout(timer));
  }

  /* ---------------------------------------------------------- layer chips */

  function renderLayers() {
    const sc = Store.current(project);
    const box = $('#layerStrip');
    if (!sc.layers.length) {
      box.innerHTML = '<p class="emptylayers">No layers yet. The pad is waiting.</p>';
      return;
    }
    box.innerHTML = sc.layers.map(l => {
      const v = Voices.get(l.voice);
      const cls = 'lchip' + (l.muted ? ' off' : '') + (l.kind === 'drum' ? ' drum' : '');
      const count = l.kind === 'drum' ? l.src.length + ' hits' : l.src.length + ' notes';
      return '<button class="' + cls + '" data-id="' + l.id + '"><i></i>' +
             v.name + ' <small>' + count + '</small></button>';
    }).join('');
    Array.prototype.forEach.call(box.children, el => {
      const id = el.getAttribute('data-id');
      let timer = 0, long = false;
      el.addEventListener('pointerdown', () => {
        long = false;
        timer = setTimeout(() => { long = true; buzz(14, 90); openLayerSheet(id); }, 450);
      });
      el.addEventListener('pointerup', () => {
        clearTimeout(timer);
        if (!long) toggleMute(id);
      });
      el.addEventListener('pointerleave', () => clearTimeout(timer));
      el.addEventListener('pointercancel', () => clearTimeout(timer));
    });
  }

  function toggleMute(id) {
    const sc = Store.current(project);
    const l = sc.layers.find(x => x.id === id);
    if (!l) return;
    l.muted = !l.muted;
    Store.touch(project);
    Engine.setGain(l);
    renderLayers(); renderRing();
    buzz(10, 70);
    if (Store.guide() === 2) advanceGuide(3);
  }

  /* --------------------------------------------------------- voice shelf */

  function renderShelf() {
    const cur = Store.settings().voice;
    $('#shelf').innerHTML = Voices.all().map(v =>
      '<button class="vtile' + (v.id === cur ? ' is-on' : '') + '" data-v="' + v.id + '">' +
      '<span class="tex"></span><b>' + v.name + '</b><span>' + v.blurb + '</span></button>'
    ).join('');
    Array.prototype.forEach.call($('#shelf').children, el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-v');
        Store.set('voice', id);
        Engine.preview(id, project);
        renderShelf(); renderPadFace();
      });
    });
  }

  /* ------------------------------------------------------------ the pad */

  function renderPadFace() {
    const big = $('#padBig'), sub = $('#padSub'), pad = $('#pad');
    const v = Voices.get(Store.settings().voice);
    const sc = Store.current(project);
    pad.classList.toggle('rec', padState === 'recording' || padState === 'counting');
    big.classList.remove('count');
    if (padState === 'thinking') {
      big.textContent = 'Listening';
      sub.textContent = 'Working out what you meant';
      return;
    }
    if (padState === 'recording') {
      big.textContent = 'Recording';
      sub.textContent = sc.layers.length ? 'One time round, then it closes'
                                         : 'Tap again to close the loop';
      return;
    }
    if (padState === 'counting') { sub.textContent = 'Come in on the one'; return; }
    if (sc.layers.length >= 8) {
      big.textContent = 'Full';
      sub.textContent = 'Eight layers. Copy the scene to keep going.';
      return;
    }
    big.textContent = v.kind === 'drum' ? 'Beat' : 'Hum';
    sub.textContent = v.kind === 'drum'
      ? 'Tap, then say boots and cats'
      : (sc.layers.length ? 'Tap and hum the next part' : 'Tap and hum a melody');
  }

  function renderPad() {
    renderTop();
    renderRing();
    renderLayers();
    renderShelf();
    renderPadFace();
    renderScenes();
    const sc = Store.current(project);
    $('#btnUndo').disabled = !sc.layers.length || padState !== 'idle';
    $('#btnScene').disabled = !sc.layers.length || padState !== 'idle';
    $('#btnPlay').disabled = !sc.layers.length;
    $('#btnPlay').classList.toggle('on', Engine.playing());
    $('#playLabel').textContent = Engine.playing() ? 'Stop' : 'Play';
  }

  function renderScenes() {
    const row = $('#sceneRow');
    row.innerHTML = project.scenes.map(s =>
      '<button class="scenechip' + (s.id === project.openScene ? ' is-on' : '') +
      '" data-s="' + s.id + '">Scene ' + s.name + '</button>'
    ).join('') + '<button class="scenechip add" data-add="1">New scene</button>';
    Array.prototype.forEach.call(row.children, el => {
      el.addEventListener('click', () => {
        if (el.getAttribute('data-add')) {
          if (project.scenes.length >= 8) { toast('Eight scenes is plenty for one song.'); return; }
          Store.addScene(project, null);
          Engine.stop();
        } else {
          project.openScene = el.getAttribute('data-s');
          Store.touch(project);
          Engine.stop();
        }
        renderPad();
      });
    });
  }

  /* ------------------------------------------------------------ recording */

  function onRecState(state, n) {
    if (state === 'countin') {
      if (padState !== 'counting') { padState = 'counting'; renderPadFace(); }
      const big = $('#padBig');
      big.classList.add('count');
      if (big.textContent !== String(n)) {
        big.textContent = String(n);
        buzz(18, 120);
      }
    } else if (state === 'recording') {
      if (padState !== 'recording') {
        padState = 'recording';
        buzz(28, 200);
        renderPadFace();
        renderPad();
      }
    }
  }

  async function startTake() {
    const sc = Store.current(project);
    if (sc.layers.length >= 8) {
      toast('Eight layers is the most a scene holds. Copy the scene, or remove one.');
      return;
    }
    const first = sc.layers.length === 0;
    if (!first && !Engine.playing()) await Engine.play(project, sc.id);
    if (!first && !Store.settings().headphones) {
      Store.set('headphones', true);
      note('Headphones help from here. Without them the microphone hears the loop as well as you.');
    }

    padState = 'counting';
    $('#padNote').textContent = '';
    renderPadFace();

    const voiceId = Store.settings().voice;
    const drum = Voices.isDrum(voiceId);
    const res = await Engine.record(project, {
      first: first,
      countIn: Store.settings().countIn,
      click: Store.settings().click,
      onState: onRecState
    });

    if (!res || res.error) {
      padState = 'idle';
      renderPad();
      note(res && res.error ? res.error : 'Recording did not start.', true);
      return;
    }
    if (res.aborted) { padState = 'idle'; renderPad(); return; }

    padState = 'thinking';
    renderPadFace();
    busy(true, drum ? 'Sorting the hits' : 'Listening back');
    await new Promise(r => setTimeout(r, 40));

    try {
      await commitTake(res, voiceId, drum, first);
    } catch (e) {
      note('Something went wrong turning that into a layer.', true);
    }
    busy(false);
    padState = 'idle';
    renderPad();
  }

  function note(text, warn) {
    const n = $('#padNote');
    n.textContent = text;
    n.classList.toggle('warn', !!warn);
    if (text) setTimeout(() => { if (n.textContent === text) { n.textContent = ''; n.classList.remove('warn'); } }, 6500);
  }

  async function commitTake(res, voiceId, drum, first) {
    if (res.duration < 1.1 && first) {
      note('That was too short to build a loop from. Give it a few seconds.', true);
      return;
    }
    const heard = drum ? DSP.hearDrums(res.samples, res.sr) : DSP.hearMelody(res.samples, res.sr);
    const events = drum ? heard.hits : heard.notes;
    if (!events.length) {
      note(heard.quiet
        ? 'I could not hear anything. Check the microphone and try a little louder.'
        : (drum ? 'No clear hits in that one. Try sharper sounds: b, k, ts.'
                : 'No steady pitch in that one. Try humming one long note first.'), true);
      return;
    }

    const sc = Store.current(project);
    // The take is captured a fraction before the one and a fraction after the loop
    // point, so times are measured from the beat rather than from the slice.
    const pre = res.pre || 0;
    if (first) {
      const fit = DSP.fitLoop(res.duration, events.map(e => e.t - pre));
      project.bpm = fit.bpm;
      project.beats = fit.beats;
    }
    const spb = 60 / project.bpm;
    const src = events.map(e => drum
      ? { lane: e.lane, t: (e.t - pre) / spb, v: e.v }
      : { p: e.p, t: (e.t - pre) / spb, d: Math.max(0.1, e.d / spb), v: e.v });
    const swing = DSP.detectSwing(src.map(e => e.t));

    if (!drum) {
      const melodicAlready = project.scenes.some(s => s.layers.some(l => l.kind === 'melodic'));
      if (!melodicAlready && !project.keyLocked) {
        const k = DSP.inferKey(src.map(e => ({ p: e.p, d: e.d })));
        if (k) { project.tonic = k.tonic; project.mode = k.mode; }
      }
    }

    // The hum itself, kept at 16k so the A/B comparison costs kilobytes not
    // megabytes. It is a nicety, not the layer: if the store will not take it the
    // take still becomes music, just without the voice to compare against.
    let key = null;
    try {
      const small = DSP.resample(res.samples, res.sr, 16000);
      key = await Hums.put(Store.uid('h'), small, 16000);
    } catch (e) { key = null; }

    const layer = Store.addLayer(project, sc, {
      kind: drum ? 'drum' : 'melodic',
      voice: voiceId,
      src: src,
      swing: swing,
      octave: drum ? 0 : Engine.suggestOctave(voiceId, src),
      tighten: Store.settings().tighten,
      hum: key,
      humDur: res.duration
    });

    if (!Store.save()) { toast(Store.error(), 5000); }
    buzz(40, 210);
    if (first) {
      await Engine.play(project, sc.id);
    } else {
      await Engine.refresh(project, layer, sc.layers.length - 1);
    }
    note(drum
      ? events.length + ' hits, snapped to the groove you played.'
      : events.length + ' notes in ' + Store.keyLong(project) + '.');

    if (Store.guide() === 0) advanceGuide(1);
    else if (Store.guide() === 1) advanceGuide(2);
  }

  function onPadTap() {
    Engine.ready();
    if (padState === 'recording') {
      const sc = Store.current(project);
      if (!sc.layers.length) Engine.finish();
      return;
    }
    if (padState === 'counting') {
      Engine.cancelRecord();
      padState = 'idle';
      renderPad();
      return;
    }
    if (padState === 'thinking') return;
    startTake();
  }

  /* ------------------------------------------------------- the layer sheet */

  function openLayerSheet(id) {
    const sc = Store.current(project);
    const l = sc.layers.find(x => x.id === id);
    if (!l) return;
    openLayer = l;
    const drum = l.kind === 'drum';
    $('#lsTitle').textContent = Voices.get(l.voice).name;
    $('#lsHelp').textContent = drum
      ? l.src.length + ' hits, heard as kick, snare and hat.'
      : l.src.length + ' notes, snapped into ' + Store.keyLong(project) + '.';
    $('#lsVol').value = Math.round(l.vol * 100);
    $('#lsVolVal').textContent = Math.round(l.vol * 100);
    $('#lsTight').value = Math.round(l.tighten * 100);
    $('#lsTightVal').textContent = Math.round(l.tighten * 100);
    $('#lsOctVal').textContent = l.octave > 0 ? '+' + l.octave : String(l.octave);
    $('#lsOctField').hidden = drum;
    $('#lsChordField').hidden = drum;
    $('#lsChords').checked = !!l.chords;
    $('#lsAb').checked = !!l.ab;
    $('#lsAbField').hidden = !l.hum;
    const pool = drum ? Voices.drums() : Voices.melodic();
    $('#lsVoices').innerHTML = pool.map(v =>
      '<button class="vtile' + (v.id === l.voice ? ' is-on' : '') + '" data-v="' + v.id + '">' +
      '<span class="tex"></span><b>' + v.name + '</b><span>' + v.blurb + '</span></button>'
    ).join('');
    Array.prototype.forEach.call($('#lsVoices').children, el => {
      el.addEventListener('click', () => {
        const vid = el.getAttribute('data-v');
        if (!drum) l.octave = Engine.suggestOctave(vid, l.src);
        l.voice = vid;
        l.ab = false;
        $('#lsAb').checked = false;
        Store.layerPatch(project, l, {});
        Engine.preview(vid, project);
        pushLayer(l);
        openLayerSheet(l.id);
      });
    });
    sheet('#layerSheet', true);
  }

  function pushLayer(l) {
    const sc = Store.current(project);
    const i = sc.layers.indexOf(l);
    Engine.refresh(project, l, Math.max(0, i));
    renderRing(); renderLayers(); renderTop();
  }

  function wireLayerSheet() {
    $('#lsClose').addEventListener('click', () => { sheet('#layerSheet', false); openLayer = null; });
    $('#layerSheet').addEventListener('click', e => {
      if (e.target === $('#layerSheet')) { sheet('#layerSheet', false); openLayer = null; }
    });
    $('#lsVol').addEventListener('input', e => {
      if (!openLayer) return;
      openLayer.vol = e.target.value / 100;
      $('#lsVolVal').textContent = e.target.value;
      Engine.setGain(openLayer);
      Store.touch(project);
      renderRing();
    });
    $('#lsTight').addEventListener('change', e => {
      if (!openLayer) return;
      Store.layerPatch(project, openLayer, { tighten: e.target.value / 100 });
      $('#lsTightVal').textContent = e.target.value;
      pushLayer(openLayer);
    });
    $('#lsTight').addEventListener('input', e => { $('#lsTightVal').textContent = e.target.value; });
    $('#lsOctDown').addEventListener('click', () => shiftOctave(-1));
    $('#lsOctUp').addEventListener('click', () => shiftOctave(1));
    $('#lsChords').addEventListener('change', e => {
      if (!openLayer) return;
      Store.layerPatch(project, openLayer, { chords: e.target.checked });
      pushLayer(openLayer);
    });
    $('#lsAb').addEventListener('change', e => {
      if (!openLayer) return;
      Store.layerPatch(project, openLayer, { ab: e.target.checked });
      pushLayer(openLayer);
      toast(e.target.checked ? 'Playing the take you recorded.' : 'Back to the instrument.');
    });
    $('#lsDelete').addEventListener('click', () => {
      if (!openLayer) return;
      const id = openLayer.id;
      Engine.forget(id);
      Store.removeLayer(project, Store.current(project), id);
      openLayer = null;
      sheet('#layerSheet', false);
      renderPad();
    });
  }

  function shiftOctave(d) {
    if (!openLayer) return;
    const o = Math.max(-3, Math.min(3, openLayer.octave + d));
    Store.layerPatch(project, openLayer, { octave: o });
    $('#lsOctVal').textContent = o > 0 ? '+' + o : String(o);
    pushLayer(openLayer);
  }

  /* -------------------------------------------------------- tempo and key */

  function openKeySheet() {
    $('#ksBpm').textContent = Math.round(project.bpm);
    $('#ksTonics').innerHTML = Store.SHORT.map((n, i) =>
      '<button class="' + (i === project.tonic ? 'is-on' : '') + '" data-t="' + i + '">' + n + '</button>'
    ).join('');
    Array.prototype.forEach.call($('#ksTonics').children, el => {
      el.addEventListener('click', () => {
        project.tonic = parseInt(el.getAttribute('data-t'), 10);
        project.keyLocked = true;
        Store.touch(project);
        reharmonise();
        openKeySheet();
      });
    });
    $$('#keySheet .mode').forEach(el => {
      el.classList.toggle('is-on', el.getAttribute('data-mode') === project.mode);
    });
    sheet('#keySheet', true);
  }

  function reharmonise() {
    project.scenes.forEach(s => s.layers.forEach(l => { l._d = null; Engine.invalidate(l); }));
    renderTop();
    if (Engine.playing()) {
      const sc = Store.current(project);
      sc.layers.forEach((l, i) => Engine.refresh(project, l, i));
    }
  }

  function setBpm(v) {
    project.bpm = Math.max(50, Math.min(200, Math.round(v * 10) / 10));
    Store.touch(project);
    $('#ksBpm').textContent = Math.round(project.bpm);
    renderTop();
    project.scenes.forEach(s => s.layers.forEach(l => Engine.invalidate(l)));
    if (Engine.playing()) Engine.play(project, project.openScene);
  }

  function wireKeySheet() {
    $('#ksClose').addEventListener('click', () => sheet('#keySheet', false));
    $('#keySheet').addEventListener('click', e => { if (e.target === $('#keySheet')) sheet('#keySheet', false); });
    $('#ksSlower').addEventListener('click', () => setBpm(project.bpm - 2));
    $('#ksFaster').addEventListener('click', () => setBpm(project.bpm + 2));
    $('#ksTap').addEventListener('click', () => {
      const now = Date.now();
      taps = taps.filter(t => now - t < 2600);
      taps.push(now);
      if (taps.length < 2) { $('#ksTapNote').textContent = 'Keep tapping.'; return; }
      const gaps = [];
      for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(60000 / avg);
      $('#ksTapNote').textContent = 'Following you at ' + Math.round(project.bpm) + ' beats a minute.';
    });
    $$('#keySheet .mode').forEach(el => el.addEventListener('click', () => {
      project.mode = el.getAttribute('data-mode');
      project.keyLocked = true;
      Store.touch(project);
      reharmonise();
      openKeySheet();
    }));
  }

  /* -------------------------------------------------------------- naming */

  function openNameSheet() {
    $('#nsInput').value = project.title || '';
    $('#nsInput').placeholder = Store.suggestTitle(project);
    $('#nsSuggest').textContent = 'Leave it empty and it stays "' + Store.suggestTitle(project) + '".';
    sheet('#nameSheet', true);
    setTimeout(() => $('#nsInput').focus(), 60);
  }

  /* ------------------------------------------------------------- arrange */

  function renderArrange() {
    $('#songLen').textContent = Store.clock(Store.songSeconds(project)) +
      ' \u00b7 ' + project.beats + ' beats a loop';
    const strip = $('#strip');
    if (!project.strip.length) {
      strip.innerHTML = '<p class="stripempty">Nothing lined up yet. Tap a scene below to put it in the song.</p>';
    } else {
      strip.innerHTML = project.strip.map((b, i) => {
        const sc = Store.scene(project, b.scene);
        return '<div class="block" data-i="' + i + '">' +
          '<button class="kill" data-kill="' + i + '" aria-label="Remove this block">\u00d7</button>' +
          '<b>' + (sc ? sc.name : '?') + '</b>' +
          '<small>' + (sc ? sc.layers.length : 0) + ' layers</small>' +
          '<div class="reps"><button data-dec="' + i + '" aria-label="Fewer repeats">&minus;</button>' +
          '<span>x' + b.repeats + '</span>' +
          '<button data-inc="' + i + '" aria-label="More repeats">+</button></div></div>';
      }).join('');
      wireStrip();
    }
    $('#stripHelp').textContent = project.strip.length
      ? 'Press and hold a block to drag it somewhere else.'
      : 'A verse, a chorus, the verse again. Two scenes are enough for a song.';
    $('#sceneList').innerHTML = project.scenes.map(s =>
      '<button class="scenebtn" data-s="' + s.id + '">Scene ' + s.name +
      ' <small>' + s.layers.length + ' layers</small></button>'
    ).join('');
    Array.prototype.forEach.call($('#sceneList').children, el => {
      el.addEventListener('click', () => {
        project.strip.push({ scene: el.getAttribute('data-s'), repeats: 2 });
        Store.touch(project);
        renderArrange();
        if (Store.guide() === 3) advanceGuide(4);
      });
    });
    $('#exportNote').textContent = isNative()
      ? 'Files land in the Downloads folder on this phone.'
      : 'Files download through the browser.';
  }

  function wireStrip() {
    const strip = $('#strip');
    $$('#strip [data-inc]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const i = +b.getAttribute('data-inc');
      project.strip[i].repeats = Math.min(16, project.strip[i].repeats + 1);
      Store.touch(project); renderArrange();
    }));
    $$('#strip [data-dec]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const i = +b.getAttribute('data-dec');
      project.strip[i].repeats = Math.max(1, project.strip[i].repeats - 1);
      Store.touch(project); renderArrange();
    }));
    $$('#strip [data-kill]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      project.strip.splice(+b.getAttribute('data-kill'), 1);
      Store.touch(project); renderArrange();
    }));

    // Press and hold to pick a block up. A short press still scrolls the strip.
    $$('#strip .block').forEach(el => {
      let hold = 0, dragging = false, startX = 0;
      el.addEventListener('pointerdown', e => {
        if (e.target.tagName === 'BUTTON') return;
        startX = e.clientX;
        hold = setTimeout(() => {
          dragging = true;
          el.classList.add('is-drag');
          el.style.touchAction = 'none';
          try { el.setPointerCapture(e.pointerId); } catch (err) {}
          buzz(12, 90);
        }, 220);
      });
      el.addEventListener('pointermove', e => {
        if (!dragging) {
          if (Math.abs(e.clientX - startX) > 8) clearTimeout(hold);
          return;
        }
        const over = document.elementFromPoint(e.clientX, e.clientY);
        const target = over && over.closest ? over.closest('.block') : null;
        if (target && target !== el && target.parentNode === strip) {
          const after = target.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING;
          strip.insertBefore(el, after ? target : target.nextSibling);
        }
      });
      const end = () => {
        clearTimeout(hold);
        if (!dragging) return;
        dragging = false;
        el.classList.remove('is-drag');
        el.style.touchAction = '';
        const order = $$('#strip .block').map(b => project.strip[+b.getAttribute('data-i')]);
        project.strip = order;
        Store.touch(project);
        renderArrange();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
  }

  function suggestShape() {
    if (project.scenes.length < 2) {
      toast('Copy the scene on the Pad first, then a shape has two things to alternate.', 4200);
      return;
    }
    const a = project.scenes[0].id, b = project.scenes[1].id;
    project.strip = [
      { scene: a, repeats: 1 }, { scene: a, repeats: 2 }, { scene: b, repeats: 2 },
      { scene: a, repeats: 2 }, { scene: b, repeats: 2 }, { scene: a, repeats: 1 }
    ];
    Store.touch(project);
    renderArrange();
    toast('Intro, verse, chorus, verse, chorus, out. Change any of it.', 3600);
  }

  async function playSong() {
    if (songSrc) { stopSong(); return; }
    const layers = Store.layerCount(project);
    if (!layers) { toast('There is nothing recorded yet.'); return; }
    Engine.stop();
    busy(true, 'Rendering the song');
    try {
      const buf = await Engine.renderSong(project);
      busy(false);
      const c = Engine.ready();
      songSrc = c.createBufferSource();
      songSrc.buffer = buf;
      songSrc.connect(c.destination);
      songStart = c.currentTime + 0.05;
      songDur = buf.duration;
      songSrc.onended = () => { songSrc = null; $('#playSong').textContent = 'Play the song'; $('#songProg').hidden = true; };
      songSrc.start(songStart);
      $('#playSong').textContent = 'Stop';
      $('#songProg').hidden = false;
    } catch (e) {
      busy(false);
      toast('The song could not be rendered on this device.');
    }
  }
  function stopSong() {
    if (!songSrc) return;
    try { songSrc.onended = null; songSrc.stop(); } catch (e) {}
    songSrc = null;
    $('#playSong').textContent = 'Play the song';
    $('#songProg').hidden = true;
  }

  /* -------------------------------------------------------------- export */

  function safeName(s) {
    return (s || 'loopwright').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'loopwright';
  }

  /* The bridge to the phone carries the file as one base64 string, so a very long
     song has to be refused rather than risk taking the app down with it. Two and a
     bit minutes of stereo audio is the line. */
  const BRIDGE_LIMIT = 24 * 1024 * 1024;

  function deliver(name, bytes, share) {
    if (window.Native && Native.saveFile) {
      if (bytes.byteLength > BRIDGE_LIMIT) {
        toast('That song is too long to write out in one file. Fewer repeats in Arrange will bring it down.', 5200);
        return false;
      }
      const uri = Native.saveFile(name, 'audio/wav', Engine.base64(bytes));
      if (!uri) { toast('This phone would not let the file be written.'); return false; }
      if (share && Native.shareUri) Native.shareUri(uri, 'audio/wav');
      return true;
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  async function exportMix(share) {
    if (!Store.layerCount(project)) { toast('There is nothing recorded yet.'); return; }
    stopSong(); Engine.stop();
    busy(true, 'Bouncing the mix');
    try {
      const buf = await Engine.renderSong(project);
      const wav = Engine.wav(buf);
      busy(false);
      if (deliver(safeName(Store.title(project)) + '.wav', wav, share)) {
        toast(isNative() ? 'Saved to Downloads.' : 'Downloaded.');
        Engine.chime(project);
      }
    } catch (e) { busy(false); toast('The mix could not be rendered.'); }
  }

  async function exportStems() {
    // One file per layer, named for the scene it belongs to, because a song with
    // two scenes has two sets of stems and unlabelled numbers help nobody.
    const all = [];
    project.scenes.forEach(sc => sc.layers.forEach((l, k) => all.push({ l: l, tag: sc.name.toLowerCase() + (k + 1) })));
    if (!all.length) { toast('There is nothing recorded yet.'); return; }
    stopSong(); Engine.stop();
    const base = safeName(Store.title(project));
    let n = 0;
    for (let i = 0; i < all.length; i++) {
      busy(true, 'Bouncing stem ' + (i + 1) + ' of ' + all.length);
      await new Promise(r => setTimeout(r, 20));
      try {
        const buf = await Engine.renderSong(project, { only: all[i].l.id });
        const name = base + '-' + all[i].tag + '-' + safeName(Voices.get(all[i].l.voice).name) + '.wav';
        if (deliver(name, Engine.wav(buf), false)) n++;
      } catch (e) {}
    }
    busy(false);
    toast(n ? 'Saved ' + n + ' stem files.' : 'The stems could not be rendered.');
  }

  /* ------------------------------------------------------------- library */

  function thumb(p) {
    const layers = Store.layerCount(p);
    const n = Math.max(1, Math.min(8, layers));
    let s = '<svg class="thumb" viewBox="0 0 46 46" aria-hidden="true">';
    s += '<circle cx="23" cy="23" r="17" fill="none" stroke="#2C231C" stroke-width="4"/>';
    for (let i = 0; i < n && layers; i++) {
      const a0 = i * 360 / n + 8, a1 = (i + 1) * 360 / n - 8;
      const rad = d => (d - 90) * Math.PI / 180;
      const x0 = 23 + 17 * Math.cos(rad(a0)), y0 = 23 + 17 * Math.sin(rad(a0));
      const x1 = 23 + 17 * Math.cos(rad(a1)), y1 = 23 + 17 * Math.sin(rad(a1));
      s += '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A17 17 0 ' +
           ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
           '" fill="none" stroke="#EE8B3F" stroke-width="4" stroke-linecap="round"/>';
    }
    s += '</svg>';
    return s;
  }

  function renderLibrary() {
    const list = Store.projects();
    $('#libLede').textContent = list.length
      ? list.length + (list.length === 1 ? ' song lives on this phone.' : ' songs live on this phone.')
      : 'Nothing here yet. Start a song and hum into it.';
    $('#cards').innerHTML = list.map(p => {
      const sub = [Store.keyName(p), Math.round(p.bpm) + ' bpm',
        Store.layerCount(p) + ' layers', Store.dayLabel(p.updated)].join(' \u00b7 ');
      return '<div class="card' + (armedProject === p.id ? ' armed' : '') + '" data-p="' + p.id + '">' +
        thumb(p) +
        '<div class="body"><b>' + escapeHtml(Store.title(p)) + '</b><span>' + sub + '</span></div>' +
        '<button class="del" data-del="' + p.id + '" aria-label="Delete this song">' +
        '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button></div>';
    }).join('');
    $$('#cards .card').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-del]')) return;
        openProject(el.getAttribute('data-p'));
      });
    });
    $$('#cards [data-del]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.getAttribute('data-del');
      if (armedProject !== id) {
        armedProject = id;
        renderLibrary();
        toast('Tap the bin again to delete that song for good.', 4000);
        setTimeout(() => { if (armedProject === id) { armedProject = null; renderLibrary(); } }, 4200);
        return;
      }
      armedProject = null;
      const wasOpen = project && project.id === id;
      Engine.stop();
      Store.remove(id);
      if (wasOpen) {
        const next = Store.projects()[0];
        project = next || Store.create();
      }
      renderLibrary(); renderPad();
      toast('Deleted.');
    }));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function openProject(id) {
    const p = Store.find(id);
    if (!p) return;
    Engine.stop(); stopSong();
    project = p;
    Store.open(id);
    setView('pad');
    renderPad();
  }

  /* -------------------------------------------------------------- guide */

  const GUIDE = [
    ['Step one of four', 'Tap the pad and hum any melody for a few seconds. Tap it again to close the loop.'],
    ['Step two of four', 'That was your hum, played as an instrument. Now choose Kit below and tap the pad again: say boots and cats over the loop.'],
    ['Step three of four', 'Tap a layer to drop it out while the loop plays. Tap it again to bring it back. That is the whole performance.'],
    ['Step four of four', 'Copy the scene, change something in the copy, then put both scenes in the song on the Arrange screen.']
  ];

  function renderGuide() {
    const g = Store.guide();
    const on = g >= 0 && g < GUIDE.length && view === 'pad';
    $('#coach').hidden = !on;
    document.body.classList.toggle('coached', on);
    if (!on) return;
    $('#coachStep').textContent = GUIDE[g][0];
    $('#coachText').textContent = GUIDE[g][1];
    // the card wraps differently on every screen, so the pad is told its real height
    requestAnimationFrame(() => {
      const h = $('#coach').offsetHeight;
      if (h) document.body.style.setProperty('--coachh', h + 'px');
    });
  }
  function advanceGuide(n) { Store.setGuide(n); renderGuide(); }

  /* --------------------------------------------------------------- views */

  function setView(v) {
    view = v;
    $('#v-pad').hidden = v !== 'pad';
    $('#v-arrange').hidden = v !== 'arrange';
    $('#v-library').hidden = v !== 'library';
    $$('#tabs .tab').forEach(t => t.classList.toggle('is-on', t.getAttribute('data-view') === v));
    if (v !== 'arrange') stopSong();
    if (v === 'arrange') renderArrange();
    if (v === 'library') renderLibrary();
    if (v === 'pad') renderPad();
    renderGuide();
  }

  /* --------------------------------------------------------- the heartbeat */

  function frame() {
    raf = requestAnimationFrame(frame);
    const ph = Engine.phase();
    const g = document.getElementById('phg');
    if (g) {
      if (ph < 0) {
        g.firstChild.setAttribute('opacity', '0');
      } else {
        g.firstChild.setAttribute('opacity', '1');
        g.setAttribute('transform', 'rotate(' + (ph * 360).toFixed(2) + ' 150 150)');
      }
    }
    if (ph >= 0) {
      const b = Math.floor(ph * project.beats);
      if (b !== lastBeat) {
        lastBeat = b;
        const pad = $('#pad');
        pad.classList.add('tick');
        setTimeout(() => pad.classList.remove('tick'), 80);
      }
    } else lastBeat = -1;

    if (padState === 'recording') {
      const arc = document.getElementById('recArc');
      if (arc && ph >= 0) arc.setAttribute('d', arcD(0.1, Math.max(0.2, ph * 360), 143));
    } else {
      const arc = document.getElementById('recArc');
      if (arc) arc.setAttribute('d', '');
    }

    const on = Engine.playing();
    if (on !== lastPlaying) {
      lastPlaying = on;
      $('#playLabel').textContent = on ? 'Stop' : 'Play';
      $('#btnPlay').classList.toggle('on', on);
    }

    if (songSrc) {
      const c = Engine.ready();
      const p = Math.max(0, Math.min(1, (c.currentTime - songStart) / songDur));
      const bar = $('#songProg').firstElementChild;
      if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
    }
  }

  /* ---------------------------------------------------------------- wiring */

  function wire() {
    $('#pad').addEventListener('click', onPadTap);
    $('#tbKey').addEventListener('click', openKeySheet);
    $('#tbTitle').addEventListener('click', openNameSheet);

    $('#btnPlay').addEventListener('click', async () => {
      Engine.ready();
      if (Engine.playing()) Engine.stop();
      else await Engine.play(project, project.openScene);
      renderPad();
    });
    $('#btnUndo').addEventListener('click', () => {
      const sc = Store.current(project);
      const last = sc.layers[sc.layers.length - 1];
      if (!last) return;
      Engine.forget(last.id);
      Store.removeLayer(project, sc, last.id);
      if (!sc.layers.length) Engine.stop();
      renderPad();
      toast('Layer removed.');
    });
    $('#btnScene').addEventListener('click', () => {
      if (project.scenes.length >= 8) { toast('Eight scenes is plenty for one song.'); return; }
      const sc = Store.current(project);
      Store.addScene(project, sc);
      Engine.stop();
      renderPad();
      toast('Scene copied. Change something in this one.');
    });

    $$('#tabs .tab').forEach(t => t.addEventListener('click', () => setView(t.getAttribute('data-view'))));

    wireLayerSheet();
    wireKeySheet();

    $('#nsClose').addEventListener('click', () => sheet('#nameSheet', false));
    $('#nsSave').addEventListener('click', () => {
      project.title = $('#nsInput').value.trim();
      Store.touch(project);
      sheet('#nameSheet', false);
      renderTop();
      // the card behind the sheet carries the old name until the list is redrawn
      if (view === 'library') renderLibrary();
    });

    $('#introGo').addEventListener('click', () => {
      Store.markIntro();
      sheet('#introSheet', false);
      Engine.ready();
      renderGuide();
    });
    $('#coachSkip').addEventListener('click', () => advanceGuide(GUIDE.length));

    $('#playSong').addEventListener('click', playSong);
    $('#shapeBtn').addEventListener('click', suggestShape);
    $('#exportMix').addEventListener('click', () => exportMix(false));
    $('#exportStems').addEventListener('click', exportStems);
    if (window.Native && Native.shareUri) {
      $('#shareMix').hidden = false;
      $('#shareMix').addEventListener('click', () => exportMix(true));
    }

    $('#newSong').addEventListener('click', () => {
      Engine.stop(); stopSong();
      project = Store.create();
      setView('pad');
      toast('New song. Hum something.');
    });

    const s = Store.settings();
    $('#countSel').value = String(s.countIn);
    $('#tightRange').value = Math.round(s.tighten * 100);
    $('#tightVal').textContent = Math.round(s.tighten * 100);
    $('#clickChk').checked = s.click;
    $('#hapChk').checked = s.haptics;
    $('#countSel').addEventListener('change', e => Store.set('countIn', parseInt(e.target.value, 10)));
    $('#tightRange').addEventListener('input', e => {
      $('#tightVal').textContent = e.target.value;
      Store.set('tighten', e.target.value / 100);
    });
    $('#clickChk').addEventListener('change', e => Store.set('click', e.target.checked));
    $('#hapChk').addEventListener('change', e => Store.set('haptics', e.target.checked));
    $('#guideBtn').addEventListener('click', () => { advanceGuide(0); setView('pad'); });

    let eraseArmed = false;
    $('#eraseBtn').addEventListener('click', () => {
      const b = $('#eraseBtn');
      if (!eraseArmed) {
        eraseArmed = true;
        b.textContent = 'Tap again to erase every song';
        $('#setNote').textContent = 'This removes every song, every layer and every recording from this phone. It cannot be undone.';
        setTimeout(() => {
          eraseArmed = false;
          b.textContent = 'Erase everything';
          $('#setNote').textContent = '';
        }, 6000);
        return;
      }
      eraseArmed = false;
      Engine.stop(); stopSong();
      Store.eraseAll();
      project = Store.create();
      b.textContent = 'Erase everything';
      $('#setNote').textContent = 'Erased.';
      renderLibrary(); renderPad();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onPause();
    });
  }

  /* ----------------------------------------------------- the shell's hooks */

  function back() {
    if (!$('#busy').hidden) return true;
    const sh = anySheet();
    if (sh) {
      if (sh.id === 'introSheet') Store.markIntro();
      sh.hidden = true;
      openLayer = null;
      return true;
    }
    if (padState === 'counting' || padState === 'recording') {
      Engine.cancelRecord();
      padState = 'idle';
      renderPad();
      return true;
    }
    if (songSrc) { stopSong(); return true; }
    if (view !== 'pad') { setView('pad'); return true; }
    return false;
  }

  function onPause() {
    Engine.cancelRecord();
    Engine.stop();
    stopSong();
    Engine.releaseMic();
    padState = 'idle';
  }
  function onResume() { }

  /* ------------------------------------------------------------------ go */

  function init() {
    project = Store.find(Store.lastOpen()) || Store.projects()[0] || Store.create();
    Store.open(project.id);
    wire();
    $('#topbar').hidden = false;
    $('#tabs').hidden = false;
    setView('pad');
    if (!Store.seenIntro()) sheet('#introSheet', true);
    frame();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    back: back, onPause: onPause, onResume: onResume,
    setView: setView, openLayerSheet: openLayerSheet, openKeySheet: openKeySheet,
    renderPad: renderPad, renderArrange: renderArrange, renderLibrary: renderLibrary,
    project: () => project, exportMix: exportMix, suggestShape: suggestShape,
    sheet: sheet, toast: toast
  };
})();

/* A top-level const is not a window property, and the shell reaches for window.App. */
window.App = App;
