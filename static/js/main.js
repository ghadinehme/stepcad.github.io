/* StepCAD project page: charts, galleries and small interactions.
   All numbers come from the NeurIPS 2026 paper (Tables 1–3). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- "More Works" dropdown ---------- */
  const mw = $('#moreWorks'), mwBtn = $('#moreWorksBtn'), mwMenu = $('#moreWorksMenu');
  const setMW = open => { mwMenu.classList.toggle('show', open); mwBtn.setAttribute('aria-expanded', open); };
  mwBtn.addEventListener('click', () => setMW(!mwMenu.classList.contains('show')));
  $('#moreWorksClose').addEventListener('click', () => { setMW(false); mwBtn.focus(); });
  document.addEventListener('click', e => { if (!mw.contains(e.target)) setMW(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && mwMenu.classList.contains('show')) { setMW(false); mwBtn.focus(); } });

  /* ---------- reveal on scroll ---------- */
  const onView = (node, fn, threshold = 0.25) => {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fn(); io.disconnect(); } }), { threshold });
    io.observe(node);
  };
  document.querySelectorAll('.reveal').forEach(n => onView(n, () => n.classList.add('in'), 0.12));

  /* ---------- stat count-up ---------- */
  document.querySelectorAll('.stat b[data-count]').forEach(b => {
    const target = parseFloat(b.dataset.count), suf = b.dataset.suffix || '', dec = (b.dataset.count.split('.')[1] || '').length;
    if (reduced) return;
    b.textContent = (0).toFixed(dec) + suf;
    onView(b, () => {
      const t0 = performance.now(), dur = 1400;
      const tick = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        b.textContent = (target * e).toFixed(dec) + suf; if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, 0.6);
  });

  /* ---------- ARCADE marquee ---------- */
  const mk = (row, ids) => { const frag = document.createDocumentFragment();
    [...ids, ...ids].forEach((i, k) => { const d = el('div'); const im = el('img');
      im.src = `static/img/arcade/a${String(i).padStart(2, '0')}.webp`; im.alt = k < ids.length ? 'ARCADE-1.5M sample' : ''; im.loading = 'lazy';
      d.appendChild(im); frag.appendChild(d); });
    row.appendChild(frag); };
  mk($('#mq1'), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  mk($('#mq2'), [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

  /* ---------- operation coverage ---------- */
  const OPS = ['Extrude', 'Revolve', 'Sweep', 'Loft', 'Fillet', 'Chamfer', 'Shell', 'Mirror'];
  const COV = {
    'ARCADE-1.5M': [95.42, 12.13, 25.37, 13.10, 34.77, 33.66, 10.01, 6.70],
    'CADEvolve': [83.05, 4.80, 5.75, 8.48, 27.78, 4.76, 1.95, 0.08],
    'Zero-to-CAD': [85.99, 18.73, 3.88, 4.17, 36.92, 74.66, 15.00, 1.56],
    'CAD-Recode': [100, 0, 0, 0, 0, 0, 0, 0],
    'DeepCAD': [100, 0, 0, 0, 0, 0, 0, 0],
  };
  const covChart = $('#covChart'), dsSeg = $('#dsSeg'), cmpName = $('#covCmpName');
  OPS.forEach((op, i) => {
    const r = el('div', 'cov-row'); r.appendChild(el('span', null, op));
    r.appendChild(el('div', 'cov-bars', `<div class="cov-line a"><div class="cov-bar a"><i></i></div><em></em></div><div class="cov-line b"><div class="cov-bar b"><i></i></div><em></em></div>`));
    covChart.appendChild(r);
  });
  const setCov = name => {
    cmpName.textContent = name;
    covChart.querySelectorAll('.cov-row').forEach((r, i) => {
      const [a, b] = r.querySelectorAll('.cov-line');
      a.querySelector('i').style.width = COV['ARCADE-1.5M'][i] + '%'; a.querySelector('em').textContent = COV['ARCADE-1.5M'][i].toFixed(1) + '%';
      b.querySelector('i').style.width = COV[name][i] + '%'; b.querySelector('em').textContent = COV[name][i] ? COV[name][i].toFixed(1) + '%' : '0';
    });
    dsSeg.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', x.dataset.n === name));
  };
  Object.keys(COV).slice(1).forEach(n => { const b = el('button', null, 'vs ' + n); b.dataset.n = n; b.setAttribute('role', 'tab'); b.onclick = () => setCov(n); dsSeg.appendChild(b); });
  onView(covChart, () => setCov('CADEvolve'));

  /* ---------- dataset dimensions ---------- */
  const DIMS = [
    { t: 'Operations per program', u: 'avg', v: { 'DeepCAD': 15, 'CAD-Recode': 28, 'Zero-to-CAD': 24, 'CADEvolve': 28, 'ARCADE-1.5M': 40 } },
    { t: 'Solid operations per program', u: 'avg', v: { 'DeepCAD': 1.5, 'CAD-Recode': 2.0, 'Zero-to-CAD': 5.5, 'CADEvolve': 5.5, 'ARCADE-1.5M': 8.5 } },
    { t: 'B-rep faces per shape', u: 'avg', v: { 'DeepCAD': 10, 'CAD-Recode': 17, 'Zero-to-CAD': 44, 'CADEvolve': 54, 'ARCADE-1.5M': 86 } },
  ];
  const dims = $('#dims');
  DIMS.forEach(d => {
    const max = Math.max(...Object.values(d.v));
    const box = el('div', 'dim'); box.appendChild(el('h4', null, `${d.t}<span>${d.u}</span>`));
    const rows = el('div', 'dim-rows');
    Object.entries(d.v).forEach(([k, v]) => {
      const r = el('div', 'dim-row' + (k === 'ARCADE-1.5M' ? ' me' : ''), `<span>${k}</span><div class="t"><i data-w="${(v / max) * 100}"></i></div><b>${v}</b>`);
      rows.appendChild(r);
    });
    box.appendChild(rows); dims.appendChild(box);
  });
  onView(dims, () => dims.querySelectorAll('.t i').forEach(i => i.style.width = i.dataset.w + '%'));

  /* ---------- benchmark results ---------- */
  const SPLITS = ['DeepCAD', 'Fusion 360', 'ABC Easy', 'ABC Medium', 'ABC Hard', 'Mechanical', 'Organic'];
  const METHODS = ['CAD-Recode', 'Cadrille', 'CADEvolve', 'CADReasoner', 'Π-StepCAD', 'StepCAD'];
  const R = {
    IoU: [[.79, .65, .76, .37, .35, .66, .40], [.78, .66, .75, .40, .37, .65, .42], [.74, .63, .72, .39, .39, .64, .40],
          [.86, .71, .83, .43, .31, .67, .31], [.82, .75, .77, .53, .52, .78, .53], [.89, .83, .89, .74, .73, .89, .71]],
    CD: [[.0207, .0268, .0237, .0349, .0328, .0297, .0570], [.0211, .0268, .0234, .0359, .0337, .0295, .0549],
         [.0389, .0466, .0413, .0638, .0617, .0486, .0890], [.0197, .0326, .0242, .0419, .0627, .0413, .0968],
         [.0205, .0240, .0227, .0320, .0283, .0259, .0446], [.0191, .0228, .0200, .0302, .0263, .0213, .0420]],
    VSR: [[96.22, 92.63, 95.02, 88.35, 87.57, 94.01, 87.84], [96.97, 94.87, 96.58, 92.30, 92.18, 96.80, 91.03],
          [99.70, 97.60, 98.88, 95.82, 95.27, 96.90, 96.91], [99.47, 98.33, 99.60, 97.10, 92.80, 98.80, 96.60],
          [100, 99.97, 100, 100, 99.95, 100, 100], [100, 99.97, 100, 100, 99.95, 100, 100]],
  };
  const GAIN = [3.5, 16.9, 7.2, 72.1, 87.2, 32.8, 69.0];
  const METRIC_LABEL = { IoU: 'Mean IoU by method', CD: 'Chamfer distance by method (lower is better)', VSR: 'Valid shape rate by method (%)' };
  let split = 4, metric = 'IoU';
  const bars = $('#bars'), barsNote = $('#barsNote'), splitSeg = $('#splitSeg'), metricSeg = $('#metricSeg');
  METHODS.forEach((m, i) => bars.appendChild(el('div', 'bar-row' + (i === 5 ? ' ours' : i === 4 ? ' pi' : ''), `<span class="nm">${m}</span><div class="tr"><i></i></div><span class="val"></span>`)));
  SPLITS.forEach((s, i) => { const b = el('button', null, s); b.setAttribute('role', 'tab'); b.onclick = () => { split = i; drawBars(); }; splitSeg.appendChild(b); });
  ['IoU', 'CD', 'VSR'].forEach(m => { const b = el('button', null, m); b.onclick = () => { metric = m; drawBars(); }; metricSeg.appendChild(b); });
  function drawBars() {
    const vals = R[metric].map(r => r[split]);
    const scale = metric === 'IoU' ? v => v / 1 * 100 : metric === 'CD' ? v => v / 0.1 * 100 : v => Math.max(0, (v - 80) / 20) * 100;
    bars.querySelectorAll('.bar-row').forEach((row, i) => {
      row.querySelector('i').style.width = scale(vals[i]) + '%';
      row.querySelector('.val').textContent = metric === 'CD' ? vals[i].toFixed(4) : metric === 'VSR' ? vals[i].toFixed(1) : vals[i].toFixed(2);
    });
    splitSeg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', i === split));
    metricSeg.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.textContent === metric));
    bars.closest('.card').querySelector('h3').textContent = METRIC_LABEL[metric];
    const prior = R[metric].slice(0, 4).map(r => r[split]);
    const best = metric === 'CD' ? Math.min(...prior) : Math.max(...prior);
    const ours = R[metric][5][split];
    const rel = metric === 'CD' ? (best - ours) / best * 100 : (ours - best) / best * 100;
    barsNote.innerHTML = metric === 'IoU'
      ? `On <b>${SPLITS[split]}</b>, StepCAD reaches IoU <b>${ours.toFixed(2)}</b> vs. ${best.toFixed(2)} for the best prior method (<b>+${GAIN[split]}%</b>).`
      : metric === 'CD'
      ? `On <b>${SPLITS[split]}</b>, StepCAD lowers Chamfer distance by <b>${rel.toFixed(1)}%</b> relative to the best prior method.`
      : `On <b>${SPLITS[split]}</b>, <b>${ours.toFixed(2)}%</b> of StepCAD programs execute to valid geometry (axis starts at 80%).`;
  }
  onView(bars, drawBars, 0.2);
  // set initial selection state so tabs look right before the chart animates in
  splitSeg.children[split].setAttribute('aria-selected', 'true'); metricSeg.children[0].setAttribute('aria-selected', 'true');

  /* ---------- gain chart (SVG) ---------- */
  (function () {
    const host = $('#gainChart');
    const order = SPLITS.map((s, i) => ({ s, g: GAIN[i], i })).sort((a, b) => a.g - b.g);
    const W = 420, H = 300, pl = 8, pb = 58, pt = 26, bw = (W - pl * 2) / order.length;
    const y = g => H - pb - (g / 100) * (H - pb - pt);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Relative IoU gain over best prior method, per split">`;
    svg += `<defs><linearGradient id="gg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0f9f86"/><stop offset="1" stop-color="#2fd1b2"/></linearGradient></defs>`;
    [0, 25, 50, 75, 100].forEach(t => svg += `<line x1="${pl}" x2="${W - pl}" y1="${y(t)}" y2="${y(t)}" stroke="currentColor" stroke-opacity=".08"/>`);
    order.forEach((o, k) => {
      const x = pl + k * bw + bw * 0.16, w = bw * 0.68, top = y(o.g);
      svg += `<rect class="gbar" x="${x}" y="${H - pb}" width="${w}" height="0" rx="6" fill="url(#gg)" data-y="${top}" data-h="${H - pb - top}" opacity="${0.45 + 0.55 * (o.g / 87.2)}"/>`;
      svg += `<text x="${x + w / 2}" y="${top - 8}" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--accent-ink)" class="glab" opacity="0">+${o.g}%</text>`;
      const [l1, l2] = o.s.split(' ');
      svg += `<text x="${x + w / 2}" y="${H - pb + 20}" text-anchor="middle" font-size="12" font-weight="600">${l1}</text>`;
      if (l2) svg += `<text x="${x + w / 2}" y="${H - pb + 36}" text-anchor="middle" font-size="12" font-weight="600">${l2}</text>`;
    });
    svg += '</svg>';
    host.innerHTML = svg;
    host.previousElementSibling.querySelector('p').textContent = 'Sorted by gain: the largest jumps are on ABC Hard, ABC Medium and organic shapes, where one-shot methods struggle most.';
    onView(host, () => {
      host.querySelectorAll('.gbar').forEach((r, k) => {
        const H0 = +r.getAttribute('y'), ty = +r.dataset.y, th = +r.dataset.h, t0 = performance.now() + k * 90, dur = reduced ? 1 : 900;
        const tick = t => { const p = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
          r.setAttribute('y', H0 - th * e); r.setAttribute('height', th * e); if (p < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      host.querySelectorAll('.glab').forEach((t, k) => setTimeout(() => { t.style.transition = 'opacity .4s'; t.setAttribute('opacity', 1); }, reduced ? 0 : 700 + k * 90));
    }, 0.3);
  })();

  /* ---------- policy vs. search comparisons ---------- */
  const CMP = [['0252', 'Gear'], ['0677', 'Five-arm spider'], ['0471', 'Angled bracket'], ['0762', 'Bushing']];
  const cg = $('#compareGrid');
  CMP.forEach(([id, name]) => {
    const c = el('div', 'cmp-card');
    c.innerHTML = `<div class="cmp-imgs">${[['in', 'Input mesh'], ['gen', 'Policy'], ['best', '+ Search']].map(([k, l]) =>
      `<figure><div class="im"><img src="static/img/compare/${id}_${k}.webp" alt="${name}: ${l}" loading="lazy"></div><figcaption>${l}</figcaption></figure>`).join('')}</div>`;
    cg.appendChild(c);
  });

  /* ---------- ablation staircase ---------- */
  const ST = [
    ['CADEvolve', 'baseline data & model', 0.568],
    ['Π-StepCAD', 'ARCADE data, no state tokens', 0.632],
    ['Π-StepCAD', '+ intermediate geometry', 0.682],
    ['StepCAD', '+ geometry-aware search', 0.816],
  ];
  const stairs = $('#stairs');
  ST.forEach(([a, b, v], i) => {
    const s = el('div', `step s${i}`);
    s.innerHTML = `<div class="col" data-h="${(v / 0.9) * 100}">${i ? `<span class="delta">+${(v - ST[i - 1][2]).toFixed(3)}</span>` : ''}<b>${v.toFixed(3)}</b></div><div class="lbl">${a}<small>${b}</small></div>`;
    stairs.appendChild(s);
  });
  onView(stairs, () => {
    stairs.classList.add('in');
    stairs.querySelectorAll('.col').forEach((c, i) => setTimeout(() => {
      const lblH = c.nextElementSibling.offsetHeight + 10;
      c.style.height = `calc((100% - ${lblH}px) * ${c.dataset.h / 100})`;
    }, reduced ? 0 : i * 180));
  }, 0.35);

  /* ---------- application tabs ---------- */
  const appSeg = $('#appSeg'), apps = document.querySelectorAll('.app');
  appSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    appSeg.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', x === b));
    apps.forEach((a, i) => a.classList.toggle('on', i === +b.dataset.i));
  });

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox'), lbImg = lb.querySelector('img');
  document.addEventListener('click', e => {
    const z = e.target.closest('.zoomable'); if (!z) return;
    lbImg.src = z.dataset.full; lbImg.alt = z.querySelector('img').alt; lb.hidden = false;
  });
  lb.addEventListener('click', () => { lb.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; });

  /* ---------- walkthrough video: play when visible ---------- */
  const vid = document.querySelector('.video-card video');
  if (vid && 'IntersectionObserver' in window && !reduced) {
    new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) vid.play().catch(() => {}); else vid.pause(); }), { threshold: 0.5 }).observe(vid);
  }

  /* ---------- BibTeX copy ---------- */
  $('#copyBib').addEventListener('click', async function () {
    try { await navigator.clipboard.writeText($('#bibText').textContent); this.textContent = 'Copied'; this.classList.add('ok'); }
    catch (_) { this.textContent = 'Select & copy'; }
    setTimeout(() => { this.textContent = 'Copy'; this.classList.remove('ok'); }, 1800);
  });
})();
