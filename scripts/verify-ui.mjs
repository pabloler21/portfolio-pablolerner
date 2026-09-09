/* Verificación de los criterios de aceptación de
   docs/superpowers/specs/2026-08-20-ui-capas-separadas-design.md §14
   Uso: npm run verify:ui   (hace build y sirve dist/) */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;

/* Las dos paginas de rol se fundieron en una sola de records. */
const DOC_PAGES = ['/en/projects/', '/es/projects/'];
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

/* Solapamiento del rail de contacto contra el contenido de la pagina.
   Devuelve un renglon por choque, con los pixeles de cruce, para que el
   detalle diga cuanto y contra que — un booleano no alcanza para saber si
   la correccion movio el problema o lo resolvio. */
const RAIL_PROBE = () => {
  const rail = document.querySelector('.ps-icon-rail');
  if (!rail) return ['falta .ps-icon-rail'];
  const r = rail.getBoundingClientRect();
  const choques = [];
  const victimas = document.querySelectorAll('.os-main, .os-main *, .os-identity, .status-bar');
  for (const el of victimas) {
    if (rail.contains(el) || el.contains(rail)) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) continue;
    const ox = Math.min(r.right, b.right) - Math.max(r.left, b.left);
    const oy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
    if (ox > 1 && oy > 1) {
      const nombre = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '');
      choques.push(`pisa ${nombre} (${Math.round(ox)}x${Math.round(oy)}px)`);
    }
  }
  /* Un rail metido a la fuerza tampoco puede empujar la pagina a lo ancho. */
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
    choques.push(`desborde horizontal ${document.documentElement.scrollWidth}>${document.documentElement.clientWidth}`);
  }
  return choques;
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

  /* C13 — el rail de contacto no se monta encima del contenido en telefono.
     Debajo de 1400px la columna de margen mide CERO, asi que un rail fijo ahi
     queda flotando sobre la pagina: en /contact/ a 320px llegaba a x=26.8 con
     el formulario empezando en 10.4, o sea los iconos sobre las etiquetas
     NAME/EMAIL. Se mide el solapamiento REAL de rectangulos contra todo lo que
     hay en <main> y en el pie, no la posicion del rail: lo que importa no es
     donde esta sino que no pise nada. Ancho 320 (el telefono mas angosto que
     se sigue usando) y 390 (el comun). */
  {
    const chico = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
    const comun = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const choques = [];
    for (const [ancho, c] of [[320, chico], [390, comun]]) {
      const pg = await c.newPage();
      for (const url of [...DOC_PAGES, '/en/contact/', '/es/contact/']) {
        await pg.goto(BASE + url, { waitUntil: 'load' });
        await pg.waitForTimeout(600);
        for (const hit of await pg.evaluate(RAIL_PROBE)) choques.push(`${ancho}px ${url} ${hit}`);
      }
      await pg.close();
      await c.close();
    }
    const combos = (DOC_PAGES.length + 2) * 2;
    record('C13', 'El rail de contacto no pisa el contenido (320/390)', choques.length === 0,
      choques.length ? choques.slice(0, 6).join(' · ') : `sin solapamiento en ${combos} combinaciones`);
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

/* C10 — la direccion personal no se publica. Estaba en un mailto: del rail de
   iconos, o sea en texto plano en las 11 paginas, que es lo que rastrean los
   recolectores de spam. El contacto va por el formulario, que sale desde
   contacto@pablolerner.dev. Se mira el HTML CONSTRUIDO y no el fuente: la
   direccion sigue viviendo en la config del server, y lo que importa es que no
   termine servida. */
const correos = [];
for (const f of await readdir(DIST, { recursive: true })) {
  if (!f.endsWith('.html')) continue;
  const t2 = await readFile(path.join(DIST, f), 'utf8');
  if (/lerner\.pb@gmail\.com/.test(t2)) correos.push(f);
}
record('C10', 'El mail personal no se publica', correos.length === 0,
  correos.length ? `${correos.length} paginas lo exponen: ${correos.slice(0, 3).join(', ')}…` : 'ninguna pagina lo expone');

/* C11 — el cambio de idioma tiene que estar en TODAS las paginas construidas y
   NO puede perder la pagina. Antes vivia en el StatusBar, que solo se renderiza
   en surface="doc": en la home —la escena, la puerta de entrada del sitio— no
   habia ninguno. Y sus links eran fijos a /en/ y /es/, asi que desde /en/projects/
   te dejaba en la home española.
   Se mira el HTML CONSTRUIDO y se comprueba que el destino EXISTE como archivo:
   /en/concept/* solo esta en ingles, y un toggle ciego manda a un 404. */
const paginas = (await readdir(DIST, { recursive: true })).filter(f => f.endsWith('index.html'));
const sinToggle = [], malDestino = [];
for (const f of paginas) {
  const ruta = '/' + f.replace(/index\.html$/, '');
  if (ruta === '/') continue;   /* el redirect raiz no lleva chrome */
  const html = await readFile(path.join(DIST, f), 'utf8');
  /* Solo las paginas que llevan el chrome del sitio. /en/concept/city/ es una
     pagina suelta SIN layout Base —a proposito, para no abrir un tercer
     contexto WebGL— asi que no tiene barra de identidad donde poner nada.
     Exigirle el toggle era medir mal, no encontrar un bug. */
  if (!html.includes('class="os-identity"')) continue;
  const m = html.match(/class="os-lang-btn" href="([^"]+)"/);
  if (!m) { sinToggle.push(ruta); continue; }
  const idioma = ruta.startsWith('/es/') ? 'es' : 'en';
  const otro = idioma === 'en' ? 'es' : 'en';
  const hermana = ruta.replace(`/${idioma}/`, `/${otro}/`);
  const existe = paginas.includes(hermana.slice(1) + 'index.html');
  const esperado = existe ? hermana : `/${otro}/`;
  if (m[1] !== esperado) malDestino.push(`${ruta} → ${m[1]} (esperaba ${esperado})`);
}
record('C11', 'Cambio de idioma en toda pagina con chrome', sinToggle.length === 0,
  sinToggle.length ? `sin toggle: ${sinToggle.join(', ')}` : 'todas las paginas con barra de identidad lo tienen');
record('C12', 'El cambio de idioma no pierde la pagina', malDestino.length === 0,
  malDestino.length ? malDestino.slice(0, 3).join(' · ') : 'cada una apunta a su hermana (o a la home si no existe)');

/* C14 — las rutas viejas no mueren. /ai/ y /risk/ se fundieron en /projects/,
   pero hay links repartidos afuera (CV, LinkedIn, postulaciones) que apuntan a
   las dos: borrarlas a secas convertia cada uno de esos links en un 404. Se
   comprueba sobre el arbol construido que las cuatro existen y que apuntan a la
   pagina nueva del MISMO idioma — un redirect cruzado seria peor que el 404. */
{
  const rotas = [];
  for (const [vieja, destino] of [
    ['/en/ai/', '/en/projects'], ['/en/risk/', '/en/projects'],
    ['/es/ai/', '/es/projects'], ['/es/risk/', '/es/projects'],
  ]) {
    const f = path.join(DIST, vieja.slice(1), 'index.html');
    if (!existsSync(f)) { rotas.push(`${vieja} no existe`); continue; }
    const html = await readFile(f, 'utf8');
    const m = html.match(/http-equiv="refresh" content="0;url=([^"]+)"/);
    if (!m) rotas.push(`${vieja} sin redirect`);
    else if (m[1] !== destino) rotas.push(`${vieja} → ${m[1]} (esperaba ${destino})`);
  }
  record('C14', 'Las rutas de rol viejas redirigen', rotas.length === 0,
    rotas.length ? rotas.join(' · ') : '/ai/ y /risk/ → /projects/ en los dos idiomas');
}

const pad = s => String(s).padEnd(40);
let failed = 0;
console.log('\n  CRITERIOS DE ACEPTACIÓN — spec §14\n');
for (const r of results.sort((a, b) => a.id.localeCompare(b.id))) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.id.padEnd(4)} ${pad(r.name)} ${r.detail}`);
}
console.log(`\n  ${results.length - failed}/${results.length} en verde\n`);
process.exit(failed ? 1 : 0);
