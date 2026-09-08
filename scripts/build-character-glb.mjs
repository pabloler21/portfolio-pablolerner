/* Rehornea public/models/remy.glb desde los FBX de Mixamo.
   Uso: node scripts/build-character-glb.mjs [carpeta-con-los-fbx]

   Existe porque la conversión anterior se hizo con un script descartable y el
   conocimiento se perdió (lección 32 del CLAUDE.md lo documenta de memoria).
   Mixamo entrega FBX y le pone `mixamo.com` de nombre a TODOS los clips, así
   que hay que renombrarlos por archivo o se pisan entre sí.

   Corre en Chromium headless: FBXLoader y GLTFExporter necesitan DOM y canvas
   (las texturas se reescalan con un <canvas>), no andan en Node pelado. */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FBX_DIR = process.argv[2] || '/mnt/c/Users/pablo/Downloads';
const OUT = path.join(ROOT, 'public/models/remy.glb');
const PORT = 4398;

/* nombre del clip -> archivo FBX. El primero es además la fuente del
   personaje (malla + esqueleto + texturas); los otros aportan sólo su clip. */
const SOURCES = [
  { clip: 'Walking', file: 'Walking.fbx' },
  { clip: 'Running', file: 'Running.fbx' },
  { clip: 'Idle',    file: 'Breathing Idle.fbx' },
  { clip: 'Jump',    file: 'Running Jump.fbx' },
];
const TEX_SIZE = 256;   // Mixamo las manda en 2048: sin esto el GLB pasa de 7 a 41 MB

for (const s of SOURCES) {
  if (!existsSync(path.join(FBX_DIR, s.file))) {
    console.error(`✗ falta ${s.file} en ${FBX_DIR}`);
    process.exit(1);
  }
}

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
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const log = m => fetch('/log', { method: 'POST', body: m });

window.build = async (sources, texSize) => {
  const fbxLoader = new FBXLoader();
  let root = null;
  const clips = [];

  for (const s of sources) {
    const obj = await fbxLoader.loadAsync('/fbx/' + encodeURIComponent(s.file));
    /* Cada FBX de Mixamo trae DOS animaciones: la real ("mixamo.com") y una
       "Take 001" vacía de 0 pistas. El orden NO es estable — en Walking y
       Running la real es la [0], en Breathing Idle es la [1]. Tomar la [0] a
       ciegas es lo que metió un clip Idle vacío en el remy.glb anterior. Se
       elige por contenido: la que más pistas tenga. */
    const clip = obj.animations.filter(a => a.tracks.length > 0)
                               .sort((a, b) => b.tracks.length - a.tracks.length)[0];
    if (!clip) throw new Error('sin animación con pistas en ' + s.file);
    clip.name = s.clip;   /* Mixamo llama "mixamo.com" a TODOS: sin esto se pisan */

    /* In Place: se anula el desplazamiento HORIZONTAL de la cadera y se
       conserva el rebote vertical, o el personaje camina solo peleando
       contra WASD (lección 31). */
    let stripped = 'no hacía falta';
    for (const tr of clip.tracks) {
      if (!/(Hips)\\.position$/i.test(tr.name)) continue;
      /* Sólo se anula si hay DESPLAZAMIENTO de verdad. Un clip bajado con
         "In Place" tildado conserva igual el balanceo lateral de la cadera
         —unos milímetros— y ese balanceo es animación buena: anularlo
         entero endurece la caminata. El caso que hay que atajar es el otro,
         el de la lección 31: un Running con 739 unidades propias que hace
         que el personaje se vaya solo peleando contra WASD. El umbral va
         contra la altura del propio modelo, así no depende de las unidades
         del archivo. */
      let range = 0;
      for (let i = 0; i < tr.values.length; i += 3) {
        range = Math.max(range, Math.abs(tr.values[i]), Math.abs(tr.values[i + 2]));
      }
      const box = new THREE.Box3().setFromObject(obj);
      const limit = box.getSize(new THREE.Vector3()).y * 0.05;
      if (range > limit) {
        for (let i = 0; i < tr.values.length; i += 3) { tr.values[i] = 0; tr.values[i + 2] = 0; }
        stripped = \`anulada (\${range.toFixed(1)} > \${limit.toFixed(1)})\`;
      } else {
        stripped = \`se conserva el balanceo (\${range.toFixed(2)} <= \${limit.toFixed(1)})\`;
      }
    }
    clips.push(clip);
    await log(\`  \${s.clip}: \${clip.tracks.length} pistas · \${clip.duration.toFixed(3)}s · cadera: \${stripped}\`);
    if (!root) root = obj;
  }

  /* Normalización contra el remy.glb que ya está en la escena, para no tocar
     ni escala ni posición en el código.

     Se mide con HUESOS, no con Box3. \`Box3.setFromObject\` sobre un SkinnedMesh
     devuelve la caja de la BIND POSE: transforma la boundingBox de la
     geometría por la matriz del mesh e ignora el skinning, así que da lo mismo
     qué animación esté aplicada. Con eso el GLB actual (pose horneada) y el
     FBX nuevo (T-pose) no son comparables — 0.68 de ancho contra 1.79. Las
     posiciones de mundo de los huesos sí siguen al mixer, así que la medición
     se hace sobre ellos, con los dos modelos en la MISMA pose. */
  const cur = await new GLTFLoader().loadAsync('/current/remy.glb');
  const WALK_NEUTRAL_TIME = 0.4667;

  const snapshot = (obj) => {
    const m = new Map();
    obj.traverse(o => { if (o.isBone) m.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
    return m;
  };
  const restore = (m) => { for (const [o, [p, q, sc]] of m) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); } };

  const poseAt = (obj, clip) => {
    const mx = new THREE.AnimationMixer(obj);
    const a = mx.clipAction(clip);
    a.setEffectiveWeight(1); a.play();
    mx.setTime(WALK_NEUTRAL_TIME);
    obj.updateMatrixWorld(true);
    return mx;
  };

  const boneMap = (obj) => {
    const m = {};
    obj.traverse(o => { if (o.isBone && !m[o.name]) m[o.name] = o; });
    return m;
  };
  const V = new THREE.Vector3();
  /* Altura de referencia: de la planta del pie más bajo a la punta de la
     cabeza, en mundo. Es independiente de la pose salvo por centímetros. */
  const metrics = (obj) => {
    const b = boneMap(obj);
    obj.updateMatrixWorld(true);
    const yOf = n => (b[n] ? b[n].getWorldPosition(V).y : null);
    const top = yOf('mixamorigHeadTop_End') ?? yOf('mixamorigHead');
    const feet = ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot']
      .map(yOf).filter(v => v !== null);
    const hips = b['mixamorigHips'].getWorldPosition(new THREE.Vector3());
    return { top, bottom: Math.min(...feet), hips };
  };

  const curWalk = cur.animations.find(a => /^walking$/i.test(a.name)) ?? cur.animations[0];
  const curSnap = snapshot(cur.scene);
  poseAt(cur.scene, curWalk);
  const T = metrics(cur.scene);

  const newSnap = snapshot(root);
  poseAt(root, clips[0]);
  let N = metrics(root);

  const k = (T.top - T.bottom) / (N.top - N.bottom);
  root.scale.multiplyScalar(k);
  root.updateMatrixWorld(true);
  N = metrics(root);
  root.position.x += T.hips.x - N.hips.x;
  root.position.y += T.bottom - N.bottom;     // pies a la misma altura
  root.position.z += T.hips.z - N.hips.z;
  root.updateMatrixWorld(true);
  const F = metrics(root);
  await log(\`  altura objetivo \${(T.top - T.bottom).toFixed(4)}u · nueva \${(F.top - F.bottom).toFixed(4)}u · factor \${k.toFixed(6)}\`);
  await log(\`  pies  objetivo y=\${T.bottom.toFixed(4)} · nuevo y=\${F.bottom.toFixed(4)}\`);
  await log(\`  cadera objetivo \${[T.hips.x,T.hips.y,T.hips.z].map(v=>v.toFixed(4))} · nueva \${[F.hips.x,F.hips.y,F.hips.z].map(v=>v.toFixed(4))}\`);

  /* Vuelta a la bind pose antes de exportar: GLTFExporter escribe la
     transformación VIVA de cada hueso, así que exportar posado hornea esa
     pose como reposo del archivo. \`stopAllAction()\` NO la restaura —
     hay que reponer los huesos a mano desde el snapshot. */
  restore(newSnap);
  restore(curSnap);
  root.updateMatrixWorld(true);

  /* Texturas a 256. GLTFExporter las embebe SIN comprimir. */
  const seen = new Set();
  let rescaled = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      for (const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','specularMap']) {
        const tex = m && m[key];
        if (!tex || !tex.image || seen.has(tex)) continue;
        seen.add(tex);
        const cv = document.createElement('canvas');
        cv.width = cv.height = texSize;
        cv.getContext('2d').drawImage(tex.image, 0, 0, texSize, texSize);
        tex.image = cv;
        tex.needsUpdate = true;
        rescaled++;
      }
    }
  });
  await log(\`  texturas reescaladas a \${texSize}px: \${rescaled}\`);

  const buf = await new Promise((res, rej) =>
    new GLTFExporter().parse(root, res, rej, { binary: true, animations: clips }));
  await fetch('/out', { method: 'POST', body: buf });
  return { bytes: buf.byteLength, clips: clips.map(c => c.name) };
};
</script>`;

let outBuf = null;
const srv = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const chunks = [];
  if (req.method === 'POST') { for await (const c of req) chunks.push(c); }
  if (url === '/out') { outBuf = Buffer.concat(chunks); res.writeHead(200).end('ok'); return; }
  if (url === '/log') { console.log(Buffer.concat(chunks).toString()); res.writeHead(200).end('ok'); return; }
  let file = null;
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE); return; }
  if (url.startsWith('/three/')) file = path.join(ROOT, 'node_modules/three', url.slice(7));
  else if (url.startsWith('/fbx/')) file = path.join(FBX_DIR, url.slice(5));
  else if (url.startsWith('/current/')) file = path.join(ROOT, 'public/models', url.slice(9));
  if (!file) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    const ct = file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

console.log(`\n  Rehorneando remy.glb desde ${FBX_DIR}\n`);
const browser = await chromium.launch({ executablePath: resolveChrome(), env: browserEnv(), args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('  [page]', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction('typeof window.build === "function"', null, { timeout: 30000 });
  const info = await page.evaluate(([s, t]) => window.build(s, t), [SOURCES, TEX_SIZE]);
  if (!outBuf) throw new Error('el navegador no devolvió el GLB');
  await copyFile(OUT, OUT + '.bak');
  await writeFile(OUT, outBuf);
  console.log(`\n  ✓ ${OUT}`);
  console.log(`    ${(outBuf.length / 1024 / 1024).toFixed(2)} MB · clips: ${info.clips.join(', ')}`);
  console.log(`    respaldo del anterior en remy.glb.bak\n`);
} finally {
  await browser.close();
  srv.close();
}
