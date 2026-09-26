/* StepCAD interactive replay.
   Stage I: the policy's CadQuery program, executed one operation at a time.
   Stage II: the search edits (policy program -> refined program) applied one at a time in program order.
   Every intermediate program is real and was executed offline; IoU is measured against the input mesh.
   Material added / removed by each search edit comes from exact B-rep Booleans between consecutive programs. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = s => document.querySelector(s);
const canvas = $('#viewer');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KIND = {
  sketch: 'Edit sketch', ccut: 'Complement cut', refine: 'Refine parameters',
  skip: 'Skip operation', replace: 'Replace operation', add: 'Add operation',
};
const COL = { policy: new THREE.Color('#3b7ddd'), search: new THREE.Color('#0f9f86') };

/* ---------- renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
camera.position.set(3.6, 2.8, 4.2);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, autoRotate: !reduced, autoRotateSpeed: 0.9, minDistance: 1.5, maxDistance: 12, enablePan: false });

const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(3, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 20 });
key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
scene.add(key, new THREE.HemisphereLight(0xffffff, 0xdfe5ee, 0.55));

const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.12 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
const grid = new THREE.GridHelper(8, 32, 0xc9d1dc, 0xe1e6ed);
grid.material.transparent = true; grid.material.opacity = 0.8;
scene.add(floor, grid);
const stage = new THREE.Group(); scene.add(stage);

/* ---------- materials & objects ---------- */
const solidMat = new THREE.MeshPhysicalMaterial({ color: COL.policy, metalness: 0.05, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.6, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide });
const edgeMat = new THREE.LineBasicMaterial({ color: 0x1b2433, transparent: true, opacity: 0.45 });
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8a9bb8, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
const ghostEdgeMat = new THREE.LineDashedMaterial({ color: 0x6d7f9e, transparent: true, opacity: 0.5, dashSize: 0.035, gapSize: 0.025, depthWrite: false });
const addMat = new THREE.MeshStandardMaterial({ color: 0x22b35e, emissive: 0x22b35e, emissiveIntensity: 0.35, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, transparent: true, opacity: 0.95 });
const remMat = new THREE.MeshStandardMaterial({ color: 0xe5484d, emissive: 0xe5484d, emissiveIntensity: 0.25, roughness: 0.6, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
const remEdgeMat = new THREE.LineBasicMaterial({ color: 0xc9363b, transparent: true, opacity: 0.8 });

const solid = new THREE.Mesh(undefined, solidMat); solid.castShadow = true; solid.receiveShadow = true;
const solidEdges = new THREE.LineSegments(undefined, edgeMat);
const ghost = new THREE.Mesh(undefined, ghostMat); ghost.renderOrder = 3;
const ghostEdges = new THREE.LineSegments(undefined, ghostEdgeMat); ghostEdges.renderOrder = 4;
const addMesh = new THREE.Mesh(undefined, addMat); addMesh.renderOrder = 2;
const remMesh = new THREE.Mesh(undefined, remMat); remMesh.renderOrder = 5;
const remEdges = new THREE.LineSegments(undefined, remEdgeMat); remEdges.renderOrder = 6;
[solid, solidEdges, ghost, ghostEdges, addMesh, remMesh, remEdges].forEach(o => { o.visible = false; stage.add(o); });

/* ---------- data ---------- */
let examples = [], cur = 0, idx = 0, playing = !reduced, userTouched = false, visible = true, timer = null, pulse = 0, flash = 0;
const cache = new Map();
const loader = new GLTFLoader();
const upFix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);   // CadQuery is Z-up, three.js is Y-up

function prep(mesh) {
  let g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  g.deleteAttribute('normal');
  g = toCreasedNormals(g, THREE.MathUtils.degToRad(28));
  g.applyMatrix4(upFix);
  return g;
}

async function load(ex) {
  if (cache.has(ex.key)) return cache.get(ex.key);
  const gltf = await loader.loadAsync(`./static/models/${ex.key}.glb`);
  gltf.scene.updateMatrixWorld(true);
  const raw = {};
  gltf.scene.traverse(o => { if (o.isMesh) raw[o.name] = o; });
  const get = n => (raw[n] ? prep(raw[n]) : null);
  const e = { target: get('target'), policy: ex.policy.map((_, k) => get(`p_${String(k).padStart(2, '0')}`)), search: [], edges: new Map() };
  ex.search.forEach(s => { const t = String(s.n).padStart(2, '0'); e.search.push({ solid: get(`s_${t}`), add: s.add ? get(`add_${t}`) : null, rem: s.rem ? get(`rem_${t}`) : null }); });
  // normalise on the input mesh: centred, largest side = 2, resting on the floor
  e.target.computeBoundingBox();
  const bb = e.target.boundingBox, size = new THREE.Vector3(), c = new THREE.Vector3();
  bb.getSize(size); bb.getCenter(c);
  const sc = 2 / Math.max(size.x, size.y, size.z);
  const M = new THREE.Matrix4().makeScale(sc, sc, sc).multiply(new THREE.Matrix4().makeTranslation(-c.x, -bb.min.y, -c.z));
  const all = [e.target, ...e.policy, ...e.search.flatMap(s => [s.solid, s.add, s.rem])].filter(Boolean);
  all.forEach(g => { g.applyMatrix4(M); g.computeBoundingSphere(); });
  e.height = size.y * sc;
  cache.set(ex.key, e);
  return e;
}
const edgesOf = (e, id, g) => { if (!e.edges.has(id)) e.edges.set(id, new THREE.EdgesGeometry(g, 24)); return e.edges.get(id); };

function frame(e) {
  const r = e.target.boundingSphere.radius, tgt = new THREE.Vector3(0, e.height / 2, 0);
  controls.target.copy(tgt);
  const dir = camera.position.clone().sub(tgt).normalize();
  if (dir.y < 0.25) dir.set(0.62, 0.55, 0.72).normalize();
  const fit = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.copy(tgt).addScaledVector(dir, fit * (camera.aspect < 1 ? 1.4 / Math.sqrt(camera.aspect) : 1.18));
  controls.update();
}

/* ---------- UI refs ---------- */
const chips = $('#exChips'), laneP = $('#lanePolicy'), laneS = $('#laneSearch'), chart = $('#chart'), code = $('#code');
const stageTag = $('#stageTag'), opTag = $('#opTag'), iouVal = $('#iouVal'), iouBar = $('#iouBar'), codeTitle = $('#codeTitle');
const legend = $('#legend3d'), playBtn = $('#playBtn'), loadingEl = $('#viewLoading');
laneP.classList.add('p'); laneS.classList.add('s');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hl = s => esc(s)
  .replace(/\.([a-zA-Z_]+)\(/g, '.<span class="f">$1</span>(')
  .replace(/^([a-z_][a-z_0-9]*) =/gm, '<span class="v">$1</span> =')
  .replace(/(-?\b\d+\.\d+|\b\d+\b)(?![^<]*>)/g, '<span class="n">$1</span>');

let iouShown = 0;
function showIoU(v, s2) {
  const from = iouShown, t0 = performance.now(), dur = reduced ? 1 : 550;
  const tick = t => { const p = Math.min(1, (t - t0) / dur), k = 1 - Math.pow(1 - p, 3);
    iouShown = from + (v - from) * k; iouVal.textContent = iouShown.toFixed(3); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  iouBar.style.width = (v * 100).toFixed(1) + '%';
  iouBar.classList.toggle('s2', s2);
}

function buildLanes(ex) {
  laneP.innerHTML = ex.policy.map((p, k) => `<li><button data-i="${k}" title="Policy step ${k + 1}: ${p.op} · IoU ${p.iou.toFixed(3)}">${k + 1}</button></li>`).join('');
  laneS.innerHTML = ex.search.map((s, n) => `<li><button data-i="${ex.policy.length + n}" title="Search edit ${n + 1}: ${KIND[s.kind] || s.kind} · IoU ${s.iou.toFixed(3)}">${n + 1}</button></li>`).join('');
}

function drawChart(ex, i) {
  const P = ex.policy.map(p => p.iou), Sx = ex.search.map(s => s.iou), all = [...P, ...Sx], n = all.length;
  const W = 320, H = 90, padL = 26, padR = 8, padT = 10, padB = 16;
  const lo = Math.max(0, Math.floor((Math.min(...all) - 0.05) * 10) / 10), hi = 1;
  const x = k => padL + (k / Math.max(1, n - 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const pts = arr => arr.map(([k, v]) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const pIdx = P.map((v, k) => [k, v]), sIdx = [[P.length - 1, P[P.length - 1]], ...Sx.map((v, k) => [P.length + k, v])];
  const xd = (x(P.length - 1) + x(P.length)) / 2;
  let s = '';
  [lo, (lo + hi) / 2, hi].forEach(t => { s += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" stroke="#e6e6e6"/><text x="${padL - 4}" y="${y(t) + 3}" text-anchor="end" font-size="8" fill="#9a9a9a">${t.toFixed(1)}</text>`; });
  s += `<line x1="${xd}" x2="${xd}" y1="${padT - 4}" y2="${H - padB + 2}" stroke="#cfd6df" stroke-dasharray="3 3"/>`;
  s += `<text x="${(padL + xd) / 2}" y="${H - 3}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#3b7ddd">Policy</text>`;
  s += `<text x="${(xd + W - padR) / 2}" y="${H - 3}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0f9f86">Search</text>`;
  s += `<polyline points="${pts(pIdx)}" fill="none" stroke="#3b7ddd" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<polyline points="${pts(sIdx)}" fill="none" stroke="#0f9f86" stroke-width="2" stroke-linejoin="round"/>`;
  all.forEach((v, k) => {
    const on = k === i, c = k < P.length ? '#3b7ddd' : '#0f9f86';
    s += `<circle cx="${x(k)}" cy="${y(v)}" r="${on ? 4.5 : 2.6}" fill="${on ? '#fff' : c}" stroke="${c}" stroke-width="${on ? 2.5 : 0}" opacity="${k <= i || on ? 1 : .35}"/>`;
  });
  s += `<text x="${x(i)}" y="${y(all[i]) - 8}" text-anchor="middle" font-size="9" font-weight="700" fill="#363636">${all[i].toFixed(3)}</text>`;
  chart.innerHTML = s;
}

function diffHTML(a, b) {
  const A = a ? a.split('\n') : [], B = b ? b.split('\n') : [];
  const setA = new Set(A), setB = new Set(B);
  const out = [];
  A.forEach(l => out.push(setB.has(l) ? `<span class="ctx">  ${hl(l)}</span>` : `<span class="del">- ${hl(l)}</span>`));
  B.forEach(l => { if (!setA.has(l)) out.push(`<span class="ins">+ ${hl(l)}</span>`); });
  return out.join('');
}

function renderCode(ex, i) {
  const P = ex.policy.length;
  if (i < P) {
    code.innerHTML = ex.policy.map((p, k) => `<span class="blk${k === i ? ' cur' : k > i ? ' future' : ''}">${hl(p.code)}</span>`).join('\n');
    codeTitle.textContent = `Policy program · step ${i + 1} of ${P}`;
  } else {
    const s = ex.search[i - P];
    const where = `operation ${s.pos + 1}${s.op ? ` (${s.op})` : ''}`;
    const what = { sketch: 'sketch replaced with the profile sliced from the input mesh', ccut: 'new cut-extrude removes overshoot',
      refine: 'continuous parameters re-optimised', skip: 'operation dropped from the program', replace: 'operation swapped for a better-fitting one', add: 'operation added' }[s.kind] || '';
    code.innerHTML = `<span class="hdr"># ${KIND[s.kind] || s.kind} at ${where}: ${what}</span>` + diffHTML(s.gen, s.best);
    codeTitle.textContent = `Search edit ${i - P + 1} of ${ex.search.length} · diff`;
  }
  const c = code.querySelector('.cur, .del, .ins');
  if (c) code.scrollTo({ top: Math.max(0, c.offsetTop - code.clientHeight / 3), behavior: reduced ? 'auto' : 'smooth' });
  else code.scrollTop = 0;
}

async function show(i) {
  const ex = examples[cur], e = await load(ex);
  if (ex !== examples[cur]) return;
  idx = i;
  const P = ex.policy.length, s2 = i >= P;
  let g;
  if (!s2) {
    g = e.policy[i];
    addMesh.visible = remMesh.visible = remEdges.visible = false;
  } else {
    const s = e.search[i - P];
    g = s.solid;
    addMesh.geometry = s.add || new THREE.BufferGeometry(); addMesh.visible = !!s.add;
    remMesh.geometry = s.rem || new THREE.BufferGeometry(); remMesh.visible = !!s.rem;
    if (s.rem) { remEdges.geometry = edgesOf(e, `rem${i}`, s.rem); remEdges.visible = true; } else remEdges.visible = false;
    pulse = 1;
  }
  solid.geometry = g; solidEdges.geometry = edgesOf(e, `g${i}`, g);
  solid.visible = true; solidEdges.visible = tgEdges.checked;
  solidMat.color.copy(s2 ? COL.search : COL.policy);
  flash = 0.3;

  laneP.querySelectorAll('button').forEach((b, k) => { b.classList.toggle('cur', k === i); b.classList.toggle('done', k < i); });
  laneS.querySelectorAll('button').forEach((b, k) => { b.classList.toggle('cur', P + k === i); b.classList.toggle('done', P + k < i); });
  stageTag.textContent = s2 ? `Stage II · search edit ${i - P + 1}/${ex.search.length}` : `Stage I · policy step ${i + 1}/${P}`;
  stageTag.classList.toggle('s2', s2);
  opTag.textContent = s2 ? (KIND[ex.search[i - P].kind] || ex.search[i - P].kind) : ex.policy[i].op;
  legend.classList.toggle('s2', s2);
  showIoU(s2 ? ex.search[i - P].iou : ex.policy[i].iou, s2);
  drawChart(ex, i);
  renderCode(ex, i);
}

async function select(i, keepCam = false) {
  cur = i;
  chips.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-selected', k === i));
  const ex = examples[i];
  buildLanes(ex);
  loadingEl.classList.remove('done');
  const e = await load(ex);
  if (ex !== examples[cur]) return;
  loadingEl.classList.add('done');
  ghost.geometry = e.target;
  ghostEdges.geometry = edgesOf(e, 'target', e.target);
  ghostEdges.computeLineDistances();
  ghost.visible = ghostEdges.visible = tgGhost.checked;
  if (!keepCam) frame(e);
  await show(0);
  schedule();
  const nx = examples[(i + 1) % examples.length]; if (nx) load(nx).catch(() => {});
}

/* ---------- playback ---------- */
function schedule() {
  clearTimeout(timer);
  playBtn.classList.toggle('paused', !playing);
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  if (!playing || !visible) return;
  const ex = examples[cur], P = ex.policy.length, last = P + ex.search.length - 1;
  const delay = idx === last ? 3200 : idx === P - 1 ? 1900 : idx >= P ? 2000 : 1100;
  timer = setTimeout(() => {
    if (idx < last) show(idx + 1).then(schedule);
    else if (!userTouched) select((cur + 1) % examples.length, true);
    else show(0).then(schedule);
  }, delay);
}
playBtn.addEventListener('click', () => { playing = !playing; schedule(); });
function onLane(e) {
  const b = e.target.closest('button'); if (!b) return;
  userTouched = true; playing = false; show(+b.dataset.i); schedule();
}
laneP.addEventListener('click', onLane); laneS.addEventListener('click', onLane);
document.querySelector('.studio-side').addEventListener('keydown', e => {
  if (!e.target.closest('.steps') || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
  const ex = examples[cur], n = ex.policy.length + ex.search.length;
  const k = Math.max(0, Math.min(n - 1, idx + (e.key === 'ArrowRight' ? 1 : -1)));
  userTouched = true; playing = false; schedule();
  show(k).then(() => document.querySelector(`.steps button[data-i="${k}"]`)?.focus());
  e.preventDefault();
});

/* ---------- toggles ---------- */
const tgGhost = $('#tgGhost'), tgEdges = $('#tgEdges'), tgSpin = $('#tgSpin');
tgSpin.checked = !reduced;
function applyToggles() {
  ghost.visible = ghostEdges.visible = tgGhost.checked && !!ghost.geometry;
  solidEdges.visible = tgEdges.checked && solid.visible;
  controls.autoRotate = tgSpin.checked;
}
[tgGhost, tgEdges, tgSpin].forEach(t => t.addEventListener('change', applyToggles));
controls.addEventListener('start', () => { userTouched = true; });

/* ---------- loop ---------- */
function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
resize();

const clock = new THREE.Clock();
function loop() {
  const t = clock.getElapsedTime();
  controls.update();
  if (flash > 0) { flash = Math.max(0, flash - 0.02); solidMat.emissiveIntensity = flash * 0.4; }
  if (addMesh.visible) addMat.emissiveIntensity = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 5)) + pulse * 0.6;
  if (remMesh.visible) remMat.opacity = 0.3 + 0.15 * (0.5 + 0.5 * Math.sin(t * 5)) + pulse * 0.3;
  pulse = Math.max(0, pulse - 0.015);
  renderer.render(scene, camera);
}
new IntersectionObserver(es => es.forEach(e => {
  const was = visible; visible = e.isIntersecting;
  if (visible && !was) { renderer.setAnimationLoop(loop); schedule(); }
  if (!visible) { renderer.setAnimationLoop(null); clearTimeout(timer); }
}), { threshold: 0.05 }).observe(canvas);
renderer.setAnimationLoop(loop);

/* ---------- boot ---------- */
fetch('./static/models/examples.json').then(r => r.json()).then(data => {
  examples = data;
  data.forEach((ex, i) => {
    const b = document.createElement('button');
    b.textContent = ex.name; b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { userTouched = true; select(i); });
    chips.appendChild(b);
  });
  select(0);
}).catch(err => {
  loadingEl.textContent = 'Could not load the 3D replay. Serve this page over HTTP (not file://).';
  console.error(err);
});
