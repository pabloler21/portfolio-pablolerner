/* Verificación de los criterios de aceptación de
   docs/superpowers/specs/2026-08-20-ui-capas-separadas-design.md §14
   Uso: npm run verify:ui   (hace build y sirve dist/) */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;

const DOC_PAGES = ['/en/risk/', '/en/ai/', '/es/risk/', '/es/ai/'];
const GAME_PAGE = '/en/';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf',
};

function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.HOME, '.cache/ms-playwright');
  if (!existsSync(base)) throw new Error('No hay navegadores en ~/.cache/ms-playwright. Definí CHROME_PATH.');
  for (const d of readdirSync(base).filter(x => x.startsWith('chromium-'))) {
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('No se encontró binario de chromium. Definí CHROME_PATH.');
}

// Chromium necesita libnspr4/libnss3/libasound en WSL2, que no vienen con la
// distro. Se extraen a .cache/pw-libs y se inyectan al proceso del navegador;
// NO alcanza con exportar LD_LIBRARY_PATH en la shell que llama al script.
//   apt-get download libnspr4 libnss3 libasound2t64
//   for f in *.deb; do dpkg-deb -x "$f" root; done
function browserEnv() {
  const libs = path.join(ROOT, '.cache/pw-libs/root/usr/lib/x86_64-linux-gnu');
  if (!existsSync(libs)) return process.env;
  const prev = process.env.LD_LIBRARY_PATH;
  return { ...process.env, LD_LIBRARY_PATH: prev ? `${libs}:${prev}` : libs };
}

function serveDist() {
  return new Promise(resolve => {
    const srv = createServer(async (req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(DIST, p);
      if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404).end('not found'); }
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

/* ── sondas de página ─────────────────────────────────────────── */

// Contraste efectivo: compone la opacidad acumulada del texto sobre el
// primer ancestro con background-color opaco.
const CONTRAST_PROBE = () => {
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
  const opaqueBg = el => {
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > 0.9)) return [c[0], c[1], c[2]];
    }
    return [13, 15, 20];
  };
  const out = [];
  document.querySelectorAll('body *').forEach(el => {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim();
    if (own.length < 2) return;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    let a = 1;
    for (let n = el; n && n !== document.body; n = n.parentElement) a *= +getComputedStyle(n).opacity;
    if (a === 0) return;
    const bg = opaqueBg(el);
    const c = parse(s.color);
    const comp = [0, 1, 2].map(i => a * c[i] + (1 - a) * bg[i]);
    const l1 = lum(comp), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    out.push({ text: own.slice(0, 40), px: +parseFloat(s.fontSize).toFixed(1), ratio: +ratio.toFixed(2) });
  });
  return out;
};

// `animation-play-state` en computed style siempre dice "running", también
// para animaciones ya terminadas. El ruido real es el movimiento perpetuo:
// se mide `animation-iteration-count: infinite`. Las animaciones de entrada
// que terminan no son ruido, pero se cuentan aparte por si se disparan.
const COUNT_PROBE = () => {
  let infinite = 0, declared = 0;
  for (const e of document.querySelectorAll('*')) {
    const s = getComputedStyle(e);
    if (s.animationName === 'none') continue;
    declared++;
    if (s.animationIterationCount.split(',').some(v => v.trim() === 'infinite')) infinite++;
  }
  return {
    canvases: document.querySelectorAll('canvas').length,
    infinite,
    declared,
    navHrefs: [...document.querySelectorAll('nav a[href]')].map(a => a.getAttribute('href')),
  };
};

const RAIN_PROBE = () => {
  const shell = document.querySelector('.os-shell');
  if (!shell) return { overlaps: [{ id: 'os-shell', overlapPx: -1 }] };
  const s = shell.getBoundingClientRect();
  const overlaps = [];
  for (const id of ['margin-rain-left', 'margin-rain-right']) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const ox = Math.min(r.right, s.right) - Math.max(r.left, s.left);
    if (ox > 1) overlaps.push({ id, overlapPx: Math.round(ox) });
  }
  return { overlaps };
};

/* ── chequeos de fuente ───────────────────────────────────────── */

async function grepSrc(re) {
  const hits = [];
  const walk = async dir => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) await walk(f);
      else if (/\.(astro|css|ts|js)$/.test(e.name)) {
        const t = await readFile(f, 'utf8');
        t.split('\n').forEach((line, i) => { if (re.test(line)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`); });
      }
    }
  };
  await walk(path.join(ROOT, 'src'));
  return hits;
}

/* ── ejecución ────────────────────────────────────────────────── */

const results = [];
const record = (id, name, pass, detail) => results.push({ id, name, pass, detail });

const srv = await serveDist();
const browser = await chromium.launch({
  executablePath: resolveChrome(),
  env: browserEnv(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();

  let worstRatio = Infinity, worstText = '';
  let smallest = Infinity, smallestText = '';
  let maxCanvas = 0, maxInfinite = 0, maxDeclared = 0;
  const navTargets = new Set();

  for (const url of DOC_PAGES) {
    await page.goto(BASE + url, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    for (const r of await page.evaluate(CONTRAST_PROBE)) {
      if (r.ratio < worstRatio) { worstRatio = r.ratio; worstText = `${url} "${r.text}" ${r.ratio}:1`; }
      if (r.px < smallest) { smallest = r.px; smallestText = `${url} "${r.text}" ${r.px}px`; }
    }
    const c = await page.evaluate(COUNT_PROBE);
    maxCanvas = Math.max(maxCanvas, c.canvases);
    maxInfinite = Math.max(maxInfinite, c.infinite);
    maxDeclared = Math.max(maxDeclared, c.declared);
    c.navHrefs.forEach(h => { if (h.startsWith('/')) navTargets.add(h); });
  }

  record('C1', 'Contraste efectivo >= 4.5:1 (doc)', worstRatio >= 4.5, `peor: ${worstText}`);
  record('C6', 'Texto >= 11px (doc)', smallest >= 11, `menor: ${smallestText}`);
  record('C2', 'Doc: 0 <canvas>', maxCanvas === 0, `máximo: ${maxCanvas}`);
  record('C3', 'Doc: 0 animaciones infinite', maxInfinite === 0, `infinite: ${maxInfinite} · declaradas: ${maxDeclared} (techo 20)`);
  record('C3b', 'Doc: <= 20 animaciones declaradas', maxDeclared <= 20, `declaradas: ${maxDeclared}`);

  // Los assets descargables (CV) dependen de que Pablo suba el archivo: se
  // reportan aparte para que un bloqueante de contenido no falsee C4.
  const broken = [], missingAssets = [];
  for (const href of navTargets) {
    const r = await page.request.get(BASE + href);
    if (r.ok()) continue;
    (/\.(pdf|zip)$/.test(href) ? missingAssets : broken).push(`${href} -> ${r.status()}`);
  }
  record('C4', 'Navegación sin 404', broken.length === 0,
    broken.length ? broken.join(', ') : `${navTargets.size - missingAssets.length} destinos OK`);
  if (missingAssets.length) {
    console.log(`\n  ⚠ asset pendiente de contenido (no bloquea C4): ${missingAssets.join(', ')}`);
  }

  await page.goto(BASE + GAME_PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const rain = await page.evaluate(RAIN_PROBE);
  record('C7', 'Lluvia no solapa .os-shell @1920', rain.overlaps.length === 0,
    rain.overlaps.length ? JSON.stringify(rain.overlaps) : 'sin solapamiento');

} finally {
  await browser.close();
  srv.close();
}

const pointerMove = await grepSrc(/intersectObject\s*\(\s*groundMesh|onMinimapClick|mmCv\.addEventListener\s*\(\s*['"]click/);
record('C5', 'Sin movimiento por puntero', pointerMove.length === 0,
  pointerMove.length ? pointerMove.join(', ') : 'sin raycast a ground ni click en minimapa');

const plain = await grepSrc(/data-plain|iron-dust-plain|plain-toggle/);
record('C9', 'Sin restos de plain mode', plain.length === 0,
  plain.length ? `${plain.length} refs: ${plain.slice(0, 4).join(', ')}…` : 'limpio');

/* ── spec 2026-09-06 mundo PBR §13 ─────────────────────────────── */

// Ojo: concept/city.astro YA usa ACESFilmicToneMapping con exposición 1.1,
// así que grepear el tone mapping solo daría verde antes de implementar nada.
// Lo que identifica a la escena real es la exposición 1.25 de la calibración A2.
const tone = await grepSrc(/toneMappingExposure\s*=\s*1\.25/);
record('A1', 'Tone mapping ACES @ exposición A2', tone.length === 1,
  tone.length ? tone.join(', ') : 'no se encontró toneMappingExposure = 1.25');

const hdri = await grepSrc(/RGBELoader|scene\.environment|loadHDRI/);
const hdriDir = existsSync(path.join(ROOT, 'public/hdri'));
record('A2', 'HDRI eliminado', hdri.length === 0 && !hdriDir,
  hdri.length ? `${hdri.length} refs: ${hdri.slice(0, 3).join(', ')}` :
  hdriDir ? 'public/hdri/ todavía existe' : 'sin refs ni carpeta');

const pbr = await grepSrc(/function atmosphereMaterial/);
record('A5', 'Atmósfera con MeshStandardMaterial', pbr.length > 0,
  pbr.length ? pbr.join(', ') : 'no existe atmosphereMaterial()');

// La información NO se ilumina: carteles, anillos, chevrons y glows siguen
// self-lit. Si alguno pasara a Standard, se apagaría.
const infoBasic = await grepSrc(/drawBillboardCanvas|RingGeometry|ShapeGeometry/);
const infoStandard = await grepSrc(/MeshStandardMaterial[^)]*map:/);
record('A6', 'La información sigue plana', infoBasic.length > 0 && infoStandard.length === 0,
  infoStandard.length ? `pantalla convertida a PBR: ${infoStandard.join(', ')}` : 'información intacta');

const lightCasters = await grepSrc(/keyLight\.castShadow\s*=\s*true/);
record('A7', 'Exactamente una luz proyecta sombra', lightCasters.length === 1,
  lightCasters.length ? lightCasters.join(', ') : 'ninguna luz con castShadow');

// Cambiar la cantidad de luces en runtime recompila el shader de todos los
// materiales iluminados. El pool se crea en init y sólo se reposiciona.
const poolCreate = await grepSrc(/lampPool\.push\(/);
const poolInTick = await grepSrc(/new THREE\.PointLight[\s\S]{0,80}frameCount/);
record('A4', 'Pool de luces de tamaño fijo', poolCreate.length === 1 && poolInTick.length === 0,
  poolCreate.length !== 1 ? `lampPool.push en ${poolCreate.length} lugares (debe ser 1)` :
  poolInTick.length ? 'se crean luces dentro del tick' : 'pool fijo, sólo se reposiciona');

const charLight = await grepSrc(/charGroup\.add\(\s*fillLight|new THREE\.PointLight\(0xcfd8e6/);
record('A3', 'El personaje no tiene luz propia', charLight.length === 0,
  charLight.length ? charLight.join(', ') : 'sin PointLight colgado del personaje');

const modelsDir = path.join(DIST, 'models');
let modelsMB = 0;
if (existsSync(modelsDir)) {
  for (const f of readdirSync(modelsDir)) {
    modelsMB += statSync(path.join(modelsDir, f)).size / 1048576;
  }
}
record('A8', 'dist/models ≤ 8 MB', modelsMB <= 8, `${modelsMB.toFixed(1)} MB`);

const pad = s => String(s).padEnd(40);
let failed = 0;
console.log('\n  CRITERIOS DE ACEPTACIÓN — spec §14\n');
for (const r of results.sort((a, b) => a.id.localeCompare(b.id))) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.id.padEnd(4)} ${pad(r.name)} ${r.detail}`);
}
console.log(`\n  ${results.length - failed}/${results.length} en verde\n`);
process.exit(failed ? 1 : 0);
