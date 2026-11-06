/* StepCAD project page: More Works dropdown, figure lightbox, BibTeX copy. The 3D viewer lives in seq.js. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  const mwBtn = $('#moreWorksBtn'), mwDrop = $('#moreWorksDropdown');
  const setMW = open => { mwDrop.classList.toggle('show', open); mwBtn.setAttribute('aria-expanded', open); };
  mwBtn.addEventListener('click', e => { e.stopPropagation(); setMW(!mwDrop.classList.contains('show')); });
  $('#moreWorksClose').addEventListener('click', () => setMW(false));
  document.addEventListener('click', e => { if (!$('#moreWorks').contains(e.target)) setMW(false); });

  const lb = $('#lightbox'), lbImg = lb.querySelector('img');
  document.addEventListener('click', e => {
    const z = e.target.closest('img.zoomable'); if (!z) return;
    lbImg.src = z.currentSrc || z.src; lbImg.alt = z.alt; lb.hidden = false;
  });
  lb.addEventListener('click', () => { lb.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { lb.hidden = true; setMW(false); } });

  $('#copyBib').addEventListener('click', async function () {
    const lbl = this.querySelector('span:last-child');
    try { await navigator.clipboard.writeText($('#bibText').textContent); lbl.textContent = 'Copied'; }
    catch (_) { lbl.textContent = 'Select & copy'; }
    setTimeout(() => { lbl.textContent = 'Copy'; }, 1800);
  });
})();
