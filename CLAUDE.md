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
- **Vanilla JS** for role selector, keyboard navigation, terminal animation, plain-mode toggle
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
--sand-dim:     #6b7280;   /* labels, meta, inactive UI chrome */

/* Borders */
--ink:          #1c2030;   /* subtle borders */
--ink-mid:      #2a3040;   /* card rims, stronger dividers */

/* Accents — two-tier system */
--accent:       #3d7a64;   /* teal muted — decorative only: ◆ cursor, DotRow, badge borders */
--accent-bright: #5ee7aa;  /* mint — INTERACTIVE ONLY: CTAs, active states, hover highlights */

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
- No pure black (#000); no pure white (#fff)
- Prose: `--font-sans` ≥ 0.8rem; labels/badges/nav: `--font-mono`
- **os-shell border**: `1px solid rgba(94,231,170,0.18)` + `box-shadow` glow — not `var(--border)`
- **Plain mode** (`[data-plain]` on `<html>`): scanlines/grain hidden, `--sand` raised. Toggle in StatusBar, persisted in `localStorage` key `iron-dust-plain`.

---

## File structure (current)

```
src/
  styles/
    tokens.css          # all CSS custom properties + plain-mode overrides
    global.css          # reset, scanlines, grain, Google Fonts, base type, .cta-btn utility
  data/
    projects.ts         # SINGLE SOURCE OF TRUTH for all project content (EN+ES)
  layouts/
    Base.astro          # YoRHa OS chrome — identity strip + AmbientCanvas + margin rain panels
    RoleLayout.astro    # 3-column grid: RoleNav (280px) + <slot /> (1fr) + TerminalWindow (220px)
  components/
    ui/
      AmbientCanvas.astro     # Three.js perspective-grid background (lazy, z-index:0)
      BootScreen.astro        # one-time OS-boot overlay (sessionStorage flag)
      TabBar.astro            # top nav tabs; props: active, lang
      DotRow.astro            # 40-dot animated row
      StatusBar.astro         # bottom bar: hints · CLEAR MODE · lang · CV link
      RoleNav.astro           # left-panel nav for role pages
      ProjectCard.astro       # Death Stranding card + pointer-tilt JS
      TerminalWindow.astro    # animated live-coding terminal panel (role pages only)
      PortfolioScene.astro    # 3D interactive home scene (Three.js city street)
      PersonaSelector.astro   # fullscreen role selector overlay (home pages)
      SceneCanvas.astro       # (legacy — was 9S viewer, superseded by PortfolioScene)
  pages/
    index.astro         # root → redirects to /en/
    en/
      index.astro       # home EN: PortfolioScene + PersonaSelector
      ai/index.astro    # AI Engineer — 6 projects
      risk/index.astro  # Data Analyst — 7 projects
      ds/index.astro    # Data Scientist — placeholder
    es/                 # mirrors EN structure
public/
  models/
    android.glb              # CURRENT: UAL2_Standard.glb (7.8MB, 65 joints, 43 animations)
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

**Zones** (linear street):
| Key | Position | Side |
|---|---|---|
| `risk` | z=−8 | left (x=−7) |
| `ai` | z=−18 | right (x=+7) |
| `ds` | z=−28 | left (x=−7) |

**Character**: `public/models/android.glb` (UAL2_Standard.glb) — fuzzy clip matching:
- Walk: `clips.find(c => /walk/i.test(c.name) && !/zombie/i.test(c.name))`
- Idle: first looping idle found (`Idle_FoldArms_Loop`)

**Material override** (runtime, IRON DUST theme):
```js
_mat.name === 'M_Joints'
  ? MeshStandardMaterial({ color: 0x5ee7aa, emissive: 0x5ee7aa, emissiveIntensity: 1.5 })
  : MeshStandardMaterial({ color: 0x2e3229, roughness: 0.75 })
```

**Project mapping** (frontmatter → JSON → JS via `ps-data` script tag):
```
zoneProjects.risk = [riskProjects[0], riskProjects[1], riskProjects[5], riskProjects[3]]
  → FraudSense AI (hero/projIdx 0), Credit Scoring (projIdx 1), E-commerce Inventory (projIdx 2), SQL Fast Food (panel only)
zoneProjects.ai   = [aiProjects[0], aiProjects[1], aiProjects[2]]
  → Iris (hero/projIdx 0), CV Evaluator (projIdx 1), Hermes (projIdx 2)
zoneProjects.ds   = [] (COMING SOON overlay)
```

**Key systems:**
- WASD + arrow keys (no `prefers-reduced-motion` guard on input, only on visual effects)
- Click billboard → `showPanel(hit.key, hit.projIdx)`; clicks/hover on non-active zones are ignored (`if (activeRole && hit.key !== activeRole) return`)
- `nier:zone` CustomEvent from PersonaSelector → dedupe guard (`if (zone === activeRole) return`), sets `activeRole`, redraws all 9 billboards by REPLACING `material.map` with a fresh `CanvasTexture` (never in-place mutation). `zoneBillRefs` stores `{mesh, edges, borderColor, cvW, cvH, isHero, projIdx}` per billboard
- Billboard states: active zone → role's projects (+ CRT `flickerOn`) · `ds` → COMING SOON · rest → `◆ OFFLINE` ghost
- `scrambleIn(el, text)` — cancel-safe scramble-settle text reveal (replaces old typeOut; stores interval in `el._scrambleTimer`)
- Beacons: additive-blend cylinder pillar per zone (`zoneBeacons`), opacity lerped to `targetBeaconOpacity` in tick; active zone 0.14, rest 0
- Minimap HUD: `#ps-minimap-canvas` (140×190 2D canvas), redrawn every 3rd frame in `tick()` via `drawMinimap()`; hidden in plain mode
- Arrival banner: `#ps-banner` + `.sweep` CSS animation, fired in `onArrival()` via `showBanner(zone)`; text from `bannerFmt` ('ACCESSING :: % RECORDS')
- `returnToCenter()` only closes panel (does NOT teleport character)
- Unit tag: HTML `<div id="unit-tag-hud">` projected via `Vector3.project(camera)` each tick
- Particles: 800 pts, `BufferGeometry`, `pos.setXYZ(i,x,y,z)` + `pos.needsUpdate = true` per tick
- Fog: `FogExp2(0x1b1e1a, 0.018)` — low enough for AI zone (z=−18) to be visible

**Billboard fan cluster per zone (3 meshes each, total 9):**
```js
{ projIdx: 1, dx: -2.5*sign, dz: -0.8, cvW: 576, cvH: 384, hero: false }  // left flank
{ projIdx: 0, dx:  0,        dz:  0,   cvW: 768, cvH: 512, hero: true  }  // center hero
{ projIdx: 2, dx:  2.5*sign, dz: -0.8, cvW: 576, cvH: 384, hero: false }  // right flank
```

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
| Data Scientist | `/ds/` | developing — DS COMING SOON overlay |

`/risk/` slug kept for routing stability.

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
17. **`showPanel(hit.key, projIdx)` vs. `showPanel(activeRole, projIdx)` are different things.** Clicking a hitbox gives the zone's key — not the active role. Non-active-zone clicks are now ignored entirely (`if (activeRole && hit.key !== activeRole) return`).
18. **Multiple event-dispatch fallbacks WILL double-fire — always dedupe in the handler.** PersonaSelector re-dispatches `nier:zone` at 600ms AND PortfolioScene's sessionStorage fallback dispatches at 200ms; both run on every reload. Concurrent `setInterval`/`setTimeout` text animations on the same element interleave characters. Fix: idempotence guard in the handler (`if (zone === activeRole) return`) + cancel-safe animations (store the timer on the element, clear before restarting).

---

## Blender / 3D assets

- **Blender filesystem is Windows** — files go to `C:\...`, accessible at `/mnt/c/...` from WSL2. Always `cp /mnt/c/... public/...` after export.
- **Blender MCP viewport screenshots never work.** Use `bpy.ops.render.render(write_still=True)` → PNG.
- **Blender 5.x animation API** (different from 4.x): `action.slots[0]` → `action.layers[0].strips[0]` → `strip.channelbags.new(slot)` → `.fcurves`

**Assets:**
- `public/models/android.glb` (7.8MB) — **CURRENT**: UAL2_Standard.glb, 65 joints, 43 animations
- `public/models/android_backup.glb` (6.2MB) — **PERMANENT BACKUP**: original 9S Sketchfab, no animations — never overwrite
- `Universal Animation Library 2[Standard].zip` (project root) — CC0, 43 animations, UAL2 rig

---

## Pending from Pablo (content blockers)

- [ ] LinkedIn About/bio text — paste directly (LinkedIn blocks scraping)
- [ ] Data Scientist repos — none assigned yet (`src/data/projects.ts → dsProjects`)
- [ ] CV PDF — place at `public/pablo-lerner-cv.pdf` (button already wired)
- [ ] Desired domain name for Cloudflare Pages
- [x] LinkedIn URL — `https://www.linkedin.com/in/pablo-lerner-591180336`

---

## Content / i18n rules

- Spanish: Rioplatense register (*vos*, native phrasing — never literal translation)
- Technical terms (FastAPI, LangChain, deploy, pipeline) stay in English in both locales
- SEO: locale `es` (not `es-419`); reciprocal `hreflang` tags; canonical self-referencing
