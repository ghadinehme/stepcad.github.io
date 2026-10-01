/* StepCAD page: method loop, search tree and reconstruction gallery, all on CADBench parts.
   Data: static/models/method.json (policy steps of the stepped boss), search_trace.json (that run's beam-search log),
   sections.json (gallery IoUs and splits). All images are renders of real geometry. */
(function () {
  'use strict';
  const V = '20261001a';
  const $ = s => document.querySelector(s);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hl = s => esc(s)
    .replace(/\.([a-zA-Z_]+)\(/g, '.<span class="f">$1</span>(')
    .replace(/^([a-z_][a-z_0-9]*) =/gm, '<span class="v">$1</span> =')
    .replace(/(-?\b\d+\.\d+|\b\d+\b)(?![^<]*>)/g, '<span class="n">$1</span>');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const img = p => `./static/img/${p}.webp?v=${V}`;
  const KIND = { sketch: 'Edit sketch', ccut: 'Complement cut', refine: 'Refine parameters', skip: 'Skip operation' };
  const KCOL = { sketch: '#8b5cf6', ccut: '#ec4899', refine: '#0ea5e9', skip: '#64748b' };
  const inView = (el, on, off) => new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? on : off)()), { threshold: 0.2 }).observe(el);
  const get = u => fetch(`${u}?v=${V}`).then(r => r.json());

  /* ---------- Stage I: closed-loop diagram + filmstrip ---------- */
  get('./static/models/method.json').then(pin => {
    const P = pin.policy, fs = $('#filmstrip');
    fs.innerHTML = P.map((p, k) => `<button class="fs-item" data-k="${k}"><img src="${img(`method/m_p${k}`)}" alt="Policy step ${k + 1}" loading="lazy"><span class="fs-op">${k + 1} · ${p.op}</span><span class="fs-iou">${p.iou.toFixed(3)}</span></button>`).join('')
      + `<div class="fs-sep"><span>search</span></div><button class="fs-item final" data-k="final"><img src="${img('method/m_final')}" alt="After search" loading="lazy"><span class="fs-op">refined</span><span class="fs-iou">${pin.final_iou.toFixed(3)}</span></button>`;
    // preload
    P.forEach((_, k) => { const i = new Image(); i.src = img(`method/m_p${k}`); });
    let k = 0, timer = null;
    const show = i => {
      k = i;
      $('#ldState').src = img(`method/m_p${i}`);
      $('#ldStep').textContent = `step ${i + 1} of ${P.length}`;
      $('#ldIou').textContent = P[i].iou.toFixed(3);
      $('#ldCode').innerHTML = hl(P[i].code.split('\n').slice(-4).join('\n'));
      fs.querySelectorAll('.fs-item').forEach(b => b.classList.toggle('on', b.dataset.k === String(i)));
      const d = $('#loopDiagram'); d.classList.remove('pulse'); void d.offsetWidth; d.classList.add('pulse');
    };
    const play = () => { clearInterval(timer); if (!reduced) timer = setInterval(() => show((k + 1) % P.length), 1800); };
    fs.addEventListener('click', e => {
      const b = e.target.closest('.fs-item'); if (!b || b.dataset.k === 'final') return;
      show(+b.dataset.k); play();
    });
    show(0);
    inView($('#loopDiagram'), play, () => clearInterval(timer));
  });

  /* ---------- Stage II: the real beam search on the stepped pin ---------- */
  $('#kindLegend').innerHTML = Object.keys(KIND).map(k => `<span><i style="background:${KCOL[k]}"></i>${KIND[k]}</span>`).join('');
  get('./static/models/search_trace.json').then(tr => {
    const host = $('#searchTree'), note = $('#treeNote');
    const ops = tr.ops, n = ops.length;
    const all = ops.flatMap(o => o.cands.map(c => c.iou));
    const lo = Math.floor((Math.min(...all) - 0.03) * 10) / 10, hi = 1;
    const W = 560, H = 300, pl = 34, pr = 12, pt = 14, pb = 40;
    const x = i => pl + 24 + (i / (n - 1)) * (W - pl - pr - 48);
    const y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Beam search trace: candidates tried at each operation and the two kept">`;
    for (let t = Math.ceil(lo * 10) / 10; t <= 1.0001; t += 0.1) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" class="gl"/><text x="${pl - 6}" y="${y(t) + 3}" text-anchor="end" class="ax">${t.toFixed(1)}</text>`;
    s += `<text x="12" y="${pt + (H - pt - pb) / 2}" transform="rotate(-90 12 ${pt + (H - pt - pb) / 2})" text-anchor="middle" class="ax">IoU of program so far</text>`;
    // beam positions per op
    const beam = ops.map(o => { const b = []; o.cands.forEach(c => { if (c.beam != null) b[c.beam] = c; }); return b; });
    // edges: every candidate from its parent beam node; kept ones drawn solid
    ops.forEach((o, i) => o.cands.forEach((c, ci) => {
      if (i === 0) return;
      const par = beam[i - 1][c.parent]; if (!par) return;
      s += `<line class="edge${c.beam != null ? ' kept' : ''}" x1="${x(i - 1)}" y1="${y(par.iou)}" x2="${x(i)}" y2="${y(c.iou)}" data-i="${i}" data-c="${ci}"/>`;
    }));
    // best path
    s += `<polyline class="best" points="${beam.map((b, i) => `${x(i)},${y(b[0].iou)}`).join(' ')}"/>`;
    ops.forEach((o, i) => {
      // jitter duplicate IoUs so every candidate is visible
      const seen = {};
      o.cands.forEach((c, ci) => {
        const key = c.iou.toFixed(3); const j = (seen[key] = (seen[key] || 0) + 1) - 1;
        const cx = x(i) + (c.beam != null ? 0 : (j % 2 ? 1 : -1) * (6 + 4 * Math.floor(j / 2)));
        s += `<circle class="cand${c.beam != null ? ' kept' : ''}${c.beam === 0 ? ' top' : ''}" cx="${cx}" cy="${y(c.iou)}" r="${c.beam != null ? 6 : 4.2}" fill="${KCOL[c.kind]}" data-i="${i}" data-c="${ci}"/>`;
      });
      s += `<text x="${x(i)}" y="${H - pb + 16}" text-anchor="middle" class="opl">op ${i + 1}</text><text x="${x(i)}" y="${H - pb + 29}" text-anchor="middle" class="opn">${o.op}</text>`;
    });
    const last = beam[n - 1][0];
    s += `<text x="${x(n - 1) - 8}" y="${y(last.iou) - 10}" text-anchor="end" class="endl">${last.iou.toFixed(3)}</text>`;
    host.innerHTML = s + '</svg>';
    const svg = host.querySelector('svg');
    const describe = (i, ci) => {
      const c = ops[i].cands[ci];
      const kept = c.beam === 0 ? 'kept as the <b>best</b> program' : c.beam === 1 ? 'kept as the <b>runner-up</b>' : 'discarded';
      return `Op ${i + 1} (${ops[i].op}): <b style="color:${KCOL[c.kind]}">${KIND[c.kind]}</b> from beam ${c.parent + 1} → IoU <b>${c.iou.toFixed(3)}</b>, ${kept}.`;
    };
    const def = `Each column is one operation of the policy's program. Dots are the edits tried there, scored on the program so far. Big dots are the two programs the beam keeps; the line follows the best one from ${beam[0][0].iou.toFixed(3)} to ${last.iou.toFixed(3)}.`;
    note.innerHTML = def;
    svg.addEventListener('mouseover', e => {
      const t = e.target.closest('.cand'); if (!t) return;
      svg.querySelectorAll('.hi').forEach(z => z.classList.remove('hi'));
      t.classList.add('hi'); svg.querySelector(`.edge[data-i="${t.dataset.i}"][data-c="${t.dataset.c}"]`)?.classList.add('hi');
      note.innerHTML = describe(+t.dataset.i, +t.dataset.c);
    });
    svg.addEventListener('mouseleave', () => { svg.querySelectorAll('.hi').forEach(z => z.classList.remove('hi')); note.innerHTML = def; });
    svg.addEventListener('click', e => { const t = e.target.closest('.cand'); if (t) note.innerHTML = describe(+t.dataset.i, +t.dataset.c); });
  });
  document.querySelectorAll('.edit-card').forEach(c => c.querySelector('.ec-dot').style.background = KCOL[c.dataset.kind]);

  /* ---------- reconstruction gallery ---------- */
  get('./static/models/sections.json').then(d => {
    // gallery
    $('#gallery').innerHTML = d.gallery.map(g => {
      const n = String(g.n).padStart(2, '0');
      return `<button class="g-card" aria-label="Reconstruction ${g.n + 1}: IoU ${g.iou.toFixed(3)}">
        <span class="g-imgs"><img class="g-in" src="${img(`gallery/gal_${n}_in`)}" alt="Input mesh" loading="lazy"><img class="g-out" src="${img(`gallery/gal_${n}_out`)}" alt="StepCAD reconstruction" loading="lazy"></span>
        <span class="g-foot"><span class="g-lab"><i class="in">Input</i><i class="out">StepCAD</i></span><span class="g-iou">IoU ${g.iou.toFixed(3)}</span></span><span class="g-split">${g.split}</span></button>`;
    }).join('');
    document.querySelectorAll('.g-card').forEach(c => c.addEventListener('click', () => c.classList.toggle('flip')));
  });
})();
