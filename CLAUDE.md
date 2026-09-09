# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server — http://localhost:4321 (always use this, not npx astro dev --host)
npm run build         # production build → dist/
npm run preview       # serve production build locally
npm run astro check   # TypeScript / Astro type-checking

npm run verify        # los cinco arneses: salto + personaje + audio + contacto + UI
npm run verify:mobile # NO entra en `verify`: emula un telefono real y mide el cableado
                      #   tactil (joystick, ✕, musica, carteles). Correlo aparte.
npm run verify:audio  # renderiza la musica offline y mide la señal (--wav deja previews)
npm run verify:check  # astro check con heap de 8 GB (con el de fabrica OOMea)
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

Personal portfolio for **Pablo**. **Un solo perfil: AI Engineer & Data Analyst**, en ese orden — es lo que PRODUCT.md declara como el trabajo del sitio (*"get Pablo Lerner hired as an AI Engineer"*), con el análisis de datos como alcance de apoyo y no como titular. Data Science está retirado: sin páginas, sin proyectos, sin estado COMING SOON. Target audience: AI startups, senior engineers, founders — skim-first readers.

---

## Stack

- **Astro 7** (static output, TypeScript strict)
- **CSS custom properties** for all theming — no UI library
- **Vanilla JS** for keyboard navigation, the records listbox and the terminal animation
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
- El script verifica después de subir: códigos HTTP de las 9 rutas (incluidos los dos
  redirects de `/ai/` y `/risk/`, que no pueden dar 404) + el 404 real, y
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

/* Columnas de margen (lluvia + rail de contacto). TOPEADAS en 60px:
   antes eran todo lo que sobraba del shell y en un ultrawide se comían
   el 59% de la pantalla — ver lección 55 */
--chrome-col: min(60px, max(0px, (100vw - 1400px) / 2));
```

**Hard constraints:**
- Zero `border-radius` anywhere — ever
- Scanlines + animated grain: CSS-only overlays on `body::before` / `body::after`
- `prefers-reduced-motion`: boot screen → `display: none`; stagger reveal → `animation-duration: 0.01s` (never `animation: none` — kills `fill-mode`)
- `--accent` (teal `#3d7a64`): decorative only — ◆ cursor, DotRow, badge/tab borders
- `--accent-bright` (mint `#5ee7aa`): interactive only — CTAs, active states, hover
- `--accent-flag*` (amber): flagship marking only — badge, board frame, list row, HUD stat box. NEVER on anything clickable. A flagship row that is ALSO selected shows both: mint border-left (interactive state) + amber badge (identity)
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
    RecordsLayout.astro # 3-col grid (DocNav 280px · center · TerminalWindow 220px). Owns the records-page UI: props {heading, badge, subline, stats[], ai[], data[]} → stats HUD grid + master-detail dossier (numbered listbox 01–16 with a non-selectable block divider, pre-rendered detail panes, ↑↓ keyboard, scramble transition). Pages are thin wrappers.
  components/
    ui/
      AmbientCanvas.astro     # Three.js perspective-grid background (lazy, z-index:0)
      BootScreen.astro        # one-time OS-boot overlay (sessionStorage flag)
      TabBar.astro            # top nav tabs; props: active, lang
      DotRow.astro            # 40-dot animated row
      StatusBar.astro         # bottom bar: hints de juego (sólo surface="game") · toggle EN|ES · fecha. NO lleva CV (vive en la franja de identidad) ni CLEAR MODE (plain mode se eliminó)
      DocNav.astro            # left-panel nav for the records page: STREET back-link + two [data-jump] entries that select the first file of each block
      TerminalWindow.astro    # animated live-coding terminal panel (sólo la página de records)
      PortfolioScene.astro    # 3D interactive home scene (Three.js city street)
      TouchControls.tsx       # ÚNICA isla React del sitio: joystick + botón de salto, client:media
  pages/
    index.astro         # root → redirects to /en/
    en/
      index.astro       # home EN: PortfolioScene (la escena arranca sola)
      projects/index.astro  # records — 16 (AI 9 + DATA 7). /ai/ y /risk/ redirigen acá
      contact/index.astro   # formulario → POST /api/contact
      concept/          # INTERNAL decision pages (not in nav, sólo EN): index + city
                        # (fase 3), flagship.astro (comparación de acentos, ganó la A),
                        # audio.astro (las 3 variantes de música; se eligió 'terminal')
    es/                 # index, projects/, contact/ — NO tiene concept/ (por eso el
                        # toggle de idioma verifica la hermana contra el árbol de páginas)
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

Exported: `aiProjects` (9), `dataProjects` (7) y **`streetProjects`** (10) — este último
compuesto por id sobre los otros dos, y **es** el orden de caminata de la avenida con el
flagship último. El orden vive ahí y en ningún otro lado. Un invariante al final del módulo
**falla el build** si hay más de un `featured` o si no va último: se comprueba al evaluarse
y no en un arnés, porque un dato mal ordenado sale igual como HTML perfectamente válido.

`track: 'ai' | 'data'` no es derivable río abajo: a la escena le llega un objeto plano
mapeado, no el array de origen, y cada cartel imprime su propia mitad del perfil.
`status` describe el ESTADO del proyecto y `featured` el RANGO — son independientes a
propósito (el flagship conserva `DEPLOYED` porque "andá y tocalo" es su hecho más fuerte).

---

## Base.astro header structure

```
┌─────────────────────────────────────────────────────────────┐
│  UNIT::PL-7729  ·  [page title]  ·  SYS:OK · EN           │  ← os-title-row
├─────────────────────────────────────────────────────────────┤
│  Pablo Lerner · AI Engineer & Data Analyst  [GH][LI][✉][CV]│  ← os-identity
├─────────────────────────────────────────────────────────────┤
│  ⬡ STREET  ⬡ PROJECTS                                      │  ← TabBar
├─────────────────────────────────────────────────────────────┤
│  ● ● ● ● ● ● ● ● ● ● ●  (40 animated dots)                │  ← DotRow
└─────────────────────────────────────────────────────────────┘
```

Max-width **1400px, pero sólo en `surface="doc"`**: una columna de texto de 2560px no se
lee. **En `surface="game"` el shell suelta el tope** y toma `margin-inline: var(--chrome-col)`,
o sea que el juego ocupa el monitor menos las dos columnas de margen. os-shell border: mint
glow `rgba(94,231,170,0.18)` not `var(--border)`.

**En `surface="game"` se renderiza SÓLO la franja de identidad**: la de título, el
`TabBar` y el `DotRow` están apagados ahí. Por eso el shell del juego lleva
`height: 100svh` (no `min-height`) y la escena se queda con lo que sobra vía `flex: 1`:
la cabecera mide distinto en escritorio (una línea) que en un teléfono angosto (dos), y
cualquier constante que la suplante nace vieja — ver lección 54. `100svh` y no `100vh`
porque en un teléfono `vh` es el viewport GRANDE y la página quedaría con scroll.

**Cambio de idioma (`.os-lang-btn`)**: vive en la franja de identidad, al final de la
linea del nombre. Antes estaba SOLO en el `StatusBar`, que se renderiza unicamente en
`surface="doc"` — o sea que en la home, que es la escena y la puerta de entrada del
sitio, no habia forma de cambiar de idioma, y encima estaba al pie con scroll de por
medio. Esta franja es la unica que se renderiza en TODAS las paginas.

- Muestra el idioma **destino** (`ES` estando en ingles), no los dos: un `EN|ES` completo
  ocupa el doble por la misma informacion.
- **Va de ese lado y no con los otros botones porque no entra**: medido, los cinco suman
  358.1px en 358 disponibles en un telefono de 390 y el parlante se caia al renglon de
  abajo. Meterlo a la fuerza obligaba a achicar los tres botones-palabra en todos los
  telefonos para acomodar uno mas.
- `margin-left: auto` en vez de un margen fijo: `.identity-left` ya es flex con wrap, asi
  que el chip se pega al borde derecho de SU linea. A 375 el nombre y el rol se comen la
  linea entera y el chip baja — alineado a la derecha, no huerfano bajo el nombre.
- **El destino se verifica contra el arbol de paginas** (`import.meta.glob`), no se arma
  a ciegas: `/en/concept/*` solo existe en ingles y un swap ciego manda a un 404. Sin
  hermana se cae a la home del otro idioma. Por lo mismo, el `hreflang` alternate solo se
  emite si la traduccion existe: declarar como alternate una URL que da 404 es peor que
  no declarar nada.
- El `StatusBar` tambien perdia la pagina (sus links eran fijos a `/en/` y `/es/`, asi que
  desde `/en/risk/` caias en la home española). Ahora recibe `altHref` de `Base`, que es
  quien sabe que paginas existen.
- Cubierto por `verify:ui` **C11** (toda pagina con barra de identidad lo tiene) y **C12**
  (apunta a su hermana, o a la home si no existe).

**Rail de contacto (`.ps-icon-rail`)** — GitHub/LinkedIn/formulario, en todas las
paginas. **Tiene DOS disposiciones segun haya o no margen donde vivir**, y es el mismo
elemento en las dos (no hay copia en el HTML):

- **Desde 1400px**: columna vertical `position: fixed` en el margen izquierdo, la misma
  franja donde cae la lluvia, con su mismo ancho (`var(--chrome-col)`, tope 60px). Solo
  iconos. El tope importa acá tanto como en la lluvia: sin él, en un monitor de 2560 eran
  tres iconos de 18px centrados en una columna de 580px, que es como se ven ahora mismo
  en la versión anterior.
- **Debajo de 1400px, en `surface="doc"`**: deja de flotar. Pasa a `position: static`,
  fila horizontal al pie de la pagina, justo encima del `StatusBar`, con etiqueta
  (`GITHUB · LINKEDIN · EMAIL`, `CORREO` en español) y 44px de blanco de toque. Debajo de
  360px se caen las palabras y quedan los iconos. El corte esta medido con la fuente real
  y **en los dos idiomas**: la fila pide 298.3px en ingles y 305.6 en español (`CORREO` es
  mas largo que `EMAIL`); a 360 hay 326 disponibles y sobra, a 344 hay 310 y en español
  quedan 4.4px de aire, a 320 hay 286 y no entra.
- **Debajo de 1400px, en `surface="game"`**: sigue fija (la escena ocupa el viewport y no
  scrollea: no hay flujo donde caer), metida hacia adentro con `padding-left`.

Por eso el `<nav>` esta escrito **al final del shell, despues de `</main>`**: cuando es
`fixed` su lugar en el DOM da igual, asi que se lo pone donde tiene que caer cuando NO lo
es. La version anterior lo tenia arriba y flotando siempre, y en `/contact/` a 320px los
iconos caian sobre las etiquetas NAME/EMAIL del formulario (leccion 49). Cubierto por
`verify:ui` **C13**, que mide el solapamiento REAL de rectangulos contra todo `<main>` a
320 y 390 en las 6 paginas documento — no la posicion del rail, que no es lo que importa.

**Margin chrome panels** (visible only on viewports > 1400px):
- `position: fixed; width: var(--chrome-col)` — el token topea en **60px**. Debajo de 1400
  vale 0 y a 1440 vale 20, o sea que en teléfonos y notebooks no cambió nada; recién desde
  ~1520 se planta en 60
- Left (`#margin-rain-left`) + Right (`#margin-rain-right`): Matrix character rain via canvas RAF loop
- Script in Base.astro: `makeRain(id)` factory, `GLYPHS` pool + `pick()`, `CHAR_PX 11` / `GAP_PX 30`, `ResizeObserver`, always starts RAF (no `prefers-reduced-motion` guard on rain)

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
- **Aparecen apenas la escena está viva** (`nier:scene-ready`), sin ningún toque previo.
  Hubo un tercer pestillo (`personaChosen`) que los hacía esperar a que se eligiera un
  rol, porque el overlay del selector tenía `z-index: 9000` y el dedo le pegaba al
  overlay. Ese overlay ya no existe y el pestillo se fue con él.
- **`client:media`, nunca `client:only`**: con `client:only` Astro baja los 184 KB del
  runtime de React en toda visita, escritorio incluido, para que el componente devuelva
  `null`.
- **`JoystickShape.Square` de la librería NO es de esquina viva**: su `shapeFactory`
  devuelve `borderRadius: Math.sqrt(size)` como estilo inline. Se anula con `!important`
  (`verify:mobile` M7 lo controla).
- `devicePixelRatio` se topea en **1.5** en táctil (2 en escritorio), y además hay un
  **presupuesto de píxeles** (`PIXEL_BUDGET`, `pixelRatioFor()`): ahora que la escena
  ocupa el monitor, en 2560 el buffer pasa de 1398×1395 a 2438×1395 y multiplicado por
  DPR 2 son 13.6 MPx por frame con bloom encima. El techo es el peor caso que el sitio
  YA servía antes (1400 de ancho a DPR 2, ~7.8 MPx): nadie renderiza más pesado de lo
  que ya venía renderizando. Sólo muerde en pantallas grandes **y** de alta densidad; a
  DPR 1 no se activa nunca.
- **El tamaño del render sale de la caja, no de constantes** (`measureShell()`, usado por
  `init()` y por `onResize()` — antes eran dos fórmulas distintas). `setSize(W, H, false)`
  no toca el estilo del canvas: si el buffer y la caja no coinciden, el navegador estira.
  Con el piso de 400px que había, en un teléfono de 390 (caja 388) la escena salía
  achatada un 3% en horizontal. `verify:mobile` **M23** lo mide.
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

**Character control** (G1): **WASD/arrows ONLY** · **Shift = sprint ×2.1**, con crossfade
entre `Walking` (timeScale 1.8) y `Running` (timeScale 1.3) — los clips de Mixamo son *in
place*, así que su cadencia va atada a `WALK_SPEED` o los pies patinan · world clamp `BOUND_X 8.8 / z ∈ [−117, 4.5]` applied every tick · heading is a shortest-arc lerp toward `targetRotY` (never snaps).

**NO pointer-driven movement, ever** (PRODUCT.md brand commitment): no ground raycast, no minimap fast-travel, no auto-walk from dossier rows. Clicking a billboard SELECTS a record — selection is not displacement.

**Project mapping** (frontmatter → JSON → JS via `ps-data` script tag):
`streetProjects` (projects.ts) → `boards` (10, ya en orden de caminata, con `track` y
`featured`) + `trackLabels` + `allUrl` (`/{lang}/projects/`, un string, ya no un dict).

**BILLBOARD ARCHITECTURE — AVENUE (definitiva):**
Los carteles son FIJOS: uno por proyecto de `boards`, construidos **una vez en `init()`**,
sin esperar ningún gesto. No hay rol que elegir, así que no hay nada que reconstruir ni
que destruir — `disposeRoleBillboards` se borró junto con el cambio de rol que la
justificaba.
- `buildBillboards(THREE)` — recorre `boards` en orden; **el array ES el orden de caminata
  y el flagship es el último** (se fue la convención `order = [1..N-1, 0]`). Por cartel:
  frame, bordes apagados (0x2a3040), tablero con textura de canvas arrancando OSCURO
  (`color: 0x30343d`), anillo de piso (opacity 0), hitbox invisible. Más un `PointLight`
  ámbar en el flagship, marcado con `userData.flagship` (antes era `userData.zone`
  comparado contra la zona activa)
- **Geometría**: cartel k en `x = ±6.5` (alternando, k par → izquierda), `z = −10 − k*10`.
  Con 10 carteles el último cae en **z = −100**. Flagship 6.0×4.0 vs 4.2×2.8
- **La separación de 10u no se puede achicar.** La banda de proximidad mide 9u de ancho
  (`|bz − charZ| < 4.5`): con menos de 10u de separación se encienden dos carteles en el
  mismo frame y `showPanel` compite consigo mismo. Si hacen falta más carteles, se corre el
  FONDO del mundo, no se acercan los carteles. `verify:mobile` **M22** lo controla
- **Proximity power-on** (tick, cada 4 frames): se enciende con dist² radial < 64 **O
  `|bz − charZ| < 4.5`** (el disparo por banda de z es CRÍTICO: caminando por el medio, el
  radial solo dejaba el lado lejano oscuro para siempre). Al encender: `flickerOn`, bordes
  → borderColor, pulso del anillo, `showPanel(projIdx)`
- **Chevrons**: pool de 8 flechas de piso reubicadas cada tick hacia el próximo cartel
  APAGADO; se desvanecen cuando no queda ninguno o el objetivo quedó atrás
- **Cabecera del cartel**: `SYSTEM::PROJECT · ` + `trackLabels[proj.track]`, o sea
  `AI ENGINEER` en nueve y `DATA ANALYST` en el de FraudSense. Es lo que mantiene las dos
  mitades del perfil visibles EN LA CALLE, ahora que no hay selector que las nombre
- **Flagship board** (G7): frame/bordes ámbar `FLAG 0x9a7b2d`, hover `FLAG_BRIGHT 0xc9a94f`,
  anillo ámbar, PointLight cálido, y `drawBillboardCanvas` usa `AMBER` para barra/badge/
  métrica/CTA cuando `isHero`
- **El final de la avenida es el obelisco**, en `OBELISK_Z = -114`: tocarlo navega a
  contacto (con `obeliskTouched` como pestillo de un solo disparo). El end-cap
  `drawEndcapCanvas` que documentaba esta sección fue reemplazado por él hace tiempo
- **City dressing** (G2, `buildCityDressing`, una vez en init): 9 carteles neón de canvas
  en las caras interiores de los edificios (hasta z=−96, o la mitad de atrás queda desnuda),
  skyline de canvas en z=−126, 180 estrellas estáticas, el obelisco y sus dos pozos. Todo
  MeshBasic/aditivo — cero luces reales de más. **Las farolas se retiraron** (lección 26)

**Key systems:**
- WASD + arrow keys (no `prefers-reduced-motion` guard on input, only on visual effects)
- **Click billboard → `teleportToBoard(hit.projIdx)`, NUNCA `showPanel`.** El panel lo abre el anillo al llenarse (`SPINNER_FILL_TIME` 1.1s), y ese es el único camino que lo abre. `showPanel()` además teletransporta, así que llamarla desde el click dejaba al jugador parado adentro del círculo con `ref.opened` en false: el tick la volvía a llamar al llenarse el anillo y el dossier se dibujaba **dos veces**, con el título haciendo scramble encima del anterior. Las filas del cajón `[ PROJECTS ]` ya hacían lo correcto. Cubierto por `verify:ui` **C16**
- `scrambleIn(el, text)` — cancel-safe scramble-settle text reveal (replaces old typeOut; stores interval in `el._scrambleTimer`)
- **Minimap 2.0** (G4): `#ps-minimap-canvas` (140×190), redrawn every 3rd frame, geometry in the `MM` object (`mx/mz` project, `invX/invZ` unproject; z range **[6,−120]** — tiene que pasar SIEMPRE a `BOUND_Z_MIN`, o los carteles de más allá computan un `py` negativo y se dibujan fuera del borde de arriba del canvas; ya pasó dos veces al crecer la avenida). Corner-cut frame drawn in-canvas (the CSS border was removed). Character = **heading arrow** (`rotate(π − charGroup.rotation.y)`), markers per board (lit solid / unlit hollow, amber for flagship), expanding-square pulse on the next unlit board. **Display only** — `pointer-events: none`, no fast-travel
- `drawBillboardCanvas` sizes tuned to FILL the canvas: title 30/24px, desc 17/14px (4/3 lines), outcome (word-boundary truncate via `bbTruncate`) + CTA anchored to bottom, PAD 18
- **Dossier panel** (simplificado — sólo qué ES el proyecto): `showPanel(projIdx)` arma `#panel-title` (scrambleIn), `.d-status` con el `status` real del proyecto, sección MISSION (`.d-section` + `.d-label` + `.d-desc`), caja de métrica `.d-metric` (variante ámbar `.d-metric-flag` en el flagship) y `.d-ctas` con `.d-cta-primary` / `.d-cta-ghost`. Al pie, `#panel-all` → `/{lang}/projects/`, y `#panel-close` es la ✕ roja.
  **Se retiraron** (y no hay que volver a documentarlos como si estuvieran): el contador REC nn/NN, los bloques DISCOVERED, los chips de stack, la navegación PREV/NEXT y la lista de otros registros — el cajón `[ PROJECTS ]` ya cubre saltar a otro proyecto y el panel no necesita duplicarlo.
  **La ✕ necesita DOS pestillos.** `opened` es el one-shot que evita que el panel se reabra en cada frame; `dismissed` es el segundo, porque al seleccionar un proyecto el teleport te deja parado en el centro del anillo y cerrar a mano dejaba `fillT >= 1` con `opened` en false. Se marca por condición geométrica (`SPINNER_R`), o sea sobre el cartel en cuyo círculo está el jugador, y se rearma al salir del círculo
- **Cinematic intro** (primera visita): **son DOS hechos, no uno.** `introActive` es que la placa "Pablo Lerner / ACCESS TERMINAL" está en pantalla, y va **siempre**; `introCam` es que además baja la cámara de (0,17,34) al nivel de calle (easeOutCubic en el tick), y **sólo corre sin reduced-motion**. Estaban pegados detrás de un `!reduced`, y como Windows trae el ajuste encendido de fábrica (lección 8), la mayoría de los visitantes de escritorio no veía ninguna presentación. El punto final del barrido es idéntico al arranque de la cámara normal (`camX, 4.0, camTgtZ+9`), así que el empalme no salta. `INTRO_DUR` es `reduced ? 2.2 : 3.7` **segundos** — `introT` avanza con `delta`, no por frame (antes duraba 223 frames: 1.55s en un monitor de 144Hz); `#ps-hero` overlay fades at introT>0.72. **Se queda a propósito**: es la única puerta de entrada que le queda al sitio ahora que no hay selector, y sin ella el visitante cae de golpe en una calle sin contexto. La marca la escribe la escena (`sessionStorage['nier-visited']`) al terminar la intro — antes la escribía PersonaSelector al elegir rol
- **3D palette = blue-void** (matches site tokens): clearColor/fog 0x0d0f14, buildings 0x12151c + edges 0x2a3040, windows 0x4d8f75, asphalt 0x10131a, sidewalks 0x161a22, dashes/poles 0x232a38, char body 0x181b22. NEVER reintroduce the old olive-green (0x1b1e1a etc.)
- Unit tag: HTML `<div id="unit-tag-hud">` projected via `Vector3.project(camera)` each tick
- Particles: 800 pts, `BufferGeometry`, `pos.setXYZ(i,x,y,z)` + `pos.needsUpdate = true` per tick
- Fog: `FogExp2(0x0d0f14, 0.0086)` — bajada al crecer la avenida para conservar la misma extinción óptica sobre el skyline, que pasó de z=−96 a z=−126

**WebGL pattern (mandatory — never deviate):**
```js
const probe = document.createElement('canvas');  // probe on throwaway, NEVER on real canvas
if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;
const THREE = await import('three');              // import FIRST
const W = Math.max(shell.clientWidth, 400);       // measure AFTER import
const renderer = new THREE.WebGLRenderer({ canvas });  // first real getContext
```

**No hay handshake con nadie.** El evento `nier:zone`, su fallback por `sessionStorage`
(`nier-persona`) y la guarda de dedupe del handler existían todos para coordinar la escena
con el selector. Se fueron los tres con él: sin evento no hay carrera que desempatar
(lección 18), y los carteles se construyen en `init()` sin esperar nada.

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

- **Se arma en `init()` y suena en el primer toque real.** Antes la disparaba el click de
  rol, que era el gesto que el navegador exige; sin selector no hay gesto garantizado al
  cargar. `startAmbient()` corre en `init()` y se apoya en el camino que ya existia para
  las recargas: si el contexto queda `suspended`, arma un `pointerdown`/`keydown` de un
  solo uso que lo despierta. Entra con un fade de 4s. **Consecuencia real**: quien mire la
  escena sin tocar nada no escucha musica — es la politica del navegador, no un bug.
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
  corrio, sin meterle ganchos de test al producto — igual que `data-boards`, que dice
  cuantos carteles construyo la escena.
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
M17-M19 miden el cableado** (que se arme sola sin ningun gesto —M17 se lee ANTES del
primer toque del arnes—, que el boton corte, que apagarla se recuerde tras recargar).
Ninguno de los dos cubre lo del otro.

---

## TerminalWindow component

Props: `title: string`, `lines: readonly string[]`

Contenido (en `RecordsLayout.astro`): una sola terminal, `PROC::AGENT_RUNTIME` (codigo de
un agente LangChain) — el perfil lidera con AI Engineer. La variante `PROC::DATA_PIPELINE`
se fue con la pagina de rol que la mostraba.

Animation: commands → 45–80ms/char + 520ms pause; output → 8–18ms/char; 2.2s restart; stagger 500–2300ms.

---

## Un solo perfil

**AI Engineer & Data Analyst**, en ese orden. No hay seleccion de rol: el juego se ve
apenas se entra, y `/{lang}/projects/` es la unica pagina de registros.

| Ruta | Que es |
|---|---|
| `/{lang}/` | La calle. 10 carteles, flagship al final |
| `/{lang}/projects/` | Records: 16 (AI 9 + DATA 7), agrupados por especialidad |
| `/{lang}/ai/` · `/{lang}/risk/` | Redirect a `/projects/`. **No se borran**: hay links repartidos afuera |
| `/{lang}/contact/` | Formulario |

**El orden del documento NO es el orden de la calle**, a proposito. El paseo es una
decision de ritmo de juego (los tres proyectos nuevos abren, los tres sin metrica quedan
en el medio, la caminata sube Hermes → FraudSense → Iris → flagship). La pagina la lee
alguien que evalua candidatos, y ahi gana el agrupamiento por especialidad.

**Data Scientist sigue retirado** (PRODUCT.md): sin paginas, sin opcion, sin estado
COMING SOON.

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
| 3.20 — Perfil único | **DONE** | Se retira PersonaSelector: la calle arranca sola, sin selección de rol. 10 carteles fijos construidos en `init()` (`streetProjects`), con support-json, LlamaRAG y Tarnish sumados y CV Evaluator como flagship. `/ai/` + `/risk/` → `/projects/` (RoleLayout→RecordsLayout, RoleNav→DocNav) con redirects. Avenida de −70 a −100 moviendo el fondo del mundo. Audio armado en `init()` en vez del click de rol. Arneses: C14, M21, M22 nuevos; M3 retirado, M17 reescrito. Spec: `docs/superpowers/specs/2026-09-09-perfil-unico-design.md` |
| 3.21 — Intro y click del cartel | **DONE** | La placa "Pablo Lerner / ACCESS TERMINAL" se separa del barrido de cámara: la placa va siempre, el barrido sólo sin reduced-motion (Windows lo trae encendido de fábrica, así que la mayoría de escritorio no veía ninguna presentación). `introT` pasa a segundos reales. Y clickear un cartel ya no abre el dossier: sólo teletransporta, y el anillo queda como único camino que lo abre — antes se dibujaba dos veces. Arneses: C15 y C16 |
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
16. **Register event listeners BEFORE a long `await`.** *(El caso concreto —`nier:zone`—
    ya no existe: ver lección 51. La regla sí.)* PersonaSelector dispatches at 600ms page load. If the 7.8MB GLB takes longer, the listener isn't registered yet and the event is silently lost. Always register event listeners as early as possible in `init()`, immediately after the data they depend on is populated.
17. **When per-mode content keeps leaking across modes, stop patching draw state — make the objects' existence mode-scoped.** The static 9-billboard system needed 3 rounds of fixes (texture redraws, OFFLINE ghosts, click guards) and still felt wrong. The definitive fix was build-on-demand/dispose-on-change: role-scoped objects can't show the wrong role's content because they don't exist. Prefer this pattern over state-swapping a fixed set of scene objects.
18. **Multiple event-dispatch fallbacks WILL double-fire — always dedupe in the handler.**
    *(El caso concreto ya no existe: ver lección 51. La regla sí.)* PersonaSelector re-dispatches `nier:zone` at 600ms AND PortfolioScene's sessionStorage fallback dispatches at 200ms; both run on every reload. Concurrent `setInterval`/`setTimeout` text animations on the same element interleave characters. Fix: idempotence guard in the handler (`if (zone === activeRole) return`) + cancel-safe animations (store the timer on the element, clear before restarting).
19. **`(npm run dev &)` inherits the shell's cwd** — a `cd` earlier in the same compound Bash command silently starts the server from the wrong directory ("Missing script: dev"). Always launch the dev server before any `cd`, or use absolute paths.
20. **The backgrounded dev server dies after ~90s in the Bash sandbox.** Budget ONE Playwright flow per server start; restart server + run flow in the same call. Headless walking is ~10× slower: 100s of held `KeyW` ≈ 10s of real gameplay.
21. **Proximity triggers on a street need a z-band, not just radial distance.** Walking down the middle keeps the far sidewalk at ~10u — radial-only (8u) never fires. Trigger: `dist² < 64 || |bz − charZ| < 4.5`.
22. **Astro scoped styles NEVER match runtime-injected DOM.** Elements created via `document.createElement`/`innerHTML` lack the scoping attribute, so component `<style>` rules silently don't apply (this was why the 3D panel always looked broken/unstyled). Styles for JS-injected markup must live in a `<style is:global>` block, anchored to a container id (e.g. `#ps-panel .d-row`) to avoid leaking.
23. **Gate JS-timed UI states on `animationend`, not `setTimeout`, when heavy work runs in parallel.** CSS animations run on the compositor's wall-clock; JS timers stall under main-thread jank (7.8MB GLB parse). The selector's boot-skip listeners outlived the *visible* boot end and ate the user's first click — fixed by making `animationend` of the last-animating element the primary end signal (timeout kept as fallback only). *(El componente del caso —PersonaSelector— ya no existe, ver lección 51. La regla sí.)*

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
49. **Meter un elemento hacia adentro no es decidir qué hace cuando no hay margen: sigue flotando.** La lección 39 dejó el rail de iconos con `padding-left` para que no se saliera de la pantalla, y eso corrigió el desborde y nada más: seguía siendo una columna `position: fixed` sobre una página donde no hay columna de margen. En `/contact/` a 320px llegaba a `x = 26.8` con el formulario empezando en 10.4 — los iconos encima de las etiquetas NAME/EMAIL — y a 360 quedaban a 3.6px del borde de la columna, que se lee igual de mal. El arreglo no era moverlo unos píxeles sino cambiarle la naturaleza: **debajo de 1400px, en una página documento, el rail deja de ser chrome y pasa a ser contenido en flujo** (fila horizontal al pie, encima del `StatusBar`), y ahí no puede pisar nada a ningún ancho. Un solo elemento con dos disposiciones, no dos copias en el HTML: como arriba de 1400 es `fixed`, su lugar en el DOM da igual, así que se lo escribe donde tiene que caer cuando NO lo es. En la escena sí sigue fijo, porque ahí no hay flujo donde caer.
50. **Un backtick adentro de un comentario `{/* ... */}` de Astro rompe el compilador, y el error apunta a otra línea.** Un comentario con `` `position: fixed` `` adentro tiraba `[CompilerError] Unexpected token` en `Base.astro:228:5` —un `</div>` perfectamente balanceado, 37 líneas más abajo— porque el parser trata el backtick como apertura de template literal y se come el resto del archivo buscando el cierre. Media hora de contar `<div>`s por un error que no estaba donde decía. En los comentarios de expresión, cero backticks (y ojo también con `<`).
51. **Un handshake por evento sobrevive al componente que lo justificaba.** Sacar
    `PersonaSelector` no era borrar un archivo: era desarmar `nier:zone`, su fallback por
    `sessionStorage`, la guarda de dedupe del handler (que existía sólo porque el evento
    llegaba dos veces, lección 18) y **las tres cosas distintas que colgaban de ese
    evento** — la construcción de los carteles, el arranque de la música y la aparición
    del joystick táctil. Ninguna de las tres se veía desde el `import` del componente. Al
    retirar un componente hay que buscar quién **escucha** lo que despachaba, no sólo
    quién lo importa. Y de las tres, la que muerde es el audio: el click de rol era el
    gesto que el navegador exige para permitir sonido, así que borrar el selector borraba
    el permiso, no sólo el disparador.
52. **La documentación se pudre en silencio y encima con confianza.** Al empezar este
    cambio, CLAUDE.md describía un end-cap (`drawEndcapCanvas`), un banner de llegada
    (`showBanner`/`#ps-banner`), un HUD de RECORDS (`#ps-records`) y farolas cada 9.5u.
    **Ninguna de las cuatro existía en el código**: el end-cap había sido reemplazado por
    el obelisco, las otras tres se habían retirado. El plan de trabajo salió con "hay que
    sacar el banner" adentro. Antes de planificar sobre lo que dice el archivo, `grep` de
    los símbolos que nombra.

53. **Un `prefers-reduced-motion` de más apaga cosas que no son movimiento.** La intro
    del sitio tenía la placa de título y el barrido de cámara colgando de la MISMA
    condición `!reduced`, así que en Windows —donde el ajuste viene encendido de
    fábrica, lección 8— no había ninguna presentación: ni cámara ni título. Se reportó
    como "en el celular se ve y en la compu no", que es cierto pero describe el
    síntoma en el eje equivocado: no era el dispositivo, era el ajuste, y el corte
    pasa por cualquier visitante de escritorio. Antes de poner un `!reduced` delante de
    un bloque, separar qué parte de ese bloque **se mueve**: el ajuste suprime
    movimiento, no contenido.
54. **Una constante que mide otro elemento no se entera cuando ese elemento cambia.**
    `.ps-shell` se dimensionaba con `calc(100svh - 148px)`, y esos 148px eran la
    cabecera completa del build original: franja de título + franja de identidad +
    TabBar + DotRow. La fase 3.19 apagó las tres primeras en `surface="game"` —ahí
    queda SÓLO la franja de identidad— y nadie tocó el `148`, así que desde entonces
    la escena venía corta por la diferencia: **104px en escritorio y 70 en un teléfono
    de 390** (la franja envuelve a dos líneas). Ese sobrante quedaba al pie de `<main>`
    como una banda vacía, y como es del mismo color que el fondo de la escena
    (`--bg-void` = el clear color del renderer) no se leía como "falta espacio" sino
    como **"la imagen está cortada"**, que es exactamente como se reportó. En el
    teléfono no se veía: el joystick es fijo y caía justo encima de la banda muerta.
    Dos cosas: (a) el comentario que estaba ahí —"flex:1 inside min-height parent
    collapses to 0"— era la explicación equivocada; `flex: 1` no colapsaba, lo que
    faltaba era que el shell tuviera una altura **definida** (`height: 100svh` en
    `html[data-surface='game'] .os-shell`) en vez de `min-height`; (b) reemplazar 148
    por el número nuevo habría sido el mismo error otra vez, porque la cabecera no mide
    lo mismo en escritorio que en un teléfono ni en inglés que en español. Si un
    elemento se dimensiona contra otro, que lo mida el layout. `verify:ui` **C17** mide
    la franja REAL (del pie del canvas al pie de `<main>`) en cuatro combinaciones, y
    no la altura del shell, que es justo el número que estaba mal.

55. **Topear el ancho y no el alto no desaprovecha el monitor: lo invierte.** El shell
    tenía `max-width: 1400px`, así que la escena nunca pasaba de 1398px de ancho mientras
    el alto sí crecía con la pantalla. El cuadro se iba poniendo cuadrado (aspecto 1.64 en
    una notebook → **1.00** en 2560), y como el `fov` se deriva del aspecto —horizontal
    fijo en 76°, vertical calculado— se abría para compensar: 52° → 60° → **76°**. Abrir
    el `fov` es alejar la cámara. Medido: **el personaje se veía ×0.63 en un monitor de
    2560 contra una notebook de 1440**. Agrandar el monitor achicaba al personaje, que es
    exactamente al revés de lo que espera cualquiera. Y lo que sobraba iba a las columnas
    de margen, que no tenían tope: 580px por lado en 2560, **1020 en un ultrawide** — el
    59% de la pantalla en lluvia decorativa, con los tres iconos de contacto de 18px
    flotando en el medio de una de ellas.
    Se reportó como tres cosas distintas ("el personaje se ve chiquito", "los links se ven
    perdidos", "que el juego ocupe la pantalla") y era **una sola**: el tope de ancho. Es
    la lección 41 en el otro eje —allá el `fov` vertical fijo sacaba los carteles del
    cuadro en un teléfono, acá el ancho topeado abre el `fov` en un monitor grande— y la
    misma familia que la 54: una constante de layout decidiendo algo que tiene que salir
    de la caja.
    El arreglo va en un solo token, `--chrome-col`, elegido para **no mover nada donde ya
    estaba bien**: debajo de 1400 vale 0 (idéntico a antes), a 1440 vale 20 —que es lo que
    ya medía— y recién desde ~1520 se planta en 60. `verify:ui` **C18** mide las
    propiedades y no la fórmula (repetirla sería tautológico): que la columna no pase de
    60, que el shell se quede con todo el resto, que debajo de 1400 no aparezca ninguna
    columna nueva, y que **el `fov` no crezca al crecer el monitor**, que es lo que de
    verdad se reportó.
