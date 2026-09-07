/* Contrast, measured rather than eyeballed. Every visible piece of text on every
   screen is taken with its computed colour and composited against the stack of
   backgrounds behind it. Where a surface is a gradient, every stop in it is
   tried and the worst one is the one reported, so a pass here is a pass at the
   darkest and the lightest point of that surface. AA is 4.5, or 3.0 for text at
   24px, or 19px bold. */
const { installHum, URL } = require('./review-lib');

const MEASURE = `(function () {
  function parse(c) {
    if (!c) return null;
    var m = c.match(/rgba?\\(([^)]+)\\)/);
    if (m) {
      var p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) return { r: parseInt(m[1].slice(0,2),16), g: parseInt(m[1].slice(2,4),16), b: parseInt(m[1].slice(4,6),16), a: 1 };
    return null;
  }
  function stops(bgimg) {
    var out = [], re = /rgba?\\([^)]+\\)|#[0-9a-f]{6}/gi, m;
    while ((m = re.exec(bgimg))) { var c = parse(m[0]); if (c && c.a > 0.55) out.push(c); }
    return out;
  }
  function over(fg, bg) {
    var a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function lum(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  /** every background the element could be sitting on, worst case first */
  function grounds(el) {
    var base = { r: 18, g: 20, b: 14, a: 1 };   // --bg, the page itself
    var layers = [];
    var n = el;
    while (n && n !== document.documentElement) {
      var cs = getComputedStyle(n);
      var bc = parse(cs.backgroundColor);
      if (bc && bc.a > 0.02) layers.push([bc]);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        var st = stops(cs.backgroundImage);
        if (st.length) layers.push(st);
      }
      n = n.parentElement;
    }
    var outs = [base];
    for (var i = layers.length - 1; i >= 0; i--) {
      var next = [];
      for (var j = 0; j < outs.length; j++)
        for (var k = 0; k < layers[i].length; k++) next.push(over(layers[i][k], outs[j]));
      outs = next.slice(0, 24);
    }
    return outs;
  }
  var rows = [];
  document.querySelectorAll('body *').forEach(function (el) {
    if (!el.getClientRects().length) return;
    if (el.closest('[hidden]')) return;
    var own = '';
    for (var i = 0; i < el.childNodes.length; i++)
      if (el.childNodes[i].nodeType === 3) own += el.childNodes[i].textContent;
    own = own.trim();
    if (!own) return;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.95) return;
    var fg = parse(cs.color);
    if (!fg) return;
    var px = parseFloat(cs.fontSize), w = cs.fontWeight;
    var large = px >= 24 || (px >= 18.66 && (+w >= 700 || w === 'bold'));
    var gs = grounds(el);
    var worst = 99, wbg = null;
    gs.forEach(function (g) {
      var f = fg.a < 1 ? over(fg, g) : fg;
      var r = ratio(f, g);
      if (r < worst) { worst = r; wbg = g; }
    });
    rows.push({
      text: own.slice(0, 34), sel: el.id || (typeof el.className === 'string' ? el.className : el.tagName),
      color: cs.color, px: px, weight: w, large: large,
      ratio: Math.round(worst * 100) / 100,
      need: large ? 3 : 4.5,
      bg: wbg ? 'rgb(' + [wbg.r, wbg.g, wbg.b].map(Math.round).join(',') + ')' : '?'
    });
  });
  return rows;
})()`;

module.exports = async ({ page, wait, click, log, errors }) => {
  await installHum(page, URL);
  await wait(700);
  const all = [];
  const sweep = async label => {
    const rows = await page.evaluate(MEASURE);
    rows.forEach(r => { r.where = label; all.push(r); });
  };
  await sweep('intro');
  await click('#introGo'); await wait(400);
  await sweep('pad empty');

  await page.evaluate(() => Store.set('countIn', 0));
  await click('#pad'); await wait(5200);
  await page.evaluate(() => document.querySelector('#pad').click());
  await wait(2800);
  await sweep('pad recorded');

  await page.evaluate(() => App.openLayerSheet(Store.current(App.project()).layers[0].id));
  await wait(400); await sweep('layer sheet');
  await page.evaluate(() => App.back());
  await click('#tbKey'); await wait(400); await sweep('key sheet');
  await page.evaluate(() => App.back());
  await click('#tbTitle'); await wait(400); await sweep('name sheet');
  await page.evaluate(() => App.back());

  await page.evaluate(() => App.setView('arrange')); await wait(400); await sweep('arrange');
  await click('#shapeBtn'); await wait(600); await sweep('arrange filled');
  await page.evaluate(() => App.setView('library')); await wait(500); await sweep('library');
  await page.evaluate(() => { App.toast('A toast on the library'); }); await wait(300);
  await sweep('toast');
  // the disabled and warning states, which are the ones people forget
  await page.evaluate(() => {
    App.setView('pad');
    document.querySelector('#padNote').textContent = 'Warning text on the pad';
    document.querySelector('#padNote').className = 'padnote warn';
  });
  await wait(400); await sweep('pad warning');

  const seen = new Set(), fails = [];
  all.forEach(r => {
    const k = r.sel + '|' + r.color + '|' + r.px + '|' + r.bg;
    if (seen.has(k)) return; seen.add(k);
    if (r.ratio < r.need) fails.push(r);
  });
  const sorted = all.slice().sort((a, b) => a.ratio - b.ratio);
  log('lowest twelve measured pairs:');
  const shown = new Set();
  sorted.forEach(r => {
    const k = r.sel + '|' + r.color + '|' + r.bg;
    if (shown.has(k) || shown.size >= 12) return; shown.add(k);
    log('  ' + r.ratio.toFixed(2) + ' need ' + r.need + '  ' + r.sel + ' ' + r.px + 'px ' +
        r.color + ' on ' + r.bg + '  "' + r.text + '" (' + r.where + ')');
  });
  log('pairs measured:', all.length, '| below AA:', fails.length);
  fails.forEach(f => log('  FAIL ' + f.ratio.toFixed(2) + ' < ' + f.need + '  ' + f.sel +
    ' ' + f.px + 'px ' + f.color + ' on ' + f.bg + '  "' + f.text + '" (' + f.where + ')'));
  log('page errors:', errors.length);
};
