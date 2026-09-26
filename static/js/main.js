/* StepCAD project page: More Works dropdown, charts and small interactions.
   All numbers come from the NeurIPS 2026 paper (dataset table, main results table, ablation table). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onView = (node, fn, threshold = 0.25) => {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fn(); io.disconnect(); } }), { threshold });
    io.observe(node);
  };

  /* ---------- More Works dropdown ---------- */
  const mw = $('#moreWorks'), mwBtn = $('#moreWorksBtn'), mwDrop = $('#moreWorksDropdown');
  const setMW = open => { mwDrop.classList.toggle('show', open); mwBtn.setAttribute('aria-expanded', open); };
  mwBtn.addEventListener('click', () => setMW(!mwDrop.classList.contains('show')));
  $('#moreWorksClose').addEventListener('click', () => setMW(false));
  document.addEventListener('click', e => { if (!mw.contains(e.target)) setMW(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMW(false); });

  /* ---------- ARCADE marquee ---------- */
  const mk = (row, ids) => {
    [...ids, ...ids].forEach((i, k) => {
      const d = el('div'), im = el('img');
      im.src = `./static/img/arcade/a${String(i).padStart(2, '0')}.webp`; im.alt = k < ids.length ? 'ARCADE-1.5M sample' : ''; im.loading = 'lazy';
      d.appendChild(im); row.appendChild(d);
    });
  };
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
  const cov = $('#covChart'), dsTabs = $('#dsTabs ul'), cmpName = $('#covCmpName');
  OPS.forEach(op => {
    const r = el('div', 'cov-row'); r.appendChild(el('span', null, op));
    r.appendChild(el('div', null, `<div class="cov-line a"><div class="cov-bar a"><i></i></div><em></em></div><div class="cov-line b"><div class="cov-bar b"><i></i></div><em></em></div>`));
    cov.appendChild(r);
  });
  const setCov = name => {
    cmpName.textContent = name;
    cov.querySelectorAll('.cov-row').forEach((r, i) => {
      const [a, b] = r.querySelectorAll('.cov-line');
      a.querySelector('i').style.width = COV['ARCADE-1.5M'][i] + '%'; a.querySelector('em').textContent = COV['ARCADE-1.5M'][i].toFixed(1) + '%';
      b.querySelector('i').style.width = COV[name][i] + '%'; b.querySelector('em').textContent = COV[name][i] ? COV[name][i].toFixed(1) + '%' : '0';
    });
    dsTabs.querySelectorAll('li').forEach(li => li.classList.toggle('is-active', li.dataset.n === name));
  };
  Object.keys(COV).slice(1).forEach(n => {
    const li = el('li', null, `<a>vs ${n}</a>`); li.dataset.n = n; li.onclick = () => setCov(n); dsTabs.appendChild(li);
  });
  onView(cov, () => setCov('CADEvolve'));

  /* ---------- dataset dimensions ---------- */
  const DIMS = [
    ['Operations per program', { 'DeepCAD': 15, 'CAD-Recode': 28, 'Zero-to-CAD': 24, 'CADEvolve': 28, 'ARCADE-1.5M': 40 }],
    ['Solid operations per program', { 'DeepCAD': 1.5, 'CAD-Recode': 2.0, 'Zero-to-CAD': 5.5, 'CADEvolve': 5.5, 'ARCADE-1.5M': 8.5 }],
    ['B-rep faces per shape', { 'DeepCAD': 10, 'CAD-Recode': 17, 'Zero-to-CAD': 44, 'CADEvolve': 54, 'ARCADE-1.5M': 86 }],
  ];
  const dims = $('#dims');
  DIMS.forEach(([t, v]) => {
    const max = Math.max(...Object.values(v)), box = el('div', 'dim', `<h6>${t}</h6>`);
    Object.entries(v).forEach(([k, x]) => box.appendChild(el('div', 'dim-row' + (k === 'ARCADE-1.5M' ? ' me' : ''), `<span>${k}</span><div class="t"><i data-w="${x / max * 100}"></i></div><b>${x}</b>`)));
    dims.appendChild(box);
  });
  onView(dims, () => dims.querySelectorAll('.t i').forEach(i => { i.style.width = i.dataset.w + '%'; }));

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
  const TITLE = { IoU: 'Mean IoU by method', CD: 'Chamfer distance (lower is better)', VSR: 'Valid shape rate (%)' };
  let split = 4, metric = 'IoU';
  const bars = $('#bars'), note = $('#barsNote'), splitTabs = $('#splitTabs ul'), metricBtns = $('#metricBtns');
  METHODS.forEach((m, i) => bars.appendChild(el('div', 'bar-row' + (i === 5 ? ' ours' : i === 4 ? ' pi' : ''), `<span class="nm">${m}</span><div class="tr"><i></i></div><span class="val"></span>`)));
  SPLITS.forEach((s, i) => { const li = el('li', null, `<a>${s}</a>`); li.onclick = () => { split = i; drawBars(); }; splitTabs.appendChild(li); });
  ['IoU', 'CD', 'VSR'].forEach(m => { const b = el('button', 'button', m); b.onclick = () => { metric = m; drawBars(); }; metricBtns.appendChild(b); });
  function drawBars() {
    const vals = R[metric].map(r => r[split]);
    const scale = metric === 'IoU' ? v => v * 100 : metric === 'CD' ? v => v / 0.1 * 100 : v => Math.max(0, (v - 80) / 20) * 100;
    bars.querySelectorAll('.bar-row').forEach((row, i) => {
      row.querySelector('i').style.width = scale(vals[i]) + '%';
      row.querySelector('.val').textContent = metric === 'CD' ? vals[i].toFixed(4) : metric === 'VSR' ? vals[i].toFixed(1) : vals[i].toFixed(2);
    });
    splitTabs.querySelectorAll('li').forEach((li, i) => li.classList.toggle('is-active', i === split));
    metricBtns.querySelectorAll('.button').forEach(b => { const on = b.textContent === metric; b.classList.toggle('is-dark', on); b.classList.toggle('is-selected', on); });
    $('#barsTitle').textContent = TITLE[metric];
    const prior = R[metric].slice(0, 4).map(r => r[split]), best = metric === 'CD' ? Math.min(...prior) : Math.max(...prior), ours = R[metric][5][split];
    note.innerHTML = metric === 'IoU'
      ? `On <strong>${SPLITS[split]}</strong>, StepCAD reaches <strong>${ours.toFixed(2)}</strong> IoU vs. ${best.toFixed(2)} for the best prior method (<strong>+${GAIN[split]}%</strong>).`
      : metric === 'CD'
      ? `On <strong>${SPLITS[split]}</strong>, StepCAD lowers Chamfer distance by <strong>${((best - ours) / best * 100).toFixed(1)}%</strong> relative to the best prior method.`
      : `On <strong>${SPLITS[split]}</strong>, <strong>${ours.toFixed(2)}%</strong> of StepCAD programs execute to valid geometry (axis starts at 80%).`;
  }
  splitTabs.children[split].classList.add('is-active');
  onView(bars, drawBars, 0.2);

  /* ---------- gain chart ---------- */
  (function () {
    const host = $('#gainChart');
    const order = SPLITS.map((s, i) => ({ s, g: GAIN[i] })).sort((a, b) => a.g - b.g);
    const W = 400, H = 260, pl = 6, pb = 44, pt = 22, bw = (W - pl * 2) / order.length;
    const y = g => H - pb - (g / 100) * (H - pb - pt);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Relative IoU gain over the best prior method per split">`;
    [0, 50, 100].forEach(t => { svg += `<line x1="${pl}" x2="${W - pl}" y1="${y(t)}" y2="${y(t)}" stroke="#e1e1e1"/>`; });
    order.forEach((o, k) => {
      const x = pl + k * bw + bw * 0.17, w = bw * 0.66, top = y(o.g);
      svg += `<rect class="gbar" x="${x}" y="${H - pb}" width="${w}" height="0" rx="4" fill="#0f9f86" opacity="${0.35 + 0.65 * (o.g / 87.2)}" data-y="${top}" data-h="${H - pb - top}"/>`;
      svg += `<text class="glab" x="${x + w / 2}" y="${top - 6}" text-anchor="middle" font-size="12" font-weight="700" style="fill:#0f9f86" opacity="0">+${o.g}%</text>`;
      const [l1, l2] = o.s.split(' ');
      svg += `<text x="${x + w / 2}" y="${H - pb + 16}" text-anchor="middle" font-size="11">${l1}</text>`;
      if (l2) svg += `<text x="${x + w / 2}" y="${H - pb + 30}" text-anchor="middle" font-size="11">${l2}</text>`;
    });
    host.innerHTML = svg + '</svg>';
    onView(host, () => {
      host.querySelectorAll('.gbar').forEach((r, k) => {
        const base = +r.getAttribute('y'), th = +r.dataset.h, t0 = performance.now() + k * 80, dur = reduced ? 1 : 800;
        const tick = t => { const p = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
          r.setAttribute('y', base - th * e); r.setAttribute('height', th * e); if (p < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      host.querySelectorAll('.glab').forEach((t, k) => setTimeout(() => t.setAttribute('opacity', 1), reduced ? 0 : 600 + k * 80));
    }, 0.3);
  })();

  /* ---------- ablation staircase ---------- */
  const ST = [['CADEvolve', 'baseline data & model', 0.568], ['Π-StepCAD', 'ARCADE data, no state tokens', 0.632],
              ['Π-StepCAD', '+ intermediate geometry', 0.682], ['StepCAD', '+ geometry-aware search', 0.816]];
  const stairs = $('#stairs');
  ST.forEach(([a, b, v], i) => {
    const s = el('div', `step s${i}`);
    s.innerHTML = `<div class="col" data-h="${v / 0.9 * 100}">${i ? `<span class="delta">+${(v - ST[i - 1][2]).toFixed(3)}</span>` : ''}<b>${v.toFixed(3)}</b></div><div class="lbl">${a}<small>${b}</small></div>`;
    stairs.appendChild(s);
  });
  onView(stairs, () => {
    stairs.classList.add('in');
    stairs.querySelectorAll('.col').forEach((c, i) => setTimeout(() => {
      c.style.height = `calc((100% - ${c.nextElementSibling.offsetHeight + 8}px) * ${c.dataset.h / 100})`;
    }, reduced ? 0 : i * 160));
  }, 0.35);

  /* ---------- application tabs ---------- */
  const appTabs = document.querySelectorAll('#appTabs li'), apps = document.querySelectorAll('.app');
  appTabs.forEach(li => li.addEventListener('click', () => {
    appTabs.forEach(x => x.classList.toggle('is-active', x === li));
    apps.forEach((a, i) => a.classList.toggle('on', i === +li.dataset.i));
  }));

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox'), lbImg = lb.querySelector('img');
  document.addEventListener('click', e => {
    const z = e.target.closest('.zoomable'); if (!z) return;
    e.preventDefault(); lbImg.src = z.dataset.full; lbImg.alt = z.querySelector('img').alt; lb.hidden = false;
  });
  lb.addEventListener('click', () => { lb.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; });

  /* ---------- video: play while visible ---------- */
  const vid = document.querySelector('.video-wrap video');
  if (vid && 'IntersectionObserver' in window && !reduced) {
    new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) vid.play().catch(() => {}); else vid.pause(); }), { threshold: 0.5 }).observe(vid);
  }

  /* ---------- BibTeX copy ---------- */
  $('#copyBib').addEventListener('click', async function () {
    const lbl = this.querySelector('span:last-child');
    try { await navigator.clipboard.writeText($('#bibText').textContent); lbl.textContent = 'Copied'; }
    catch (_) { lbl.textContent = 'Select & copy'; }
    setTimeout(() => { lbl.textContent = 'Copy'; }, 1800);
  });
})();
