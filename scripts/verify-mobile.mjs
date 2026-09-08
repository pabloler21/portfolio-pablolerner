/* Arnes de los controles tactiles de la escena 3D.
   Uso: npm run verify:mobile   (hace build y sirve dist/)

   Emula un telefono de verdad (viewport, hasTouch, isMobile) porque el
   componente se monta detras de `(hover: none) and (pointer: coarse)`: en un
   navegador de escritorio no existe, y un test que no emule el dispositivo
   estaria comprobando la nada.

   Lo que importa medir no es que el joystick se dibuje, sino que MUEVA: el
   puente con la escena son KeyboardEvent sinteticos sobre document, asi que
   se escuchan ahi mismo. */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const PORT = 4394;
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2',
};

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
  throw new Error('no encontre chromium; defini CHROME_PATH');
}
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
       .end(await readFile(file));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

const results = [];
const record = (id, name, pass, detail) => results.push({ id, name, pass, detail });

/* La escena avisa cuando arranco; sin eso los controles no se muestran, y
   esperar por reloj mide la maquina y no el producto (leccion 38). */
const SCENE_READY = `document.documentElement.dataset.scene === 'ready'`;

const browser = await chromium.launch({ executablePath: resolveChrome(), env: browserEnv(), args: ['--no-sandbox'] });
try {
  /* ── Telefono ──────────────────────────────────────────────────────── */
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await phone.newPage();
  page.on('pageerror', e => console.error('  [page]', e.message));
  await page.goto(BASE + '/en/', { waitUntil: 'load' });

  let sceneUp = true;
  try { await page.waitForFunction(SCENE_READY, null, { timeout: 90000 }); }
  catch { sceneUp = false; }

  record('M1', 'La escena 3D arranca en tactil', sceneUp,
    sceneUp ? 'nier:scene-ready' : 'NO arranco (antes salia al fallback a proposito)');

  const canvasVisible = await page.locator('#ps-canvas').isVisible().catch(() => false);
  const fallbackHidden = await page.locator('#ps-fallback').evaluate(el => el.classList.contains('hidden')).catch(() => false);
  record('M2', 'Canvas visible y fallback oculto', canvasVisible && fallbackHidden,
    `canvas=${canvasVisible} fallback oculto=${fallbackHidden}`);

  /* Con el selector de perfil abierto los controles NO tienen que estar: es un
     overlay de z-index 9000 y el dedo le pegaria a el, no al joystick. */
  const stickAntes = await page.locator('.tc-stick').count();
  record('M3', 'Ocultos con el selector abierto', stickAntes === 0,
    stickAntes ? 'VISIBLES debajo del overlay — el dedo no los alcanza' : 'ocultos');

  /* Se elige un rol, que es lo que pone al personaje a caminar. Se espera a
     `.boot-done` y no a un reloj: los listeners de saltear-el-boot del
     selector se comen el primer click mientras la secuencia sigue viva
     (leccion 23 del CLAUDE.md), asi que tocar antes de tiempo no hace nada y
     el test falla de a ratos. */
  await page.waitForSelector('#persona-overlay.boot-done', { timeout: 30000 });
  await page.locator('.persona-opt').first().tap();
  await page.waitForSelector('.tc-stick', { timeout: 20000 }).catch(() => {});
  const hasStick = await page.locator('.tc-stick').count();
  const hasJump = await page.locator('.tc-jump').count();
  record('M3b', 'Aparecen al elegir rol', hasStick === 1 && hasJump === 1,
    `stick=${hasStick} salto=${hasJump}`);

  /* Espia de teclas: el puente real con la escena. */
  await page.evaluate(() => {
    window.__k = [];
    document.addEventListener('keydown', e => window.__k.push('down:' + e.code), true);
    document.addEventListener('keyup', e => window.__k.push('up:' + e.code), true);
  });

  /* Arrastre del pulgar hacia adelante = KeyW mantenida. */
  const box = await page.locator('.tc-stick').boundingBox();
  if (box) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - box.height * 0.45, { steps: 8 });
    await page.waitForTimeout(250);
    const held = await page.evaluate(() => window.__k.slice());
    await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__k.slice());

    record('M4', 'Arrastrar adelante mantiene KeyW', held.includes('down:KeyW'),
      held.length ? held.slice(0, 4).join(' ') : 'no se despacho ninguna tecla');
    record('M5', 'Soltar libera la tecla', after.includes('up:KeyW'),
      after.filter(x => x.startsWith('up:')).join(' ') || 'NO se solto — el personaje quedaria caminando solo');
  } else {
    record('M4', 'Arrastrar adelante mantiene KeyW', false, 'sin joystick en pantalla');
    record('M5', 'Soltar libera la tecla', false, 'sin joystick en pantalla');
  }

  await page.evaluate(() => { window.__k = []; });
  await page.locator('.tc-jump').tap().catch(() => {});
  await page.waitForTimeout(200);
  const jk = await page.evaluate(() => window.__k.slice());
  /* Exactamente uno de cada: onPointerUp y onPointerLeave disparan los dos al
     levantar el dedo, y el keyup salia duplicado. */
  const downs = jk.filter(x => x === 'down:Space').length;
  const ups = jk.filter(x => x === 'up:Space').length;
  record('M6', 'El salto despacha Space una sola vez', downs === 1 && ups === 1,
    jk.join(' ') || 'ninguna tecla');

  /* Regla dura del design system: cero border-radius. */
  const radii = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.tc-root, .tc-root *')) {
      const r = getComputedStyle(el).borderRadius;
      if (r && r !== '0px' && !r.startsWith('0px 0px')) out.push(`${el.className || el.tagName}:${r}`);
    }
    return out;
  });
  record('M7', 'Controles sin border-radius', radii.length === 0, radii.length ? radii.slice(0, 3).join(' ') : 'cuadrados');

  /* M9 — el panel del dossier medía 440px sobre un viewport de 390 y se le
     cortaban 50px por la izquierda. La media query existía pero estaba ANTES
     de la regla base: misma especificidad, gana la última. */
  const anchos = await page.evaluate(() => {
    const vw = innerWidth;
    const med = sel => {
      const e = document.querySelector(sel);
      return e ? Math.round(e.getBoundingClientRect().width) : null;
    };
    return { vw, panel: med('#ps-panel'), drawer: med('#ps-projects-drawer'),
             scrollX: document.documentElement.scrollWidth };
  });
  const entra = anchos.panel !== null && anchos.panel <= anchos.vw
             && anchos.drawer !== null && anchos.drawer <= anchos.vw;
  record('M9', 'Panel y cajon entran en la pantalla', entra,
    `viewport ${anchos.vw} · panel ${anchos.panel} · cajon ${anchos.drawer}`);

  /* M11 — nada puede colgar fuera del borde. Los iconos sociales quedaban a
     x=-9: su ancho es el margen que sobra del shell de 1400px, que en un
     telefono es 0, asi que se desbordaban mitad afuera. */
  const colgando = await page.evaluate(() => {
    const vw = innerWidth;
    return [...document.querySelectorAll('body *')].filter(e => {
      const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return b.width > 4 && b.height > 4 && cs.visibility !== 'hidden'
          && cs.display !== 'none' && +cs.opacity > 0.05
          && (b.x < -0.5 || b.right > vw + 0.5);
    })
    /* El panel y el cajon —y todo lo que llevan adentro— estan estacionados
       fuera a proposito MIENTRAS ESTAN CERRADOS: entran con un transform. Se
       los perdona solo en ese estado; abiertos tienen que entrar en pantalla,
       que es justo lo que mide M9. */
    .filter(e => !e.closest('#ps-panel:not(.open), #ps-projects-drawer:not(.open)'))
    .map(e => `${e.tagName}.${(typeof e.className === 'string' ? e.className.split(' ')[0] : '')}@${Math.round(e.getBoundingClientRect().x)}`);
  });
  record('M11', 'Nada cuelga fuera de la pantalla', colgando.length === 0,
    colgando.length ? colgando.slice(0, 4).join(' ') : 'todo adentro');

  /* M10 — el boton decía "[ SALTO ]" también en /en/. */
  const label = await page.locator('.tc-jump').textContent();
  record('M10', 'El boton de salto habla el idioma de la pagina', /JUMP/i.test(label ?? ''),
    `/en/ dice ${JSON.stringify(label)}`);

  await phone.close();

  /* ── Escritorio: no tiene que bajar React ──────────────────────────── */
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dpage = await desk.newPage();
  const reactReqs = [];
  dpage.on('request', r => { if (/client\.[\w-]+\.js|TouchControls/.test(r.url())) reactReqs.push(r.url().split('/').pop()); });
  await dpage.goto(BASE + '/en/', { waitUntil: 'load' });
  await dpage.waitForTimeout(3000);
  record('M8', 'Escritorio no descarga React', reactReqs.length === 0,
    reactReqs.length ? `bajo ${reactReqs.join(', ')}` : 'client:media no lo pidio');
  await desk.close();
} finally {
  await browser.close();
  srv.close();
}

const pad = s => String(s).padEnd(36);
let failed = 0;
console.log('\n  CONTROLES TACTILES — escena 3D en telefono\n');
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.id.padEnd(4)} ${pad(r.name)} ${r.detail}`);
}
console.log(`\n  ${results.length - failed}/${results.length} en verde\n`);
process.exit(failed ? 1 : 0);
