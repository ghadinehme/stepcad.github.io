/* StepCAD reconstruction gallery: click a card to inspect the input mesh and the StepCAD-3.5M program in 3D.
   static/models/gNN.glb holds 'input' (CADBench mesh) and 'cad' (the executed program); gallery.json the metadata. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const V = '20261106g';
const $ = s => document.querySelector(s);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('#galCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
let spin = !reduced, angle = 0;   // each part turns about its own vertical axis, so the pair stays side by side
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, -3, 4);
const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-3, 2, 1);
scene.add(key, fill, new THREE.HemisphereLight(0xffffff, 0xdfe5ee, 0.5));

const cadMat = new THREE.MeshStandardMaterial({ color: 0x2c86d9, metalness: 0.05, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const meshMat = new THREE.MeshStandardMaterial({ color: 0xb4c4c4, roughness: 0.65, side: THREE.DoubleSide });
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8a9bb0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
const edgeMat = new THREE.LineBasicMaterial({ color: 0x0f2c4a, transparent: true, opacity: 0.45 });
const root = new THREE.Group(); scene.add(root);
const loader = new GLTFLoader(), cache = new Map();
let G = [], cur = null, mode = 'side', showEdges = true, spinners = [];

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

function load(g) {
  if (!cache.has(g.key)) cache.set(g.key, loader.loadAsync(`./static/models/${g.key}.glb?v=${V}`).then(gl => {
    const parts = {};
    gl.scene.traverse(o => {
      if (!o.isMesh) return;
      let geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.deleteAttribute('normal');
      geo = toCreasedNormals(geo, o.name === 'input' ? Math.PI / 5 : Math.PI / 6);
      geo.computeBoundingBox();
      parts[o.name] = { geo, edges: o.name === 'cad' ? new THREE.EdgesGeometry(geo, 28) : null };
    });
    const box = parts.input.geo.boundingBox.clone().union(parts.cad.geo.boundingBox);
    return { parts, box };
  }));
  return cache.get(g.key);
}

function frame() {
  const { box } = cur.data, c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const r = size.length() / 2, span = mode === 'side' ? r * 1.75 : r * 0.95;
  controls.target.copy(c); camera.up.set(0, 0, 1);
  const dir = new THREE.Vector3(0.75, -1.25, 0.85).normalize();
  camera.position.copy(c).addScaledVector(dir, span / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.near = r / 50; camera.far = r * 60; camera.updateProjectionMatrix(); controls.update();
}

function build() {
  root.clear(); spinners = [];
  const { parts, box } = cur.data, size = box.getSize(new THREE.Vector3());
  // side by side along the camera's screen-right axis so the two parts never overlap
  const off = mode === 'side' ? (Math.max(size.x, size.y) * 0.62 + size.length() * 0.06) : 0;
  const axis = new THREE.Vector3(1, 0.6, 0).normalize();
  const inp = new THREE.Mesh(parts.input.geo, mode === 'side' ? meshMat : ghostMat);
  inp.position.copy(axis).multiplyScalar(-off); root.add(inp); spinners.push(inp);
  const cad = new THREE.Mesh(parts.cad.geo, cadMat); cad.position.copy(axis).multiplyScalar(off); root.add(cad); spinners.push(cad);
  if (showEdges) { const e = new THREE.LineSegments(parts.cad.edges, edgeMat); e.position.copy(cad.position); root.add(e); spinners.push(e); }
  $('#galLabIn').hidden = mode !== 'side'; $('#galLabOut').hidden = mode !== 'side';
}

async function pick(g) {
  cur = { g, data: null };
  document.querySelectorAll('.gcard').forEach(c => c.classList.toggle('on', c.dataset.k === g.key));
  $('#galSplit').textContent = g.split; $('#galIou').textContent = g.iou.toFixed(3);
  $('#galLoading').classList.remove('done');
  const data = await load(g); if (cur.g !== g) return;
  cur.data = data; $('#galLoading').classList.add('done');
  frame(); build();
  const i = G.indexOf(g); if (G[i + 1]) load(G[i + 1]);
}

fetch(`./static/models/gallery.json?v=${V}`).then(r => r.json()).then(list => {
  G = list;
  $('#galGrid').innerHTML = G.map(g => `<button class="gcard" data-k="${g.key}" aria-label="${g.split}, IoU ${g.iou.toFixed(3)}">
    <span class="gpair"><img src="./static/img/gallery/${g.key}_in.webp?v=${V}" alt="Input mesh" loading="lazy"><img src="./static/img/gallery/${g.key}_out.webp?v=${V}" alt="StepCAD-3.5M program" loading="lazy"></span>
    <span class="gmeta"><span>${g.split}</span><b>IoU ${g.iou.toFixed(3)}</b></span></button>`).join('');
  $('#galGrid').addEventListener('click', e => {
    const b = e.target.closest('.gcard'); if (!b) return;
    pick(G.find(x => x.key === b.dataset.k));
    const v = $('#galView').getBoundingClientRect(); if (v.top < 0) $('#galView').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  });
  pick(G[0]);
});
document.querySelectorAll('#galMode button').forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.m; document.querySelectorAll('#galMode button').forEach(x => x.classList.toggle('on', x === b));
  if (cur && cur.data) { frame(); build(); }
}));
$('#galEdges').addEventListener('change', e => { showEdges = e.target.checked; if (cur && cur.data) build(); });
$('#galSpin').addEventListener('change', e => { spin = e.target.checked; });
let last = performance.now();
renderer.setAnimationLoop(t => {
  if (spin) angle += (t - last) * 0.00035; last = t;
  spinners.forEach(m => { m.rotation.z = angle; });
  resize(); controls.update(); renderer.render(scene, camera);
});
