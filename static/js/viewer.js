/* Interactive StepCAD studio: replays real StepCAD programs one operation at a time.
   Meshes and per-step IoU were produced offline by executing each CadQuery program
   line by line (see static/models/examples.json). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = s => document.querySelector(s);
const canvas = $('#viewer');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
camera.position.set(3.6, 2.6, 4.2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = !reduced;
controls.autoRotateSpeed = 1.1;
controls.minDistance = 1.6;
controls.maxDistance = 12;
controls.enablePan = false;

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(3, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 20 });
key.shadow.radius = 6;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.025;
scene.add(key, new THREE.HemisphereLight(0xbfd6ff, 0x0b1220, 0.5));

const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.32 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
const grid = new THREE.GridHelper(8, 32, 0x2b4066, 0x1a2842);
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(floor, grid);

const stage = new THREE.Group();
scene.add(stage);

/* ---------- materials ---------- */
const COL_POLICY = new THREE.Color('#5aa2ff');
const COL_FINAL = new THREE.Color('#2fd1b2');
const solidMat = new THREE.MeshPhysicalMaterial({ color: COL_POLICY, metalness: 0.05, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.55, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide });
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
const ghostEdgeMat = new THREE.LineBasicMaterial({ color: 0x9cc4ff, transparent: true, opacity: 0.32, depthWrite: false });
const edgeMat = new THREE.LineBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.55 });

/* ---------- state ---------- */
let examples = [], cur = 0, step = 0, playing = !reduced, userTouched = false, visible = true;
const cache = new Map();          // key -> { target, steps: [geom], best }
let solid = null, solidEdges = null, ghost = null, ghostEdges = null;
let flash = 0, playTimer = null;

const loader = new GLTFLoader();
const loadingEl = $('#viewLoading');

function prepGeometry(mesh) {
  let g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  g.deleteAttribute('normal');
  g = toCreasedNormals(g, THREE.MathUtils.degToRad(28));
  return g;
}

async function loadExample(ex) {
  if (cache.has(ex.key)) return cache.get(ex.key);
  const gltf = await loader.loadAsync(`static/models/${ex.key}.glb`);
  gltf.scene.updateMatrixWorld(true);
  const byName = {};
  gltf.scene.traverse(o => { if (o.isMesh) byName[o.name] = o; });
  const find = n => byName[n] || Object.values(byName).find(m => m.name.startsWith(n) || (m.parent && m.parent.name === n));
  const target = prepGeometry(find('target'));
  const steps = ex.steps.map((_, k) => prepGeometry(find(`gen_${String(k).padStart(2, '0')}`)));
  const best = prepGeometry(find('best'));
  // programs are Z-up (CadQuery); three.js is Y-up
  const up = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  [target, ...steps, best].forEach(g => g.applyMatrix4(up));
  // normalise: centre on target bbox, scale so the largest side is 2 units, rest on floor
  target.computeBoundingBox();
  const bb = target.boundingBox, size = new THREE.Vector3(), c = new THREE.Vector3();
  bb.getSize(size); bb.getCenter(c);
  const s = 2 / Math.max(size.x, size.y, size.z);
  const m = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-c.x, -bb.min.y, -c.z));
  [target, ...steps, best].forEach(g => { g.applyMatrix4(m); g.computeBoundingSphere(); });
  const entry = { target, steps, best, edges: new Map(), height: size.y * s };
  cache.set(ex.key, entry);
  return entry;
}

function edgesFor(entry, id, geom) {
  if (!entry.edges.has(id)) entry.edges.set(id, new THREE.EdgesGeometry(geom, 24));
  return entry.edges.get(id);
}

function frame(entry) {
  const r = entry.target.boundingSphere.radius;
  const tgt = new THREE.Vector3(0, entry.height / 2, 0);
  controls.target.copy(tgt);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.y < 0.25) dir.set(0.62, 0.55, 0.72).normalize();
  camera.position.copy(tgt).addScaledVector(dir, (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * (camera.aspect < 1 ? 1.45 / camera.aspect ** 0.5 : 1.2));
  controls.update();
}

/* ---------- UI ---------- */
const chips = $('#exChips'), tl = $('#timeline'), code = $('#code'), spark = $('#spark');
const iouVal = $('#iouVal'), iouBar = $('#iouBar'), stagePill = $('#stagePill'), opPill = $('#opPill'), codeTitle = $('#codeTitle');
const playBtn = $('#playBtn');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function hl(src) {
  return esc(src)
    .replace(/(#.*)$/gm, '<span class="c">$1</span>')
    .replace(/\b(import|as|for|in|def|return|lambda)\b/g, '<span class="k">$1</span>')
    .replace(/\.([a-zA-Z_]+)\(/g, '.<span class="f">$1</span>(')
    .replace(/^([a-z_][a-z_0-9]*) =/gm, '<span class="v">$1</span> =')
    .replace(/(-?\b\d+\.?\d*)/g, '<span class="n">$1</span>');
}
function blocksOf(src) {
  const out = []; let buf = [];
  src.split('\n').forEach(l => { if (/^(#!|import )/.test(l)) return; buf.push(l); if (l.startsWith('result = ')) { out.push(buf.join('\n')); buf = []; } });
  if (buf.join('').trim()) out.push(buf.join('\n'));
  return out;
}

let iouShown = 0;
function animateIoU(to) {
  const from = iouShown, t0 = performance.now(), dur = reduced ? 1 : 600;
  const tick = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    iouShown = from + (to - from) * e; iouVal.textContent = iouShown.toFixed(3); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  iouBar.style.width = (to * 100).toFixed(1) + '%';
}

function buildTimeline(ex) {
  tl.innerHTML = '';
  ex.steps.forEach((s, k) => {
    const li = document.createElement('li');
    li.innerHTML = `<button data-k="${k}" title="Step ${k + 1}: ${s.op} · IoU ${s.iou.toFixed(3)}"><b>${String(k + 1).padStart(2, '0')}</b>${s.op}</button>`;
    tl.appendChild(li);
  });
  const li = document.createElement('li'); li.className = 'search';
  li.innerHTML = `<button data-k="${ex.steps.length}" title="After geometry-guided search · IoU ${ex.best.iou.toFixed(3)}"><b>II</b>search</button>`;
  tl.appendChild(li);
}

function drawSpark(ex, k) {
  const vals = [...ex.steps.map(s => s.iou), ex.best.iou];
  const W = 300, H = 54, n = vals.length, px = i => 6 + (i / Math.max(1, n - 1)) * (W - 12), py = v => H - 6 - v * (H - 14);
  const pts = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const lastPolicy = n - 2;
  let s = `<defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#5aa2ff"/><stop offset="1" stop-color="#2fd1b2"/></linearGradient></defs>`;
  s += `<line x1="6" x2="${W - 6}" y1="${py(1)}" y2="${py(1)}" stroke="#2a3752" stroke-dasharray="3 4"/>`;
  s += `<text x="${W - 6}" y="${py(1) - 3}" text-anchor="end" font-size="9" fill="#56657f" font-family="Exo">IoU 1.0</text>`;
  s += `<polyline points="${pts.slice(0, n - 1).join(' ')}" fill="none" stroke="#5aa2ff" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<line x1="${px(lastPolicy)}" y1="${py(vals[lastPolicy])}" x2="${px(n - 1)}" y2="${py(vals[n - 1])}" stroke="#2fd1b2" stroke-width="2" stroke-dasharray="4 3"/>`;
  vals.forEach((v, i) => {
    const on = i === k, last = i === n - 1;
    s += `<circle cx="${px(i)}" cy="${py(v)}" r="${on ? 5 : 3}" fill="${last ? '#2fd1b2' : '#5aa2ff'}" ${on ? 'stroke="#fff" stroke-width="2"' : 'opacity="' + (i <= k ? 1 : .45) + '"'}/>`;
  });
  spark.innerHTML = s;
}

function renderCode(ex, k) {
  const final = k === ex.steps.length;
  const blocks = final ? blocksOf(ex.best.code) : ex.steps.map(s => s.code);
  code.classList.toggle('final', final);
  code.innerHTML = blocks.map((b, i) => `<span class="blk${(!final && i === k) || (final && i === blocks.length - 1) ? ' cur' : ''}${!final && i > k ? ' future' : ''}">${hl(b)}</span>`).join('\n');
  code.querySelectorAll('.future').forEach(n => n.style.opacity = '.14');
  codeTitle.textContent = final ? `Refined program · ${blocks.length} ops` : `Policy program · step ${k + 1} of ${ex.steps.length}`;
  const curEl = code.querySelector('.cur');
  if (curEl) code.scrollTo({ top: Math.max(0, curEl.offsetTop - code.clientHeight / 3), behavior: reduced ? 'auto' : 'smooth' });
}

function setMesh(geom, edges, color) {
  if (!solid) {
    solid = new THREE.Mesh(geom, solidMat); solid.castShadow = true; solid.receiveShadow = true;
    solidEdges = new THREE.LineSegments(edges, edgeMat);
    stage.add(solid, solidEdges);
  } else { solid.geometry = geom; solidEdges.geometry = edges; }
  solidMat.color.copy(color);
  flash = 0.35;
}

async function showStep(k) {
  const ex = examples[cur], entry = await loadExample(ex);
  if (ex !== examples[cur]) return;
  step = k;
  const final = k === ex.steps.length;
  const geom = final ? entry.best : entry.steps[k];
  setMesh(geom, edgesFor(entry, final ? 'best' : k, geom), final ? COL_FINAL : COL_POLICY);
  tl.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('cur', i === k); b.classList.toggle('done', i < k); });
  const curBtn = tl.querySelector('button.cur');
  if (curBtn) tl.scrollTo({ left: curBtn.parentElement.offsetLeft - tl.clientWidth / 2 + curBtn.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  stagePill.textContent = final ? 'Stage II · after search' : `Stage I · policy step ${k + 1}`;
  stagePill.classList.toggle('s2', final);
  opPill.textContent = final ? `${ex.best.nops} ops` : ex.steps[k].op;
  animateIoU(final ? ex.best.iou : ex.steps[k].iou);
  drawSpark(ex, k);
  renderCode(ex, k);
}

async function selectExample(i, keepCamera = false) {
  cur = i;
  chips.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-selected', j === i));
  const ex = examples[i];
  buildTimeline(ex);
  loadingEl.classList.remove('done');
  const entry = await loadExample(ex);
  if (ex !== examples[cur]) return;
  loadingEl.classList.add('done');
  if (!ghost) {
    ghost = new THREE.Mesh(entry.target, ghostMat); ghost.renderOrder = 2;
    ghostEdges = new THREE.LineSegments(edgesFor(entry, 'target', entry.target), ghostEdgeMat); ghostEdges.renderOrder = 3;
    stage.add(ghost, ghostEdges);
  } else { ghost.geometry = entry.target; ghostEdges.geometry = edgesFor(entry, 'target', entry.target); }
  applyToggles();
  if (!keepCamera) frame(entry);
  await showStep(0);
  schedule();
  // warm the next example in the background
  const nx = examples[(i + 1) % examples.length]; if (nx) loadExample(nx).catch(() => {});
}

/* ---------- playback ---------- */
function schedule() {
  clearTimeout(playTimer);
  playBtn.classList.toggle('on', playing);
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  if (!playing || !visible) return;
  const ex = examples[cur], last = ex.steps.length;
  const delay = step === last ? 3200 : step === last - 1 ? 1500 : 1000;
  playTimer = setTimeout(() => {
    if (step < last) showStep(step + 1).then(schedule);
    else if (!userTouched) selectExample((cur + 1) % examples.length, true);
    else showStep(0).then(schedule);
  }, delay);
}
playBtn.addEventListener('click', () => { playing = !playing; if (playing && step === examples[cur].steps.length) showStep(0); schedule(); });
tl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  userTouched = true; playing = false; showStep(+b.dataset.k); schedule();
});
tl.addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const n = examples[cur].steps.length, k = Math.max(0, Math.min(n, step + (e.key === 'ArrowRight' ? 1 : -1)));
  userTouched = true; playing = false; showStep(k).then(() => tl.querySelector('button.cur')?.focus()); schedule(); e.preventDefault();
});

/* ---------- toggles ---------- */
const tgGhost = $('#tgGhost'), tgEdges = $('#tgEdges'), tgSpin = $('#tgSpin');
function applyToggles() {
  if (ghost) { ghost.visible = tgGhost.checked; ghostEdges.visible = tgGhost.checked; }
  if (solidEdges) solidEdges.visible = tgEdges.checked;
  controls.autoRotate = tgSpin.checked;
}
tgSpin.checked = !reduced;
[tgGhost, tgEdges, tgSpin].forEach(t => t.addEventListener('change', applyToggles));
controls.addEventListener('start', () => { userTouched = true; });

/* ---------- sizing / loop ---------- */
function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
resize();

new IntersectionObserver(es => es.forEach(e => {
  const was = visible; visible = e.isIntersecting;
  if (visible && !was) { renderer.setAnimationLoop(loop); schedule(); }
  if (!visible) { renderer.setAnimationLoop(null); clearTimeout(playTimer); }
}), { threshold: 0.05 }).observe(canvas);

function loop() {
  controls.update();
  if (flash > 0) { flash = Math.max(0, flash - 0.02); solidMat.emissiveIntensity = flash * 0.5; }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(loop);

/* ---------- boot ---------- */
fetch('static/models/examples.json').then(r => r.json()).then(data => {
  examples = data;
  data.forEach((ex, i) => {
    const b = document.createElement('button');
    b.textContent = ex.name; b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { userTouched = true; selectExample(i); });
    chips.appendChild(b);
  });
  selectExample(0);
}).catch(err => {
  loadingEl.innerHTML = 'Could not load the 3D viewer. Serve this page over HTTP, not file://.';
  console.error(err);
});
