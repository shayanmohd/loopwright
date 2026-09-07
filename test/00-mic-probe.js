/* What does the fake microphone actually sound like, and what does the DSP make of it. */
module.exports = async ({ page, wait, log }) => {
  const out = await page.evaluate(async () => {
    const C = window.AudioContext;
    const ctx = new C();
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    const src = ctx.createMediaStreamSource(st);
    const sp = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    sp.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(sp);
    const sink = ctx.createGain(); sink.gain.value = 0; sp.connect(sink); sink.connect(ctx.destination);
    await new Promise(r => setTimeout(r, 4000));
    sp.disconnect();
    let n = 0; chunks.forEach(c => n += c.length);
    const all = new Float32Array(n); let o = 0;
    chunks.forEach(c => { all.set(c, o); o += c.length; });
    const peak = DSP.peak(all);
    const mel = DSP.hearMelody(all, ctx.sampleRate);
    const dr = DSP.hearDrums(all, ctx.sampleRate);
    // rms profile per 100ms
    const step = Math.round(ctx.sampleRate * 0.1);
    const prof = [];
    for (let i = 0; i + step < all.length; i += step) {
      let s = 0; for (let k = 0; k < step; k++) s += all[i+k]*all[i+k];
      prof.push(Math.sqrt(s/step).toFixed(3));
    }
    return { sr: ctx.sampleRate, samples: n, peak: peak.toFixed(4), notes: mel.notes.length,
      firstNotes: mel.notes.slice(0,6), hits: dr.hits.length, prof: prof.slice(0, 40).join(' ') };
  });
  log(JSON.stringify(out, null, 1));
};
