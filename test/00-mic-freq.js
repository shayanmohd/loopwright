module.exports = async ({ page, log }) => {
  const out = await page.evaluate(async () => {
    const ctx = new AudioContext();
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = ctx.createMediaStreamSource(st);
    const an = ctx.createAnalyser(); an.fftSize = 8192;
    src.connect(an);
    const buf = new Float32Array(an.frequencyBinCount);
    let best = { v: -999, hz: 0 };
    const t0 = performance.now();
    while (performance.now() - t0 < 3000) {
      an.getFloatFrequencyData(buf);
      for (let i = 1; i < buf.length; i++) if (buf[i] > best.v) best = { v: buf[i], hz: i * ctx.sampleRate / an.fftSize };
      await new Promise(r => setTimeout(r, 20));
    }
    // top 5 bins of one loud frame
    an.getFloatFrequencyData(buf);
    return { sr: ctx.sampleRate, peakHz: Math.round(best.hz), peakDb: best.v.toFixed(1) };
  });
  log(JSON.stringify(out));
};
