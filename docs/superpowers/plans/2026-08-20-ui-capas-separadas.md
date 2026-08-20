# UI "Capas separadas" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la atmósfera del sitio (grain, scanlines, lluvia, canvas ambiente) exista únicamente en la superficie jugable, y que las páginas de registro sean documento legible a WCAG AA en su estado por defecto.

**Architecture:** `Base.astro` gana una prop `surface: 'game' | 'doc'` que es la única condición que decide la existencia de cada efecto. Los componentes pesados se excluyen del render de Astro (no se ocultan con CSS). Los 9 criterios de aceptación del spec se implementan primero como un arnés ejecutable (`scripts/verify-ui.mjs`), de modo que cada tarea tiene un ciclo rojo → verde real.

**Tech Stack:** Astro 7 (static, TS strict), CSS custom properties, Three.js, `playwright-core` (sólo dev, para el arnés).

**Spec:** `docs/superpowers/specs/2026-08-20-ui-capas-separadas-design.md`

## Global Constraints

- **Zero `border-radius`** en cualquier CSS nuevo o modificado.
- **No pure black (`#000`) ni pure white (`#fff`)**.
- Contraste efectivo **≥ 4.5:1** para todo texto en estado por defecto, compositando `opacity`.
- Tamaño mínimo de texto renderizado: **11px**.
- `--accent` (`#3d7a64`) y `--accent-flag` (`#9a7b2d`): **prohibidos como color de texto**. Sólo bordes, rims, ◆, DotRow.
- Texto flagship usa `--accent-flag-bright` (`#c9a94f`).
- `--accent-bright` (`#5ee7aa`): sólo interactivo (CTAs, estados activos, hover).
- `prefers-reduced-motion`: usar `animation-duration: 0.01s`, **nunca** `animation: none`. Jamás aplicar el guard a input del usuario (WASD, clicks).
- Paridad EN/ES completa en todo cambio de copy o navegación. ES en registro rioplatense (*vos*); términos técnicos en inglés en ambos locales.
- Convención de botones intacta: mono + corchetes, `[ LABEL ↗ ]` externo, `[ LABEL → ]` interno, `[ LABEL ↓ ]` descarga.
- Servidor de desarrollo: **siempre** `npm run dev` sin flags. Nunca `npx astro dev --host`.
- El dev server backgrounded muere a los ~90s en el sandbox: reiniciar y verificar **en la misma** llamada de Bash. Nunca `pkill -f "astro.mjs"` (se auto-mata); usar `ps aux | grep '[a]stro.mjs' | awk '{print $2}' | xargs -r kill -9`.

---

### Task 1: Arnés de verificación ejecutable

Convierte los 9 criterios del spec §14 en un comando. Sin esto, cada tarea posterior se "verifica" por opinión.

**Files:**
- Create: `scripts/verify-ui.mjs`
- Modify: `package.json` (scripts + devDependency)

**Interfaces:**
- Consumes: nada.
- Produces: `npm run verify:ui` → imprime una tabla de 9 criterios y sale con código 1 si alguno falla. Cada criterio se identifica por el número `C1`…`C9` usado en el resto del plan.

- [ ] **Step 1: Instalar `playwright-core` como devDependency**

`playwright-core` no descarga navegadores (a diferencia de `playwright`); el arnés resuelve el binario cacheado.

```bash
npm i -D playwright-core@1.62.1 --no-audit --no-fund
```

- [ ] **Step 2: Escribir el arnés**

Crear `scripts/verify-ui.mjs`:

```js
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

const DOC_PAGES  = ['/en/risk/', '/en/ai/', '/es/risk/', '/es/ai/'];
const GAME_PAGES = ['/en/', '/es/'];

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.ico':'image/x-icon', '.glb':'model/gltf-binary', '.hdr':'application/octet-stream',
  '.woff2':'font/woff2', '.pdf':'application/pdf' };

function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.HOME, '.cache/ms-playwright');
  if (!existsSync(base)) throw new Error('No hay navegadores en ~/.cache/ms-playwright. Definí CHROME_PATH.');
  const dirs = readdirSync(base).filter(d => d.startsWith('chromium-'));
  for (const d of dirs) {
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('No se encontró binario de chromium. Definí CHROME_PATH.');
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

/* ── helpers de página ────────────────────────────────────────── */

// Contraste efectivo: compone opacity del texto sobre el primer ancestro
// con background-color no transparente.
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
    // opacidad acumulada de la cadena de ancestros
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

const COUNT_PROBE = () => ({
  canvases: document.querySelectorAll('canvas').length,
  animated: [...document.querySelectorAll('*')].filter(e => {
    const s = getComputedStyle(e);
    return s.animationName !== 'none' && s.animationPlayState === 'running';
  }).length,
  navHrefs: [...document.querySelectorAll('nav a[href]')].map(a => a.getAttribute('href')),
});

const RAIN_PROBE = () => {
  const shell = document.querySelector('.os-shell');
  if (!shell) return { shell: null, overlaps: [] };
  const s = shell.getBoundingClientRect();
  const overlaps = [];
  ['margin-rain-left', 'margin-rain-right'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ox = Math.min(r.right, s.right) - Math.max(r.left, s.left);
    if (ox > 1) overlaps.push({ id, overlapPx: Math.round(ox) });
  });
  return { shell: { left: Math.round(s.left), width: Math.round(s.width) }, overlaps };
};

/* ── ejecución ────────────────────────────────────────────────── */

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

const results = [];
const record = (id, name, pass, detail) => results.push({ id, name, pass, detail });

const srv = await serveDist();
const browser = await chromium.launch({
  executablePath: resolveChrome(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();

  // ── C1 contraste · C6 tamaño mínimo · C2 canvas · C3 animaciones · C4 nav
  let worstRatio = Infinity, worstText = '', smallest = Infinity, smallestText = '';
  let maxCanvas = 0, maxAnim = 0;
  const navTargets = new Set();

  for (const url of DOC_PAGES) {
    await page.goto(BASE + url, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    for (const r of await page.evaluate(CONTRAST_PROBE)) {
      if (r.ratio < worstRatio) { worstRatio = r.ratio; worstText = `${url} "${r.text}" ${r.ratio}:1`; }
      if (r.px < smallest)     { smallest = r.px;     smallestText = `${url} "${r.text}" ${r.px}px`; }
    }
    const c = await page.evaluate(COUNT_PROBE);
    maxCanvas = Math.max(maxCanvas, c.canvases);
    maxAnim   = Math.max(maxAnim, c.animated);
    c.navHrefs.forEach(h => { if (h.startsWith('/')) navTargets.add(h); });
  }

  record('C1', 'Contraste efectivo ≥ 4.5:1 (doc)', worstRatio >= 4.5, `peor: ${worstText}`);
  record('C6', 'Texto ≥ 11px (doc)', smallest >= 11, `menor: ${smallestText}`);
  record('C2', 'Superficie doc: 0 <canvas>', maxCanvas === 0, `máximo observado: ${maxCanvas}`);
  record('C3', 'Superficie doc: ≤ 8 animaciones activas', maxAnim <= 8, `máximo observado: ${maxAnim}`);

  const broken = [];
  for (const href of navTargets) {
    const r = await page.request.get(BASE + href);
    if (!r.ok()) broken.push(`${href} → ${r.status()}`);
  }
  record('C4', 'Navegación primaria sin 404', broken.length === 0,
    broken.length ? broken.join(', ') : `${navTargets.size} destinos OK`);

  // ── C7 lluvia no solapa el shell (game, viewport ancho)
  await page.goto(BASE + GAME_PAGES[0], { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const rain = await page.evaluate(RAIN_PROBE);
  record('C7', 'Lluvia no solapa .os-shell @1920', rain.overlaps.length === 0,
    rain.overlaps.length ? JSON.stringify(rain.overlaps) : 'sin solapamiento');

  // ── C5 ningún input de puntero mueve al personaje (chequeo de fuente)
  const pointerMove = await grepSrc(/intersectObject\s*\(\s*groundMesh|onMinimapClick|mmCv\.addEventListener\s*\(\s*['"]click/);
  record('C5', 'Sin movimiento por puntero', pointerMove.length === 0,
    pointerMove.length ? pointerMove.join(', ') : 'sin raycast a ground ni click en minimapa');

  // ── C9 sin restos de plain mode
  const plain = await grepSrc(/data-plain|iron-dust-plain|plain-toggle/);
  record('C9', 'Sin restos de plain mode', plain.length === 0,
    plain.length ? `${plain.length} referencias: ${plain.slice(0, 4).join(', ')}…` : 'limpio');

} finally {
  await browser.close();
  srv.close();
}

// ── C8 astro check se corre aparte (ver npm run verify)
const pad = s => String(s).padEnd(42);
let failed = 0;
console.log('\n  CRITERIOS DE ACEPTACIÓN — spec §14\n');
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.id}  ${pad(r.name)} ${r.detail}`);
}
console.log(`\n  ${results.length - failed}/${results.length} en verde\n`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Registrar los scripts en `package.json`**

Agregar al bloque `"scripts"`:

```json
    "verify:ui": "astro build && node scripts/verify-ui.mjs",
    "verify": "astro check && npm run verify:ui"
```

- [ ] **Step 4: Correr el arnés y confirmar que falla**

```bash
npm run verify:ui
```

Esperado: **rojo en C1, C2, C3, C4, C5, C6, C7, C9**. C7 debería reportar solapamiento de ~260px por lado a 1920. Si algún criterio da verde acá, el chequeo está mal escrito — arreglarlo antes de seguir.

- [ ] **Step 5: Tomar el baseline de `astro check` (criterio C8)**

```bash
npm run astro check 2>&1 | tail -5
```

Anotar el número de errores/warnings actual en el mensaje de commit. C8 exige "sin errores **nuevos**", no cero absoluto.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-ui.mjs package.json package-lock.json
git commit -m "test: arnés ejecutable para los 9 criterios de aceptación de UI"
```

---

### Task 2: Retirar el rol Data Scientist

Se hace primero: reduce la superficie que todas las tareas siguientes tienen que tocar.

**Files:**
- Delete: `src/pages/en/ds/index.astro`, `src/pages/es/ds/index.astro`
- Modify: `src/data/projects.ts`, `src/components/ui/PersonaSelector.astro`, `src/components/ui/RoleNav.astro`, `src/layouts/RoleLayout.astro`, `src/components/ui/PortfolioScene.astro`, `src/pages/en/concept/index.astro`

**Interfaces:**
- Consumes: nada.
- Produces: el tipo de rol pasa de `'ai' | 'risk' | 'ds'` a `'ai' | 'risk'` en `RoleLayout.astro` y en el mapa `zoneProjects` de `PortfolioScene.astro`. Las tareas 6 y 8 dependen de este tipo reducido.

- [ ] **Step 1: Borrar las páginas**

```bash
git rm -r src/pages/en/ds src/pages/es/ds
```

- [ ] **Step 2: Quitar `dsProjects` de la fuente de datos**

En `src/data/projects.ts`, eliminar el export `dsProjects` (array vacío) y cualquier referencia a él.

- [ ] **Step 3: Quitar la tercera opción del selector**

En `src/components/ui/PersonaSelector.astro`: eliminar la entrada `ds` del array de opciones, el bloque `<div class="preview-pane pane-ds" data-preview="ds">` completo, y las claves de traducción `dsTitle` / `dsText` / `soon` si quedan sin uso. La navegación por teclado debe seguir funcionando con dos opciones (`01`, `02`).

- [ ] **Step 4: Quitar `ds` de la navegación lateral y del layout**

En `src/components/ui/RoleNav.astro`: eliminar el item Data Scientist.
En `src/layouts/RoleLayout.astro`: cambiar `role: 'ai' | 'risk' | 'ds'` por `role: 'ai' | 'risk'` y eliminar la entrada `ds` de `termContent`.

- [ ] **Step 5: Quitar la rama `ds` de la escena**

En `src/components/ui/PortfolioScene.astro`: eliminar `zoneProjects.ds`, el overlay COMING SOON (`cs-close` y su markup/estilos), y la rama `zone === 'ds'` del handler de `nier:zone`. El handler queda: dedupe guard → `disposeRoleBillboards()` → `buildRoleBillboards()` → `navigateTo()`.

- [ ] **Step 6: Limpiar la página interna de concepto**

En `src/pages/en/concept/index.astro`: quitar las referencias a `ds`.

- [ ] **Step 7: Verificar que no quedan referencias**

```bash
grep -rn "dsProjects\|'ds'\|\"ds\"\|/ds/\|COMING SOON\|cs-close" src/ ; echo "exit=$?"
```

Esperado: sin resultados (`exit=1`).

- [ ] **Step 8: Verificar que el sitio compila y las rutas vivas siguen vivas**

```bash
npm run astro check 2>&1 | tail -5 && npm run build 2>&1 | tail -8
```

Esperado: build OK; `dist/en/ds/` y `dist/es/ds/` ya no existen.

- [ ] **Step 9: Commit**

```bash
git add -A src/
git commit -m "feat: retirar el rol Data Scientist (PRODUCT.md lo declara retirado)"
```

---

### Task 3: Tokens legibles y eliminación del modo plain

Ataca C1, C6 y C9.

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles/global.css`

**Interfaces:**
- Consumes: nada.
- Produces: `--sand-dim` con valor `#838c9e`. El bloque `[data-plain]` deja de existir; ningún archivo puede referenciarlo después de la Task 4.

- [ ] **Step 1: Subir `--sand-dim` a un valor que cumpla AA**

En `src/styles/tokens.css`, reemplazar:

```css
  --sand-dim:     #6b7280;   /* labels, meta, inactive UI chrome */
```

por:

```css
  /* Contraste sobre bg-void 5.67:1 · bg-panel 5.40:1 · bg-surface 5.10:1 — AA ✓
     No bajar de este valor: por debajo, los labels de 11px fallan AA. */
  --sand-dim:     #838c9e;   /* labels, meta, inactive UI chrome */
```

- [ ] **Step 2: Eliminar el bloque de modo plain**

En `src/styles/tokens.css`, borrar completo:

```css
/* ── Plain / high-legibility mode ─────────────────────────────────────── */
[data-plain] { … }

[data-plain] body::before,
[data-plain] body::after { display: none !important; }
```

- [ ] **Step 3: Documentar la prohibición de `opacity` sobre texto**

En `src/styles/global.css`, reemplazar la utilidad `.sys-text`:

```css
.sys-text {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  color: var(--sand-dim);
  text-transform: uppercase;
  opacity: 0.6;
  user-select: none;
}
```

por:

```css
/* Micro-texto de sistema.
   NUNCA usar `opacity` para atenuar texto: componía 2.17:1 sobre --bg-void
   y es lo que rompía el piso AA. La atenuación es por color (--sand-dim).
   0.7rem = 11.2px, el mínimo del sistema. */
.sys-text {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  color: var(--sand-dim);
  text-transform: uppercase;
  user-select: none;
}
```

- [ ] **Step 4: Subir `.cta-btn` por encima de AA**

En `src/styles/global.css`, dentro de `.cta-btn`, cambiar `font-size: 0.65rem;` por `font-size: 0.7rem;` y `color: var(--sand-dim);` se mantiene (ahora vale `#838c9e` → 5.67:1).

- [ ] **Step 5: Verificar**

```bash
npm run verify:ui 2>&1 | tail -14
```

Esperado: **C9 sigue rojo** (quedan referencias en componentes, se limpian en Task 4). C1 y C6 mejoran pero pueden seguir rojos por estilos locales de componentes — eso es correcto en este punto.

- [ ] **Step 6: Commit**

```bash
git add src/styles/
git commit -m "feat: --sand-dim a #838c9e y eliminación del bloque de modo plain"
```

---

### Task 4: `surface` prop en Base, fix del bug de lluvia, chrome de 2 bandas

El corazón del trabajo. Ataca C2, C3, C7 y cierra C9.

**Files:**
- Modify: `src/layouts/Base.astro`, `src/styles/global.css`
- Modify: `src/components/ui/AmbientCanvas.astro` (quitar referencias a plain)

**Interfaces:**
- Consumes: `--sand-dim` de Task 3.
- Produces: `Base.astro` acepta `surface?: 'game' | 'doc'` con default `'doc'`, y emite `<html data-surface="game">` sólo cuando vale `'game'`. Las Tasks 5, 6 y 7 dependen de esta prop y de ese atributo.

- [ ] **Step 1: Añadir la prop y el atributo en el html**

En `src/layouts/Base.astro`, en el frontmatter, agregar a `interface Props`:

```ts
  surface?: 'game' | 'doc';
```

y al destructuring:

```ts
  surface = 'doc',
```

Luego cambiar la etiqueta de apertura:

```astro
<html lang={lang} data-surface={surface}>
```

- [ ] **Step 2: Condicionar los componentes de atmósfera**

En `src/layouts/Base.astro`, envolver los tres bloques de atmósfera. Reemplazar:

```astro
    <div class="page-sweep" aria-hidden="true"></div>
    <AmbientCanvas />
    <canvas id="margin-rain-left" class="margin-chrome margin-chrome-left" aria-hidden="true"></canvas>
    <canvas id="margin-rain-right" class="margin-chrome margin-chrome-right" aria-hidden="true"></canvas>
```

por:

```astro
    {surface === 'game' && (
      <>
        <div class="page-sweep" aria-hidden="true"></div>
        <AmbientCanvas />
        <canvas id="margin-rain-left" class="margin-chrome margin-chrome-left" aria-hidden="true"></canvas>
        <canvas id="margin-rain-right" class="margin-chrome margin-chrome-right" aria-hidden="true"></canvas>
      </>
    )}
```

El script de `makeRain` también debe quedar dentro del condicional, o hacer early-return si el canvas no existe (ya lo hace: `if (!canvas) return;`). Dejarlo condicionado es preferible: no se envía JS muerto a la superficie documento.

- [ ] **Step 3: Reducir el chrome en superficie documento**

En `src/layouts/Base.astro`, condicionar la fila de título OS y el DotRow:

```astro
      {surface === 'game' && (
        <div class="os-title-row">
          <span class="os-unit-id sys-text">UNIT::PL-7729</span>
          <span class="os-page sys-text">{title}</span>
          <span class="os-status sys-text">SYS:OK · {lang.toUpperCase()}</span>
        </div>
      )}
```

y en `<header class="os-header">`, envolver `<DotRow />`:

```astro
      <header class="os-header">
        <TabBar active={activeTab} lang={lang} />
        {surface === 'game' && <DotRow />}
      </header>
```

- [ ] **Step 4: Quitar las opacidades del chrome de identidad**

En el `<style>` de `Base.astro`, borrar `opacity: 0.4;` de `.os-page` y `opacity: 0.3;` de `.id-sep`. En `.os-page`, cambiar `font-size: 0.55rem;` por `font-size: 0.7rem;`.

- [ ] **Step 5: Arreglar el bug de la lluvia — las tres correcciones**

En el `<style>` de `Base.astro`:

**(a)** el ancho contra el shell real (1400px, no 1200px):

```css
    width: max(0px, calc((100vw - 1400px) / 2));
```

**(b)** la regla de ID deja de pisar el ancho. Reemplazar:

```css
  #margin-rain-left,
  #margin-rain-right {
    display: block;
    width: 100%;
    height: 100%;
  }
```

por:

```css
  /* Sólo `display`. NO declarar width/height acá: estos selectores de ID
     apuntan al MISMO elemento que .margin-chrome y ganan por especificidad;
     un `width: 100%` sobre un position:fixed resuelve contra el viewport y
     convierte cada panel en una capa animada de 100vw sobre todo el sitio. */
  #margin-rain-left,
  #margin-rain-right {
    display: block;
  }
```

**(c)** fondo opaco en el shell, para que ninguna capa se lea a través del contenido:

```css
  .os-shell {
    background-color: var(--bg-void);
```

- [ ] **Step 6: Condicionar scanlines y grain a la superficie jugable**

En `src/styles/global.css`, cambiar los selectores de los overlays de `body::before` / `body::after` a:

```css
html[data-surface="game"] body::before { … }
html[data-surface="game"] body::after  { … }
```

y en el bloque `@media (prefers-reduced-motion: reduce)` actualizar la regla correspondiente a los mismos selectores.

- [ ] **Step 7: Limpiar plain mode de AmbientCanvas**

En `src/components/ui/AmbientCanvas.astro`, eliminar cualquier lectura de `data-plain` / `iron-dust-plain` y la rama de comportamiento asociada.

- [ ] **Step 8: Verificar**

```bash
npm run verify:ui 2>&1 | tail -14
```

Esperado: **C2 verde** (0 canvas en doc), **C7 verde** (sin solapamiento), **C3 verde o cerca**. C9 sigue rojo hasta la Task 5 (StatusBar).

- [ ] **Step 9: Commit**

```bash
git add src/layouts/Base.astro src/styles/global.css src/components/ui/AmbientCanvas.astro
git commit -m "feat: prop surface en Base y fix del bug de lluvia a 100vw"
```

---

### Task 5: StatusBar — variante documento y eliminación del toggle plain

Cierra C9. Elimina duplicados y telemetría inventada (spec §4).

**Files:**
- Modify: `src/components/ui/StatusBar.astro`, `src/layouts/Base.astro`

**Interfaces:**
- Consumes: `surface` de Task 4.
- Produces: `StatusBar` acepta `surface: 'game' | 'doc'` (requerida) y renderiza controles de juego + coordenadas sólo en `'game'`. El botón `#plain-toggle` y su script dejan de existir.

- [ ] **Step 1: Pasar la superficie al StatusBar**

En `src/layouts/Base.astro`:

```astro
      <StatusBar lang={lang} surface={surface} />
```

- [ ] **Step 2: Añadir la prop y recortar el markup**

En `src/components/ui/StatusBar.astro`, en el frontmatter agregar `surface: 'game' | 'doc';` a `Props` y al destructuring. Luego:

- Envolver el `<div class="controls">` (`◆ SELECT · ↵ CONFIRM · ESC BACK`) en `{surface === 'game' && ( … )}`.
- Envolver el `<span class="coord sys-text">` (LAT/LON/NODE:ACTIVE) en `{surface === 'game' && ( … )}` — es telemetría inventada y no debe aparecer en documento.
- Eliminar por completo el `<button class="plain-toggle" id="plain-toggle">` y el `<span class="sys-text sep-v">·</span>` que lo separa.
- Eliminar el `<a href="/pablo-lerner-cv.pdf" class="lang-btn cta-accent">[ CV ↓ ]</a>`: el CV ya vive en la banda de identidad de `Base.astro`.

El toggle EN/ES **se mantiene** en el StatusBar y **se quita** de la banda de identidad — un solo lugar, abajo, que es donde el usuario ya lo busca.

- [ ] **Step 3: Borrar el script del toggle**

En `src/components/ui/StatusBar.astro`, eliminar el bloque `<script>` completo que maneja `plain-toggle`, `iron-dust-plain` y `documentElement.dataset.plain`. Eliminar también las claves `t.plain` / `t.normal` del objeto de traducción y los estilos `.plain-toggle` / `.toggle-label`.

- [ ] **Step 4: Verificar que no queda rastro de plain mode**

```bash
grep -rn "data-plain\|iron-dust-plain\|plain-toggle" src/ ; echo "exit=$?"
```

Esperado: sin resultados (`exit=1`). Si aparece `PortfolioScene.astro` o `ProjectCard.astro`, limpiarlos ahora (`ProjectCard.astro` se borra en Task 9; si sólo queda ahí, dejarlo y cerrar C9 en la Task 9).

- [ ] **Step 5: Verificar**

```bash
npm run verify:ui 2>&1 | tail -14
```

Esperado: **C9 verde** (o pendiente sólo por `ProjectCard.astro`), C1/C3/C6 en verde o muy cerca.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/StatusBar.astro src/layouts/Base.astro
git commit -m "feat: StatusBar por superficie, sin toggle plain ni telemetría inventada"
```

---

### Task 6: Navegación honesta

Cierra C4.

**Files:**
- Modify: `src/components/ui/TabBar.astro`
- Modify: `src/layouts/Base.astro` (valor de `activeTab`), `src/layouts/RoleLayout.astro`, `src/pages/en/index.astro`, `src/pages/es/index.astro`

**Interfaces:**
- Consumes: el tipo de rol reducido de Task 2.
- Produces: `TabBar` acepta `active: 'terminal' | 'risk' | 'ai'`. Los llamadores que hoy pasan `activeTab="projects"` deben pasar `"terminal"`.

- [ ] **Step 1: Reescribir la lista de tabs**

En `src/components/ui/TabBar.astro`, reemplazar el array `tabs` por:

```ts
const tabs = lang === 'en'
  ? [
      { id: 'terminal', label: 'TERMINAL',     href: `/${lang}/` },
      { id: 'risk',     label: 'DATA ANALYST', href: `/${lang}/risk/` },
      { id: 'ai',       label: 'AI ENGINEER',  href: `/${lang}/ai/` },
    ]
  : [
      { id: 'terminal', label: 'TERMINAL',      href: `/${lang}/` },
      { id: 'risk',     label: 'DATA ANALYST',  href: `/${lang}/risk/` },
      { id: 'ai',       label: 'AI ENGINEER',   href: `/${lang}/ai/` },
    ];
```

Los nombres de rol quedan en inglés en ambos locales: son títulos de puesto, y la regla de i18n del proyecto deja los términos técnicos en inglés.

Cambiar también el default de la prop: `const { active = 'terminal', lang = 'en' } = Astro.props;`

- [ ] **Step 2: Actualizar los llamadores**

- `src/pages/en/index.astro` y `src/pages/es/index.astro`: `activeTab="terminal"` y agregar `surface="game"`.
- `src/layouts/RoleLayout.astro`: pasar `activeTab={role}` y `surface="doc"` al `<Base>`.

- [ ] **Step 3: Verificar**

```bash
npm run verify:ui 2>&1 | tail -14
```

Esperado: **C4 verde** — los 3 destinos por locale devuelven 200.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/TabBar.astro src/layouts/ src/pages/en/index.astro src/pages/es/index.astro
git commit -m "feat: navegación primaria sólo con rutas que existen"
```

---

### Task 7: RoleLayout como documento

Cierra C1, C3 y C6 de forma definitiva.

**Files:**
- Modify: `src/layouts/RoleLayout.astro`

**Interfaces:**
- Consumes: `surface` de Task 4, `activeTab` de Task 6.
- Produces: nada nuevo.

- [ ] **Step 1: Quitar toda atenuación por opacidad y subir tamaños**

En el `<style>` de `src/layouts/RoleLayout.astro`, buscar cada declaración `opacity:` que aplique a un elemento con texto y eliminarla:

```bash
grep -n "opacity" src/layouts/RoleLayout.astro
```

Para cada una: si el elemento contiene texto, borrar la línea. Si es decorativa (un ◆, un rim, un separador sin texto), dejarla.

Elevar todo `font-size` por debajo de `0.7rem` a `0.7rem`:

```bash
grep -n "font-size: 0\.[0-6]" src/layouts/RoleLayout.astro
```

- [ ] **Step 2: Quitar animaciones ambientales del documento**

En `src/layouts/RoleLayout.astro`, el `@keyframes` local y su `animation:` de reveal escalonado se conservan (son de entrada, no `infinite`). Cualquier `animation:` con `infinite` en este archivo se elimina.

```bash
grep -n "infinite" src/layouts/RoleLayout.astro
```

- [ ] **Step 3: Texto flagship a la variante bright**

Buscar usos de `--accent-flag` como `color:` y cambiarlos a `--accent-flag-bright`:

```bash
grep -n "color: var(--accent-flag)" src/layouts/RoleLayout.astro
```

`--accent-flag` (`#9a7b2d`) da 4.30:1 sobre `--bg-surface` y falla AA. Como borde está bien; como texto no.

- [ ] **Step 4: Verificar**

```bash
npm run verify:ui 2>&1 | tail -14
```

Esperado: **C1, C3 y C6 en verde**. Si C1 sigue rojo, el detalle del output nombra el texto exacto y la página — corregir ese selector.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/RoleLayout.astro
git commit -m "feat: páginas de registro legibles a AA, sin atenuación por opacidad"
```

---

### Task 8: Sólo WASD mueve al personaje

Cierra C5. Spec §6.

**Files:**
- Modify: `src/components/ui/PortfolioScene.astro`

**Interfaces:**
- Consumes: el mapa de roles reducido de Task 2.
- Produces: `onCanvasClick` conserva únicamente los hits de billboard y del end-cap. `groundMesh` deja de existir como variable.

- [ ] **Step 1: Eliminar el raycast al asfalto**

En `src/components/ui/PortfolioScene.astro`, dentro de `onCanvasClick` (~línea 1104), eliminar el bloque que hace `raycaster.r.intersectObject(groundMesh)` y asigna `targetX` / `targetZ`. La función termina después de los hits de billboard y end-cap.

Eliminar también la declaración `let groundMesh = null;` (~línea 198) y la asignación `groundMesh = asphalt;` (~línea 474).

- [ ] **Step 2: Eliminar el fast-travel del minimapa**

Eliminar `mmCv.addEventListener('click', onMinimapClick);` (~línea 232) y la función `onMinimapClick` completa (~línea 1291).

En el bloque de estilos del minimapa (~línea 1799), cambiar `pointer-events: auto;` por:

```css
    /* Display puro: el minimapa no mueve al personaje (PRODUCT.md: sólo WASD) */
    pointer-events: none;
```

- [ ] **Step 3: Las filas del dossier cambian de registro sin caminar**

En el handler de `.d-row` (~línea 1423), eliminar la llamada a `walkToBoard(...)`, conservando `showPanel(...)`. Hacer lo mismo en los botones `PREV`/`NEXT` (~línea 1401) si llaman a `walkToBoard`.

Si `walkToBoard` queda sin llamadores fuera de `navigateTo`, dejarla: `navigateTo` la sigue usando cuando el usuario elige un rol en el PersonaSelector, que no es input de puntero sobre la escena.

- [ ] **Step 4: Verificar el criterio de fuente**

```bash
grep -n "intersectObject(groundMesh\|onMinimapClick\|groundMesh" src/components/ui/PortfolioScene.astro ; echo "exit=$?"
```

Esperado: sin resultados (`exit=1`).

- [ ] **Step 5: Verificar en vivo que WASD sigue funcionando**

Levantar servidor y probar en la **misma** llamada de Bash:

```bash
ps aux | grep '[a]stro.mjs' | awk '{print $2}' | xargs -r kill -9; sleep 2
( npm run dev > /tmp/dev.log 2>&1 & )
for i in $(seq 1 25); do sleep 2; c=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4321/en/); [ "$c" = "200" ] && { echo up; break; }; done
```

Abrir `http://localhost:4321/en/`, elegir un rol, mantener `W` y confirmar que el personaje camina y que los boards encienden por proximidad. Confirmar que hacer click en el asfalto **no** lo mueve.

- [ ] **Step 6: Verificar**

```bash
npm run verify:ui 2>&1 | tail -14
```

Esperado: **C5 verde**.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/PortfolioScene.astro
git commit -m "feat: el personaje se mueve sólo con WASD"
```

---

### Task 9: Defectos visuales de la escena y archivos muertos

Spec §5 y §11. No tiene criterio automático: se verifica por captura.

**Files:**
- Modify: `src/components/ui/PortfolioScene.astro`
- Delete: `src/components/ui/SceneCanvas.astro`, `src/components/ui/ProjectCard.astro`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Separar el título del intro del chip HUD**

En `src/components/ui/PortfolioScene.astro`, el overlay `#ps-hero` (título *Pablo Lerner*) y `#unit-tag-hud` (chip `UNIT::PL-7729`) se superponen. El chip se proyecta con `Vector3.project(camera)` sobre la posición del personaje; el título está centrado. Corrección: mientras `introActive` sea true, ocultar `#unit-tag-hud` (`opacity: 0`), y restaurarlo cuando el hero termina de desvanecerse (`introT > 0.72`, el mismo umbral que ya usa el fade del hero).

- [ ] **Step 2: Los conos de luz se leen como luz**

Buscar la construcción de los conos en `buildCityDressing`:

```bash
grep -n "ConeGeometry\|cone" src/components/ui/PortfolioScene.astro
```

Bajar la opacidad del material aditivo del cono a `0.06`–`0.10` y confirmar que usa `depthWrite: false`. Si a esa opacidad el cono sigue leyéndose como geometría sólida, eliminarlo y dejar sólo el `head` de la farola y el glow en el piso.

- [ ] **Step 3: Subordinar el resto de los efectos al encendido de board**

El encendido por proximidad es el evento principal. Bajar en un escalón la intensidad de: chevrons (opacidad del material aditivo), partículas (opacidad), neones de las fachadas (opacidad del canvas), estrellas (tamaño de punto). Ninguno se elimina.

- [ ] **Step 4: Borrar los componentes muertos**

```bash
grep -rn "SceneCanvas\|ProjectCard" src/ --include=*.astro | grep -v "^src/components/ui/SceneCanvas.astro\|^src/components/ui/ProjectCard.astro"
```

Esperado: sin resultados. Entonces:

```bash
git rm src/components/ui/SceneCanvas.astro src/components/ui/ProjectCard.astro
```

- [ ] **Step 5: Verificar por captura**

Levantar el servidor y capturar la home tras elegir un rol, comparando contra `01`–`05` de la sesión de diagnóstico. Confirmar: sin superposición título/chip, conos legibles como luz, el board encendido es el elemento más brillante del cuadro.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "fix: defectos visuales de la escena y baja de componentes muertos"
```

---

### Task 10: Transición entre superficies y verificación final

Spec §12 y §14. Mitiga el riesgo declarado de la dirección elegida.

**Files:**
- Modify: `src/layouts/Base.astro`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `surface` de Task 4.
- Produces: entregable final.

- [ ] **Step 1: El page-sweep marca el cambio de capa**

El `.page-sweep` ya se emite sólo en `surface === 'game'` (Task 4, Step 2). Eso es lo correcto: el barrido ocurre al **entrar** a la escena, y su ausencia al entrar a un documento hace que la caída de atmósfera se lea como un cambio de lugar y no como una página rota. Confirmar que la regla `:global(html[data-plain]) .page-sweep { display: none; }` fue eliminada (el modo plain ya no existe) y que el guard de `prefers-reduced-motion` usa `animation-duration: 0.01s`.

- [ ] **Step 2: Actualizar CLAUDE.md**

Actualizar en `CLAUDE.md`: el bloque de tokens (`--sand-dim` a `#838c9e`), la desaparición del modo plain, la prop `surface` en la estructura de `Base.astro`, la tabla de roles sin Data Scientist, la nueva navegación, el control sólo-WASD, y añadir una fase `3.19 — UI capas separadas` a la tabla de estado con el link al spec.

Añadir a "Lessons learned" la entrada:

```markdown
24. **Un selector de ID y uno de clase sobre el MISMO elemento: el ID gana y puede
    reintroducir un valor que la clase estaba conteniendo.** `#margin-rain-left { width: 100% }`
    pisaba `.margin-chrome { width: max(0px, calc(…)) }`, y sobre `position: fixed` ese
    `100%` resuelve contra el viewport: dos canvas animados de 100vw sobre todo el sitio,
    durante meses, leídos como "el diseño es ruidoso". Antes de rediseñar por sensación,
    medir.
```

- [ ] **Step 3: Verificación completa**

```bash
npm run verify 2>&1 | tail -20
```

Esperado: `astro check` sin errores nuevos respecto del baseline de Task 1 Step 5, y **9/9 en verde** (C8 se evalúa a mano contra ese baseline).

- [ ] **Step 4: Verificación en móvil**

Capturar `/en/risk/` y `/en/` a 390×844 y confirmar que el chrome reducido no rompe el layout ni introduce scroll horizontal.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: CLAUDE.md al día con la UI de capas separadas"
```

---

## Self-Review

**1. Cobertura del spec**

| Sección del spec | Tarea |
|---|---|
| §3 arquitectura `surface` | Task 4 |
| §4 superficie documento | Tasks 4, 5, 7 |
| §5 superficie juego | Task 9 |
| §6 sólo WASD | Task 8 |
| §7 bug de la lluvia | Task 4 |
| §8 tokens | Tasks 3, 7 |
| §9 navegación | Task 6 |
| §10 retiro de Data Scientist | Task 2 |
| §11 archivos muertos | Task 9 |
| §12 transición | Task 10 |
| §13 a11y / i18n | Global Constraints + Tasks 3, 7 |
| §14 criterios de aceptación | Task 1 (arnés), Task 10 (cierre) |

Sin huecos.

**2. Placeholders:** ninguno. Los tres puntos que dependen de inspección (`grep` de opacidades en Task 7, opacidad de conos en Task 9) llevan el comando exacto y el criterio de decisión, no "ajustar según convenga".

**3. Consistencia de tipos:** `surface: 'game' | 'doc'` se usa idéntico en `Base.astro` (Task 4), `StatusBar.astro` (Task 5) y `RoleLayout.astro` (Task 6). `active` del TabBar pasa a `'terminal' | 'risk' | 'ai'` en Task 6 y todos sus llamadores se actualizan en el mismo paso. El tipo de rol se reduce a `'ai' | 'risk'` en Task 2, antes de que las Tasks 6 y 8 lo consuman.
