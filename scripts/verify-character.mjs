/* Verificación del GLB del personaje.
   Uso: npm run verify:character

   Existe por un bug que pasó desapercibido meses: el clip `Idle` del GLB
   estaba VACÍO (0 pistas) porque la conversión tomaba `animations[0]` y en
   Breathing Idle.fbx la primera animación es una "Take 001" de relleno. El
   archivo cargaba bien, el nombre era correcto y la escena no tiraba ningún
   error: el personaje simplemente se quedaba inmóvil. Un clip puede tener el
   nombre correcto y no ser la animación (lección 29) — o no ser ninguna.

   Se aplican las MISMAS regex de selección que PortfolioScene.astro, así el
   test falla si el asset deja de servirle a la escena aunque el GLB sea
   válido. */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 4396;
const GLB = process.argv[2] || 'remy.glb';   /* permite auditar otro archivo: node scripts/verify-character.mjs remy.glb.bak */
/* Copiadas literalmente de PortfolioScene.astro — si allá cambian, acá también. */
const PICKS = [
  { key: 'walk', res: ['^walking$', 'walk'] },
  { key: 'run',  res: ['^running$', 'run|sprint|jog'] },
  { key: 'idle', res: ['^idle$', 'idle'] },
  { key: 'jump', res: ['^jump$', 'jump|leap'] },
];
/* Huesos del torso: si el idle es una respiración, tienen que moverse. */
const TORSO = ['mixamorigSpine1', 'mixamorigSpine2'];

function browserEnv() {
  const libs = path.join(ROOT, '.cache/pw-libs/root/usr/lib/x86_64-linux-gnu');
  if (!existsSync(libs)) return process.env;
  const prev = process.env.LD_LIBRARY_PATH;
  return { ...process.env, LD_LIBRARY_PATH: prev ? `${libs}:${prev}` : libs };
}
function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.HOME, '.cache/ms-playwright');
  for (const d of readdirSync(base).filter(x => x.startsWith('chromium-'))) {
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('no encontré chromium; definí CHROME_PATH');
}

const PAGE = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
window.inspect = async (glb, picks, torso) => {
  const g = await new GLTFLoader().loadAsync('/models/' + glb);
  const clips = g.animations;
  const out = { all: clips.map(c => ({ name: c.name, tracks: c.tracks.length, dur: +c.duration.toFixed(3) })), picked: {}, motion: {}, inPlace: {} };

  for (const p of picks) {
    const found = p.res.reduce((acc, r) => acc ?? clips.find(c => new RegExp(r, 'i').test(c.name)) ?? null, null);
    out.picked[p.key] = found ? { name: found.name, tracks: found.tracks.length, dur: +found.duration.toFixed(3) } : null;
  }


  /* ¿El clip MUEVE de verdad el torso? Se reproduce y se mide cuánto rota
     cada hueso a lo largo del ciclo. Un clip presente pero inerte no sirve. */
  const bones = {};
  let hipBone = null;
  g.scene.traverse(o => {
    if (!o.isBone) return;
    if (torso.includes(o.name) && !bones[o.name]) bones[o.name] = o;
    if (o.name === 'mixamorigHips' && !hipBone) hipBone = o;
  });
  for (const key of Object.keys(out.picked)) {
    const p = out.picked[key];
    if (!p) { out.motion[key] = null; continue; }
    const clip = clips.find(c => c.name === p.name);
    const mixer = new THREE.AnimationMixer(g.scene);
    const a = mixer.clipAction(clip); a.setEffectiveWeight(1); a.play();
    const seen = {};
    for (const n of Object.keys(bones)) seen[n] = { min: [9,9,9,9], max: [-9,-9,-9,-9] };
    const STEPS = 40;
    /* Desplazamiento de la cadera en unidades de MUNDO (no las del archivo,
       que dependen de la escala del nodo raíz y no dicen nada por sí solas). */
    const hipW = new THREE.Vector3();
    let hx = [9, -9], hz = [9, -9];
    for (let i = 0; i <= STEPS; i++) {
      mixer.setTime((clip.duration * i) / STEPS);
      if (hipBone) {
        g.scene.updateMatrixWorld(true);
        hipBone.getWorldPosition(hipW);
        hx = [Math.min(hx[0], hipW.x), Math.max(hx[1], hipW.x)];
        hz = [Math.min(hz[0], hipW.z), Math.max(hz[1], hipW.z)];
      }
      for (const n of Object.keys(bones)) {
        const q = bones[n].quaternion.toArray();
        for (let c = 0; c < 4; c++) {
          if (q[c] < seen[n].min[c]) seen[n].min[c] = q[c];
          if (q[c] > seen[n].max[c]) seen[n].max[c] = q[c];
        }
      }
    }
    let amp = 0;
    for (const n of Object.keys(seen)) for (let c = 0; c < 4; c++) amp = Math.max(amp, seen[n].max[c] - seen[n].min[c]);
    out.motion[key] = +amp.toFixed(5);
    out.inPlace[key] = hipBone ? +Math.max(hx[1] - hx[0], hz[1] - hz[0]).toFixed(4) : null;
    mixer.stopAllAction();
  }
  return out;
};
</script>`;

const srv = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE); return; }
  const file = url.startsWith('/three/')  ? path.join(ROOT, 'node_modules/three', url.slice(7))
             : url.startsWith('/models/') ? path.join(ROOT, 'public/models', url.slice(8)) : null;
  if (!file) { res.writeHead(404).end(); return; }
  try {
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' })
       .end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

const results = [];  /* se imprimen en orden de insercion */
const record = (id, name, pass, detail) => results.push({ id, name, pass, detail });
const browser = await chromium.launch({ executablePath: resolveChrome(), env: browserEnv(), args: ['--no-sandbox'] });
let r;
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('  [page]', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction('typeof window.inspect === "function"', null, { timeout: 30000 });
  r = await page.evaluate(([g, p, t]) => window.inspect(g, p, t), [GLB, PICKS, TORSO]);
} finally {
  await browser.close();
  srv.close();
}

const sceneSrc = await readFile(path.join(ROOT, 'src/components/ui/PortfolioScene.astro'), 'utf8');

const missing = Object.entries(r.picked).filter(([, v]) => !v).map(([k]) => k);
record('A1', `La escena encuentra sus ${PICKS.length} clips`, missing.length === 0,
  missing.length ? `sin resolver: ${missing.join(', ')}` : Object.entries(r.picked).map(([k, v]) => `${k}→${v.name}`).join(' '));

const empty = Object.entries(r.picked).filter(([, v]) => v && v.tracks === 0).map(([k]) => k);
record('A2', 'Ningún clip elegido está vacío', empty.length === 0,
  empty.length ? `VACÍOS: ${empty.join(', ')}` : Object.entries(r.picked).map(([k, v]) => `${k} ${v.tracks}p/${v.dur}s`).join(' · '));

const inert = Object.entries(r.motion).filter(([, v]) => v !== null && v < 0.002).map(([k]) => k);
record('A3', 'Cada clip mueve el torso', inert.length === 0,
  inert.length ? `inertes: ${inert.join(', ')}` : Object.entries(r.motion).map(([k, v]) => `${k} ${v}`).join(' · '));

record('A4', 'Idle es una respiración larga', !!r.picked.idle && r.picked.idle.dur > 3,
  r.picked.idle ? `${r.picked.idle.dur}s` : 'sin idle');

/* Umbral en unidades de mundo: 15 cm sobre un personaje de ~1.7u. El
   balanceo natural de la cadera queda muy por debajo; el desplazamiento
   propio de un clip sin "In Place" se va muy por encima. */
const drift = Object.entries(r.inPlace).filter(([, v]) => v !== null && v > 0.15);
record('A5', 'Cadera sin desplazamiento propio', drift.length === 0,
  drift.length ? `SE MUEVE: ${drift.map(([k, v]) => `${k}=${v}u`).join(' ')}`
               : Object.entries(r.inPlace).map(([k, v]) => `${k} ${v}u`).join(' · '));

/* A7 — el asset y el código tienen que coincidir. JUMP_DUR es la ventana de
   aire y el clip se escala para entrar en ella: si dejan de coincidir la
   animación se estira o se comprime, y nadie se entera hasta verlo. */
const jumpDur = parseFloat(sceneSrc.match(/const JUMP_DUR = ([\d.]+)/)[1]);
const clipDur = r.picked.jump ? r.picked.jump.dur : null;
const match = clipDur !== null && Math.abs(clipDur - jumpDur) < 0.02;
record('A7', 'JUMP_DUR coincide con el clip Jump', match,
  clipDur === null ? 'sin clip Jump' : `clip ${clipDur}s · JUMP_DUR ${jumpDur}s${match ? ' (factor 1, sin estirar)' : ' <-- SE ESTIRA'}`);

/* A6 — invariante de código, no del asset: todo cambio de acción tiene que
   pasar por switchAction(), que arranca la entrante ANTES de parar la
   saliente. Si una rama vuelve a parar primero, el mixer restaura la bind
   pose del GLB (una T-pose) y se dibuja un frame entero así en la transición
   de respirar a correr. */
const stops = [...sceneSrc.matchAll(/^.*\.stop\(\).*$/gm)].map(m => m[0].trim())
  .filter(l => !l.includes('stopAllAction'));
const helper = sceneSrc.match(/function switchAction[\s\S]*?\n  \}/);
const playsFirst = !!helper && helper[0].indexOf('.play()') < helper[0].indexOf('.stop()');
record('A6', 'El cambio de acción no pasa por bind pose', stops.length === 1 && playsFirst,
  stops.length !== 1 ? `${stops.length} llamadas a .stop() sueltas: ${stops.slice(0, 3).join(' | ')}`
  : !playsFirst ? 'switchAction para antes de arrancar'
  : 'un solo .stop(), dentro de switchAction y después del play()');

console.log(`\n  GLB DEL PERSONAJE — public/models/${GLB}\n`);
console.log('  clips en el archivo: ' + r.all.map(c => `${c.name}(${c.tracks}p/${c.dur}s)`).join(' · ') + '\n');
let failed = 0;
for (const x of results) {
  if (!x.pass) failed++;
  console.log(`  ${x.pass ? '✓' : '✗'} ${x.id.padEnd(4)} ${String(x.name).padEnd(34)} ${x.detail}`);
}
console.log(`\n  ${results.length - failed}/${results.length} en verde\n`);
process.exit(failed ? 1 : 0);
