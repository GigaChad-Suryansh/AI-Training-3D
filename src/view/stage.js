/**
 * The 3D stage: a small diorama with a robot, a beacon, walls, pits and a key.
 * It only draws. All learning lives in src/core.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DIRS } from '../core/levels.js';
import { PALETTES } from './palette.js';

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export function createStage(host) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  let pal = PALETTES.light, palName = 'light';
  let level = null, lvl = null, w3 = 1, h3 = 1, time = 0, last = performance.now();
  let insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let lastHeat = null;

  /* ---------- theming: every accent-colored material registers here ---------- */
  const baseTints = [], levelTints = [];
  const tint = (list, mat, key, extra) => { list.push({ mat, key, extra }); mat.color.setHex(pal[key]); if (extra === 'emissive') mat.emissive.setHex(pal[key]); return mat; };
  function retint(list) { list.forEach(t => { t.mat.color.setHex(pal[t.key]); if (t.extra === 'emissive') t.mat.emissive.setHex(pal[t.key]); }); }

  /* ---------- textures ---------- */
  function radialTexture(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const glowTex = radialTexture([[0, 1], [0.3, 0.3], [1, 0]]);
  const blobTex = radialTexture([[0, 1], [0.55, 0.45], [1, 0]]);

  const glowSprite = (list, key, size, opacity) => {
    const m = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    tint(list, m, key);
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.userData.base = opacity; return s;
  };
  const flatMat = (list, key, opacity) => {
    const m = new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    return tint(list, m, key);
  };

  /* ---------- lights, table, shadows ---------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a94a8, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(6, 12, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 6; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  scene.add(sun);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.22 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.34; table.receiveShadow = true; scene.add(table);

  /* ---------- robot ---------- */
  const bot = { x: 0, z: 0, fx: 0, fz: 0, tx: 0, tz: 0, t: 1, dur: 0.2, kind: 'step', yaw: 0, tyaw: 0, shake: 0, scale: 1, spawn: 0, fall: 0, joy: 0, dx: 0, dz: 0, mood: 'think', moodT: 0, blink: 2.5 };
  const botRoot = new THREE.Group(), botInner = new THREE.Group(); botRoot.add(botInner);
  const bodyMat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const faceMat = new THREE.MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.2, 10, 32), bodyMat); body.position.y = 0.37; body.castShadow = true; botInner.add(body);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 24), faceMat); face.scale.set(1.05, 0.82, 0.5); face.position.set(0, 0.42, 0.14); botInner.add(face);
  const eyeMat = new THREE.MeshBasicMaterial({ transparent: true });
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.035, 6, 12), eyeMat); e.position.set(s * 0.06, 0.43, 0.205); botInner.add(e); return e; });
  const earMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 }); tint(baseTints, earMat, 'accent');
  [-1, 1].forEach(s => { const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 24), earMat); ear.rotation.z = Math.PI / 2; ear.position.set(s * 0.2, 0.38, 0); botInner.add(ear); });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.004; botRoot.add(blob);
  const underglow = glowSprite(baseTints, 'accent', 1.5, 0.5); underglow.position.y = 0.06; botRoot.add(underglow);
  const botLight = new THREE.PointLight(0xffffff, 0, 3, 2); botLight.position.y = 0.35; botRoot.add(botLight); tint(baseTints, { color: botLight.color }, 'accent');
  scene.add(botRoot);
  const MOODS = { think: 'accent', bad: 'warn', key: 'amber', happy: 'accent' };
  function setMood(m) { bot.mood = m; eyeMat.color.setHex(pal[MOODS[m] || 'accent']); bot.moodT = m === 'think' ? 0 : 1.1; }

  /* ---------- effects ---------- */
  const ripples = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 64), flatMat(baseTints, 'accent', 0));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.visible = false; m.userData = { t: 1, max: 3, key: 'accent' }; scene.add(m); ripples.push(m);
  }
  const BURST = 48, bp = new Float32Array(BURST * 3).fill(-999), bvel = [], blife = new Float32Array(BURST);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const burstMat = new THREE.PointsMaterial({ map: glowTex, size: 0.26, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const burstPts = new THREE.Points(bg, burstMat); burstPts.frustumCulled = false; scene.add(burstPts);
  for (let i = 0; i < BURST; i++) bvel.push(new THREE.Vector3());
  retintBase();
  function retintBase() { retint(baseTints); }

  /* ---------- level objects ---------- */
  let tiles = null, tileIndex = [], goalObj = null, keyObj = null, doorObj = null, pitGlows = [], trailLine = null, trailDots = null, trailPos = null, trailN = 0, maxTrail = 0;
  const tmpC = new THREE.Color(), baseC = new THREE.Color(), hiC = new THREE.Color();
  const cx = () => (level.W - 1) / 2, cz = () => (level.H - 1) / 2, wx = x => x - cx(), wz = y => y - cz();

  function clearLevel() {
    if (!lvl) return;
    scene.remove(lvl);
    lvl.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    lvl = null; tiles = null; goalObj = keyObj = doorObj = null; pitGlows = []; tileIndex = []; levelTints.length = 0;
    if (trailLine) { scene.remove(trailLine); scene.remove(trailDots); trailLine.geometry.dispose(); trailDots.geometry.dispose(); trailLine = trailDots = null; }
  }

  function loadLevel(L) {
    clearLevel(); level = L; lvl = new THREE.Group(); scene.add(lvl);
    const W = L.W, H = L.H, M = new THREE.Matrix4();

    const plinthMat = new THREE.MeshStandardMaterial({ color: pal.plinth, roughness: 0.7 });
    levelTints.push({ mat: plinthMat, key: 'plinth' });
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(W + 0.5, 0.34, H + 0.5, 4, 0.14), plinthMat); plinth.position.y = -0.24; plinth.receiveShadow = true; plinth.castShadow = true; lvl.add(plinth);

    const floorCells = []; tileIndex = new Array(W * H).fill(-1);
    for (let i = 0; i < W * H; i++) { const c = L.grid[i]; if (c !== '#' && c !== 'P') { tileIndex[i] = floorCells.length; floorCells.push(i); } }
    tiles = new THREE.InstancedMesh(new RoundedBoxGeometry(0.93, 0.12, 0.93, 3, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), floorCells.length);
    floorCells.forEach((ci, k) => { M.makeTranslation(wx(ci % W), -0.06, wz((ci / W) | 0)); tiles.setMatrixAt(k, M); tiles.setColorAt(k, baseC.setHex(pal.tile)); });
    tiles.receiveShadow = true; lvl.add(tiles);

    const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.55 }); tint(levelTints, wallMat, 'wall');
    const walls = new THREE.InstancedMesh(new RoundedBoxGeometry(0.93, 0.62, 0.93, 4, 0.12), wallMat, Math.max(1, L.walls.length));
    L.walls.forEach((p, k) => { M.makeTranslation(wx(p.x), 0.25, wz(p.y)); walls.setMatrixAt(k, M); });
    walls.count = L.walls.length; walls.castShadow = true; walls.receiveShadow = true; lvl.add(walls);

    const start = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.3, 48), flatMat(levelTints, 'blue', 0.7)); start.rotation.x = -Math.PI / 2; start.position.set(wx(L.start.x), 0.012, wz(L.start.y)); lvl.add(start);

    goalObj = new THREE.Group(); goalObj.position.set(wx(L.goal.x), 0, wz(L.goal.y));
    const r1 = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.37, 64), flatMat(levelTints, 'accent', 0.95)); r1.rotation.x = -Math.PI / 2; r1.position.y = 0.014; goalObj.add(r1);
    const r2 = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.465, 64), flatMat(levelTints, 'accent', 0.4)); r2.rotation.x = -Math.PI / 2; r2.position.y = 0.014; goalObj.add(r2);
    const gemMat = new THREE.MeshPhysicalMaterial({ roughness: 0.15, clearcoat: 1, emissiveIntensity: 0.9 }); tint(levelTints, gemMat, 'accent', 'emissive');
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 1), gemMat); gem.position.y = 0.8; goalObj.add(gem);
    const gs = glowSprite(levelTints, 'accent', 2.4, 0.6); gs.position.y = 0.8; goalObj.add(gs);
    goalObj.userData = { gem, gs, r2 }; lvl.add(goalObj);

    pitGlows = [];
    L.pits.forEach(p => {
      const g = new THREE.Group(); g.position.set(wx(p.x), 0, wz(p.y));
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.4, 40), new THREE.MeshBasicMaterial({ color: 0x03050a })); hole.position.y = -0.2; g.add(hole);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 48), flatMat(levelTints, 'warn', 0.9)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; g.add(ring);
      const gl = glowSprite(levelTints, 'warn', 1.6, 0.4); gl.position.y = 0.05; g.add(gl); pitGlows.push(gl);
      lvl.add(g);
    });

    if (L.key) {
      keyObj = new THREE.Group(); keyObj.position.set(wx(L.key.x), 0.5, wz(L.key.y));
      const km = new THREE.MeshPhysicalMaterial({ roughness: 0.25, metalness: 0.3, clearcoat: 0.6, emissiveIntensity: 0.5 }); tint(levelTints, km, 'amber', 'emissive');
      const head = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.034, 14, 32), km); head.position.y = 0.14; keyObj.add(head);
      const shaft = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.28, 0.05, 2, 0.02), km); shaft.position.y = -0.06; keyObj.add(shaft);
      const tooth = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.045, 0.045, 2, 0.015), km); tooth.position.set(0.05, -0.15, 0); keyObj.add(tooth);
      const ks = glowSprite(levelTints, 'amber', 1.1, 0.45); ks.position.y = 0.05; keyObj.add(ks);
      keyObj.userData = { gone: 0, taken: false }; lvl.add(keyObj);
    }
    if (L.door) {
      const dm = new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.55, roughness: 0.2, clearcoat: 1, emissiveIntensity: 0.25 }); tint(levelTints, dm, 'amber', 'emissive');
      doorObj = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.78, 0.9, 4, 0.12), dm); doorObj.position.set(wx(L.door.x), 0.33, wz(L.door.y));
      doorObj.userData = { open: 0, opening: false }; lvl.add(doorObj);
    }

    maxTrail = L.maxSteps + 3; trailPos = new Float32Array(maxTrail * 3);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); tg.setDrawRange(0, 0);
    const lm = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 }); tint(levelTints, lm, 'accent');
    trailLine = new THREE.Line(tg, lm);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); dg.setDrawRange(0, 0);
    const dm2 = new THREE.PointsMaterial({ map: glowTex, size: 0.17, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }); tint(levelTints, dm2, 'accent');
    trailDots = new THREE.Points(dg, dm2);
    trailLine.frustumCulled = false; trailDots.frustumCulled = false; scene.add(trailLine); scene.add(trailDots); trailN = 0;

    fit(); placeBot(L.start.x, L.start.y); spawnBot();
  }

  function trailClear() { trailN = 0; if (trailLine) { trailLine.geometry.setDrawRange(0, 0); trailDots.geometry.setDrawRange(0, 0); } }
  function trailAdd(x, y) {
    if (!trailLine || trailN >= maxTrail) return;
    trailPos[trailN * 3] = wx(x); trailPos[trailN * 3 + 1] = 0.05; trailPos[trailN * 3 + 2] = wz(y); trailN++;
    trailLine.geometry.attributes.position.needsUpdate = true; trailDots.geometry.attributes.position.needsUpdate = true;
    trailLine.geometry.setDrawRange(0, trailN); trailDots.geometry.setDrawRange(0, trailN);
  }

  function placeBot(x, y) { bot.x = bot.fx = bot.tx = wx(x); bot.z = bot.fz = bot.tz = wz(y); bot.t = 1; bot.fall = 0; bot.joy = 0; bot.shake = 0; }
  function spawnBot() { bot.spawn = 0.0001; bot.scale = 0.001; bot.fall = 0; setMood('think'); }

  /** kind: 'step' | 'bump' | 'fall' | 'goal' */
  function botMove(px, py, a, nx, ny, kind, dur) {
    const d = DIRS[a]; bot.tyaw = Math.atan2(d[0], d[1]);
    bot.fx = wx(px); bot.fz = wz(py); bot.tx = wx(nx); bot.tz = wz(ny); bot.dx = d[0]; bot.dz = d[1];
    bot.kind = kind; bot.t = 0; bot.dur = Math.max(0.035, dur);
    if (kind === 'bump') { bot.tx = bot.fx; bot.tz = bot.fz; bot.shake = 1; }
    if (kind === 'fall') bot.fall = 0.0001;
    if (kind === 'goal') bot.joy = 0.0001;
  }

  function ripple(x, y, key, max) {
    const m = ripples.find(r => !r.visible) || ripples[0];
    m.material.color.setHex(pal[key]); m.userData.key = key; m.position.set(wx(x), 0.03, wz(y)); m.userData.t = 0; m.userData.max = max || 3.2; m.visible = true; m.scale.setScalar(0.4);
  }
  function burst(x, y, key) {
    if (reduced) return;
    burstMat.color.setHex(pal[key]);
    const p = bg.attributes.position;
    for (let i = 0; i < BURST; i++) {
      p.setXYZ(i, wx(x), 0.5, wz(y));
      const a = Math.random() * Math.PI * 2, s = 0.7 + Math.random() * 1.5;
      bvel[i].set(Math.cos(a) * s, 1.2 + Math.random() * 2, Math.sin(a) * s); blife[i] = 1;
    }
    p.needsUpdate = true;
  }

  /** Paint what the agent believes onto the floor. arr holds 0..1 per cell. */
  function setHeat(arr) {
    lastHeat = arr;
    if (!tiles) return;
    baseC.setHex(pal.tile); hiC.setHex(pal.accent);
    for (let i = 0; i < arr.length; i++) {
      const k = tileIndex[i]; if (k < 0) continue;
      tmpC.copy(baseC); if (arr[i] > 0) tmpC.lerp(hiC, Math.min(1, arr[i]) * pal.heatMix);
      tiles.setColorAt(k, tmpC);
    }
    tiles.instanceColor.needsUpdate = true;
  }
  function takeKey() { if (keyObj) keyObj.userData.taken = true; if (doorObj) doorObj.userData.opening = true; }
  function resetItems() {
    if (keyObj) { keyObj.userData.taken = false; keyObj.userData.gone = 0; keyObj.visible = true; keyObj.scale.setScalar(1); }
    if (doorObj) { doorObj.userData.opening = false; doorObj.userData.open = 0; doorObj.scale.set(1, 1, 1); doorObj.position.y = 0.33; doorObj.material.opacity = 0.55; doorObj.visible = true; }
  }

  /* ---------- appearance ---------- */
  function setAppearance(name) {
    palName = name === 'dark' ? 'dark' : 'light'; pal = PALETTES[palName];
    scene.background = new THREE.Color(pal.bg);
    hemi.intensity = pal.hemi; sun.intensity = pal.sun; scene.environmentIntensity = pal.env; renderer.toneMappingExposure = pal.exposure;
    table.material.opacity = pal.shadow; botLight.intensity = palName === 'dark' ? 5 : 0;
    bodyMat.color.setHex(pal.body); faceMat.color.setHex(pal.face);
    eyeMat.color.setHex(pal[MOODS[bot.mood] || 'accent']);
    retint(baseTints); retint(levelTints);
    underglow.material.opacity = underglow.userData.base * pal.glow;
    if (tiles && lastHeat) setHeat(lastHeat);
  }

  /* ---------- camera and sizing ---------- */
  const cam = { user: 0, userEl: 0, idle: 0, drag: false, lx: 0, ly: 0, r: 18 };
  function fit() {
    if (!level) return;
    const availW = Math.max(120, w3 - insets.left - insets.right), availH = Math.max(120, h3 - insets.top - insets.bottom);
    const size = Math.max(level.W, level.H) / 9;
    cam.r = Math.max(19.5 * h3 / availH, 22 * h3 / availW) * size;
  }
  function resize() {
    w3 = Math.max(60, host.clientWidth); h3 = Math.max(60, host.clientHeight);
    renderer.setSize(w3, h3); camera.aspect = w3 / h3;
    camera.setViewOffset(w3, h3, (insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2, w3, h3);
    camera.updateProjectionMatrix(); fit();
  }
  function setInsets(i) { insets = Object.assign({ top: 0, right: 0, bottom: 0, left: 0 }, i); resize(); }

  const el = renderer.domElement; el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', e => { cam.drag = true; cam.lx = e.clientX; cam.ly = e.clientY; el.setPointerCapture && el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!cam.drag) return;
    cam.user += (e.clientX - cam.lx) * 0.006;
    if (e.pointerType === 'mouse') cam.userEl = Math.max(-0.4, Math.min(0.3, cam.userEl + (e.clientY - cam.ly) * 0.004));
    cam.lx = e.clientX; cam.ly = e.clientY; cam.idle = 0;
  });
  const up = () => { cam.drag = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);

  /* ---------- frame ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    if (bot.t < 1) {
      bot.t = Math.min(1, bot.t + dt / bot.dur); const e = ease(bot.t);
      if (bot.kind === 'bump') { const p = Math.sin(Math.PI * bot.t) * 0.2; bot.x = bot.fx + bot.dx * p; bot.z = bot.fz + bot.dz * p; }
      else { bot.x = bot.fx + (bot.tx - bot.fx) * e; bot.z = bot.fz + (bot.tz - bot.fz) * e; }
    }
    bot.yaw += angDiff(bot.yaw, bot.tyaw) * Math.min(1, dt * 14);
    if (bot.spawn > 0) { bot.spawn += dt; bot.scale = Math.min(1, ease(Math.min(1, bot.spawn / 0.5))); if (bot.spawn >= 0.5) { bot.spawn = 0; bot.scale = 1; } }
    let yoff = 0.05 + Math.sin(time * 2.2) * 0.025, sc = bot.scale, rotZ = 0, rotX = 0;
    if (bot.fall > 0) { bot.fall += dt; const f = Math.min(1, bot.fall / 0.7); yoff -= f * 0.9; sc *= 1 - f * 0.9; rotZ = f * 1.2; }
    if (bot.joy > 0) { bot.joy += dt; const f = Math.min(1, bot.joy / 1.0); yoff += Math.sin(f * Math.PI) * 0.4; bot.yaw += dt * 6 * (1 - f); if (f >= 1) bot.joy = 0; }
    if (bot.shake > 0) { bot.shake = Math.max(0, bot.shake - dt * 3.2); rotZ += Math.sin(time * 60) * 0.12 * bot.shake; }
    if (bot.t < 1 && bot.kind === 'step') rotX = 0.1 * Math.sin(Math.PI * bot.t);
    botRoot.position.set(bot.x, 0, bot.z);
    botInner.position.y = yoff; botInner.rotation.set(rotX, bot.yaw, rotZ); botInner.scale.setScalar(Math.max(0.001, sc) * 1.15);
    const hov = Math.max(0, yoff - 0.05);
    blob.scale.setScalar((1 - hov * 0.8) * Math.max(0.05, sc)); blob.material.opacity = pal.shadow * 1.4 * (bot.fall > 0 ? 0.2 : 1);
    underglow.material.opacity = underglow.userData.base * pal.glow * (bot.fall > 0 ? 0.3 : 1) * (0.85 + Math.sin(time * 2.2) * 0.15);
    if (bot.moodT > 0) { bot.moodT -= dt; if (bot.moodT <= 0 && bot.mood !== 'think') setMood('think'); }
    // eyes: blink, squint when hurt, smile when happy
    bot.blink -= dt; let ey = 1, ex = 1;
    if (bot.blink < 0) { ey = 0.12; if (bot.blink < -0.12) bot.blink = 2 + Math.random() * 3; }
    if (bot.mood === 'bad') { ey = Math.min(ey, 0.55); }
    if (bot.mood === 'happy') { ey = Math.min(ey, 0.4); ex = 1.25; }
    eyes.forEach((e, i) => { e.scale.set(ex, ey, 1); e.rotation.z = bot.mood === 'bad' ? (i ? -0.35 : 0.35) : 0; });
    if (goalObj) {
      const u = goalObj.userData; u.gem.rotation.y = time * 1.1; u.gem.position.y = 0.8 + Math.sin(time * 1.6) * 0.06;
      u.r2.scale.setScalar(1 + Math.sin(time * 1.8) * 0.05); u.gs.material.opacity = u.gs.userData.base * pal.glow * (0.8 + Math.sin(time * 1.6) * 0.2);
    }
    pitGlows.forEach((g, i) => { g.material.opacity = g.userData.base * pal.glow * (0.8 + Math.sin(time * 1.4 + i * 1.7) * 0.25); });
    if (keyObj) {
      const u = keyObj.userData;
      if (u.taken) { u.gone = Math.min(1, u.gone + dt * 3); keyObj.scale.setScalar(Math.max(0.001, 1 - u.gone)); keyObj.position.y = 0.5 + u.gone * 0.6; if (u.gone >= 1) keyObj.visible = false; }
      else { keyObj.rotation.y = time * 1.5; keyObj.position.y = 0.5 + Math.sin(time * 1.8) * 0.06; }
    }
    if (doorObj && doorObj.userData.opening) {
      const u = doorObj.userData; u.open = Math.min(1, u.open + dt * 1.6);
      doorObj.scale.y = Math.max(0.001, 1 - u.open); doorObj.position.y = 0.33 * (1 - u.open); doorObj.material.opacity = 0.55 * (1 - u.open);
      if (u.open >= 1) doorObj.visible = false;
    }
    ripples.forEach(m => {
      if (!m.visible) return;
      const u = m.userData; u.t += dt / 0.95; if (u.t >= 1) { m.visible = false; return; }
      m.scale.setScalar(0.4 + u.t * u.max); m.material.opacity = 0.75 * (1 - u.t) * (1 - u.t);
    });
    const p = bg.attributes.position; let any = false;
    for (let i = 0; i < BURST; i++) {
      if (blife[i] <= 0) continue; any = true;
      blife[i] -= dt * 0.9; bvel[i].y -= dt * 4.5;
      p.setXYZ(i, p.getX(i) + bvel[i].x * dt, Math.max(0.02, p.getY(i) + bvel[i].y * dt), p.getZ(i) + bvel[i].z * dt);
      if (blife[i] <= 0) p.setXYZ(i, 0, -999, 0);
    }
    if (any) p.needsUpdate = true;
    cam.idle += dt;
    if (!cam.drag && cam.idle > 5) { cam.user *= 1 - Math.min(1, dt * 0.5); cam.userEl *= 1 - Math.min(1, dt * 0.5); }
    const sway = reduced ? 0 : Math.sin(time * 0.1) * 0.25;
    const th = 0.14 + sway + cam.user, elv = 0.92 + cam.userEl + (reduced ? 0 : Math.sin(time * 0.07) * 0.025);
    camera.position.set(Math.sin(th) * Math.cos(elv) * cam.r, Math.sin(elv) * cam.r, Math.cos(th) * Math.cos(elv) * cam.r);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  setAppearance('light');
  resize();
  requestAnimationFrame(frame);

  return { loadLevel, setHeat, trailClear, trailAdd, setMood, ripple, burst, takeKey, resetItems, placeBot, spawnBot, botMove, setAppearance, setInsets };
}
