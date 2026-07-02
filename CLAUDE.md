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

- **Always use `npm run dev` with zero extra flags.** This binds to `127.0.0.1` only and goes through WSL2's built-in localhost forwarding → Windows browser reaches it at `http://localhost:4321/`.
- **Never run `npx astro dev --host 0.0.0.0` or `npx astro dev --host <ip>`.** Binding to `0.0.0.0` tells Windows Firewall the process is listening for external connections. Firewall may silently block it, causing `ERR_CONNECTION_REFUSED` on both `localhost:4321` and `192.168.1.33:4321` from the Windows browser. This happened in session and broke the dev server for the rest of the session.
- **Never use `npx astro dev` directly** (with or without flags) — only `npm run dev`. The skill runner has started the server with `--json` and `--host` flags in the past; those modes cause networking issues.
- **If localhost stops working** after a bad server restart: kill the broken process (`pkill -f "astro dev"`), then start fresh with `npm run dev`. If still blocked, check Windows Defender Firewall → "Allow an app through firewall" → Node.js must be checked for both Private and Public.
- **For curl smoke-tests from inside WSL2** (not from Windows browser): use `http://192.168.1.33:4321/` — localhost inside WSL2 does not reach the Windows-forwarded port.
- **Claude Code's own Bash tool gets a fresh, sometimes-broken network namespace per tool call.** A dev server backgrounded in one Bash call (`nohup npm run dev & disown`) can be unreachable (`curl`/Playwright `ERR_CONNECTION_REFUSED`) from a *later, separate* Bash call even though `ps aux`/`ss -tlnp` confirm it's alive and listening. This is independent of the WSL2/Windows-firewall issue above and only matters for Claude's own verification, not for Pablo's real browser. Workaround: always restart the server **and** verify it (curl/Playwright) inside the *same* Bash tool call; never assume a previously-backgrounded server is reachable from a fresh call. `pkill -f "astro.mjs"` is also unsafe here — its own command-line text contains "astro.mjs" and can self-match, killing the calling shell; use `ps aux | grep '[a]stro.mjs' | awk '{print $2}' | xargs -r kill -9` instead.

## Project overview

Personal portfolio for **Pablo** — primary role **Data Analyst**, with adjacent specializations in AI Engineering (LLM systems, RAG, multi-agent) and Data Science. Target audience: AI startups, senior engineers, and founders — skim-first readers. Full phase plan in `PLAN_PORTFOLIO_NIER.md`.

## Stack

- **Astro 7** (static output, TypeScript strict)
- **CSS custom properties** for all theming — no UI library
- **Vanilla JS** for role selector, keyboard navigation, terminal animation, and plain-mode toggle
- **Three.js** (lazy-loaded via dynamic import) for ambient 3D background; `@types/three` as devDep
- **i18n:** Astro native i18n, locales `en` (default) and `es`, both prefixed (`/en/…`, `/es/…`)
- **Hosting:** Cloudflare Pages (target)

## Design system — IRON DUST v2

Inspired by NieR: Automata (YoRHa OS) as the base skin, with Death Stranding card hierarchy and a single bright Cyberpunk-style accent for CTAs. Tokens in `src/styles/tokens.css`.

```css
/* Backgrounds */
--bg-void:      #1b1e1a;   /* main background */
--bg-panel:     #252820;   /* panels, selected rows, active tabs */
--bg-surface:   #2e3229;   /* card hover, lifted surfaces */

/* Text scale */
--sand:         #E8E4D0;   /* body text — high-contrast off-white */
--sand-muted:   #B0AC9C;   /* secondary prose, descriptions */
--sand-dim:     #787668;   /* labels, meta, inactive UI chrome */

/* Borders */
--ink:          #363b30;   /* subtle borders */
--ink-mid:      #4a5044;   /* card rims, stronger dividers */

/* Accents — two-tier system */
--accent:       #8fa882;   /* olive — decorative only: ◆ cursor, DotRow, badge borders, tab underline */
--accent-bright: #5ee7aa;  /* mint — INTERACTIVE ONLY: CTAs, active states, hover highlights */

/* Typography */
--font-display: 'IM Fell English', Georgia, serif;      /* titles, headings */
--font-mono:    'Share Tech Mono', 'Courier New', monospace;  /* UI chrome, labels, badges, meta */
--font-sans:    'Inter', system-ui, sans-serif;          /* prose: project descriptions, body copy */
```

**Hard constraints:**
- Zero `border-radius` anywhere — ever
- Scanlines + animated grain are CSS-only overlays on `body::before` / `body::after`
- `prefers-reduced-motion`: boot screen → `display: none`; stagger reveal → `animation-duration: 0.01s` (instant, not removed — `animation: none` kills `fill-mode` and makes elements immediately visible)
- `--accent` (olive `#8fa882`) used ONLY for decorative elements: `◆` cursor, DotRow dots, badge/tab borders, terminal pip
- `--accent-bright` (mint `#5ee7aa`) used ONLY for interactive elements: CTAs, active/selected states, hover highlights
- No pure black (#000); no pure white (#fff)
- Prose descriptions use `--font-sans` at ≥0.8rem; labels/badges/nav use `--font-mono`
- **Plain mode** (`[data-plain]` on `<html>`): scanlines/grain hidden, `--sand` raised. Toggle in StatusBar, persisted in localStorage key `iron-dust-plain`.

## Actual file structure (Phase 2.7)

```
src/
  styles/
    tokens.css          # all CSS custom properties + plain-mode overrides
    global.css          # reset, scanlines, grain, Google Fonts, base type, .cta-btn utility
  data/
    projects.ts         # ← SINGLE SOURCE OF TRUTH for all project content (EN+ES)
                        #   edit here to update cards across all pages
  layouts/
    Base.astro          # YoRHa OS chrome — identity strip (name + CTAs) + AmbientCanvas mount
                        #   header structure: os-title-row → os-identity → TabBar → DotRow
    RoleLayout.astro    # 3-column grid: RoleNav (280px) + <slot /> (1fr) + TerminalWindow (220px)
                        #   terminal column hidden at < 1024px
  components/
    ui/
      AmbientCanvas.astro   # Three.js perspective-grid background (lazy, z-index:0, all guardrails)
      BootScreen.astro      # one-time OS-boot overlay (sessionStorage flag)
      TabBar.astro          # top nav tabs; props: active (tab id), lang
      DotRow.astro          # 40-dot row; dots animate left-to-right (CSS-only)
      StatusBar.astro       # bottom bar: keyboard hints · CLEAR MODE toggle · lang toggle · CV link
      RoleNav.astro         # left-panel nav for role pages: ◀ TERMINAL back link + 3 role links
      ProjectCard.astro     # Death-Stranding card + pointer-tilt JS (flat fallback on touch/reduced-motion)
      TerminalWindow.astro  # animated live-coding terminal panel (role pages only)
  pages/
    index.astro         # root → redirects to /en/
    en/
      index.astro       # home EN: role selector (DA primary) + full-width detail panel (no terminal)
      ai/index.astro    # AI Engineer — 6 projects from data file
      risk/index.astro  # Data Analyst — 7 projects from data file
      ds/index.astro    # Data Scientist — placeholder
    es/
      index.astro       # home ES: Rioplatense
      ai/index.astro
      risk/index.astro
      ds/index.astro
  content/
    projects/           # (empty — data is in src/data/projects.ts)
public/
  favicon.svg
  favicon.ico
```

## Projects data file

`src/data/projects.ts` is the **only place to edit project content**. All role pages import from it.

```typescript
// Structure of each project entry
{
  id:        string;          // kebab-case unique id
  github:    string;          // GitHub repo URL
  demo?:     string;          // live demo URL (omit if none)
  stack:     readonly string[];
  status:    string;          // EN badge label
  statusEs?: string;          // ES badge label (if different)
  featured?: boolean;         // true → bright accent left border
  en: { name, problem, outcome }  // EN content
  es: { name, problem, outcome }  // ES content
  // problem: one-line "what problem does this solve"
  // outcome: key metric or result ('' to hide the metric row)
}
```

Exported arrays: `aiProjects`, `riskProjects`, `dsProjects` (empty pending Pablo's DS repos).

## ProjectCard component

`src/components/ui/ProjectCard.astro` — Death Stranding-style hierarchy.

Props:
```ts
{
  name: string;
  desc: string;       // one-line problem statement (mapped from project.en/es.problem)
  outcome?: string;   // key metric / result — shown in accent-bright color with ◆ prefix
  stack: readonly string[];
  status: string;
  featured?: boolean;
  github: string;
  demo?: string;
}
```

Card anatomy (top to bottom):
1. Top bar: `[STATUS BADGE]` left · `[LIVE DEMO ↗]` + `[CODE ↗]` right
2. `card-name` — monospace, 0.88rem, `--sand`
3. `card-desc` — Inter sans, 0.825rem, `--sand-muted`, line-height 1.6
4. `card-outcome` — monospace, `--accent-bright`, with ◆ pip (hidden if `outcome` is undefined)
5. `card-stack` — tiny tag pills, `--sand-dim`

Hover: `translateY(-2px)` + `bg-surface` + `border-color: ink-mid`.
Featured hover: bright left border stays `accent-bright`.
Pointer tilt (desktop only): `perspective(800px) rotateX/Y(±7°)` via JS. Disabled on touch, reduced-motion, or plain mode.

## TerminalWindow component

`src/components/ui/TerminalWindow.astro` — ambient live-coding terminal panel. Present on **role pages only** (not home page).

Props: `title: string`, `lines: readonly string[]`

Animation: commands (`$`, `>>>`) → 45–80ms/char + 520ms pause; output → 8–18ms/char + 80ms pause; 2.2s restart pause; random 500–2300ms stagger between instances. `prefers-reduced-motion`: shows final state instantly, cursor blink disabled.

Terminal content per role (defined in `RoleLayout.astro`):
- `ai` → `PROC::AGENT_RUNTIME`: LangChain agent code + tool reasoning output
- `risk` → `PROC::DATA_PIPELINE`: psql session + fraud query results
- `ds` → `PROC::ML_PIPELINE`: sklearn Pipeline + GradientBoosting training epochs

## Base.astro header structure

```
┌────────────────────────────────────────────────────────────┐
│  UNIT::PL-7729  ·  [page title]  ·  SYS:OK · EN          │  ← os-title-row (micro-text flavor)
├────────────────────────────────────────────────────────────┤
│  Pablo Lerner · Data Analyst & AI Engineer — from raw data…  [GH] [LI] [✉] [CV↓] │  ← os-identity (hero strip)
├────────────────────────────────────────────────────────────┤
│  ⬡ PROFILE  ⬡ PROJECTS  ⬡ SKILLS  ⬡ ABOUT  ⬡ CONTACT    │  ← TabBar
├────────────────────────────────────────────────────────────┤
│  ● ● ● ● ● ● ● ● ● ● ●  (40 animated dots)               │  ← DotRow
└────────────────────────────────────────────────────────────┘
```

## Home page structure (role selector)

Two-panel layout: `280px` left + `1fr` right (no terminal column — full width for content).

- Role order: **DATA ANALYST** (first, default, [PRIMARY] tag) → AI ENGINEER → DATA SCIENTIST
- Active role button: `border-left: 2px solid --accent-bright` + `--sand` text
- Hover: `border-left: 2px solid --accent` + `--bg-panel`
- Detail panels use `.hidden` class; `aria-live="polite"` on `.detail-area`
- Each role has `#detail-{role}` div with: header + badge + stats table + 4-item preview list + access button
- Access button and badge: `--accent-bright` (primary) or `--accent` (secondary)

## StatusBar — plain mode toggle

The `[CLEAR MODE]` button in StatusBar toggles `data-plain` attribute on `<html>`:
- Hides scanlines + grain (`display: none` on `body::before/after`)
- Raises `--sand` to `#F2EFE2`
- Persisted in `localStorage` key `iron-dust-plain`
- Restored before paint (no flash) via inline script in StatusBar

## Stagger reveal animation (home pages)

Pure CSS, no JS event needed. `animation: fade-in-up 0.28s ease both` with staggered delays.

- **Return visit**: delays 0.05s → 0.54s
- **First visit** (`html.first-boot` from BootScreen): delays 3.2s → 3.72s
- `prefers-reduced-motion`: `animation-duration: 0.01s !important` — **never** `animation: none`

## Three roles

| Role | URL slug | Primary |
|---|---|---|
| Data Analyst | `/risk/` | **YES — primary positioning** |
| AI Engineer | `/ai/` | specialization |
| Data Scientist | `/ds/` | developing |

Note: `/risk/` slug kept for routing stability (changing requires redirect config).

## 3D depth system (Phase 2.7)

### AmbientCanvas component

`src/components/ui/AmbientCanvas.astro` — full-viewport Three.js background, injected into `Base.astro` before `.os-shell` (z-index: 0; content at z-index: 1).

**Style:** Two overlaid `GridHelper` planes seen at a shallow downward camera angle — a dim tactical-display grid in `--ink` / `--ink-mid` colors, `opacity: 0.5`. Barely visible; adds sci-fi depth without competing with text.

**Loading:** Dynamic `import('three')` inside a Vite-processed `<script>` → separate 708KB chunk (`three.module.*.js`). Initialization deferred to `requestIdleCallback` (fallback: `setTimeout 500ms`). Content renders and is interactive before Three.js loads.

**Guardrails (all wired):**
- `prefers-reduced-motion` → skip init, `canvas.hidden = true`
- `(hover: none)` media → skip init (touch devices)
- `window.innerWidth < 768` → skip init (mobile)
- WebGL unavailable → silent `return` after `getContext()` null check
- `[data-plain]` → `MutationObserver` on `<html>` toggles `canvas.hidden` in real-time
- Tab hidden / offscreen → `visibilitychange` + `IntersectionObserver` → skip render tick
- Pixel ratio capped at 2; `renderer.setClearColor(0x000000, 0)` (transparent, CSS background shows through)

**Parallax:** `pointermove` → lerped camera rotation ±0.05 rad Y, ±0.025 rad X (4% per frame).

### Card tilt

`src/components/ui/ProjectCard.astro` — `pointermove` listener applies `perspective(800px) rotateX/Y(±7°)`. Disables transform transition during move (instant tracking), restores on `pointerleave` (smooth CSS return). Skips on `prefers-reduced-motion`, `(hover:none)`, or `[data-plain]` active.

### Phase 2 hero placeholder

Instructions for adding a hero 3D object are in `AmbientCanvas.astro` at the top comment block (search `PHASE 2 HERO`). Short version: create `Hero3D.astro`, use its own renderer inside `.os-identity`, same lazy-load + guardrail pattern.

## Phase status

| Phase | Status | Deliverable |
|---|---|---|
| 0 — Foundation | **DONE** | Astro scaffold, IRON DUST theme, boot screen, role selector stub |
| 1 — Navigation + Animation | **DONE** | Role pages, RoleNav, RoleLayout, stagger reveal, DotRow |
| 2 — Project cards | **DONE** | 13 real projects as ProjectCard components |
| 2.5 — Terminal windows | **DONE** | TerminalWindow component, role-page ambient terminals |
| 2.6 — UX/UI Overhaul | **DONE** | Legibility, identity strip, DA-primary, data file, card redesign, plain mode, micro-interactions |
| 2.7 — 3D depth | **DONE** | Ambient perspective-grid background (Three.js island), card pointer-tilt, all guardrails wired |
| 2.8 — Character viewer | **DONE** | Real 9S Sketchfab model in SceneCanvas, slow auto-rotation + pointer tracking |
| 3 — 3D Interactive World | **DONE** | City street, WASD, billboards, PersonaSelector, particles, vignette, panel redesign |
| 3.6 — WASD + Billboards + Typewriter | **DONE** | WASD movement, billboards at street level, typewriter panel, click-billboard-direct |
| 3.7 — Animation fix | **DONE** | UAL2_Standard.glb (from zip in project root) — 65 joints, Walk_Carry_Loop + Idle_FoldArms_Loop, IRON DUST materials |
| 3.9 — PersonaSelector redesign + legibility | **DONE** | DATA ANALYST/AI ENGINEER/DATA SCIENTIST roles; DS COMING SOON overlay; fog fix; panel legibility |
| 3.10 — Visual Polish | **DONE** | Particles (800 pts), HTML unit tag overlay, panel hero/compact redesign, vignette, billboard font fix, zone label dim/bright |
| 4 — About / Contact | pending | Career narrative (EN + ES), LinkedIn/GitHub/email |
| 5 — Polish | pending | Lighthouse, a11y audit, mobile, SEO |
| 6 — Launch | pending | Custom domain, Cloudflare Pages deploy |

## Phase 2.8 — Character viewer (COMPLETED 2026-06-30)

### Final state

- `src/components/ui/SceneCanvas.astro` — wired into EN+ES home pages (left panel, 280px wide × 280px tall)
- `public/models/android.glb` — See Phase 2.8 assets section. Note: `android.glb` has since been overwritten by Phase 3.1/3.6 work and is now the broken Rigify model (spider pose). The original clean Sketchfab model is `android_backup.glb` (6.2MB). Materials: Wet_CLT, Wet_PBS, Wet_Hair, PL0200_Skin, Wet_Eyelash, PL_0000_Eye1, Wet_Skin. No animations.
- `public/models/320a534d668f46859f4f61579e3ef4ad.glb` — original Sketchfab download (3 versions, 13MB), keep as backup
- SceneCanvas uses: slow auto-rotation (0.003 rad/frame) + pointer tracking (±0.3 rad), no animation mixer
- Lighting: ambient 0xb0ac9c + warm key + mint rim `#5ee7aa` + soft fill
- Camera: FOV 32, position (0.3, 1.10, 2.2), lookAt (0, 0.95, 0)

### Known permanent constraints

1. **`astro dev` always starts with `--json` flag** via npm run dev background launch. HTTP still works (200). Only breaks if `--host 0.0.0.0` is also added.
2. **Blender filesystem is Windows** — files written by Blender go to `C:\...`, accessible from WSL2 at `/mnt/c/...`. Always `cp /mnt/c/home/pablo/projects/... public/...` after export.
3. **Blender MCP viewport screenshots** never work. Use `bpy.ops.render.render(write_still=True)` to PNG, then copy from Windows path.
4. **9S Sketchfab rig is incompatible with direct FCurve copy from UAL2.** The Sketchfab rig uses 3dsMax Biped convention (111 bones, `bip_pelvis_108` naming) with bone axes that don't match UAL2's Unreal Engine convention (65 bones, Y-along-bone). FCurve copy produces visually broken poses in Three.js even if it renders correctly in Blender. **Decision: use Rigify Human meta-rig** — fit it to 9S body, transfer weights from old rig, retarget UAL2 to Rigify DEF bones. Rigify and UAL2 share compatible axis conventions.

### Assets available

- `Universal Animation Library 2[Standard].zip` (project root) — CC0, 43 animations, UAL2 rig (65 bones, UE convention). Key animations: `Walk_Carry_Loop` (48fr), `Idle_No_Loop` (60fr), `Idle_Rail_Loop`, `Zombie_Walk_Fwd_Loop`.
- `public/models/android_backup.glb` (6.2MB) — original 9S Sketchfab model, 111-bone Biped rig, NO animations. **Permanent backup — never overwrite.**
- `public/models/android_pre_bake.glb` (6.3MB) — Rigify DEF armature + 9S meshes + 2-frame static animations (constraints disabled but FCurves are UAL2 values in wrong bone space). Pre-bake backup.
- `public/models/android_previous.glb` (7.9MB) — older broken version, keep as reference.
- `public/models/android.glb` (7.8MB) — **CURRENT AND WORKING.** Is `UAL2_Standard.glb` — 65 joints, 43 pre-baked animations (Walk_Carry_Loop + Idle_FoldArms_Loop used). IRON DUST materials applied at runtime in Three.js.
- `public/models/android_broken_spider.glb` (7.0MB) — broken Rigify model with spider pose animations (backup only).
- `C:\Users\pablo\projects\portfolio-blender\android_rigify_final.blend` — Blender source with Rigify rig + broken animations
- Blender 5.1.2 has Rigify add-on enabled

## Phase 3 — 3D Interactive World (planning as of 2026-06-30)

### Concept

Replace the current 2D role-selector home page with a **3D interactive diorama** where:
- A 3D scene (isometric or third-person) shows three zones (DA / AI / DS)
- The 9S character stands/walks in the scene
- Clicking a zone navigates to that role's project view
- Projects appear as 3D panels or floating cards in the scene

### Three design options (see `/en/concept/` for live prototypes)

**Option A — Isometric Diorama (recommended)**
- Fixed isometric camera, Three.js scene with 3 floor zones
- Character stands center, zones labeled with role names
- Click zone → camera smooth pans to that area → project cards appear
- Assets: Kenney.nl CC0 building/office blocks, UAL2 idle animation
- Estimated scope: 3–4 weeks

**Option B — Third-person exploration**
- Player controls character with click-to-move or WASD
- Zones are rooms in a YoRHa-style base
- Walking to a zone triggers project display
- Assets: Quaternius CC0 dungeon/sci-fi rooms, UAL2 walk cycle
- Estimated scope: 2–3 months

**Option C — 2.5D parallax side-scroll**
- Character auto-runs left to right through layered scene
- Scroll position reveals zones
- Fastest to build, works perfectly on mobile
- Assets: CSS layers + character sprite or small 3D scene
- Estimated scope: 1–2 weeks

### Free asset sources for Phase 3

| Source | What | License | Format |
|---|---|---|---|
| kenney.nl | City, office, space, dungeon blocks | CC0 | GLB/FBX |
| quaternius.com | Characters + environments | CC0 | GLB |
| UAL2 (have it) | 43 animations (walk, run, idle) | CC0 | GLB |
| polyhaven.com | HDRIs, textures, some models | CC0 | GLB |
| mixamo.com | Animations for humanoid rigs | Free (Adobe) | FBX |

### Decision made: Hybrid B

Pablo chose **Option B aesthetic + Option A interaction** (2026-06-30):
- Third-person camera follows character
- User clicks a zone → character walks there automatically (no WASD)
- Camera follows with lag
- Project panels slide in from right on arrival
- Mobile: 2D fallback (existing role menu)

### Current implementation state (Phase 3.3 — DONE, rendering verified)

**Done:**
- `src/components/ui/PortfolioScene.astro` — main component created
- `src/pages/en/index.astro` — replaced with `<PortfolioScene lang="en" />`
- Scene logic complete: movement lerp, camera follow, zone triggers, project panel HTML
- Concept prototypes at `/en/concept/` (all 3 options, interactive Three.js)
- Black-canvas bug fully resolved (three stacked root causes, see below) — verified via headless-browser screenshot: zone pads/pillars/labels/character all visible, click → walk → camera follow → arrival → panel-with-cards confirmed working end to end

**Black-canvas bug — root cause (three separate bugs stacked):**

1. **CSS height collapse** — `flex: 1` resolves to 0 height when the ancestor uses `min-height` instead of `height`. Fixed with explicit `height: calc(100svh - 148px)` on `.ps-shell` (`100svh` avoids mobile browser-chrome resize jitter).
2. **`define:vars` blocks Vite bundling** — `<script define:vars={{...}}>` forces Astro to mark the script `is:inline`, which skips Vite processing entirely. `await import('three')` then fails in-browser with "Failed to resolve module specifier 'three'", silently aborting `init()`. Fixed by moving server data into a separate `<script type="application/json" id="ps-data" set:html={...}>` island and reading it via `JSON.parse(document.getElementById('ps-data').textContent)` inside a plain (Vite-processed) `<script>`.
3. **The real blocker — WebGL double-`getContext()` on the real canvas, but in `AmbientCanvas.astro`, not `PortfolioScene.astro`.** `AmbientCanvas` (mounted globally in `Base.astro`, runs on every page) called `canvas.getContext('webgl')` directly on its own real `#ambient-canvas` as a capability probe, then `new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })` tried to get a context on that *same* canvas with *different* attributes. Per the HTML Canvas spec, a second `getContext()` call with mismatched attributes throws/returns null — manifesting as `THREE.WebGLRenderer: Canvas has an existing context of a different type`. This error looked like it belonged to `PortfolioScene`'s `#ps-canvas` (same console, same page load) but didn't — `#ps-canvas` itself was sized and rendering correctly the whole time. `SceneCanvas.astro` (used on `/es/`) had the identical anti-pattern. **Fixed in both** by probing on a throwaway `document.createElement('canvas')` instead of the real one — same pattern already used in `PortfolioScene.astro`.

**Verification method used:** headless Chromium via Playwright (no root/sudo available in this environment — got shared libs via `apt-get download <pkg>` + `dpkg-deb -x` into a local dir, then `LD_LIBRARY_PATH` pointed at it). Confirms this sandbox's Bash tool gets a fresh, often-broken network namespace per tool call — `curl`/`page.goto` to `127.0.0.1:4321` fails unpredictably unless the dev-server restart and the verification request happen **in the same Bash call**. Always restart + verify together; never assume a server backgrounded in a prior call is reachable from a new one.

**Known pattern — always measure canvas AFTER Three.js import, probe WebGL on a throwaway canvas, never the real one:**
```js
const probe = document.createElement('canvas');           // never canvas.getContext() on the real element
if (!probe.getContext('webgl2') && !probe.getContext('webgl')) { /* fallback */ }
const THREE = await import('three');                      // import first
const W = Math.max(shell.clientWidth, 400);                // THEN measure
const H = Math.max(shell.clientHeight, 400);                // guaranteed computed by now
const renderer = new THREE.WebGLRenderer({ canvas, ... }); // first real getContext() call on the real canvas
```

**Scene goals — all confirmed working:**
1. Dark floor with ink grid visible
2. Three glowing zone pads: mint (DA), olive (AI), dim grey (DS)
3. Bright edge lines on pad borders
4. Corner pillars with zone-color emissive glow
5. Floating zone labels (Sprite with CanvasTexture)
6. Character visible at center — real 9S model with Rigify animations
7. Click zone → character walks there with Walk_Loop animation, transitions to Idle_Loop on arrival
8. Third-person camera with lag follows character
9. Project panel slides in from right on arrival
10. Mobile: 2D fallback with direct links

**Phase 3.5 and 3.6 have been completed.** `es/index.astro` mirrored to PortfolioScene. Next: Phase 3.7 — fix animation (spider pose) via Quaternius character replacement.

### Phase 3.1 — COMPLETED 2026-07-01 (what was done and how)

**Why Rigify instead of direct FCurve copy (Phase 3.1 rationale — later proved wrong):**
FCurve copy from UAL2 (UE convention) to Sketchfab 9S rig (3dsMax Biped) produces broken poses — bone local axes incompatible. Decision was to try Rigify DEF bones instead, assuming they'd share UAL2's Y-along-bone convention. **This assumption proved incorrect in Phase 3.6** — Rigify DEF bones also have different rest orientations from UAL2, producing spider pose. See Spider Pose Crisis section.

**What actually happened (two-agent pipeline):**

Agent 1 (blender -b, background mode) ran the full pipeline producing `android_rigify_final.blend`:
1. Imported `android_backup.glb` → renamed armature to `old_armature`
2. Added Rigify Human meta-rig, scaled to 0.406x to match 9S proportions, generated `rig` (706 bones)
3. Renamed vertex groups on all 15 meshes from old bone names → DEF- names; swapped Armature modifier target to `rig`
4. Imported UAL2, retargeted `Walk_Carry_Loop` → `Walk_Loop` and `Idle_No_Loop` → `Idle_Loop` using FCurve copy (Blender 5.x API: `action.slots[0]` → `action.layers[0].strips[0]` → `strip.channelbags.new(slot)`)
5. Exported `android.glb` — but with 707 bones and cloth/hair VGs unmapped → cone deformation

Agent 2 (Blender MCP, this session) fixed the exported blend:
1. Loaded `android_rigify_final.blend`, identified 20 cloth/hair VGs per mesh with actual weights, 0 matching bones in rig
2. Remapped each cloth/hair VG to nearest DEF bone by vertex centroid proximity (Python)
3. Deleted 570 orphaned VGs (`bone91_0`, `GLTF_created_0_rootJoint`, `bip_finger43_L`, etc.)
4. Re-exported with `export_def_bones=True` → 161 joints (down from 707), animations baked by exporter (Rigify constraints → sampled keyframes, normal)

**UAL2 → Rigify DEF bone name mapping (key joints):**
```
pelvis       → DEF-pelvis
spine_01     → DEF-spine
spine_02     → DEF-spine.001
spine_03     → DEF-chest
neck_01      → DEF-neck
Head         → DEF-head
clavicle_l   → DEF-shoulder.L
upperarm_l   → DEF-upper_arm.L
lowerarm_l   → DEF-forearm.L
hand_l       → DEF-hand.L
thigh_l      → DEF-thigh.L
calf_l       → DEF-shin.L
foot_l       → DEF-foot.L
ball_l       → DEF-toe.L
(mirror R)
```

**Blender 5.x animation API (critical — different from 4.x):**
```python
# Actions use slots → layers → strips → channelbags (NOT action.fcurves)
slot = action.slots[0]
strip = action.layers[0].strips[0]
channelbag = strip.channelbag(slot)           # returns None for NEW actions
channelbag = strip.channelbags.new(slot)      # use this to CREATE a channelbag
fcurves = strip.channelbag(slot).fcurves      # then this works
```

**Errors made in Phase 3.1:**
- First attempted direct FCurve copy from UAL2 → Sketchfab Biped rig → visually broken in Three.js (wrong bone axis convention). 2 sessions wasted before switching to Rigify.
- Tried to modify meta-rig individual bone positions AND set `use_connect = True` → Rigify generation failed ("Cannot connect chain - bone position is disjoint"). Fix: apply only uniform scale to meta-rig, never touch individual bone positions.
- Tried to use Data Transfer modifier for weight transfer → "disabled, skipping apply" error. Fix: rename vertex groups directly in Python + swap armature modifier target.
- Agent 1 exported with all 707 bones including MCH/ORG/WGT controls → cloth/hair VGs left unmapped → cone deformation in Three.js. Fix: `export_def_bones=True` + remap orphaned VGs before export.

### Phase 3.1 — COMPLETED 2026-07-01 (but animation broken post-session)

- `public/models/android.glb` was 6.3MB at completion, now 7.0MB after bake attempts in Phase 3.6 session
- 161 skin joints (160 DEF + root), all control/MCH/ORG/WGT bones excluded via `export_def_bones=True`
- Cloth/hair VGs (20 per mesh) remapped to nearest DEF bone; 570 orphaned VGs cleaned
- **Animations are broken** — FCurve-copied UAL2 quaternions in wrong Rigify DEF bone space → spider pose. See Spider Pose Crisis section.
- The rig and mesh quality is fine; only the animation data is bad.

### Lessons learned — mistakes to avoid next time

7. **UAL2 quaternions CANNOT be FCurve-copied to Rigify DEF bones.** The rest pose orientations are incompatible (UE convention vs Rigify convention). The correct Rigify retargeting workflow targets FK *control* bones, not DEF bones — constraints then propagate. Alternatively: bake on FK controls, then export. Going DEF→DEF always produces spider pose regardless of bake settings.
8. **`prefers-reduced-motion` is ON by default in Windows accessibility settings** — this affects any guard like `const wsadOn = !reduced && (...)`. Pablo's Windows machine had it active, so WASD was silently disabled. Fix: only apply `reduced` guard to visual animations, never to user input.
9. **"It baked 49 frames" ≠ "the animation is correct".** The bake producing real frame data proves the *process* worked, not that the *data is valid*. A spider-pose animation has correct frame counts and proper GLB structure — you can only detect it visually, not from file size or sampler counts.

1. **An error in the console doesn't belong to the file you're staring at.** The "Canvas has an existing context of a different type" error kept getting attributed to `PortfolioScene.astro` because that's what was being edited — it actually came from `AmbientCanvas.astro`, a sibling component mounted globally that had the *same* anti-pattern already fixed once in `PortfolioScene`. Lesson: when a fix doesn't change a symptom, check whether another component sharing the same page has the identical bug, instead of re-auditing the file already fixed.
2. **Don't clear `node_modules/.vite` mid-debug unless you mean to.** Doing so forces Vite's dep-optimizer to re-scan/re-bundle on the next request, causing automatic page reloads with transient `504 Outdated Optimize Dep` / `net::ERR_ABORTED` noise that can look like a real bug in a diagnostic capture. Let the dep cache stay warm between test runs.
3. **Headless/software-rendered WebGL (Playwright with no GPU, e.g. SwiftShader) runs `requestAnimationFrame` far slower than a real browser.** A movement-lerp animation that converges in ~2s on real hardware took ~20s of wall-clock time in headless verification. A short wait (`waitForTimeout(2500)`) falsely looked like the click-to-navigate flow was broken. Always wait generously (15–20s) before concluding a time-based interaction failed in headless testing.
4. **Bash tool network namespace** and **`pkill -f` self-match** — see the "WSL2 networking" section at the top of this file; both bit this session repeatedly.
5. **Playwright headless needs manual lib install.** The `chromium_headless_shell` in `~/.cache/ms-playwright/` requires `libnspr4`, `libnss3`, `libasound2` which are missing in WSL2. Install via: `cd /tmp/chrome-libs && apt-get download libnspr4 libnss3 libasound2t64 && dpkg-deb -x *.deb .`, then set `LD_LIBRARY_PATH=/tmp/chrome-libs/usr/lib/x86_64-linux-gnu`. The playwright module is at `/home/pablo/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`. Full pattern: `export LD_LIBRARY_PATH=...; node -e "const {chromium}=require('/home/pablo/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'); chromium.launch({executablePath:'~/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell', args:['--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader']})"`.
6. **Orphaned vertex groups in GLB cause cone/triangle deformations.** When an armature modifier is swapped (old rig → new rig) via vertex group renaming, any VG with weight that has no matching bone in the new rig leaves vertices with undefined deformation. Fix: for each orphaned VG, find the nearest DEF bone by vertex position and merge the weight into it. Also verify with `ldd` that the exported GLB bone count is reasonable for Three.js (<256 for uniform skinning, unlimited for texture skinning).

## Phase 3.5 — City Street Overhaul (COMPLETED 2026-07-01)

### What was built

**PersonaSelector** (`src/components/ui/PersonaSelector.astro`):
- Fullscreen overlay, appears once per session (`sessionStorage('nier-persona')`)
- 3 options: **DATA ANALYST** (zone: `risk`) / **AI ENGINEER** (zone: `ai`) / **DATA SCIENTIST** (zone: `ds`)
- On click: stores zone key in sessionStorage + dispatches `window.dispatchEvent(new CustomEvent('nier:zone', { detail: { zone } }))` + fade out
- On reload (already chosen): overlay skipped, event re-dispatched after 600ms delay
- DS → shows COMING SOON overlay (not the 3D scene zone)
- Accepts `lang` prop; ES labels: ANALISTA DE DATOS / INGENIERO DE IA / CIENTÍFICO DE DATOS
- No border-radius. Keyboard nav (arrows + enter). Mounted in `en/index.astro` and `es/index.astro` as `<PersonaSelector lang={lang} />`.

**PortfolioScene overhaul** (`src/components/ui/PortfolioScene.astro`):
- ZONES redefined as linear street: `risk(-7, -8, left)`, `ai(7, -18, right)`, `ds(-7, -28, left)`. Keys `risk/ai/ds` intact — panel and navigateTo() unchanged.
- `buildStreet()`: asphalt floor `PlaneGeometry(22,80)` + sidewalks (x=±11) + lane dashes every 9 units + 5 buildings/side with `EdgesGeometry` + emissive windows (deterministic 60% on, `PlaneGeometry(0.55,0.38)` facing street)
- `buildBillboard()` per zone: pole `CylinderGeometry(0.07,0.07,9)` at y=4.5 → frame `BoxGeometry(5.2,3,0.12)` at y=9.5 + EdgesGeometry (zone color) + CanvasTexture 512×320 with project data (name, outcome, CTA) + transparent hitbox `PlaneGeometry(5.2,3)` for raycaster + `PointLight` with zone color
- Fog: `FogExp2(0x1b1e1a, 0.038)`. Lighting: `HemisphereLight(0x2e3229, 0x1b1e1a, 0.9)` + `DirectionalLight(0xb0ac9c, 0.7)` + `AmbientLight(0x252820, 0.5)`
- Camera: `position(0, 4.5, 12)` → `lookAt(0, 2, -5)`. Follow: `camTgtX*0.3, 4.0, camTgtZ+9`
- HDRI: `loadHDRI()` via `requestIdleCallback`, `RGBELoader` from `three/addons`, `scene.environment` only (no background)
- HUD hint: "CLICK BILLBOARD TO NAVIGATE"
- `navigateTo()` offset changed from 2.2 → 3.5

**HDRI asset**: `public/hdri/cobblestone_street_night_1k.hdr` (1.7MB, downloaded via Polyhaven Blender MCP)

**ES mirror**: `es/index.astro` replaced old 2D SceneCanvas selector → now uses `PortfolioScene lang="es"` + PersonaSelector (same as EN)

### Critical bug fixed this session

**`visible: false` prevents raycasting in Three.js** — hitbox meshes for billboards initially used `MeshBasicMaterial({ visible: false })`. Three.js Raycaster skips objects with `visible === false`. Fixed to `{ transparent: true, opacity: 0, depthWrite: false }`.

### Issues resolved in Phase 3.6

1. ~~T-pose~~ — **Resolved in code**: fuzzy clip matching now used. BUT android.glb itself is broken (spider pose) — see Spider Pose Crisis section.
2. ~~Billboards too high~~ — **Fixed**: frame now at y=4.5, pole height 5.
3. ~~No free movement~~ — **Fixed**: WASD + arrow keys implemented.
4. ~~Panel text instant~~ — **Fixed**: typewriter effect at 28ms/char (title) and 18ms/char (card names).

### Remaining issue (Phase 3.7)

**Spider pose animation** — android.glb shows extreme limb deformation. Requires character replacement or animation retarget fix. See Spider Pose Crisis section.

## Phase 3.6 — WASD + Billboards + Typewriter (COMPLETED 2026-07-01)

### What was implemented

All changes are in `src/components/ui/PortfolioScene.astro`.

- **WASD movement**: `const keys = {}; const WALK_SPEED = 0.1;` in shared state; keydown/keyup listeners scoped to `WASD_CODES` in `init()`; movement block in `tick()` — WASD takes priority, cancels click-target. **Critical: removed `!reduced` guard from `wsadOn`** — Windows has `prefers-reduced-motion` enabled by default in accessibility settings, which blocked WASD entirely in testing.
- **Billboard heights**: pole `CylinderGeometry(0.07,0.07,5)` at `y=2.5`; frame/texture/hitbox at `y=4.5`; label sprite at `y=7.0`; `PointLight` at `y=5.0`. Bills now at street/eye level from camera at y=4.0.
- **Typewriter**: `typeOut(el, text, msPerChar)` helper added before `showPanel()`; panel title at 28ms/char; card-name at 18ms/char with 120ms stagger per card; cards fade in with `opacity: 0 → 1` CSS transition.
- **Click billboard → panel direct**: `onCanvasClick` now calls `showPanel(zone)` instead of `navigateTo(zone)`.
- **HUD hint**: `'WASD TO WALK · CLICK BILLBOARD'` / `'WASD PARA CAMINAR · CLICK CARTEL'`

### Animation state (BROKEN — spider pose)

`G1` (T-pose fix) used `clips.find(c => c.name.toLowerCase().includes('walk'))` — this finds the clips, and the mixer is active. BUT the animations themselves are broken (spider pose). The code is correct; the GLB data is wrong. See **Spider Pose Crisis** section below.

---

## Spider Pose Crisis — Root Cause + Fix Plan (Phase 3.7)

### What the problem is

`public/models/android.glb` — the character renders in a "spider/bat" pose: arms and legs extended at extreme angles forming a huge X shape, with mesh severely stretched. This happens both in Blender viewport AND in Three.js browser.

### Root cause

UAL2 (Universal Animation Library 2) stores animation rotations as quaternions in **local bone space using Unreal Engine convention** (Y-along-bone, specific rest orientations). Rigify DEF bones have **different rest pose orientations** — different bone roll values, different parent chain orientations. When the same quaternion value is applied to a bone with a different rest pose, the resulting world-space rotation is completely wrong.

This is NOT a bake flag issue, NOT a constraints issue, NOT a Three.js issue. The FCurve data itself is invalid for the target skeleton.

**What was tried (failed):**
1. `bpy.ops.nla.bake(visual_keying=True, clear_constraints=True)` with constraints pre-disabled → baked visual pose (rest pose) → 2-frame static T-pose → android_pre_bake.glb
2. FCurve copy from UAL2 DEF bones → Rigify DEF bones → spider pose → android.glb (current broken)
3. Multiple bake variations — all produce either T-pose or spider pose

### Three options (analyzed)

| Option | Risk | Time | Description |
|---|---|---|---|
| **A — Rigify FK control bones** | Medium | 4–8h | Retarget UAL2 to Rigify FK control bones (not DEF) — the correct Rigify workflow. Constraints propagate to DEF bones. High risk of silently wrong math across 161-bone chain. |
| **B — Delta matrix correction** | High | 8–16h | Compute rest-pose delta matrix per bone, transform quaternions. One error in chain breaks everything. |
| **C — Quaternius CC0 replacement** | **Low** | 1–2h | Download pre-animated humanoid from quaternius.com, wire into existing AnimationMixer code. Guaranteed working. Different aesthetic. |

### Recommended plan (Phase 3.7) — Option C: Quaternius replacement

1. **Pablo downloads** a Quaternius CC0 animated humanoid (walk + idle, GLB) from quaternius.com — or gives permission to auto-download
2. **Verify**: joint count ≤ 128 (mobile GPU limit), animation clip names contain "walk" and "idle"
3. **Replace** `public/models/android.glb` with the Quaternius model
4. **Adjust materials** in Three.js: `MeshStandardMaterial` override — body `#2e3229`, accent emissive `#5ee7aa`, visor `#0a0c0a`
5. **Camera + scale**: adjust character scale and camera position for new model height
6. **Build + visual confirmation**: idle on load, walk animation with WASD

The existing `PortfolioScene.astro` AnimationMixer code already uses fuzzy name matching (`clips.find(c => c.name.toLowerCase().includes('walk'))`), so it works with any clip names. Zero JS changes needed unless the Quaternius model scale is very different from ~1.75m.

### Alternative if Pablo wants to keep 9S

Use Mixamo: upload `android_backup.glb` (the Sketchfab original with Biped rig) to mixamo.com, apply walk + idle animations there, download as FBX, import into Blender, re-export as GLB. Mixamo handles Biped rigs natively and produces working animations. Risk: Mixamo may not accept the 111-bone Biped rig without Auto-Rigging.

---

## Phase 3.7 — Animation Fix (COMPLETED 2026-07-01)

### What was done

**Root cause confirmed:** UAL2 quaternion FCurves copied to Rigify DEF bones produce spider pose because rest orientations are incompatible. Not fixable via bake flags.

**Solution:** Used `UAL2_Standard.glb` already present in the project root zip (`Universal Animation Library 2[Standard].zip`). Extracted `Unreal-Godot/UAL2_Standard.glb` — the UAL2 character itself with all 43 animations pre-baked on the correct rig.

**Character specs:**
- 65 joints (well under 128 mobile GPU limit)
- Height: 1.83m (perfect for scene scale)
- Walk: `Walk_Carry_Loop` (fuzzy match: `clips.find(c => /walk/i.test(c.name) && !/zombie/i.test(c.name))`)
- Idle: `Idle_FoldArms_Loop` (first looping idle found — arms crossed, great NieR aesthetic)

**Files changed:**
- `public/models/android.glb` → replaced with UAL2_Standard.glb (7.8MB, 43 animations)
- `public/models/android_broken_spider.glb` → backup of the broken Rigify model (7.0MB)
- `src/components/ui/PortfolioScene.astro` → material override + improved clip matching

**Material override in PortfolioScene.astro** (after GLB load, before `animClock.start()`):
```js
charGroup.traverse(obj => {
  if (!obj.isMesh) return;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  mats.forEach((_mat, i) => {
    const replacement = _mat.name === 'M_Joints'
      ? new THREE.MeshStandardMaterial({ color: 0x5ee7aa, emissive: 0x1a4a38, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.1 })
      : new THREE.MeshStandardMaterial({ color: 0x2e3229, roughness: 0.75, metalness: 0.05 });
    if (Array.isArray(obj.material)) obj.material[i] = replacement;
    else obj.material = replacement;
  });
});
```

**Note on visuals in SwiftShader headless:** The dark body (#2e3229) appears warmer/orange-ish under the DirectionalLight (0xb0ac9c sand-muted). In a real browser with GPU, the material renders correctly darker. Mint joints (#5ee7aa emissive) are clearly visible in both environments.

---

## Phase 3.9 — PersonaSelector redesign + legibility (COMPLETED 2026-07-01)

### What changed

- **PersonaSelector**: 3 visitor types → 3 Pablo roles (DATA ANALYST / AI ENGINEER / DATA SCIENTIST). Each dispatches `nier:zone` CustomEvent. DS shows COMING SOON overlay instead of navigating.
- **COMING SOON overlay** (`#ps-coming-soon`): absolute within `.ps-shell`, z-index 20, `font-display` 3.5rem title, 5 `◆` dots with `cs-blink` animation staggered 0.28s each, `[ RETURN ]` button.
- **Fog**: `FogExp2(0x1b1e1a, 0.038)` → `0.018` — AI zone at z=−18 (distance ~22) now 71% visible instead of 43%.
- **Unit tag canvas**: 256×80 → 512×160, fonts 14px/11px → 28px/22px, sprite scale (1.3,0.4,1) → (2.0,0.62,1). *(Replaced by HTML overlay in 3.10.)*
- **Panel**: width 360px → 420px, title 0.9rem → 1.05rem, sys-text 0.5rem → 0.62rem.

### Race condition pattern (PersonaSelector ↔ PortfolioScene)

PersonaSelector dispatches `nier:zone` immediately on click. But PortfolioScene's `init()` (which runs `setTimeout(init, 80)`) may not have registered the listener yet. Double-mechanism fixes it:
1. PortfolioScene registers `window.addEventListener('nier:zone', ...)` inside `init()`.
2. PortfolioScene also reads `sessionStorage.getItem('nier-persona')` at end of `init()` with 400ms delay.
3. PersonaSelector dispatches with 600ms delay on reload (stored session), ensuring init() has run.

## Phase 3.10 — Visual Polish (COMPLETED 2026-07-01)

### What changed

- **Particle system** (`buildParticles()`): 800 `THREE.Points`, `BufferGeometry`, color `0x787668` (sand-dim), size 0.055, opacity 0.45. Each particle has a pre-computed random velocity in `Float32Array particleVelocities`. Updated in `tick()` via `pos.setXYZ(i, x, y, z)` + `pos.needsUpdate = true`. Wraps at scene bounds (x:±12, y:0–14, z:−50 to +5).
- **Unit tag HTML overlay** (replaces 3D sprite): `<div id="unit-tag-hud">` positioned absolute inside `.ps-shell`. Each tick: `charGroup.getWorldPosition(_tagPos)`, `_tagPos.y += 2.8`, `_tagPos.project(camera)` → converts to screen px → CSS `transform: translate(-50%,-100%) translate(Xpx,Ypx)`. Hidden (`display:none`) when `_tagPos.z >= 1` (behind camera). `_tagPos` is pre-allocated as `let _tagPos = null` in shared state, initialized once inside `init()` after `import('three')`.
- **Panel hero/compact redesign**: `showPanel()` now finds the featured project → renders as `.panel-hero` (big name, desc, metric, CTA button). Remaining projects render as `.panel-row` (badge + name + link, compact 1-line). Typewriter applies to `.hero-name` (22ms/char) and `.row-name` (14ms/char).
- **Vignette**: `.ps-shell::after { box-shadow: inset 0 0 120px 50px rgba(27,30,26,0.92); z-index:5; pointer-events:none; }` — darkens viewport edges, hides scene cutoffs.
- **Billboard font fix**: replaced `await document.fonts.ready` with `await Promise.all([document.fonts.load('bold 17px "Share Tech Mono"'), ...])` + `tex.needsUpdate = true` + explicit `color: 0xffffff` on MeshBasicMaterial.
- **Zone label sprites**: start at opacity 0.18. On `nier:zone` event: active zone → `targetZoneOpacity[k] = 1.0`, others → 0.12. Lerped 4%/frame in `tick()`.

### Lessons learned (Phase 3.9 / 3.10)

10. **`document.fonts.ready` ≠ font usable on canvas.** It resolves when the browser's font loading queue is empty, not when a specific font is rendered. Use `document.fonts.load('bold 17px "Share Tech Mono"')` — it returns a Promise that resolves only when that exact variant is available. Always call before any `canvas.getContext('2d').fillText()` that uses a web font.
11. **CanvasTexture + MeshBasicMaterial pitfalls.** `tex.needsUpdate = true` should be set after `new THREE.CanvasTexture(canvas)`. Also set `color: 0xffffff` explicitly on `MeshBasicMaterial` — the default is white but being explicit prevents tinting bugs if the material is ever cloned.
12. **HTML overlay > 3D Sprite for readable text.** `THREE.Sprite` with `CanvasTexture` degrades at distance and requires careful canvas pixel density tuning. A `<div>` positioned via `Vector3.project(camera)` is always crisp, supports full CSS, and costs one DOM update per frame — much better for labels/tags that must be readable at any zoom. Pre-allocate the `Vector3` once (`let _tagPos = null; /* in shared state */ _tagPos = new THREE.Vector3(); /* inside init() after import */`) — never `new THREE.Vector3()` inside `tick()`.
13. **BufferGeometry particle update pattern.** To move particles each frame: `pos.setXYZ(i, x, y, z)` then `pos.needsUpdate = true` once after the loop. Do not replace the BufferAttribute or create new geometry each frame.

## Phase 3.7 — Previous animation history (for reference)

## Pending from Pablo (content blockers)

- [ ] LinkedIn About/bio text — paste directly (LinkedIn blocks scraping)
- [ ] Data Scientist repos — none assigned yet (`src/data/projects.ts → dsProjects`)
- [ ] CV PDF — place at `public/pablo-lerner-cv.pdf` (button already wired)
- [ ] Desired domain name for Cloudflare Pages
- [x] LinkedIn URL — resolved: `https://www.linkedin.com/in/pablo-lerner-591180336`

## Content / i18n rules

- Spanish: Rioplatense register (*vos*, native phrasing — never a literal translation)
- Technical terms (FastAPI, LangChain, deploy, pipeline, etc.) stay in English in both locales
- SEO: use locale `es` (not `es-419`); reciprocal `hreflang` tags; canonical self-referencing
