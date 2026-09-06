/* Captura reproducible de la escena 3D para verificación visual.
   Uso: npm run build && node scripts/shot-scene.mjs <etiqueta>
   Deja .captures/<etiqueta>-wide.png y .captures/<etiqueta>-crop.png */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const OUT  = path.join(ROOT, '.captures');
const TAG  = process.argv[2] || 'scene';
const PORT = 4405;
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2',
};

function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.HOME, '.cache/ms-playwright');
  for (const d of readdirSync(base).filter(x => x.startsWith('chromium-'))) {
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('No se encontró chromium. Definí CHROME_PATH.');
}

function browserEnv() {
  const libs = path.join(ROOT, '.cache/pw-libs/root/usr/lib/x86_64-linux-gnu');
  if (!existsSync(libs)) return process.env;
  const prev = process.env.LD_LIBRARY_PATH;
  return { ...process.env, LD_LIBRARY_PATH: prev ? `${libs}:${prev}` : libs };
}

const srv = await new Promise(resolve => {
  const s = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(DIST, p);
    if (!f.startsWith(DIST)) { res.writeHead(403).end(); return; }
    try {
      const b = await readFile(f);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      res.end(b);
    } catch { res.writeHead(404).end('not found'); }
  });
  s.listen(PORT, '127.0.0.1', () => resolve(s));
});

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: resolveChrome(), env: browserEnv(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 160)));

  await page.goto(BASE + '/en/', { waitUntil: 'load' });
  await page.waitForSelector('.persona-opt[data-zone="risk"]', { timeout: 60000 });
  /* La intro cinematográfica bloquea el selector ~2.4s */
  await page.waitForTimeout(4000);
  await page.click('.persona-opt[data-zone="risk"]');

  /* NO esperar un tiempo fijo. La caminata al primer cartel avanza POR FRAME
     (charX += dx * 0.035), así que cuánto tarda depende de cuántos frames
     entren en el intervalo — y SwiftShader se vuelve más lento con cada
     material que recibe luz. Un timeout fijo que alcanzaba antes de los
     materiales PBR dejó de alcanzar después, y las capturas salían con el
     personaje parado en el origen y ningún cartel encendido.
     La condición real es que el dossier se haya abierto por proximidad. */
  const t0 = Date.now();
  await page.waitForFunction(
    () => document.getElementById('ps-panel')?.classList.contains('open'),
    null, { timeout: 180000, polling: 500 },
  );
  console.log(`  cartel encendido a los ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  /* Dejar asentar el flicker de power-on y el scramble del título */
  await page.waitForTimeout(3000);
  /* El overlay del título tapa al personaje en el encuadre de detalle */
  await page.evaluate(() => {
    const h = document.getElementById('ps-hero');
    if (h) h.style.display = 'none';
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(OUT, `${TAG}-wide.png`) });
  await page.screenshot({
    path: path.join(OUT, `${TAG}-crop.png`),
    clip: { x: 520, y: 300, width: 460, height: 440 },
  });
  console.log(`  capturas → .captures/${TAG}-wide.png · .captures/${TAG}-crop.png`);
  if (errs.length) console.log(`  ⚠ errores de página: ${errs.slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
  srv.close();
}
