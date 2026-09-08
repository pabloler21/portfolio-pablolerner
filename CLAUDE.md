# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server — http://localhost:4321 (always use this, not npx astro dev --host)
npm run build         # production build → dist/
npm run preview       # serve production build locally
npm run astro check   # TypeScript / Astro type-checking

npm run verify        # los cinco arneses: salto + personaje + audio + contacto + UI
npm run verify:audio  # renderiza la musica offline y mide la señal (--wav deja previews)
npm run deploy:dry    # build + simulacro del rsync, no toca el server
npm run deploy        # build + rsync al VPS + verificacion en vivo
npm run deploy:contact # instala/actualiza el endpoint de contacto en el VPS
```

**WSL2 networking — read carefully, mistakes have been made here:**

- **Always use `npm run dev` with zero extra flags.** Binds to `127.0.0.1` only → Windows browser reaches it at `http://localhost:4321/`.
- **Never run `npx astro dev --host 0.0.0.0` or `npx astro dev --host <ip>`.** Firewall silently blocks it.
- **Never use `npx astro dev` directly** — only `npm run dev`.
- **If localhost stops working:** kill broken process (`pkill -f "astro dev"`), restart with `npm run dev`. Check Windows Defender Firewall → Node.js must be allowed for both Private and Public.
- **Claude Code's Bash tool gets a fresh network namespace per call.** A server backgrounded in one call may be unreachable from the next. Always restart + verify in the **same** Bash call. Never `pkill -f "astro.mjs"` — it self-matches. Use: `ps aux | grep '[a]stro.mjs' | awk '{print $2}' | xargs -r kill -9`.

---

## Project overview

Personal portfolio for **Pablo** — primary role **Data Analyst**, adjacent specializations in AI Engineering (LLM systems, RAG, multi-agent) and Data Science. Target audience: AI startups, senior engineers, founders — skim-first readers.

---

## Stack

- **Astro 7** (static output, TypeScript strict)
- **CSS custom properties** for all theming — no UI library
- **Vanilla JS** for role selector, keyboard navigation, terminal animation
- **React** — SOLO para `TouchControls.tsx`, los controles táctiles de la escena 3D. Es la
  única isla React del sitio; entra con `client:media`, así que en escritorio se descargan
  **0 KB** de React
- **Three.js** (lazy-loaded via dynamic import) for ambient background and the 3D interactive home scene
- **Web Audio** — beeps y musica ambiente generativa (`src/lib/ambient.ts`). Cero archivos
  de audio en todo el sitio, a proposito: ver `## Musica ambiente`
- **i18n:** Astro native, locales `en` (default) and `es`, both prefixed (`/en/…`, `/es/…`)
- **Hosting:** VPS propio (Vultr) con **Caddy** sirviendo estáticos. Cloudflare Pages fue el plan original y quedó descartado — ver `## Deploy`

---

## Deploy

`pablolerner.dev` (+ `www.` y `pablolerner.duckdns.org`) se sirve **estático desde un
VPS propio en Vultr**, con Caddy. No hay CI: el deploy es `rsync` desde esta máquina.

```bash
npm run deploy:dry    # build + simulacro, muestra qué subiría y qué borraría
npm run deploy        # build + rsync --delete + verificación en vivo
```

- **Host SSH**: `vultr` en `~/.ssh/config` → `deploy@64.176.23.59`. El directorio raíz
  es `/var/www/portfolio`, propiedad de `deploy`: **no hace falta `sudo`**.
- **`--delete` es intencional**: deja el server exactamente igual a `dist/`. Sin eso los
  assets con hash superado y los modelos viejos se acumulan para siempre (había 52 MB
  donde el build son 26 MB, con cuatro GLBs muertos y las páginas `ds/` ya retiradas).
- **El Caddyfile se administra desde el repo `vps-infra`, NO se edita a mano en el
  server.** El bloque del portfolio hace `try_files {path} {path}/ {path}.html /404.html`
  y marca `/_astro/*` como `immutable` — por eso los assets van con hash en el nombre y
  el HTML no se cachea agresivamente.
- El script verifica después de subir: códigos HTTP de las 7 rutas reales + el 404, y
  compara el **md5 del árbol servido contra el del build**. Si difieren, sale con error.
- El VPS también corre otros proyectos (`aurea`, `starting`, `tarnish`) detrás del mismo
  Caddy, algunos con un esquema de *lazy wake*. El portfolio es estático a propósito:
  no tiene servicio que despertar ni entrada en el registro.
- **Ojo con la duplicación**: `vps-infra/scripts/deploy-portfolio.sh` hace build + rsync al
  mismo destino. `npm run deploy` agrega simulacro y verificación; conviene dejar uno solo.

### Formulario de contacto (Resend)

El sitio es estático y la API key de Resend es un secreto, así que **no puede llamarse a
Resend desde el navegador**: cualquiera la leería del bundle y mandaría mails en nombre
del sitio. Hay un servicio chico en el mismo VPS.

```
navegador → POST https://pablolerner.dev/api/contact
          → Caddy handle /api/* → 127.0.0.1:8110
          → contact-svc (server/contact/contact_svc.py) → API de Resend
```

- **`server/contact/contact_svc.py`** — SOLO stdlib de Python, a propósito: idlea en
  **10.4 MB**. El VPS tiene 1 GB y este servicio, a diferencia del resto, **no puede
  dormir** (un POST contra un servicio dormido cae en la pantalla de espera y el mensaje
  se pierde), así que está siempre encendido y con `MemoryMax=64M`.
- **La key vive sólo en `/etc/contact-svc.env`** (root:contact 0640), nunca en el repo.
  Sin ella el endpoint responde 503, jamás un 500.
- Defensas: honeypot (`website`) que responde 200 y no envía, rate limit de 5/hora por IP,
  límites de tamaño por campo y rechazo de saltos de línea en nombre/email (inyección de
  cabeceras).
- **`reply_to` es el visitante**: responder el mail le contesta directo a quien escribió.
- **Estado actual: dominio verificado.** Los mensajes salen de `contacto@pablolerner.dev`
  hacia `lerner.pb@gmail.com`. Ambas cosas son config del server (`/etc/contact-svc.env`),
  no del repo: se leen en cada arranque, así que cambiarlas es editar y reiniciar, sin
  redeploy.
- **Si alguna vez se vuelve a un dominio sin verificar**, Resend obliga a que el remitente
  sea `onboarding@resend.dev` y a que el destino sea **la casilla dueña de la cuenta de
  Resend** — que no es necesariamente la que el sitio publica. Ese error dice exactamente
  a qué dirección sí se puede enviar, pero sólo si se registra el cuerpo de la respuesta.
- **La API de Resend está detrás de Cloudflare y rechaza el `User-Agent` por defecto de
  `urllib`.** Devuelve `403 error code: 1010`, que no es un error de Resend ni figura en su
  documentación. `USER_AGENT` en `contact_svc.py` es obligatorio, y `verify:contact` K2b lo
  controla.
- `npm run deploy:contact` instala/actualiza el servicio (idempotente, nunca pisa el env).
  `npm run verify:contact` levanta un Resend falso y ejercita los 8 caminos sin mandar
  un solo mail.
- **El icono de sobre del rail izquierdo va al formulario, NO a un `mailto:`.** Un
  `mailto:` no hace nada visible en una maquina sin cliente de correo configurado —la de
  casi cualquiera que use Gmail en el navegador— asi que era el unico de los tres iconos
  que podia no responder al tocarlo. Y publicaba la direccion personal en texto plano en
  las 11 paginas.
- **La direccion personal no se sirve en ninguna pagina.** Sigue existiendo como
  fallback en `/contact/` (si el formulario falla por rate limit, servicio caido o falta
  de red, se ofrece el mail directo), pero se arma en runtime con
  `['lerner.pb','gmail.com'].join('@')`. Se usa `.join()` y no `'a' + 'b'` porque el
  minificador pliega la suma de literales y volveria a dejarla entera. Esto NO la hace
  secreta —un scraper que ejecuta JS la arma igual— pero la saca del texto plano, que es
  el caso comun. `verify:ui` **C10** lo controla sobre el HTML construido.
- La ruta `/api/*` vive en `vps-infra/caddy/Caddyfile` y se aplica con el deploy de ESE
  repo. El bloque del portfolio pasó a usar `handle`: sin eso, `file_server` y `try_files`
  también atenderían `/api/*`.

---

## Design system — IRON DUST v2 (NieR Reforged palette)

Inspired by NieR: Automata (YoRHa OS). Tokens in `src/styles/tokens.css`.

```css
/* Backgrounds */
--bg-void:      #0d0f14;   /* main background */
--bg-panel:     #12151c;   /* panels, selected rows, active tabs */
--bg-surface:   #181b22;   /* card hover, lifted surfaces */

/* Text scale */
--sand:         #e8e6dd;   /* body text */
--sand-muted:   #a0a8b8;   /* secondary prose, descriptions */
--sand-dim:     #838c9e;   /* labels, meta, inactive UI chrome — 5.67:1 on --bg-void */

/* Borders */
--ink:          #1c2030;   /* subtle borders */
--ink-mid:      #2a3040;   /* card rims, stronger dividers */

/* Accents — three-tier system */
--accent:       #3d7a64;   /* teal muted — decorative only: ◆ cursor, DotRow, badge borders */
--accent-bright: #5ee7aa;  /* mint — INTERACTIVE ONLY: CTAs, active states, hover highlights */

/* Flagship tier (Deus Ex black&gold) — flagship MARKING only, NEVER interactive */
--accent-flag:        #9a7b2d;  /* amber bronze — flagship frames, borders, ◆ cursor */
--accent-flag-bright: #c9a94f;  /* amber light — flagship text, metric, filled CTA */
--accent-flag-bg:     #14110a;  /* warm black — flagship block backgrounds */

/* Alerta — el ÚNICO rojo, y SÓLO para salir (la ✕ que cierra un panel) */
--accent-alert:     #e05a4f;    /* 5.21:1 sobre --bg-void — AA ✓ */
--accent-alert-dim: #7a2b26;    /* borde en reposo, nunca lleva texto */

/* Typography */
--font-display: 'IM Fell English', Georgia, serif;
--font-mono:    'Share Tech Mono', 'Courier New', monospace;
--font-sans:    'Inter', system-ui, sans-serif;

/* Layout */
--border:     1px solid var(--ink);
--border-mid: 1px solid var(--ink-mid);
```

**Hard constraints:**
- Zero `border-radius` anywhere — ever
- Scanlines + animated grain: CSS-only overlays on `body::before` / `body::after`
- `prefers-reduced-motion`: boot screen → `display: none`; stagger reveal → `animation-duration: 0.01s` (never `animation: none` — kills `fill-mode`)
- `--accent` (teal `#3d7a64`): decorative only — ◆ cursor, DotRow, badge/tab borders
- `--accent-bright` (mint `#5ee7aa`): interactive only — CTAs, active states, hover
- `--accent-flag*` (amber): flagship marking only — badge, board frame, list row, selector chip. NEVER on anything clickable. A flagship row that is ALSO selected shows both: mint border-left (interactive state) + amber badge (identity)
- `--accent-alert` (rojo `#e05a4f`): **sólo para salir** — la ✕ que cierra un panel (`.ps-close`), nada más. Mint dice "seguir", ámbar dice "destacado"; ninguno podía decir "salí de acá", que es lo que hacía falta cuando en táctil el panel tapa la pantalla entera. No se usa para errores de formulario, badges ni estados: si aparece un segundo uso, discutirlo antes
- No pure black (#000); no pure white (#fff)
- Prose: `--font-sans` ≥ 0.8rem; labels/badges/nav: `--font-mono`
- **Button convention (site-wide)**: mono + brackets `[ LABEL ↗ ]` (external) / `[ LABEL → ]` (internal nav). States: hover → mint border+text, `translateY(-1px)` · active → mint fill, `--bg-void` text, `translateY(1px)` · focus-visible → mint outline offset 2px. `.cta-btn` = secondary, `.cta-btn.cta-primary` = mint border always. Tabs are navigation, NOT buttons — no brackets.
- **os-shell border**: `1px solid rgba(94,231,170,0.18)` + `box-shadow` glow — not `var(--border)`
- **Plain mode is GONE.** It existed because the default state failed AA; the default now passes. Never reintroduce `[data-plain]`, `iron-dust-plain` or a legibility toggle — legibility is the default, not a mode.
- **Surface rule** (`surface: 'game' | 'doc'` prop on `Base.astro`, reflected as `<html data-surface>`): atmosphere exists ONLY where the visitor can walk. `doc` gets no AmbientCanvas, no margin rain, no scanlines/grain, no game footer. Default is `'doc'` — a new page is born clean and must ASK for atmosphere.
- **Never use `opacity` to dim text.** It composited to 2.17:1 and is what broke the AA floor. Dim with colour (`--sand-dim`). Minimum rendered text size: **11px** (`0.7rem`).
- **`--accent` teal (3.80:1) and `--accent-flag` (4.30:1 on `--bg-surface`) must NEVER carry text** — borders, rims, ◆ and DotRow only. Flagship text uses `--accent-flag-bright`.

---

## File structure (current)

```
src/
  styles/
    tokens.css          # all CSS custom properties
    global.css          # reset, scanlines, grain, Google Fonts, base type, .cta-btn utility
  data/
    projects.ts         # SINGLE SOURCE OF TRUTH for all project content (EN+ES)
  lib/
    ambient.ts          # motor de musica generativa (3 variantes; se despacha 'terminal')
  layouts/
    Base.astro          # YoRHa OS chrome — identity strip + AmbientCanvas + margin rain panels
    RoleLayout.astro    # 3-col grid (RoleNav 280px · center · TerminalWindow 220px). Owns the role-page UI: props {heading, badge, subline, stats[], projects[]} → stats HUD grid + master-detail dossier (numbered listbox + pre-rendered detail panes, ↑↓ keyboard, scramble transition). Pages are thin wrappers.
  components/
    ui/
      AmbientCanvas.astro     # Three.js perspective-grid background (lazy, z-index:0)
      BootScreen.astro        # one-time OS-boot overlay (sessionStorage flag)
      TabBar.astro            # top nav tabs; props: active, lang
      DotRow.astro            # 40-dot animated row
      StatusBar.astro         # bottom bar: hints · CLEAR MODE · lang · CV link
      RoleNav.astro           # left-panel nav for role pages
      ProjectCard.astro       # (unused since master-detail role pages — kept for reference)
      TerminalWindow.astro    # animated live-coding terminal panel (role pages only)
      PortfolioScene.astro    # 3D interactive home scene (Three.js city street)
      PersonaSelector.astro   # fullscreen role selector — 2-col layout: numbered options + live preview pane (records/flagship/stack from projects.ts), clock, footer hints, ~950ms boot-build sequence (skippeable)
      SceneCanvas.astro       # (legacy — was 9S viewer, superseded by PortfolioScene)
  pages/
    index.astro         # root → redirects to /en/
    en/
      index.astro       # home EN: PortfolioScene + PersonaSelector
      ai/index.astro    # AI Engineer — 6 projects
      risk/index.astro  # Data Analyst — 7 projects
      concept/          # INTERNAL decision pages (not in nav): index+city (phase 3),
                        # flagship.astro (accent direction comparison, option A shipped)
    es/                 # mirrors EN structure
public/
  models/
    remy.glb                 # CURRENT: Remy de Mixamo (7.2MB, 114 huesos, Running/Walking/Idle)
    android.glb              # PREVIO: UAL2_Standard.glb (7.7MB, 65 joints, 43 animations sin correr)
    android_backup.glb       # PERMANENT BACKUP: original 9S Sketchfab model — never overwrite
  hdri/
    cobblestone_street_night_1k.hdr
  favicon.svg
  favicon.ico
```

---

## Projects data file

`src/data/projects.ts` — only place to edit project content.

```typescript
{
  id:        string;          // kebab-case unique id
  github:    string;
  demo?:     string;
  stack:     readonly string[];
  status:    string;          // EN badge
  statusEs?: string;          // ES badge (if different)
  featured?: boolean;         // true → bright accent left border
  en: { name, problem, outcome }
  es: { name, problem, outcome }
  // problem: one-line "what problem does this solve"
  // outcome: key metric or result ('' to hide)
}
```

Exported: `aiProjects`, `riskProjects`, `dsProjects` (empty — pending Pablo's DS repos).

---

## Base.astro header structure

```
┌─────────────────────────────────────────────────────────────┐
│  UNIT::PL-7729  ·  [page title]  ·  SYS:OK · EN           │  ← os-title-row
├─────────────────────────────────────────────────────────────┤
│  Pablo Lerner · Data Analyst & AI Engineer  [GH][LI][✉][CV]│  ← os-identity
├─────────────────────────────────────────────────────────────┤
│  ⬡ PROFILE  ⬡ PROJECTS  ⬡ SKILLS  ⬡ ABOUT  ⬡ CONTACT     │  ← TabBar
├─────────────────────────────────────────────────────────────┤
│  ● ● ● ● ● ● ● ● ● ● ●  (40 animated dots)                │  ← DotRow
└─────────────────────────────────────────────────────────────┘
```

Max-width: **1400px**. os-shell border: mint glow `rgba(94,231,170,0.18)` not `var(--border)`.

**Margin chrome panels** (visible only on viewports > 1400px):
- `position: fixed; width: max(0px, calc((100vw - 1400px) / 2))` — no `max-width` cap
- Left (`#margin-rain-left`) + Right (`#margin-rain-right`): Matrix character rain via canvas RAF loop
- Script in Base.astro: `makeRain(id)` factory, `RAIN_CHARS`, `ResizeObserver`, always starts RAF (no `prefers-reduced-motion` guard on rain)

---

## PortfolioScene — 3D home (EN + ES)

`src/components/ui/PortfolioScene.astro` — Three.js city street, character walking.

**Avenue layout** (no fixed zones anymore — ZONES dict was removed):
Billboard k (walk order) sits at `x = ±6.5` (alternating, k even → left), `z = −10 − k*10`, `rotY = ±0.5` (angled toward the walking camera). Flagship (projIdx 0) is the LAST board of the avenue — larger (6.0×4.0 vs 4.2×2.8). `risk` → 4 boards (z −10…−40), `ai` → 3 (z −10…−30).

**Character**: `public/models/remy.glb` — Remy de Mixamo, 114 huesos, tres clips propios:
`Running`, `Walking`, `Idle`. Se eligen por nombre exacto con respaldo difuso
(`/^walking$/i` → `/walk/i`). **`Idle` es una respiración de 9.93s y SE
REPRODUCE**: durante un tiempo estuvo vacío (0 pistas) y el idle era un frame
congelado de `Walking` con `timeScale 0`, o sea una estatua. El GLB se rehornea
con `npm run build:character` desde los FBX de Mixamo, y `npm run
verify:character` audita que los tres clips existan, no estén vacíos, muevan el
torso y no arrastren la cadera. **La bind pose del GLB es una T-pose**, así que
los cambios de clip van todos por `switchAction()`, que arranca la entrante
antes de parar la saliente (lección 38).

**El personaje conserva SUS materiales.** No hay override de paleta: el que había
(`M_Joints` en mint, el resto en `0x181b22`) pintaba el cuerpo casi del color del fondo
`0x0d0f14` y era la causa de que el personaje desapareciera — la forma quedaba a cargo de
la luz y sólo se veían las articulaciones. Nunca reintroducirlo. Lo único que se le suma es
un `PointLight(0xcfd8e6, 0.85, 8)` colgado del grupo: el renderer no tiene tone mapping, así
que a más intensidad los altos recortan y el personaje lee naranja fluorescente.

**El GLB viene normalizado** (escala y centrado en su nodo raíz) y el tick pisa
`position`/`rotation` del grupo en cada frame, así que va **envuelto en un `THREE.Group`**:
el wrapper es lo que maneja la escena, el nodo interno conserva su transform.

**Mobile / táctil**: la escena **corre** en teléfono. Hasta hace poco salía por un
`if (touch || narrow)` antes de cargar Three.js y mostraba una lista de links: no
andaba mal, no existía. Los controles son `TouchControls.tsx`, la única isla React
del sitio.

- **No le habla a la escena por una API propia**: despacha `KeyboardEvent` sintéticos
  sobre `document`, que es donde ya se escuchan WASD y Space. El joystick recorre
  exactamente el mismo camino que el teclado en vez de abrir una segunda puerta que
  después se desincroniza.
- **Aparecen recién al elegir rol.** El overlay del selector tiene `z-index: 9000`:
  mostrados antes quedaban debajo y el dedo le pegaba al overlay.
- **`client:media`, nunca `client:only`**: con `client:only` Astro baja los 184 KB del
  runtime de React en toda visita, escritorio incluido, para que el componente devuelva
  `null`.
- **`JoystickShape.Square` de la librería NO es de esquina viva**: su `shapeFactory`
  devuelve `borderRadius: Math.sqrt(size)` como estilo inline. Se anula con `!important`
  (`verify:mobile` M7 lo controla).
- `devicePixelRatio` se topea en **1.5** en táctil (2 en escritorio).
- **Los paneles tienen salida y van por encima del joystick.** `.ps-panel` (z 45) y
  `.ps-projects-drawer` (z 46) están arriba de `.tc-root` (z 40): con 11 y 10 el
  joystick se dibujaba SOBRE el cajón y en la mitad de abajo el dedo le pegaba al
  joystick, no a la lista. Y los dos llevan una `.ps-close` — ✕ roja
  (`--accent-alert`), 44px de blanco de toque. Sin ella se entraba a un proyecto y
  no se salía: en un teléfono el cajón mide 300 de 390 y va de arriba abajo, no hay
  Escape ni lugar donde tocar afuera. Cubierto por `verify:mobile` M13/M14/M15.
- **La ✕ del dossier necesita DOS pestillos, no uno.** `opened` es el one-shot que
  evita que el panel se reabra en cada frame; `hidePanel()` lo limpia para que el
  anillo pueda volver a dispararse. Pero al seleccionar un proyecto el teleport te
  deja parado en el centro de ese anillo, así que cerrar a mano dejaba `fillT >= 1`
  con `opened` en false y el tick siguiente reabría el panel: la ✕ parecía no hacer
  nada. `dismissed` es el segundo pestillo, se marca sobre el cartel en cuyo círculo
  está el jugador (misma condición que el tick, `SPINNER_R` — no `ref.opened`, que
  todavía puede estar en false si el panel se abrió clickeando el cartel) y se rearma
  solo al salir del círculo.
- **El paso en táctil va ×1.3 (`MOVE_MULT`), y sólo en el piso.** En vertical el fov
  sube a 85°, se ve más mundo por pantalla y el mismo desplazamiento produce menos
  flujo óptico: a igual velocidad real, el paso se *siente* más lento. En el aire
  manda `JUMP_SPEED_MULT` sin tocar, así el alcance del salto (5.72u, calibrado
  contra los 3.6u del charco) es el mismo en los dos dispositivos y `verify:jump`
  sigue midiendo el producto y no una de sus dos versiones — `verify:jump` J0b y
  `verify:mobile` M16 lo controlan.
- **Cámara**: sigue al personaje en X **a fondo**, así queda centrado — antes seguía sólo
  el 30% (y el `lookAt` el 20%), lo que en una pantalla angosta lo corría al borde del
  cuadro. Con tope de `CAM_X_LIMIT = 4.5`: hay dos edificios en `x = ±9, z = 1` (entrada
  de la avenida, 6.5 de ancho → ocupan `x ∈ [5.75, 12.25]`) y pegar la cámara al personaje
  contra el borde los ponía en la línea de visión, tapando la pantalla. Esos dos edificios
  además ahora tienen colisión: se podía **caminar adentro** de ellos.
- **FOV adaptativo**: `fov` se deriva de un horizontal fijo de 76° y se acota a `[52, 85]`.
  A 16:10 devuelve 52 exactos, así que escritorio no cambia; en vertical sube a 85 y el
  horizontal pasa de 25° a 46°.
- Cubierto por `npm run verify:mobile`, que emula un teléfono de verdad
  (`hasTouch`, `isMobile`) y mide que el joystick **mueva**, no que se dibuje.

**Salto y charcos de ácido**: `Space` dispara el clip `Jump` del GLB (0.9s).
Dos cráteres con líquido tóxico cortan la avenida en `CRATER_ZS = [-5, -35]`,
`CRATER_HALF_W 1.8` → bandas de 3.6u. La compuerta de `tick()` es **booleana
sobre `jumping`**: en el aire se cruza siempre y la altura del arco **no
participa** — `JUMP_H` es puramente estético. Lo que decide es el alcance
horizontal.

**La calibración está atada a la geometría del nivel, no elegida por gusto**
(spawn z=0 · charco z ∈ −6.8…−3.2 · 1er cartel z=−10):

| | |
|---|---|
| `JUMP_DUR 0.9` | exactamente la duración del clip → entra una vez, sin estirarse |
| `JUMP_SPEED_MULT 1.2` | alcance **5.72u** |
| `JUMP_H 0.2` | poco: el clip ya levanta la cadera 0.437u por su cuenta |

Saltando desde el borde (−3.15) se cae en **−8.89**, a 1.1u del cartel. Y hay
**dificultad**: la ventana de despegue es de 2.15u sobre 3.2u de pista, así
que saltar apenas se aparece cae adentro del charco. Antes el alcance era de
11.58u y se cruzaba desde cualquier lado, incluso parado en el spawn.

`jumpT` avanza en **segundos reales** (`+= delta`), así que `JUMP_DUR` se lee
en segundos y el alcance no depende de los Hz del monitor (lección 34). El
arco **no** se achata bajo `prefers-reduced-motion`: es feedback de una tecla
del jugador, no animación ambiente. En el piso, corriendo se cae y se
respawnea en la entrada; caminando (Shift) se choca contra el borde. Cubierto
por `npm run verify:jump` (alcance, punto de caída, tamaño de la ventana) y
`verify:character` A7 (que `JUMP_DUR` siga coincidiendo con el clip).

**Character control** (G1): **WASD/arrows ONLY** · **Shift = sprint ×1.8**, con crossfade
entre `Walking` (timeScale 1.8) y `Running` (timeScale 1.3) — los clips de Mixamo son *in
place*, así que su cadencia va atada a `WALK_SPEED` o los pies patinan · world clamp `BOUND_X 8.8 / z ∈ [−46, 4.5]` applied every tick · heading is a shortest-arc lerp toward `targetRotY` (never snaps).

**NO pointer-driven movement, ever** (PRODUCT.md brand commitment): no ground raycast, no minimap fast-travel, no auto-walk from dossier rows. Clicking a billboard SELECTS a record — selection is not displacement.

**Project mapping** (frontmatter → JSON → JS via `ps-data` script tag):
```
zoneProjects.risk = [riskProjects[0], riskProjects[1], riskProjects[5], riskProjects[3]]
  → FraudSense AI (hero/projIdx 0), Credit Scoring (projIdx 1), E-commerce Inventory (projIdx 2), SQL Fast Food (panel only)
zoneProjects.ai   = [aiProjects[0], aiProjects[1], aiProjects[2]]
  → Iris (hero/projIdx 0), CV Evaluator (projIdx 1), Hermes (projIdx 2)
```

**DYNAMIC BILLBOARD ARCHITECTURE — AVENUE (definitive):**
Billboards are built ON role selection and destroyed on role change. Exactly N billboards exist for the N projects of the active role, spread ALONG the street (avenue). Cross-role mixing is impossible by construction.
- `buildRoleBillboards(THREE, role)` — walk order = non-flagship first, flagship last (`order = [1..N-1, 0]`). Per board: pole, frame, dim edges (0x2a3040), canvas-textured board starting DARK (`color: 0x30343d`), ground ring (opacity 0), invisible hitbox. Plus role label sprite at avenue entrance and one PointLight at the flagship
- `disposeRoleBillboards()` — removes group, disposes all geometries/materials/textures, clears `roleBillRefs` + `zoneMeshes`
- **Proximity power-on** (tick, every 4th frame): board lights when radial dist² < 64 **OR `|bz − charZ| < 4.5`** (z-band trigger — CRITICAL: walking straight down the middle must discover BOTH sides; radial-only left the far side dark forever). On light: `flickerOn`, edges → borderColor, ground ring pulses on, `showPanel(activeRole, projIdx)`
- **Chevrons**: pool of 8 ground arrows (`buildChevrons`, ShapeGeometry, additive blend) repositioned every tick from character toward the next UNLIT board; fade when none left or target behind
- `nier:zone` handler: dedupe guard (`if (zone === activeRole) return`) → rebuild+`navigateTo` (walks to first board; panel opens via proximity, not onArrival)
- At init the scene has NO billboards — they appear only when PersonaSelector fires `nier:zone`
- **Flagship board** (G7): frame/edges amber `FLAG 0x9a7b2d`, hover `FLAG_BRIGHT 0xc9a94f`, amber ground ring, warm amber PointLight, and `drawBillboardCanvas` uses `AMBER` for its bar/badge/metric/CTA when `isHero`
- **End-cap** (G3): 10×5 terminal screen at `flagshipZ − 11`, drawn by `drawEndcapCanvas` ("ALL RECORDS ACCESSED" + `[ VIEW FULL ARCHIVE → ]`). Starts dark, powers on at `|bz − charZ| < 8`, hitbox `userData.zone = '__endcap'` → `onCanvasClick` navigates to `allUrl[activeRole]`. Tracked in `endcapRef`, cleared by `disposeRoleBillboards`
- **City dressing** (G2, `buildCityDressing`, built once at init): streetlamps every 9.5u on both sidewalks (pole + head + additive light cone + ground glow), 6 canvas neon signs on inner building faces, canvas skyline plane at z=−58, 180 static star points. All MeshBasic/additive — zero extra real lights

**Key systems:**
- WASD + arrow keys (no `prefers-reduced-motion` guard on input, only on visual effects)
- Click billboard → `showPanel(hit.key, hit.projIdx)` — only active-role hitboxes exist, so any hit is valid
- `scrambleIn(el, text)` — cancel-safe scramble-settle text reveal (replaces old typeOut; stores interval in `el._scrambleTimer`)
- **Minimap 2.0** (G4): `#ps-minimap-canvas` (140×190), redrawn every 3rd frame, geometry in the `MM` object (`mx/mz` project, `invX/invZ` unproject; z range [6,−56]). Corner-cut frame drawn in-canvas (the CSS border was removed). Character = **heading arrow** (`rotate(π − charGroup.rotation.y)`), markers per board (lit solid / unlit hollow, amber for flagship), wide bar for the end-cap, expanding-square pulse on the next unlit board. **Display only** — `pointer-events: none`, no fast-travel
- Arrival banner: `#ps-banner` + `.sweep` CSS animation, fired in `onArrival()` via `showBanner(zone)`; text from `bannerFmt` ('ACCESSING :: % RECORDS')
- `drawBillboardCanvas` sizes tuned to FILL the canvas: title 30/24px, desc 17/14px (4/3 lines), outcome (word-boundary truncate via `bbTruncate`) + CTA anchored to bottom, PAD 18
- **Dossier panel 2.0**: `showPanel(zone, projIdx)` renders ONE project as a record — `#panel-count` REC nn/NN, `#dossier-status` badge (amber `.d-badge-flag` when featured), big `#panel-title` (scrambleIn), `.d-progress` DISCOVERED blocks (one per board, amber for flagship), MISSION section, `.d-metric` box (`.d-metric-flag` amber variant), `.d-chips` stack chips, `.d-cta-primary/.d-cta-ghost`, `.d-nav` PREV/NEXT (wraps, walks to board), `.d-row` numbered rows for other projects (click → `showPanel` + `walkToBoard`)
- **RECORDS HUD** (G6): `#ps-records` beside `#ps-zone-id`, updated by `updateRecordsHUD(flash)` on every proximity power-on; `.flash` class replays a 0.5s mint highlight (`void el.offsetWidth` to restart). Both HUD chips carry a `rgba(13,15,20,0.82)` background for contrast over lit windows
- **Arrival gating**: `arrivalPending` is set only by `navigateTo` — click-to-move and fast-travel walks reach their target without firing the arrival banner
- **Cinematic intro** (first visit, skipped on reduced-motion): `introActive/introT` blend camera from (0,17,34) down to street cam over ~3.7s (easeOutCubic in tick); `#ps-hero` overlay fades at introT>0.72; PersonaSelector holds `.wait` class 2.4s before fading in
- **3D palette = blue-void** (matches site tokens): clearColor/fog 0x0d0f14, buildings 0x12151c + edges 0x2a3040, windows 0x4d8f75, asphalt 0x10131a, sidewalks 0x161a22, dashes/poles 0x232a38, char body 0x181b22. NEVER reintroduce the old olive-green (0x1b1e1a etc.)
- `returnToCenter()` only closes panel (does NOT teleport character)
- Unit tag: HTML `<div id="unit-tag-hud">` projected via `Vector3.project(camera)` each tick
- Particles: 800 pts, `BufferGeometry`, `pos.setXYZ(i,x,y,z)` + `pos.needsUpdate = true` per tick
- Fog: `FogExp2(0x0d0f14, 0.018)` — low enough for the far end of the avenue to read

**WebGL pattern (mandatory — never deviate):**
```js
const probe = document.createElement('canvas');  // probe on throwaway, NEVER on real canvas
if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;
const THREE = await import('three');              // import FIRST
const W = Math.max(shell.clientWidth, 400);       // measure AFTER import
const renderer = new THREE.WebGLRenderer({ canvas });  // first real getContext
```

**PersonaSelector ↔ PortfolioScene timing (all resolved 2026-07-02):**
- `nier:zone` listener registered BEFORE GLB load (after `buildZoneBillboards`) — catches PersonaSelector's 600ms dispatch
- Fallback: `sessionStorage.getItem('nier-persona')` → re-dispatches `nier:zone` at 200ms after listener registration
- PersonaSelector re-dispatches with 600ms delay on page reload
- **Both mechanisms fire on reload** → handler has a dedupe guard (`if (zone === activeRole) return`). Without it, `showPanel` runs twice and concurrent text animations interleave characters ("DATA ANALYST" → "DNAATLAY SATNALYST")

---

## Musica ambiente

Suena en la escena 3D. **No hay archivo de audio en ningun lado**, y es la misma
postura que ya habia tomado `beep()` ("no files to source/license"): un loop decente
pesa 2-3 MB sobre un build de 26, hay que licenciarlo, y se escucha loopear a los tres
minutos — aca la gente se queda caminando la avenida un rato largo. El motor
(`src/lib/ambient.ts`) genera todo en vivo: 0 KB, y no repite nunca porque no hay loop.

**La variante que se despacha es `terminal`**, elegida escuchando las tres en
`/en/concept/audio/` (pagina interna, misma convencion que `concept/flagship.astro`).
Las otras dos —`engine` (drone puro) y `lofi` (60 BPM con kick)— siguen en el modulo:
son el material de esa decision y cambiar de una a otra es una linea.

- **Arranca al elegir rol, NUNCA al cargar.** No es solo criterio de producto: el
  navegador exige un gesto del usuario, y elegir perfil es un click. Entra con un fade
  de 4s. En una recarga el evento `nier:zone` se re-despacha solo desde sessionStorage y
  ahi NO hay gesto — el contexto queda `suspended`, asi que `startAmbient()` deja armado
  un listener de un solo uso sobre el primer `pointerdown`/`keydown` real.
- **`startAmbient()` va ANTES de la guarda de dedupe** del handler de `nier:zone` y
  tiene la suya propia. Debajo del `return`, en una recarga el segundo evento (misma
  zona) se descartaria junto con el arranque del audio.
- **Un solo `AudioContext`** para beeps y musica (`getAudioCtx()`). Dos suenan igual y
  se pagan dos veces; Safari ademas los cuenta contra un presupuesto por pestaña.
- **Se apaga con el boton del parlante** en la barra de arriba —mismo precedente que `[ PROJECTS ]`,
  un control que solo existe donde hay escena (`surface === 'game'`)— y apagarla se
  **recuerda para siempre** (`localStorage` `nier-audio`). Quien la apago una vez no
  quiere que vuelva sola en la proxima visita. No va en el HUD de la escena: ese tiene
  `pointer-events: none` y en un telefono la esquina de abajo ya es del joystick.
- **Dos hechos distintos, a proposito**: `<html data-audio>` dice si la musica esta
  SONANDO (existe el handle) y el boton dice la PREFERENCIA. Antes de elegir rol no
  suena nada y el boton igual dice encendida, porque va a sonar: es un ajuste, no un
  indicador. `data-audio` es ademas lo que el arnes mira para saber que `startAmbient()`
  corrio, sin meterle ganchos de test al producto.
- **Se suspende el contexto con la pestaña oculta**, o la musica sigue sonando de fondo.
- **El icono es un SVG inline, no un glifo.** `🔊`/`🔇` son emoji: salen en color, rompen
  la barra mono y cada sistema los dibuja distinto. El SVG hereda `currentColor`, asi que
  el mint de encendido y el atenuado de apagado salen del mismo CSS. Los DOS parlantes
  (normal y tachado) estan en el HTML y el CSS muestra uno: el estado no depende de que
  JS reconstruya nodos, y **no depende solo del color** — cambia la forma.
- **Sin corchetes, a diferencia del resto de los botones.** Los corchetes enmarcan una
  PALABRA en este lenguaje; alrededor de un icono son 23px sin significado, y esos 23px
  importaban: la fila de cuatro botones cerraba con **0.7px de sobra** en un telefono de
  390 y el boton se caia al renglon de abajo. Antes de tocar anchos, medir la fila.
- El icono mide 13px y la caja de texto de los botones hermanos 10.99, asi que lleva
  `margin-block: -1px`: sin eso el boton sale 2px mas alto y en una fila de cajas con
  borde el desalineo se ve. `verify:mobile` **M20** controla que los cuatro sigan
  midiendo igual, para que el ajuste no quede viejo.
- El estado apagado se atenua **con color**, nunca con `opacity` (leccion 25), y el
  bloque CSS va DESPUES del `:hover` de `.os-nav-btn` — misma especificidad, gana el
  ultimo (leccion 40, tercera vez en este repo). El `:hover` del apagado ademas vive
  dentro de `@media (hover: hover)`: **en tactil el `:hover` queda pegado despues de
  tocar**, asi que el boton recien apagado se seguia viendo mint justo en el momento en
  que hay que ver que se apago.

### Como esta verificado

`createAmbient` recibe un `BaseAudioContext` en vez de crear el suyo. Esa es la decision
que sostiene todo lo demas: el mismo codigo corre en vivo y adentro de un
`OfflineAudioContext`, asi que `npm run verify:audio` **renderiza 96s y mide la señal**
—sin huecos, sin clipeo, suave (RMS 0.015-0.026), sin continua, y que evolucione— en vez
de comprobar que la funcion no explota. De ahi sale la segunda regla: los eventos
discretos se programan sobre el reloj de audio en ventanas (`schedule(desde, hasta)`),
nunca con `setTimeout` — offline el reloj de JS no avanza y no sonaria nada. En vivo
`runLive()` mantiene la ventana adelantada.

El reparto de alcance importa: **`verify:audio` mide que salga sonido; `verify:mobile`
M17-M19 miden el cableado** (que arranque al elegir rol, que el boton corte, que
apagarla se recuerde tras recargar). Ninguno de los dos cubre lo del otro.

---

## TerminalWindow component

Props: `title: string`, `lines: readonly string[]`

Role terminal content (in `RoleLayout.astro`):
- `ai` → `PROC::AGENT_RUNTIME`: LangChain agent code
- `risk` → `PROC::DATA_PIPELINE`: psql session + fraud query
- `ds` → `PROC::ML_PIPELINE`: sklearn Pipeline + training epochs

Animation: commands → 45–80ms/char + 520ms pause; output → 8–18ms/char; 2.2s restart; stagger 500–2300ms.

---

## Three roles

| Role | URL slug | Primary |
|---|---|---|
| Data Analyst | `/risk/` | **YES** |
| AI Engineer | `/ai/` | specialization |

`/risk/` slug kept for routing stability. **Data Scientist is retired** (PRODUCT.md): no pages, no selector option, no COMING SOON state.

---

## Phase status

| Phase | Status | Deliverable |
|---|---|---|
| 0 — Foundation | **DONE** | Astro scaffold, IRON DUST theme, boot screen |
| 1 — Navigation + Animation | **DONE** | Role pages, RoleNav, stagger reveal, DotRow |
| 2 — Project cards | **DONE** | 13 real projects as ProjectCard components |
| 2.5 — Terminal windows | **DONE** | TerminalWindow, role-page ambient terminals |
| 2.6 — UX/UI Overhaul | **DONE** | Legibility, identity strip, DA-primary, plain mode |
| 2.7 — 3D depth | **DONE** | Ambient grid (Three.js), card pointer-tilt |
| 2.8 — Character viewer | **DONE** | SceneCanvas with 9S model |
| 3 – 3.10 — 3D World | **DONE** | City street, WASD, billboards, PersonaSelector, particles, vignette, panel hero |
| 3.11 — Margin chrome rain | **DONE** | Matrix rain canvas both panels, 2 borders instead of 4 |
| 3.12 — NieR Reforged palette | **DONE** | New tokens, glow borders, max-width 1400px, compact header |
| 3.13 — Billboard role isolation | **DONE** | Each role shows only its own projects; other zones = OFFLINE ghost, ds = COMING SOON. Texture swap via fresh CanvasTexture + dedupe guard on `nier:zone`. |
| 3.14 — Scene FX pack | **DONE** | Minimap HUD, arrival banner, zone beacons, CRT flicker, hover glow, scramble-settle text |
| 3.15 — Dynamic billboards + selector redesign | **DONE** | Definitive fix: N projects = N billboards built on role select, destroyed on change; clean city elsewhere. PersonaSelector: 2-column layout with live preview panel (records, flagship+metric, stack chips), clock, footer hints. |
| 3.16 — Avenue + discovery gameplay | **DONE** | Boards spread along the street (flagship last, larger), proximity power-on (radial + z-band), ground chevrons guiding to next unlit board, ground rings, minimap per-board markers, billboard canvas content redistributed to fill height. Beacons removed. |
| 3.17 — Visual overhaul (blue-void + dossier + intro) | **DONE** | 3D scene migrated from old olive-green palette to blue-void NieR Reforged (bg/fog 0x0d0f14, buildings 0x12151c, windows 0x4d8f75). Dossier panel (REC counter, MISSION section, metric box, big CTAs, numbered other-records rows → click walks to board). Cinematic intro (first visit: high camera pan + hero title, PersonaSelector waits 2.4s via `.wait` class). Role pages master-detail + global micro-interactions (hover scramble via `data-scramble`, page sweep, `:focus-visible` mint). |
| 3.18 — Gameplay + flagship amber (G1–G11) | **DONE** | Sprint (Shift ×1.8), click-to-move (asphalt raycast), world bounds clamp, smooth heading lerp. City dressing (streetlamps+cones, neon signs, skyline, stars). Avenue end-cap screen (click → role page). Minimap 2.0 (heading arrow, click fast-travel, next-objective pulse, corner-cut frame). Dossier 2.0 (stack chips, PREV/NEXT, DISCOVERED blocks). RECORDS HUD counter with flash. Flagship amber treatment (Deus Ex, `--accent-flag: #9a7b2d` / bright `#c9a94f` / bg `#14110a`) across 3D board, dossier, selector preview, role pages — NEVER interactive. PersonaSelector boot-build sequence (~950ms, skippeable, `animationend`-gated). Unified button system: `[ LABEL ↗ ]` mono + identical hover/active/focus. All 10 goals E2E-verified PASS. |
| 3.19 — UI capas separadas | **DONE** | Atmósfera acotada a la superficie jugable vía prop `surface`. Fix del bug de lluvia (dos canvas de 100vw sobre todo el sitio). AA en estado por defecto, plain mode eliminado. Nav sólo con rutas reales. WASD-only. DS retirado. Arnés `npm run verify:ui` (9/9). Spec: `docs/superpowers/specs/2026-08-20-ui-capas-separadas-design.md` |
| 4 — About / Contact | **pending** | Career narrative EN+ES, LinkedIn/GitHub/email |
| 5 — Polish | **pending** | Lighthouse, a11y audit, mobile, SEO |
| 6 — Launch | **parcial** | Dominio propio y sitio en vivo en `pablolerner.dev` (VPS Vultr + Caddy, `npm run deploy`). Falta: SEO final, analytics, CV PDF |

---

## Lessons learned (critical — prevent repeated mistakes)

1. **Error source ≠ file being edited.** "Canvas has an existing context" came from `AmbientCanvas.astro`, not `PortfolioScene.astro`. When a fix doesn't change a symptom, check sibling components on the same page.
2. **Don't clear `node_modules/.vite` mid-debug.** Causes `504 Outdated Optimize Dep` noise that looks like a real bug.
3. **Headless WebGL (SwiftShader) runs RAF far slower.** A 2s animation takes ~20s headless. Wait 15–20s before concluding time-based interactions failed.
4. **Bash tool network namespace** — see WSL2 section above. Always restart + verify in the same Bash call.
5. **Playwright headless needs manual lib install** in WSL2: `apt-get download libnspr4 libnss3 libasound2t64`, extract with `dpkg-deb -x`, set `LD_LIBRARY_PATH`.
6. **Orphaned vertex groups in GLB → cone/triangle deformations.** When swapping armature modifiers, remap any VG with weights to nearest bone before export.
7. **UAL2 quaternions CANNOT be FCurve-copied to Rigify DEF bones.** Rest orientations are incompatible (UE vs Rigify convention). Solution: use UAL2_Standard.glb directly (the rig already has correct animations).
8. **`prefers-reduced-motion` is ON by default on Windows.** Apply the guard to visual-only animations, NEVER to user input (WASD, clicks) or canvas rain.
9. **"It baked 49 frames" ≠ "animation is correct."** Spider-pose animations have valid frame counts — only detectable visually.
10. **`document.fonts.ready` ≠ font usable on canvas.** Use `document.fonts.load('bold 17px "Share Tech Mono"')` before any `fillText()` with a web font.
11. **CanvasTexture `needsUpdate` mutation is unreliable for dynamic updates.** `tex.needsUpdate = true` after `ctx.clearRect + drawBillboardCanvas` does NOT reliably update the GPU texture in this setup. The correct pattern for dynamic billboard updates is to **replace `material.map` with a new `CanvasTexture`** and set `material.needsUpdate = true`. Never try to update an existing CanvasTexture in-place.
12. **HTML overlay > 3D Sprite for readable text.** Use `Vector3.project(camera)` → CSS `transform`. Pre-allocate the Vector3 once in `init()`, never inside `tick()`.
13. **BufferGeometry particles.** Update: `pos.setXYZ(i,x,y,z)` then `pos.needsUpdate = true` once after loop. Never replace the BufferAttribute.
14. **`visible: false` prevents raycasting.** Use `{ transparent: true, opacity: 0, depthWrite: false }` for invisible hitbox meshes.
15. **`define:vars` in Astro forces `is:inline`**, which skips Vite bundling. `await import('three')` fails silently. Pass data via `<script type="application/json" id="...">` + `JSON.parse()` instead.
16. **Register `nier:zone` listener BEFORE the GLB `await`.** PersonaSelector dispatches at 600ms page load. If the 7.8MB GLB takes longer, the listener isn't registered yet and the event is silently lost. Always register event listeners as early as possible in `init()`, immediately after the data they depend on (`zoneBillRefs`) is populated.
17. **When per-mode content keeps leaking across modes, stop patching draw state — make the objects' existence mode-scoped.** The static 9-billboard system needed 3 rounds of fixes (texture redraws, OFFLINE ghosts, click guards) and still felt wrong. The definitive fix was build-on-demand/dispose-on-change: role-scoped objects can't show the wrong role's content because they don't exist. Prefer this pattern over state-swapping a fixed set of scene objects.
18. **Multiple event-dispatch fallbacks WILL double-fire — always dedupe in the handler.** PersonaSelector re-dispatches `nier:zone` at 600ms AND PortfolioScene's sessionStorage fallback dispatches at 200ms; both run on every reload. Concurrent `setInterval`/`setTimeout` text animations on the same element interleave characters. Fix: idempotence guard in the handler (`if (zone === activeRole) return`) + cancel-safe animations (store the timer on the element, clear before restarting).
19. **`(npm run dev &)` inherits the shell's cwd** — a `cd` earlier in the same compound Bash command silently starts the server from the wrong directory ("Missing script: dev"). Always launch the dev server before any `cd`, or use absolute paths.
20. **The backgrounded dev server dies after ~90s in the Bash sandbox.** Budget ONE Playwright flow per server start; restart server + run flow in the same call. Headless walking is ~10× slower: 100s of held `KeyW` ≈ 10s of real gameplay.
21. **Proximity triggers on a street need a z-band, not just radial distance.** Walking down the middle keeps the far sidewalk at ~10u — radial-only (8u) never fires. Trigger: `dist² < 64 || |bz − charZ| < 4.5`.
22. **Astro scoped styles NEVER match runtime-injected DOM.** Elements created via `document.createElement`/`innerHTML` lack the scoping attribute, so component `<style>` rules silently don't apply (this was why the 3D panel always looked broken/unstyled). Styles for JS-injected markup must live in a `<style is:global>` block, anchored to a container id (e.g. `#ps-panel .d-row`) to avoid leaking.
23. **Gate JS-timed UI states on `animationend`, not `setTimeout`, when heavy work runs in parallel.** CSS animations run on the compositor's wall-clock; JS timers stall under main-thread jank (7.8MB GLB parse). The selector's boot-skip listeners outlived the *visible* boot end and ate the user's first click — fixed by making `animationend` of the last-animating element the primary end signal (timeout kept as fallback only).

---

## Blender / 3D assets

- **Blender filesystem is Windows** — files go to `C:\...`, accessible at `/mnt/c/...` from WSL2. Always `cp /mnt/c/... public/...` after export.
- **Blender MCP viewport screenshots never work.** Use `bpy.ops.render.render(write_still=True)` → PNG.
- **Blender 5.x animation API** (different from 4.x): `action.slots[0]` → `action.layers[0].strips[0]` → `strip.channelbags.new(slot)` → `.fcurves`

**Assets:**
- `public/models/remy.glb` (7.2MB) — **CURRENT**: Remy de Mixamo, 114 huesos, `Running` / `Walking` / `Idle`
- `public/models/android.glb` (7.7MB) — PREVIO: UAL2_Standard.glb, 65 joints, 43 animations (ninguna de correr)
- `public/models/android_backup.glb` (6.2MB) — **PERMANENT BACKUP**: original 9S Sketchfab, no animations — never overwrite
- `Universal Animation Library 2[Standard].zip` (project root) — CC0, 43 animations, UAL2 rig

---

## Pending from Pablo (content blockers)

- [ ] LinkedIn About/bio text — paste directly (LinkedIn blocks scraping)
- [ ] Data Scientist repos — none assigned yet (`src/data/projects.ts → dsProjects`)
- [ ] CV PDF — place at `public/pablo-lerner-cv.pdf` (button already wired)
- [x] LinkedIn URL — `https://www.linkedin.com/in/pablo-lerner-591180336`
- [x] Domain — `site: 'https://pablolerner.dev'` set in `astro.config.mjs` (drives canonical + hreflang). Served by Caddy on `pablolerner.dev`, `www.pablolerner.dev` and `pablolerner.duckdns.org`

---

## Content / i18n rules

- Spanish: Rioplatense register (*vos*, native phrasing — never literal translation)
- Technical terms (FastAPI, LangChain, deploy, pipeline) stay in English in both locales
- SEO: locale `es` (not `es-419`); reciprocal `hreflang` tags; canonical self-referencing

24. **Un selector de ID y uno de clase sobre el MISMO elemento: el ID gana y puede reintroducir un valor que la clase estaba conteniendo.** `#margin-rain-left { width: 100% }` pisaba `.margin-chrome { width: max(0px, calc(…)) }`, y sobre `position: fixed` ese `100%` resuelve contra el viewport: dos canvas animados de 100vw sobre todo el sitio, leídos durante meses como "el diseño es ruidoso". Antes de rediseñar por sensación, medir.
25. **Un `opacity` bajo sobre texto no es "atenuar", es romper el contraste.** `opacity: 0.6` sobre `--sand-dim` componía **2.17:1**. Atenuar es cambiar de color, nunca de opacidad.
26. **Geometría aditiva + `DoubleSide` + bloom se suma tres veces.** Los conos de farola a `opacity: 0.045` igual leían como conos verdes sólidos. Si un efecto "de luz" parece un objeto, contá cuántas veces se está sumando antes de bajarle más la opacidad.
27. **`animation-play-state` en computed style SIEMPRE dice `running`.** Para medir movimiento perpetuo hay que mirar `animation-iteration-count: infinite`; si no, las animaciones de entrada ya terminadas cuentan como ruido y el umbral se vuelve imposible.
29. **Un clip puede tener el nombre correcto y ser la animación equivocada.** El personaje anterior caminaba con `Walk_Carry_Loop` —una caminata *llevando algo en brazos*— porque el matcheo era `/walk/i && !/zombie/i` y en sus 43 clips (granja, espada, zombie, escudo) ése era el único que daba. Ninguna animación de correr. Buscar por nombre exacto primero y dejar el difuso como respaldo.
30. **Entre dos rigs Mixamo alcanza con renombrar pistas; entre Mixamo y Unreal no.** Prestarle clips a otro esqueleto de la misma familia es sólo reescribir `mixamorigHips.quaternion` → `Hips.quaternion`. Cruzar a nomenclatura Unreal (UAL2: `pelvis`, `upperarm_l`) colapsa la pose aunque se corrija por delta de reposo, en cualquiera de los dos órdenes de multiplicación: las orientaciones de reposo y los ejes de hueso son incompatibles y hace falta un solver de remapeo por hueso. Es la misma pared de la lección 7 por otro camino.
31. **Mixamo entrega FBX y le pone `mixamo.com` de nombre a TODOS los clips.** Bajar tres animaciones y cargarlas juntas hace que se pisen entre sí: hay que renombrarlas por archivo. Además, sin tildar *In Place* el clip trae su propio desplazamiento (`Running` traía 739 unidades) y el personaje se va caminando solo peleando contra WASD — se anula la pista de posición horizontal de la cadera conservando el rebote vertical.
32. **Convertir FBX → GLB sin Blender**: cargar los FBX con `FBXLoader` en una página headless, juntar los clips y exportar con `GLTFExporter({ binary: true, animations })`. Dos trampas: exportar con un override de materiales activo lo hornea dentro del GLB, y `GLTFExporter` embebe las texturas sin comprimir — las de Mixamo vienen en 2048 y el archivo pasaba de 7 a 41 MB. Reescalarlas a 256 antes de exportar lo deja en 7.2 MB.
33. **`astro check` OOMea con el heap por defecto de Node en este proyecto.** Usar `npm run verify:check` (`--max-old-space-size=8192`). Baseline a 2026-08-20: 347 errores, 0 warnings, 118 hints.
34. **Si normalizás el movimiento por `dtScale` pero dejás el reloj de una acción atado al frame, el alcance de esa acción depende de los Hz del monitor.** `charX/charZ` avanzaban por segundo (`dtScale`) y `jumpT` avanzaba por frame (`+= 0.016`): el salto duraba 87 *frames*, no 1.4 segundos, así que en 60Hz cubría 11.58u y en 144Hz 4.82u. Con `prefers-reduced-motion` —prendido de fábrica en Windows, lección 8— el paso se duplicaba y caía a 2.41u, menos que los 3.6u del charco de ácido: imposible de cruzar, y sin ningún error a la vista. Cuando dos magnitudes se suman en el mismo tick, las dos van en la misma unidad de tiempo.
35. **Un clip puede tener el nombre correcto y estar VACÍO.** El `Idle` del GLB tenía 0 pistas, 0 nodos, 0 segundos: cargaba sin error, el nombre matcheaba y la escena lo daba por bueno — el personaje simplemente no se movía nunca, y eso se leyó como "le falta una animación de respiración" en vez de "la que hay está vacía". La causa estaba dos pasos atrás: **cada FBX de Mixamo trae DOS animaciones**, la real (`mixamo.com`) y una `Take 001` de relleno con 0 pistas, y el orden NO es estable — en `Walking.fbx` y `Running.fbx` la real es la `[0]`, en `Breathing Idle.fbx` la vacía viene primera. La conversión tomaba `animations[0]`. Elegir por contenido (la de más pistas), nunca por índice. Es la lección 29 llevada al extremo.
36. **`Box3.setFromObject` sobre un `SkinnedMesh` mide la bind pose, no la pose animada.** Transforma la `boundingBox` de la geometría por la matriz del mesh e ignora el skinning, así que da el mismo resultado con cualquier animación aplicada. Normalizar el modelo nuevo contra el viejo con cajas comparaba una T-pose contra una pose horneada (1.79 de ancho contra 0.68) y el resultado parecía correcto por casualidad. Las posiciones de mundo de los HUESOS sí siguen al mixer: medir con `getWorldPosition` de cabeza y pies, con los dos modelos en la misma pose.
37. **`mixer.stopAllAction()` no devuelve el esqueleto a la bind pose.** Deja los huesos donde quedaron, y `GLTFExporter` escribe la transformación viva de cada uno: exportar después de haber posado el modelo hornea esa pose como reposo del archivo. Hay que guardar position/quaternion/scale de cada hueso antes de posar y reponerlos a mano.
38. **`AnimationMixer` restaura la bind pose en cuanto una acción se detiene y ningún otro clip usa ese hueso.** Lleva un `useCount` por binding; al llegar a 0 llama `restoreOriginalState()` **en el acto**. Y `play()` sólo marca la acción como activa — la pose recién se escribe en el siguiente `mixer.update()`. Así que parar la saliente antes de arrancar la entrante deja un frame entero dibujado en bind pose. Con el GLB viejo no se notaba porque su reposo era una pose de caminata horneada; con la bind pose real —una T-pose— aparece un parpadeo al pasar de idle a correr. **Arrancar siempre la entrante primero**: el contador nunca toca 0 y en el frame del cambio se ve la pose anterior, que es una pose real. En este repo todo pasa por `switchAction()` y `verify:character` A6 controla que siga habiendo un solo `.stop()` **de AnimationAction** — `ambient.stop()` esta excluido por receptor, porque `.stop()` no es exclusivo del mixer (los beeps nunca cayeron ahi porque llevan argumentos y el patron pide parentesis vacio).
39. **Un ancho `max(0px, calc((100vw - 1400px) / 2))` vale CERO debajo de 1400px, y lo que tenga adentro se desborda.** El rail de iconos sociales se dimensiona con el margen que sobra del shell; en un teléfono ese margen es 0, así que los iconos de 18px quedaban a `x = -9`, mitad afuera de la pantalla — y no sólo en teléfonos: en **todo** viewport menor a 1400. Es el mismo patrón de la lección 24 por el otro lado: allá el ID reintroducía un ancho que la clase contenía, acá el ancho calculado colapsa a cero y el contenido se sale. Si un elemento vive en el margen, hay que decidir qué hace cuando no hay margen.
40. **En CSS, a igual especificidad gana el ÚLTIMO.** La media query de pantallas chicas no aplicaba porque la había puesto ANTES de la regla base: los dos selectores eran de clase, así que la de abajo ganaba y el panel seguía en 440px sobre un viewport de 390, perdiendo 50px por la izquierda. No era la lección 24 (ID contra clase) aunque se le pareciera: era orden puro. Los bloques responsive van al final.
41. **El `fov` de Three.js es VERTICAL, y en una pantalla vertical eso es una trampa.** Con 52° fijos y el aspecto de un teléfono (0.46), el FOV **horizontal** cae a 25°: a la distancia del primer cartel la cámara veía hasta `x = ±4.3` con los carteles parados en `x = ±6.5`. No es que se vieran mal — estaban **fuera del cuadro**, y ninguna cantidad de centrar la cámara lo arreglaba. Cuando el encuadre depende del ancho, hay que fijar el horizontal y derivar el vertical del aspecto.
42. **Un ajuste de cámara puede destapar un bug del mundo que llevaba meses escondido.** Al pasar el seguimiento en X del 30% al 100%, la cámara empezó a acercarse a los bordes de la calle y apareció que el personaje podía **caminar adentro** de los dos edificios de la entrada: su límite es `±8.8` y el edificio ocupa desde `x = 5.75`. Siempre estuvo así; lo tapaba que la cámara nunca llegaba hasta ahí. Cuando algo se ve mal recién después de un cambio, preguntarse si el cambio lo *causó* o sólo lo *destapó*.
43. **Registrá el cuerpo del error de una API ajena, no sólo el código.** El envío por Resend fallaba con `403` y el cuerpo decía `error code: 1010` — un código de **Cloudflare**, no de Resend: su API está detrás de Cloudflare y rechaza el `User-Agent` por defecto de `urllib` ("Python-urllib/3.x") por firma de bot. Nada de eso figura en la documentación de Resend, y con sólo el `403` a la vista la hipótesis obvia habría sido "la key está mal". El segundo `403`, ya con `User-Agent` propio, trajo el error real de Resend y venía con la solución escrita adentro (la casilla exacta a la que sí se podía enviar). Un `except` que se traga el cuerpo convierte diez segundos de diagnóstico en una tarde.
44. **Antes de tocar la constante que nombra el síntoma, buscá quién la lee.** "El salto se queda corto, subile la altura" es un diagnóstico razonable y equivocado: la compuerta del charco es `if (!jumping)`, booleana, y `jumpY` no se lee en ningún lado salvo para pintar la Y del personaje. Con `JUMP_H` en 1.3 o en 10 el resultado es el mismo. Peor: el comentario del código prometía un umbral de `jumpY` que nunca existió. Un `grep` de tres segundos por la variable separa la constante estética de la que decide.

45. **Una chapa de 0.48rem no crea jerarquía.** El selector ofrecía dos filas con la misma forma, el mismo cuerpo y el mismo color, y toda la diferencia entre "el rol principal" y "el otro" era un badge `◆ PRIMARY` de 7.7px. Leído de corrido —y en un teléfono, donde el panel de preview directamente no se muestra— eso son dos opciones idénticas: una decisión que el visitante no tiene con qué tomar. La jerarquía la hacen el tamaño, el fondo y el riel; la etiqueta sólo la nombra una vez que ya se ve. Ojo con el orden al agregarla: `.persona-opt:hover` y `.persona-opt.is-alt` tienen la MISMA especificidad, así que el riel apagado del secundario le ganaba al mint del hover (lección 40 otra vez, en otro archivo).
46. **"Corre muy lento en mobile" no era la velocidad.** En táctil no hay Shift, y la compuerta es `sprinting = wsadOn && !keys.Shift`: el personaje ya corría al máximo, más rápido que un escritorio caminando. Lo que cambia es cuánto mundo entra en la pantalla — el `fov` de Three.js es vertical, en un teléfono sube a 85° y el mismo desplazamiento produce menos flujo óptico, así que a igual velocidad real el paso se *siente* más lento. Es la lección 41 por el lado perceptual: antes el fov fijo sacaba los carteles del cuadro, ahora el fov adaptativo cambia la sensación de velocidad. Y al compensarlo, compensar sólo lo que se reportó: `MOVE_MULT` multiplica el paso en el piso y NO el salto, porque el alcance en el aire está calibrado contra el ancho del charco y no puede depender del dispositivo.
47. **Un control flotante flota también sobre tus paneles.** El joystick es `position: fixed` con `z-index: 40` porque tiene que estar arriba de la escena; el cajón de proyectos tenía 11 porque sólo se comparaba contra el dossier (10). Nadie los comparó entre sí hasta que en un teléfono el cajón ocupó la pantalla entera y la mitad de abajo dejó de responder: los toques iban al joystick invisible que estaba encima. Cuando se agrega una capa fija, hay que revisar el z-index de TODO lo que pueda abrirse debajo, no sólo de sus vecinos.
48. **Un test que fuerza el estado en vez de recorrer el camino real pasa en verde con el bug adentro.** M15 abría el dossier con `classList.add('open')`, tocaba la ✕ y comprobaba que la clase se hubiera ido. Verde — y el botón estaba roto en el producto: por el camino real el jugador está parado adentro del círculo del cartel (ahí lo deja el teleport al seleccionar un proyecto), así que el tick reabría el panel en el frame siguiente. El estado forzado nunca reproducía esa condición. Dos correcciones, las dos necesarias: recorrer el camino del usuario (PROJECTS → fila → el panel se abre SOLO por proximidad) y medir que **siga** cerrado un rato después, no que se cierre. Y antes de dar por bueno un test nuevo, correrlo contra el código sin el fix: si no falla, no está midiendo nada.
