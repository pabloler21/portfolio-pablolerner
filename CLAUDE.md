# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server — http://localhost:4321 (always use this, not npx astro dev --host)
npm run build         # production build → dist/
npm run preview       # serve production build locally
npm run astro check   # TypeScript / Astro type-checking
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
- **Three.js** (lazy-loaded via dynamic import) for ambient background and the 3D interactive home scene
- **i18n:** Astro native, locales `en` (default) and `es`, both prefixed (`/en/…`, `/es/…`)
- **Hosting:** Cloudflare Pages (target)

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
- No pure black (#000); no pure white (#fff)
- Prose: `--font-sans` ≥ 0.8rem; labels/badges/nav: `--font-mono`
- **Button convention (site-wide)**: mono + brackets `[ LABEL ↗ ]` (external) / `[ LABEL → ]` (internal nav). States: hover → mint border+text, `translateY(-1px)` · active → mint fill, `--bg-void` text, `translateY(1px)` · focus-visible → mint outline offset 2px. `.cta-btn` = secondary, `.cta-btn.cta-primary` = mint border always. Tabs are navigation, NOT buttons — no brackets.
- **os-shell border**: `1px solid rgba(94,231,170,0.18)` + `box-shadow` glow — not `var(--border)`
- **Plain mode is GONE.** It existed because the default state failed AA; the default now passes. Never reintroduce `[data-plain]`, `iron-dust-plain` or a legibility toggle — legibility is the default, not a mode.
- **Surface rule** (`surface: 'game' | 'doc'` prop on `Base.astro`, reflected as `<html data-surface>`): atmosphere exists ONLY where the visitor can walk. `doc` gets no AmbientCanvas, no margin rain, no scanlines/grain, no game footer. Default is `'doc'` — a new page is born clean and must ASK for atmosphere.
- **Regla de luz en la escena 3D**: *la luz es del mundo, la interfaz no se ilumina*. Atmósfera (asfalto, veredas, edificios, postes, líneas) → `MeshStandardMaterial`, recibe y proyecta sombra. Información (carteles, end-cap, anillos, chevrons, glows, ventanas, neones, skyline) → `MeshBasic` self-lit, siempre. Es la doctrina de `surface: 'game' | 'doc'` aplicada adentro de la escena.
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
  favicon.svg
  favicon.ico
assets/
  models/
    android_backup.glb       # PERMANENT BACKUP: 9S original — fuera de public/, NO se despliega
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
(`/^walking$/i` → `/walk/i`).

**El personaje conserva SUS materiales.** No hay override de paleta: el que había
(`M_Joints` en mint, el resto en `0x181b22`) pintaba el cuerpo casi del color del fondo
`0x0d0f14` y era la causa de que el personaje desapareciera — la forma quedaba a cargo de
la luz y sólo se veían las articulaciones. Nunca reintroducirlo. **Tampoco lleva luz
propia**: el `PointLight` que colgaba de `charGroup` era una prótesis para un personaje que
vivía en una ciudad de `MeshBasic`. Desde la fase 3.20 lo iluminan la hemisférica, la luna y
las farolas reales, como a todo lo demás.

**Presupuesto de farolas**: pool fijo de 8 `PointLight` creadas una sola vez en
`buildCityDressing()` y reposicionadas a los postes más cercanos cada 4 frames.
**Nunca crear ni destruir luces en runtime.**

**Shadow map**: una sola luz proyecta (`keyLight`). Su cámara ortográfica es una caja de
28u que sigue al personaje, no la avenida entera.

**El GLB viene normalizado** (escala y centrado en su nodo raíz) y el tick pisa
`position`/`rotation` del grupo en cada frame, así que va **envuelto en un `THREE.Group`**:
el wrapper es lo que maneja la escena, el nodo interno conserva su transform.

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
| 3.20 — Mundo PBR | **DONE** | La atmósfera pasa a PBR con sombras y la interfaz queda plana: *la luz es del mundo, la interfaz no se ilumina*. Tone mapping ACES (exposición 1.25, calibración A2), shadow map con cámara que sigue al personaje, pool fijo de 8 farolas con presupuesto rotativo, bloom recalibrado a (0.45, 0.35, 0.62). Se elimina el HDRI de calle empedrada —iluminaba sólo al personaje, con luz de otro mundo— y la luz propia que colgaba de `charGroup`. Deploy −49.3 MB. Arnés a 17/17. Spec: `docs/superpowers/specs/2026-09-06-mundo-pbr-design.md` |
| 4 — About / Contact | **pending** | Career narrative EN+ES, LinkedIn/GitHub/email |
| 5 — Polish | **pending** | Lighthouse, a11y audit, mobile, SEO |
| 6 — Launch | **pending** | Custom domain, Cloudflare Pages deploy |

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
- `assets/models/android_backup.glb` (6.2MB) — **PERMANENT BACKUP**: original 9S Sketchfab, no animations — never overwrite. Vive fuera de `public/` desde la fase 3.20: se conserva en el repo pero no se despliega
- Los otros cinco GLBs (`android.glb`, `android_previous.glb`, `android_pre_bake.glb`, `android_broken_spider.glb`, `320a534d…glb`) se borraron en la fase 3.20 — recuperables del historial de git
- El HDRI `cobblestone_street_night_1k.hdr` se borró en la fase 3.20: iluminaba únicamente al personaje, con luz de una calle real que no es la que se ve
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
34. **Un environment map sobre una escena de `MeshBasic` ilumina exactamente un objeto: el único que usa materiales que reciben luz.** El personaje no estaba mal iluminado, estaba iluminado por otro mundo — un HDRI de calle empedrada real de noche, cargado para él y para nadie más. Antes de retocar un material, preguntarse qué luces lo alcanzan y de dónde vienen.
35. **Cambiar la CANTIDAD de luces de la escena recompila el shader de todos los materiales iluminados.** Un presupuesto dinámico de luces no se implementa creando y destruyendo: se implementa con un pool de tamaño fijo que se reposiciona.
36. **Con `EffectComposer`, `RenderPass` entrega lineal y el tone mapping lo aplica `OutputPass`.** El umbral del bloom se calibra contra la luz de escena, no contra `toneMappingExposure`: subir la exposición no cambia qué objetos hacen bloom.
37. **Un preview descartable puede convertir materiales por `traverse`; el código que queda, no.** La conversión post-hoc es el antipatrón de la lección 17. Para comparar direcciones sobre la escena real sirve un parche temporal por query param que se revierte; para producción, los materiales se construyen desde el origen.
38. **Un timeout fijo en un arnés headless mide la máquina, no el producto.** `shot-scene.mjs` esperaba 26s a que el personaje caminara hasta el primer cartel; la caminata avanza POR FRAME, así que al pasar los materiales a PBR entraron menos frames en esos 26s y las capturas empezaron a salir con el personaje parado en el origen. Esperar por condición observable (`#ps-panel.open`), nunca por reloj.
39. **En SwiftShader el costo dominante de esta escena son los materiales PBR, no las luces ni las sombras.** Medición relativa: main 5.44 fps, PBR completo 2.69 (2.02×). Bajar a 4 farolas da 3.05 y sacar el shadow map da 2.45 — que "sin sombras" mida más lento que "con sombras" acota el ruido en ~10%, así que ninguna de las dos palancas mueve la aguja. Es justo el costo que un rasterizador por software exagera y una GPU absorbe: el número headless **sobreestima** el impacto real. Verificar en GPU antes de degradar la calibración.
