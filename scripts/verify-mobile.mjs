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

  /* M3 se fue con el selector: media el caso "controles debajo del overlay de
     z-index 9000, el dedo le pega al overlay". Ese overlay ya no existe, asi
     que el test no tenia nada que medir. Lo que queda es que los controles
     esten apenas la escena esta viva, SIN ningun toque previo — antes habia
     que elegir un rol primero. */
  await page.waitForSelector('.tc-stick', { timeout: 20000 }).catch(() => {});
  const hasStick = await page.locator('.tc-stick').count();
  const hasJump = await page.locator('.tc-jump').count();
  record('M3b', 'Aparecen apenas la escena esta lista', hasStick === 1 && hasJump === 1,
    `stick=${hasStick} salto=${hasJump}`);

  /* M21 — la calle esta poblada sin que el visitante haga nada. Antes los
     carteles se construian recien al elegir rol; ahora salen en init(). Se
     mira `data-boards`, un atributo que el producto ya escribe (mismo criterio
     que `data-audio`), no un gancho de test. */
  const boards = Number(await page.evaluate(() => document.documentElement.dataset.boards ?? '0'));
  record('M21', 'Los carteles salen sin ningun gesto', boards === 10,
    `${boards} carteles al cargar`);

  /* M22 — el ultimo cartel entra en el mundo. La avenida crecio a 10 carteles
     (z=-100) y hubo que correr el fondo del mundo; esto es lo que atrapa la
     regresion si manana se suma un cartel 11 sin estirar la calle otra vez. */
  const ultimoZ = await page.evaluate(() => {
    try {
      const d = JSON.parse(document.getElementById('ps-data').textContent);
      if (!Array.isArray(d.boards) || !d.boards.length) return null;
      return -10 - (d.boards.length - 1) * 10;   /* misma formula que buildBillboards */
    } catch (_) { return null; }
  });
  const BOUND_Z_MIN = -117, OBELISK_Z = -114;
  record('M22', 'El ultimo cartel entra en el mundo',
    ultimoZ !== null && ultimoZ > BOUND_Z_MIN && ultimoZ > OBELISK_Z,
    ultimoZ === null ? 'no pude leer los carteles de ps-data'
                     : `ultimo cartel z=${ultimoZ} · obelisco ${OBELISK_Z} · bound ${BOUND_Z_MIN}`);

  /* M17 — la musica se arma SOLA, sin ningun gesto. Antes la disparaba el
     click de rol, que era el gesto que el navegador exige; ahora startAmbient()
     corre en init() y deja armado un pointerdown/keydown de un solo uso para
     despertar el contexto. Se lee ACA, antes del primer toque del arnes: mas
     abajo ya se arrastro el joystick y se toco el salto, y cualquiera de los
     dos habria disparado el camino viejo tambien.
     Ojo con el alcance: que SALGA SONIDO lo mide verify:audio renderizando el
     motor en un OfflineAudioContext. Aca se mide el cableado. */
  const audioAlCargar = await page.evaluate(() => document.documentElement.dataset.audio);
  record('M17', 'La musica se arma sin ningun gesto', audioAlCargar === 'on',
    `data-audio=${audioAlCargar} antes de tocar nada`);

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
    /* El componente throttlea a 60ms y bajo carga el primer move puede caer
       dentro de esa ventana. Se espera POR LA TECLA, no por reloj: con un
       timeout fijo el test fallaba una de cada tres corridas, que es peor que
       no tenerlo — enseña a ignorar el rojo. */
    await page.mouse.move(cx, cy - box.height * 0.45, { steps: 12 });
    await page.waitForFunction(() => window.__k.some(k => k === 'down:KeyW'), null, { timeout: 5000 })
      .catch(() => {});
    const held = await page.evaluate(() => window.__k.slice());
    await page.mouse.up();
    await page.waitForFunction(() => window.__k.some(k => k === 'up:KeyW'), null, { timeout: 5000 })
      .catch(() => {});
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
  /* El dropdown de PROJECTS hay que ABRIRLO para medirlo: cerrado es
     `display: none` y mide 0, que pasaria el check sin decir nada. El panel
     en cambio conserva su ancho cerrado (entra con un transform). */
  await page.locator('#ps-projects-tab').tap().catch(() => {});
  await page.waitForTimeout(250);
  const anchos = await page.evaluate(() => {
    const vw = innerWidth;
    const med = sel => {
      const e = document.querySelector(sel);
      return e ? Math.round(e.getBoundingClientRect().width) : null;
    };
    return { vw, panel: med('#ps-panel'), menu: med('#ps-projects-pop'),
             scrollX: document.documentElement.scrollWidth };
  });
  const entra = anchos.panel !== null && anchos.panel <= anchos.vw
             && anchos.menu !== null && anchos.menu > 0 && anchos.menu <= anchos.vw;
  record('M9', 'Panel y menu de proyectos entran en la pantalla', entra,
    `viewport ${anchos.vw} · panel ${anchos.panel} · menu ${anchos.menu}`);
  /* Y se cierra: el menú es un toggle, así que dejarlo abierto le da vuelta
     el primer toque del check siguiente (M14 abría creyendo que abría, y en
     realidad cerraba lo que M9 había dejado abierto). */
  await page.locator('#ps-projects-tab').tap().catch(() => {});
  await page.waitForTimeout(200);

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
    /* El panel esta estacionado fuera a proposito MIENTRAS ESTA CERRADO:
       entra con un transform. Se lo perdona solo en ese estado; abierto tiene
       que entrar en pantalla, que es justo lo que mide M9. (El dropdown de
       proyectos no necesita excepcion: cerrado es `display: none` y el filtro
       de arriba ya lo saltea.) */
    .filter(e => !e.closest('#ps-panel:not(.open)'))
    .map(e => `${e.tagName}.${(typeof e.className === 'string' ? e.className.split(' ')[0] : '')}@${Math.round(e.getBoundingClientRect().x)}`);
  });
  record('M11', 'Nada cuelga fuera de la pantalla', colgando.length === 0,
    colgando.length ? colgando.slice(0, 4).join(' ') : 'todo adentro');

  /* M10 — el boton decía "[ SALTO ]" también en /en/. */
  const label = await page.locator('.tc-jump').textContent();
  record('M10', 'El boton de salto habla el idioma de la pagina', /JUMP/i.test(label ?? ''),
    `/en/ dice ${JSON.stringify(label)}`);

  /* M12 — geometria de la camara, leida del fuente. El `fov` de Three.js es
     VERTICAL: con 52 fijos y el aspecto de un telefono en vertical (0.46) el
     horizontal cae a 25° y los carteles, parados en x = ±6.5, quedaban
     literalmente afuera del cuadro. Esto no mide pixeles, mide la decision
     geometrica: si alguien vuelve a fijar el fov, falla. */
  const src = await readFile(path.join(ROOT, 'src/components/ui/PortfolioScene.astro'), 'utf8');
  const hFovDeg = parseFloat(src.match(/const H_FOV = ([\d.]+) \* Math\.PI/)[1]);
  /* Ojo con el orden: en `Math.min(85, Math.max(52, v))` el PRIMERO es el
     techo y el segundo el piso. Tenerlos al reves dejaba el fov clavado en 52
     y el test fallaba culpando al producto. */
  const clamp = src.match(/Math\.min\((\d+), Math\.max\((\d+),/);
  const fovCap = +clamp[1], fovFloor = +clamp[2];
  const bx = parseFloat(src.match(/const bx\s*=\s*side \* ([\d.]+)/)[1]);
  const camZoff = parseFloat(src.match(/camera\.position\.set\(camX, 4\.0, camTgtZ \+ (\d+)\)/)[1]);
  const boardZ = parseFloat(src.match(/const bz\s*=\s*-(\d+) - k \* /)[1]);

  const aspect = 390 / 844;
  const vFov = Math.min(fovCap, Math.max(fovFloor,
    2 * Math.atan(Math.tan((hFovDeg * Math.PI / 180) / 2) / aspect) * 180 / Math.PI));
  const hFovReal = 2 * Math.atan(Math.tan(vFov * Math.PI / 360) * aspect);
  const dist = boardZ + camZoff;                       // camara a z=+9, cartel a z=-10
  const media = Math.tan(hFovReal / 2) * dist;         // medio ancho visible ahi
  record('M12', 'Los carteles entran en cuadro (vertical)', media >= bx,
    `ve x = ±${media.toFixed(1)} · carteles en ±${bx} · fov ${vFov.toFixed(0)}° vert / ${(hFovReal * 180 / Math.PI).toFixed(0)}° horiz`);

  /* M13 — lo que se abre tiene que dibujarse ARRIBA de los controles. El
     joystick es `position: fixed` con z-index 40 y el cajon estaba en 11: en
     la mitad de abajo del panel el dedo le pegaba al joystick, no a la lista.
     Se lee el z-index computado, no el del fuente: lo que decide es lo que
     resuelve el navegador. */
  const zs = await page.evaluate(() => {
    const z = s => { const e = document.querySelector(s); return e ? +getComputedStyle(e).zIndex : null; };
    return { panel: z('#ps-panel'), menu: z('#ps-projects-pop'), controles: z('.tc-root') };
  });
  const arriba = zs.panel > zs.controles && zs.menu > zs.controles;
  record('M13', 'Los paneles tapan al joystick', arriba,
    `panel ${zs.panel} · menu de proyectos ${zs.menu} · controles ${zs.controles}`);

  /* M14 — la salida de la lista de proyectos. El cajon de 300px tapaba 300
     de 390 y de arriba abajo: no habia lugar donde tocar afuera, por eso
     necesitaba una ✕ propia. El dropdown SI deja afuera —y esa es la razon
     por la que la ✕ se pudo retirar—, asi que lo que hay que medir ahora es
     exactamente eso: que quede pantalla libre y que tocarla cierre.
     El punto se calcula del rectangulo del menu, no a ojo: a la izquierda de
     su borde y arriba de la mitad de la pantalla, para no tocar el joystick,
     que es fijo y vive abajo a la izquierda. */
  await page.locator('#ps-projects-tab').tap().catch(() => {});
  await page.waitForTimeout(250);
  const fuera = await page.evaluate(() => {
    const pop = document.getElementById('ps-projects-pop');
    const r = pop.getBoundingClientRect();
    /* El punto libre se busca DEBAJO del menu: en un telefono el popup ocupa
       casi todo el ancho de la barra, asi que a los costados quedan 17px y no
       son un blanco. Se deja un margen de 120px contra el borde de abajo
       porque ahi vive el joystick, que es fijo y se comeria el toque. */
    const y = r.bottom + 40;
    return {
      abierto: !pop.hasAttribute('hidden'),
      hayAfuera: y < innerHeight - 120,
      libre: Math.round(innerHeight - r.bottom),
      x: Math.round(innerWidth / 2), y: Math.round(y),
    };
  });
  if (fuera.hayAfuera) await page.touchscreen.tap(fuera.x, fuera.y).catch(() => {});
  await page.waitForTimeout(300);
  const menuCerrado = await page.evaluate(() =>
    document.getElementById('ps-projects-pop').hasAttribute('hidden'));
  record('M14', 'Tocar afuera cierra la lista de proyectos',
    fuera.abierto && fuera.hayAfuera && menuCerrado,
    `abrio=${fuera.abierto} · deja ${fuera.libre}px de pantalla libre debajo · cerro=${menuCerrado}`);

  /* M25 — en tactil el boton de PROJECTS tiene que ser un TOGGLE: toco y
     abre, vuelvo a tocar y cierra. Parece obvio y es justo lo que se pierde
     si el hover se habilita sin mirar el tipo de puntero.
     En un telefono los eventos de puntero llegan TODOS en el mismo gesto:
     `pointerenter` con el toque (el menu abre por hover), `pointerleave` al
     levantar el dedo, y recien despues el `click`. O sea que para cuando
     llega el click el pestillo de hover ya se solto y el click cierra lo que
     el hover acababa de abrir: tocar el boton no hace NADA.
     Medido mutando el fuente: con el hover habilitado en tactil, "primer
     toque abre=false", y con el se caen tambien M14 y M15 — todo lo que
     necesita abrir esta lista.
     Por eso el hover va detras de `(hover: hover) and (pointer: fine)`, y
     esto es lo que avisa si alguien saca esa condicion. */
  await page.locator('#ps-projects-tab').tap().catch(() => {});
  await page.waitForTimeout(250);
  const abrioConToque = await page.evaluate(() =>
    !document.getElementById('ps-projects-pop').hasAttribute('hidden'));
  await page.locator('#ps-projects-tab').tap().catch(() => {});
  await page.waitForTimeout(250);
  const cerroConToque = await page.evaluate(() =>
    document.getElementById('ps-projects-pop').hasAttribute('hidden'));
  record('M25', 'En tactil el boton de proyectos abre Y cierra',
    abrioConToque && cerroConToque,
    `primer toque abre=${abrioConToque} · segundo toque cierra=${cerroConToque}`);

  /* M15 — la misma salida en el dossier, por el camino REAL: PROJECTS → una
     fila → el teleport te deja parado en el centro del anillo → el spinner
     llena → el panel se abre solo. Recien ahi se toca la ✕.
     Forzar `.open` a mano —como hacia este test antes— pasaba en verde con el
     bug adentro: cerrar estando parado en el circulo dejaba `opened` en false
     y el tick siguiente REABRIA el panel (fillT ya estaba en 1), asi que la ✕
     parecia no hacer nada. Por eso se espera un segundo y medio despues de
     cerrar: lo que se mide es que SIGA cerrado, no que se cierre. */
  await page.locator('#ps-projects-tab').tap().catch(() => {});
  await page.waitForTimeout(250);
  await page.locator('#ps-projects-pop [data-proj]').first().tap().catch(() => {});
  const seAbrioSolo = await page.waitForSelector('#ps-panel.open', { timeout: 20000 }).then(() => true).catch(() => false);
  await page.locator('#panel-close').tap().catch(() => {});
  await page.waitForTimeout(1500);
  const sigueCerrado = await page.locator('#ps-panel').evaluate(el => !el.classList.contains('open')).catch(() => false);
  record('M15', 'La ✕ cierra el dossier y NO se reabre', seAbrioSolo && sigueCerrado,
    !seAbrioSolo ? 'el panel no llego a abrirse por proximidad'
                 : sigueCerrado ? 'cerrado 1.5s despues, parado en el circulo' : 'SE REABRIO solo');

  /* M16 — el paso en tactil. En vertical el fov sube a 85°, se ve mas mundo
     por pantalla y el mismo desplazamiento se siente mas lento. Se compensa
     con MOVE_MULT, pero SOLO en el piso: si entrara tambien en el aire, el
     alcance del salto —calibrado contra los 3.6u del charco— cambiaria segun
     el dispositivo y verify:jump pasaria a medir una de las dos versiones.
     Esto no mide pixeles, mide esa decision, leida del fuente. */
  const mm = parseFloat(src.match(/const MOVE_MULT = [^?]+\? ([\d.]+) : 1;/)?.[1] ?? '0');
  const soloPiso = /\(jumping \? JUMP_SPEED_MULT : MOVE_MULT\)/.test(src);
  record('M16', 'Tactil camina mas rapido, salta igual', mm > 1 && soloPiso,
    `MOVE_MULT ${mm || '(no lo encontre)'} · en el aire manda JUMP_SPEED_MULT=${soloPiso}`);

  /* ── Musica ambiente (M18-M19) ────────────────────────────────────────
     M17 (que se arma sola) se mide arriba, antes del primer toque. Aca queda
     el resto del cableado: que el boton la corte y que apagarla se recuerde.
     `<html data-audio>` dice si hay musica sonando de verdad (existe el
     handle); el boton dice la preferencia. Son dos hechos distintos y por eso
     se miran los dos. */
  const btnAntes = await page.locator('#ps-audio-toggle').getAttribute('aria-pressed').catch(() => null);
  /* El parlante ya no esta suelto en la barra: vive adentro del menu kebab,
     asi que el camino real son DOS toques. Se recorre ese camino y no se
     fuerza el estado (leccion 48) — y sin el toque del kebab la fila esta en
     display:none y no se puede tocar, que es justo lo que tiene que pasar. */
  await page.locator('#os-menu-btn').tap().catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('#ps-audio-toggle').tap().catch(() => {});
  await page.waitForTimeout(300);
  const tras = await page.evaluate(() => ({
    data: document.documentElement.dataset.audio,
    pressed: document.getElementById('ps-audio-toggle')?.getAttribute('aria-pressed'),
    guardado: localStorage.getItem('nier-audio'),
    /* El icono es la mitad del mensaje: apagado tiene que mostrar el parlante
       TACHADO, no el normal en gris. Si el estado dependiera solo del color,
       un daltonico no lo distinguiria. */
    iconoOn: getComputedStyle(document.querySelector('#ps-audio-toggle .ab-on')).display,
    iconoOff: getComputedStyle(document.querySelector('#ps-audio-toggle .ab-off')).display,
  }));
  record('M18', 'El boton la corta y muestra el parlante tachado',
    btnAntes === 'true' && tras.data === 'off' && tras.pressed === 'false'
      && tras.iconoOn === 'none' && tras.iconoOff !== 'none',
    `data-audio=${tras.data} · aria-pressed=${tras.pressed} · icono normal=${tras.iconoOn} tachado=${tras.iconoOff}`);

  /* M19 — apagarla se recuerda. Sin esto la musica vuelve sola en cada visita
     de alguien que ya dijo que no la queria, que es peor que no tener boton. */
  record('M19a', 'Apagarla se guarda', tras.guardado === 'off', `localStorage nier-audio=${tras.guardado}`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(SCENE_READY, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);   /* que la escena termine de armarse */
  const trasRecarga = await page.evaluate(() => ({
    data: document.documentElement.dataset.audio,
    pressed: document.getElementById('ps-audio-toggle')?.getAttribute('aria-pressed'),
  }));
  record('M19b', 'Y no vuelve sola al recargar',
    trasRecarga.data === 'off' && trasRecarga.pressed === 'false',
    `data-audio=${trasRecarga.data} · aria-pressed=${trasRecarga.pressed}`);

  /* M20 — la barra es una fila de cajas con borde: si una mide distinto, el
     desalineo se ve. El boton de audio lleva un SVG de 13px donde los otros
     llevan una caja de texto de 10.99, asi que se compensa con margin-block
     negativo — y esto es lo que avisa si alguien cambia el tamaño del icono o
     la tipografia de la barra y el ajuste queda viejo. */
  const alturas = await page.evaluate(() =>
    [...document.querySelector('.id-ctas').children].map(e => +e.getBoundingClientRect().height.toFixed(2)));
  const parejas = new Set(alturas).size === 1;
  record('M20', 'Los botones de la barra miden lo mismo', parejas, alturas.join(' / '));

  /* M24 — el menu abre POR ENCIMA de lo que ya este abierto debajo. El
     dossier tiene z-index 45 y el joystick 40; un control flotante flota
     tambien sobre tus paneles (leccion 47) y aca hace falta la relacion
     inversa: si el dossier le gana, las filas del menu se ven pero el dedo le
     pega al dossier. (Antes el panel de abajo era el cajon de proyectos, que
     se retiro: ahora lo que puede estar abierto debajo del kebab es el
     dossier, que en un telefono ocupa el ancho entero y 58vh de alto.)
     Se mide de dos maneras y las dos hacen falta. Primero se pregunta quien
     ATIENDE el punto (elementFromPoint en el centro de la fila), que es el
     hecho exacto y no el z-index, que es la formula. Despues se TOCA: si el
     dossier estuviera arriba, el dedo caeria en el panel y la musica no
     cambiaria.
     El dossier se abre por el camino real: PROJECTS -> una fila -> el teleport
     deja al personaje parado en el anillo y el panel se abre solo. Se usa la
     SEGUNDA fila porque M15 acaba de cerrar a mano el dossier de la primera,
     y ese cartel queda con el pestillo `dismissed` puesto hasta que el
     personaje salga de su circulo. */
  await page.locator('#ps-projects-tab').tap().catch(() => {});
  await page.waitForTimeout(250);
  await page.locator('#ps-projects-pop [data-proj]').nth(1).tap().catch(() => {});
  const dossierAbierto = await page.waitForSelector('#ps-panel.open', { timeout: 25000 })
    .then(() => true).catch(() => false);
  /* Los toques van con .catch: si el menu quedara TAPADO, Playwright espera a
     que reciba el puntero y termina tirando una excepcion que se lleva puesto
     el arnes entero — se pierde el resto de los checks y el informe dice
     "crash" donde tendria que decir "M24 en rojo". El hecho se mide sobre el
     estado, no sobre el exito del toque. */
  await page.locator('#os-menu-btn').tap().catch(() => {});
  await page.waitForTimeout(250);
  const capas = await page.evaluate(() => {
    const fila = document.getElementById('ps-audio-toggle');
    const pop = document.getElementById('os-menu-pop');
    const r = fila.getBoundingClientRect();
    const quien = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const panel = document.getElementById('ps-panel');
    return {
      atiendeElMenu: !!quien && pop.contains(quien),
      quien: quien ? quien.tagName.toLowerCase() + (quien.id ? '#' + quien.id : '') : 'nadie',
      /* Se deja constancia de que el dossier estaba ABIERTO y solapando: sin
         eso el check pasaria tambien por no haber nada debajo. */
      panelAbierto: !!panel && panel.classList.contains('open'),
      solapa: !!panel && (() => {
        const c = panel.getBoundingClientRect();
        return Math.min(c.right, r.right) - Math.max(c.left, r.left) > 1
            && Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top) > 1;
      })(),
    };
  });
  const audioAntes = await page.evaluate(() => document.documentElement.dataset.audio);
  await page.locator('#ps-audio-toggle').tap({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  const audioDespues = await page.evaluate(() => document.documentElement.dataset.audio);
  record('M24', 'El menu abre por encima del dossier abierto',
    dossierAbierto && capas.panelAbierto && capas.solapa && capas.atiendeElMenu
      && audioDespues !== audioAntes,
    `dossier abierto=${capas.panelAbierto} solapando=${capas.solapa} · atiende ${capas.quien} · musica ${audioAntes}→${audioDespues}`);

  /* M23 — el buffer del render tiene el mismo aspecto que la caja.
     `renderer.setSize(W, H, false)` NO toca el estilo del canvas: si el buffer
     y la caja no coinciden, el navegador estira el render para meterlo adentro.
     init() y onResize() calculaban W con un piso de 400px, y en un telefono de
     390 la caja mide 388: se rendereaba a 400 de ancho y se metia a la fuerza
     en 388, o sea la escena achatada un 3% en horizontal. Un piso ahi no tenia
     sentido —la caja no puede valer 0, es 100% de ancho con min-height— y era
     invisible: nada falla, solo sale mal dibujado.
     Se compara el ASPECTO y no los pixeles porque el buffer va multiplicado
     por el devicePixelRatio, que es otra cosa. */
  const buf = await page.evaluate(() => {
    const c = document.getElementById('ps-canvas');
    const b = c.getBoundingClientRect();
    return { cajaW: +b.width.toFixed(1), cajaH: +b.height.toFixed(1), bufW: c.width, bufH: c.height };
  });
  const aspCaja = buf.cajaW / buf.cajaH, aspBuf = buf.bufW / buf.bufH;
  const estira = Math.abs(aspBuf / aspCaja - 1);
  record('M23', 'El render no sale estirado', estira < 0.005,
    `caja ${buf.cajaW}x${buf.cajaH} (${aspCaja.toFixed(3)}) · buffer ${buf.bufW}x${buf.bufH} (${aspBuf.toFixed(3)}) · deformacion ${(estira * 100).toFixed(1)}%`);

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
