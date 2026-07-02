# 3D Side-Scroller Portfolio — Agent Implementation Plan

> **Read this before coding anything.** This document is the single source of truth for
> the 3D landing implementation. Every locked decision is here. If something is not in
> this file, ask the user before inventing a solution.

---

## 0. Current State (do not re-derive)

The terminal portfolio is **fully built and working**. Do not touch it except to wire
the mode-toggle. All of the following exist and function:

| What | Where |
|---|---|
| IRON DUST v2 design tokens | `src/styles/tokens.css` |
| Global CSS (scanlines, grain, boot) | `src/styles/global.css` |
| YoRHa OS chrome layout | `src/layouts/Base.astro` |
| Role layout (3-col grid + terminal) | `src/layouts/RoleLayout.astro` |
| Home page (role selector, bilingual) | `src/pages/en/index.astro`, `src/pages/es/index.astro` |
| Role pages (7 DA + 6 AI + DS placeholder) | `src/pages/en/risk/`, `/ai/`, `/ds/` (+ ES mirrors) |
| All project data | `src/data/projects.ts` (single source of truth) |
| Ambient canvas (Three.js grid bg) | `src/components/ui/AmbientCanvas.astro` |
| Card pointer-tilt | `src/components/ui/ProjectCard.astro` |
| Boot screen, StatusBar, TabBar, DotRow | `src/components/ui/` |
| Three.js v0.185.0 + @types/three | `package.json` — **already installed** |

**Do NOT rewrite any of the above.** The 3D landing is an additive layer on top.

---

## 1. Locked Architecture Decisions

### 1A. Stack

| Package | Version | Why | Status |
|---|---|---|---|
| `three` | ^0.185.0 | 3D rendering, vanilla | ✅ installed |
| `@types/three` | ^0.185.0 | TypeScript types | ✅ installed |
| `gsap` | ^3.13.0 | ScrollTrigger, free since May 2025 | ❌ add |
| `postprocessing` | ^7.x | pmndrs, SelectiveBloom, SMAA | ❌ add |
| React / R3F | — | **DO NOT ADD** — vanilla only | — |

GLTFLoader + DRACOLoader come from `three/addons/` — **no extra npm install**.

### 1B. Scene concept: YoRHa Operations Terminal Bay

A long corridor extending along the **X axis** (~22 units). The camera and a white
android character move **left → right** as the user scrolls. Interactive objects are
named Blender meshes positioned along the corridor. Clicking an object zooms the camera
to it then navigates.

```
X: -10     -8          -2     0      3          8       13
    |       |            |    |      |           |        |
  [entry]  [CONSOLE]  [AI SCR]  [DS PANEL]  [SERVER]  [COMMS]
```

### 1C. Interactive object → route map (LOCKED — use these exact mesh names in Blender)

| Blender mesh name | Scene position (approx) | Click destination |
|---|---|---|
| `mesh_console` | (-8, 0, -0.5) | `/en/risk/` (Data Analyst — primary) |
| `mesh_ai_screen` | (-2, 1.2, -1.8) | `/en/ai/` |
| `mesh_ds_panel` | (3, 1.2, -1.8) | `/en/ds/` |
| `mesh_server` | (8, 0, -0.8) | `https://github.com/pabloler21` (new tab) |
| `mesh_comms` | (13, 2, 0) | `mailto:lerner.pb@gmail.com` |

### 1D. Mode system

| Mode | What shows | Trigger |
|---|---|---|
| `'3d'` (default) | SceneCanvas fullscreen | default / user toggle |
| `'terminal'` | Existing home-grid (role selector) | user toggle / auto-fallback |

Persisted in `localStorage['pabloler-mode']`. Applied before paint (inline script,
no flash). Both modes live on the **same URL** (`/en/`, `/es/`).

Auto-fallback to `'terminal'` (silent, no prompt):
- `prefers-reduced-motion: reduce`
- `(hover: none)` — touch device
- `window.innerWidth < 768`
- `[data-plain]` on html (plain mode)
- WebGL context returns null
- `import('three')` throws

### 1E. Performance budget

| Asset | Budget | Format |
|---|---|---|
| Three.js chunk (already exists) | 708KB raw / ~200KB Brotli | lazy dynamic import |
| Android character GLB | ≤ 500KB raw | GLB + Draco + gltf-transform |
| Corridor environment GLB | ≤ 1.5MB raw | GLB + Draco + gltf-transform |
| Total 3D assets | ≤ 2MB raw / ≤ 600KB Brotli | — |
| Draw calls | ≤ 80 | InstancedMesh for repeated panels |
| GPU frame budget | ≤ 8ms | 60fps target, pause when tab hidden |
| Pixel ratio | `Math.min(devicePixelRatio, 2)` | — |

---

### 1F. Blender MCP Connection

All Blender operations in this plan use the **Blender MCP** (Model Context Protocol)
tools. The MCP server must be running and connected before executing any Blender
commands.

**Connection details:**
- **Host:** `localhost`
- **Port:** `9876` (must be open in Blender via the BlenderMCP addon)
- **Tool prefix:** `mcp__blender__*`

**Verification:** Before starting Phase 3 or Phase 9, call
`mcp__blender__get_scene_info` to confirm the connection is active. If it times out,
check that:
1. Blender is running with the BlenderMCP addon enabled
2. The addon shows "Connected" in the Blender sidebar (N key → BlenderMCP tab)
3. Port 9876 is not blocked by a firewall

**Tool usage:** All Blender Python scripts in this plan are executed via
`mcp__blender__execute_blender_code`. Asset generation uses
`mcp__blender__generate_hyper3d_model_via_text` and related tools. See Appendix A
for full setup instructions.

## 2. File Map — what this plan creates / modifies

```
NEW:
  src/components/ui/SceneCanvas.astro     ← main 3D island
  src/components/ui/SceneLoader.astro     ← branded loading overlay
  public/models/android.glb              ← android character (from Blender)
  public/models/corridor.glb             ← environment (from Blender)
  public/draco/                          ← Draco WASM decoder (copy from three)

MODIFIED:
  src/pages/en/index.astro               ← add SceneCanvas + mode toggle
  src/pages/es/index.astro               ← same
  src/layouts/Base.astro                 ← disable AmbientCanvas in 3D mode
  package.json                           ← add gsap, postprocessing
```

---

## Phase 1 — Dependencies & Infrastructure

**Goal:** Install packages, set up public directories, verify build passes. No visual
change yet.

### 1.1 Install packages

```bash
npm install gsap postprocessing
```

Verify in `package.json` afterward:
- `"gsap": "^3.13.x"` in `dependencies`
- `"postprocessing": "^7.x.x"` in `dependencies`

### 1.2 Copy Draco WASM decoder to public

DRACOLoader requires its decoder files to be served statically. They ship with `three`:

```bash
cp -r node_modules/three/addons/libs/draco/ public/draco/
```

Verify these files now exist in `public/draco/`:
- `draco_decoder.js`
- `draco_decoder.wasm`
- `draco_wasm_wrapper.js`

### 1.3 Create models directory

```bash
mkdir -p public/models
```

Add a `.gitkeep` if you want it tracked. The actual `.glb` files are large — consider
adding them to `.gitignore` and serving them from Cloudflare R2 or git-lfs instead.
For now, track them directly (they'll be ≤ 2MB total).

### 1.4 Add `.gitignore` entry for GLB (optional, decide now)

If keeping GLBs in repo: no change needed.
If using git-lfs: `echo "*.glb filter=lfs diff=lfs merge=lfs -text" >> .gitattributes`

### 1.5 Verify build still passes

```bash
npm run astro check   # TypeScript — must be 0 errors
npm run build         # production build — must succeed
```

Fix any errors before proceeding. Do not continue to Phase 2 with a broken build.

---

## Phase 2 — SceneCanvas Scaffold (Placeholder Primitive Scene)

**Goal:** A working Three.js side-scroller island with placeholder colored boxes for
each interactive object. No GSAP yet. No character. No interaction. Render loop with
all pausing logic.

### 2.1 Create `src/components/ui/SceneCanvas.astro`

The full file — copy exactly:

```astro
---
/**
 * SceneCanvas — 3D side-scroller landing island.
 *
 * Guardrails:
 *  prefers-reduced-motion → auto-terminal, canvas hidden
 *  hover:none (touch)     → auto-terminal, canvas hidden
 *  viewport < 768px       → auto-terminal, canvas hidden
 *  data-plain             → auto-terminal via MutationObserver
 *  WebGL unavailable      → auto-terminal, canvas hidden
 *  import('three') fails  → auto-terminal, canvas hidden
 *  tab hidden/offscreen   → visibilitychange + IntersectionObserver pause tick
 *  pixelRatio capped at 2
 */
---

<!-- Floating mode toggle — always visible in 3D mode -->
<button id="mode-toggle" class="mode-toggle" aria-label="Switch to terminal mode">
  ENTER TERMINAL ◈
</button>

<!-- Object label tooltip (shown on hover) -->
<div id="scene-label" class="scene-label" aria-live="polite" hidden>
  <span class="label-pip">◆</span>
  <span id="scene-label-text"></span>
</div>

<!-- Accessible nav mirror (screen readers / keyboard — always in DOM) -->
<nav class="scene-nav-a11y" aria-label="Portfolio navigation">
  <a href="/en/risk/">Data Analyst — View Projects</a>
  <a href="/en/ai/">AI Engineer — View Projects</a>
  <a href="/en/ds/">Data Scientist — View Projects</a>
  <a href="https://github.com/pabloler21" target="_blank" rel="noopener noreferrer">GitHub</a>
  <a href="mailto:lerner.pb@gmail.com">Email</a>
</nav>

<!-- Scene loader overlay -->
<div id="scene-loader" class="scene-loader" aria-hidden="true">
  <p class="loader-label sys-text">INITIALIZING MEMORY SECTOR</p>
  <div class="loader-bar-wrap">
    <div id="loader-bar" class="loader-bar"></div>
  </div>
  <p id="loader-pct" class="loader-pct sys-text">0%</p>
</div>

<!-- 3D canvas -->
<canvas id="scene-canvas" aria-hidden="true"></canvas>

<script>
  const html   = document.documentElement;
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;

  // ── Fallback helpers ──────────────────────────────────────────────────────
  function goTerminal() {
    html.dataset.portfolioMode = 'terminal';
    localStorage.setItem('pabloler-mode', 'terminal');
    if (canvas) canvas.hidden = true;
    const toggle = document.getElementById('mode-toggle');
    if (toggle) toggle.textContent = 'ENTER 3D MODE ◈';
  }

  const shouldSkip = (): boolean =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(hover: none)').matches ||
    window.innerWidth < 768 ||
    html.hasAttribute('data-plain');

  // Apply saved mode before paint (this script also runs in index.astro inline,
  // but we reinforce here for SceneCanvas's own fallback logic)
  if (shouldSkip()) {
    goTerminal();
  } else {
    const savedMode = localStorage.getItem('pabloler-mode') || '3d';
    if (savedMode === 'terminal') {
      goTerminal();
    } else {
      // Kick off 3D init after idle
      const kick = () => init3D();
      'requestIdleCallback' in window
        ? (window as any).requestIdleCallback(kick, { timeout: 3000 })
        : setTimeout(kick, 500);
    }
  }

  // ── Mode toggle button ────────────────────────────────────────────────────
  const toggleBtn = document.getElementById('mode-toggle');
  toggleBtn?.addEventListener('click', () => {
    const current = html.dataset.portfolioMode ?? '3d';
    const next = current === '3d' ? 'terminal' : '3d';
    html.dataset.portfolioMode = next;
    localStorage.setItem('pabloler-mode', next);
    if (toggleBtn) {
      toggleBtn.textContent = next === '3d' ? 'ENTER TERMINAL ◈' : 'ENTER 3D MODE ◈';
    }
    // If switching to 3D and it hasn't been initialized yet, init now
    if (next === '3d' && !sceneInitialized) init3D();
  });

  // ── Reduced-motion live listener ──────────────────────────────────────────
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (e.matches) goTerminal();
  });

  // ── Main init ─────────────────────────────────────────────────────────────
  let sceneInitialized = false;

  async function init3D() {
    if (sceneInitialized || !canvas || shouldSkip()) return;
    sceneInitialized = true;

    // WebGL check
    let glCtx: WebGLRenderingContext | null = null;
    try {
      glCtx = (canvas.getContext('webgl2') ??
               canvas.getContext('webgl') ??
               canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    } catch { /* silent */ }
    if (!glCtx) { goTerminal(); return; }

    // Lazy-load Three.js
    let THREE: typeof import('three');
    try { THREE = await import('three'); }
    catch { goTerminal(); return; }

    // ── Dimensions ───────────────────────────────────────────────────────────
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.setClearColor(0x1b1e1a, 1); // --bg-void, opaque in 3D mode

    const scene  = new THREE.Scene();

    // ── Camera ────────────────────────────────────────────────────────────────
    // Side-scroller: camera follows character along X, fixed Y and Z
    const camera = new THREE.PerspectiveCamera(60, W() / H(), 0.1, 100);
    camera.position.set(-8, 2.5, 6);
    camera.lookAt(-8, 1, 0);

    // ── Lighting ──────────────────────────────────────────────────────────────
    const ambLight = new THREE.AmbientLight(0xe8e4d0, 0.25);  // --sand, dim fill
    scene.add(ambLight);

    const keyLight = new THREE.DirectionalLight(0xb0ac9c, 0.9); // --sand-muted key
    keyLight.position.set(5, 10, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x5ee7aa, 0.25); // --accent-bright rim
    rimLight.position.set(-5, 2, -4);
    scene.add(rimLight);

    // ── Placeholder geometry (will be replaced by GLB in later phases) ────────
    const mkBox = (w: number, h: number, d: number, color: number, name: string, px: number, py: number, pz: number) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.3 })
      );
      mesh.name  = name;
      mesh.position.set(px, py, pz);
      scene.add(mesh);
      return mesh;
    };

    // Corridor floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.15, 6),
      new THREE.MeshStandardMaterial({ color: 0x252820, roughness: 0.95 })
    );
    floor.position.set(2, -1.08, 0);
    scene.add(floor);

    // Interactive placeholder boxes
    mkBox(1.6, 2.0, 1.0, 0x4a5044, 'mesh_console',   -8,  0,   -0.5);
    mkBox(2.0, 1.2, 0.1, 0x363b30, 'mesh_ai_screen',  -2,  1.2, -1.8);
    mkBox(1.5, 1.0, 0.1, 0x363b30, 'mesh_ds_panel',    3,  1.2, -1.8);
    mkBox(0.8, 3.0, 0.8, 0x252820, 'mesh_server',       8,  0.5, -0.8);

    // Comms array — emissive accent
    const commsMat = new THREE.MeshStandardMaterial({
      color: 0x5ee7aa, emissive: 0x5ee7aa, emissiveIntensity: 0.4
    });
    const commsBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 2.0), commsMat);
    commsBox.name = 'mesh_comms';
    commsBox.position.set(13, 2, 0);
    scene.add(commsBox);

    // Collect interactive meshes for raycaster (Phase 6)
    const interactiveMeshes = ['mesh_console','mesh_ai_screen','mesh_ds_panel','mesh_server','mesh_comms']
      .map(n => scene.getObjectByName(n))
      .filter(Boolean) as THREE.Object3D[];

    // ── Raycaster setup (hover + click — Phase 6) ────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer   = new THREE.Vector2(-9999, -9999);
    let hoveredMesh: THREE.Mesh | null = null;
    const originalMats = new Map<THREE.Mesh, THREE.Material>();
    const highlightMat = new THREE.MeshStandardMaterial({
      color: 0x5ee7aa, emissive: 0x5ee7aa, emissiveIntensity: 0.25
    });
    const destinationMap = new Map([
      ['mesh_console',   '/en/risk/'],
      ['mesh_ai_screen', '/en/ai/'],
      ['mesh_ds_panel',  '/en/ds/'],
      ['mesh_server',    'https://github.com/pabloler21'],
      ['mesh_comms',     'mailto:lerner.pb@gmail.com'],
    ]);
    const labelMap = new Map([
      ['mesh_console',   'DATA ANALYST — VIEW RECORDS'],
      ['mesh_ai_screen', 'AI ENGINEER — VIEW RECORDS'],
      ['mesh_ds_panel',  'DATA SCIENTIST — VIEW RECORDS'],
      ['mesh_server',    'GITHUB PROFILE ↗'],
      ['mesh_comms',     'SEND MESSAGE ↗'],
    ]);

    const labelEl  = document.getElementById('scene-label');
    const labelTxt = document.getElementById('scene-label-text');

    function applyHighlight(mesh: THREE.Mesh) {
      if (!originalMats.has(mesh)) originalMats.set(mesh, mesh.material as THREE.Material);
      mesh.material = highlightMat;
    }
    function removeHighlight(mesh: THREE.Mesh) {
      const orig = originalMats.get(mesh);
      if (orig) mesh.material = orig;
    }

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      pointer.x =  (e.clientX / W()) * 2 - 1;
      pointer.y = -(e.clientY / H()) * 2 + 1;
    }, { passive: true });

    let isTransitioning = false;
    canvas.addEventListener('click', () => {
      if (!hoveredMesh || isTransitioning) return;
      const dest = destinationMap.get(hoveredMesh.name);
      if (!dest) return;
      isTransitioning = true;
      // Camera zoom (requires GSAP — wired in Phase 5; plain navigate for now)
      if (dest.startsWith('http') || dest.startsWith('mailto')) {
        window.open(dest, '_blank', 'noopener,noreferrer');
        isTransitioning = false;
      } else {
        window.location.href = dest;
      }
    });

    // ── Pause when offscreen / tab hidden ────────────────────────────────────
    let isVisible = true;
    const visObs = new IntersectionObserver(([e]) => { isVisible = e.isIntersecting; }, { threshold: 0 });
    visObs.observe(canvas);
    document.addEventListener('visibilitychange', () => { isVisible = !document.hidden; });

    // ── Plain-mode observer ──────────────────────────────────────────────────
    const plainObs = new MutationObserver(() => {
      if (html.hasAttribute('data-plain')) goTerminal();
    });
    plainObs.observe(html, { attributes: true, attributeFilter: ['data-plain'] });

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    };
    window.addEventListener('resize', onResize, { passive: true });

    // ── Camera state (updated by GSAP in Phase 5) ────────────────────────────
    // In Phase 2 the camera is static. scrollProgress drives character X later.
    let targetCamX = -6;   // camera lags character by ~2 units

    // ── Render loop ───────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let rafId = 0;
    const isInTerminalMode = () => html.dataset.portfolioMode === 'terminal';

    function tick() {
      rafId = requestAnimationFrame(tick);
      if (!isVisible || isInTerminalMode()) return;

      const _delta = clock.getDelta();

      // Smooth camera X follow (GSAP sets targetCamX in Phase 5)
      camera.position.x += (targetCamX - camera.position.x) * 0.05;

      // Raycaster hover
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, true);
      if (hits.length > 0) {
        const hit = hits[0].object as THREE.Mesh;
        if (hit !== hoveredMesh) {
          if (hoveredMesh) { removeHighlight(hoveredMesh); }
          hoveredMesh = hit;
          applyHighlight(hit);
          canvas.style.cursor = 'pointer';
          if (labelEl && labelTxt) {
            labelTxt.textContent = labelMap.get(hit.name) ?? hit.name;
            labelEl.hidden = false;
          }
        }
      } else {
        if (hoveredMesh) {
          removeHighlight(hoveredMesh);
          hoveredMesh = null;
          canvas.style.cursor = '';
          if (labelEl) labelEl.hidden = true;
        }
      }

      renderer.render(scene, camera);
    }
    tick();

    // Dismiss loader immediately in scaffold (no GLBs yet)
    const loader = document.getElementById('scene-loader');
    if (loader) { loader.style.opacity = '0'; setTimeout(() => (loader as HTMLElement).style.display = 'none', 400); }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    document.addEventListener('astro:before-swap', () => {
      cancelAnimationFrame(rafId);
      visObs.disconnect();
      plainObs.disconnect();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    }, { once: true });

    // Expose targetCamX setter for GSAP (Phase 5)
    (window as any).__setSceneCamX = (x: number) => { targetCamX = x; };
  }
</script>

<style>
  /* ── Canvas ── */
  #scene-canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    display: block;
  }

  [data-portfolio-mode="terminal"] #scene-canvas { display: none; }

  /* ── Mode toggle ── */
  .mode-toggle {
    position: fixed;
    top: 3.8rem;
    right: 1rem;
    z-index: 20;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.15em;
    border: 1px solid var(--accent-bright);
    color: var(--accent-bright);
    background: rgba(27,30,26,0.88);
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    backdrop-filter: blur(4px);
    transition: background 0.15s, color 0.15s;
  }
  .mode-toggle:hover {
    background: var(--accent-bright);
    color: var(--bg-void);
  }
  .mode-toggle:focus-visible {
    outline: 1px solid var(--accent-bright);
    outline-offset: 2px;
  }
  [data-portfolio-mode="terminal"] .mode-toggle { z-index: 10; }

  /* ── Object label ── */
  .scene-label {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -180%);
    z-index: 20;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    color: var(--accent-bright);
    background: rgba(27,30,26,0.85);
    border: 1px solid var(--accent-bright);
    padding: 0.3rem 0.8rem;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    backdrop-filter: blur(4px);
  }
  .label-pip { font-size: 0.5rem; }

  /* ── Accessible nav (visually hidden, in DOM for a11y) ── */
  .scene-nav-a11y {
    position: absolute;
    width: 1px; height: 1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    white-space: nowrap;
  }

  /* ── Loader ── */
  .scene-loader {
    position: fixed;
    inset: 0;
    z-index: 15;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
    background: var(--bg-void);
    transition: opacity 0.4s ease;
  }
  .loader-label {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: var(--sand-dim);
  }
  .loader-bar-wrap {
    width: 200px;
    height: 2px;
    background: var(--ink);
  }
  .loader-bar {
    height: 100%;
    width: 0%;
    background: var(--accent-bright);
    transition: width 0.3s ease;
  }
  .loader-pct {
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    color: var(--accent-bright);
  }
</style>
```

### 2.2 Update `src/pages/en/index.astro`

Add the import and mount point. The existing `.home-grid` stays exactly as-is —
just wrap it and add the mode-toggle CSS.

At the top of the frontmatter, add:
```astro
import SceneCanvas from '../../components/ui/SceneCanvas.astro';
```

Add this **inline script** as the very first child of `<Base>` (before BootScreen):
```html
<script is:inline>
  // Apply saved mode before paint — prevents flash
  (function() {
    var mode = localStorage.getItem('pabloler-mode') || '3d';
    // Auto-fallback checks
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        window.matchMedia('(hover: none)').matches ||
        window.innerWidth < 768) {
      mode = 'terminal';
      localStorage.setItem('pabloler-mode', 'terminal');
    }
    document.documentElement.dataset.portfolioMode = mode;
  })();
</script>
```

Add `<SceneCanvas />` after the inline script (before BootScreen).

Add this CSS to the page's `<style>` block:
```css
/* Terminal layer — hidden when 3D mode is active */
[data-portfolio-mode="3d"] .home-grid {
  display: none;
}
```

Do the **exact same changes** to `src/pages/es/index.astro` — same structure, same
import, same inline script, same CSS. The SceneCanvas component is language-agnostic.

### 2.3 Update `src/layouts/Base.astro`

Disable AmbientCanvas when 3D mode is active (two Three.js renderers running
simultaneously is wasteful):

In the `<style>` block, add:
```css
[data-portfolio-mode="3d"] #ambient-canvas { display: none; }
```

### 2.4 Validation for Phase 2

```bash
npm run astro check          # 0 TypeScript errors
npm run build                # clean build
npm run dev                  # start dev server at localhost:4321
```

In browser at `http://localhost:4321/en/`:
- [ ] 3D scene renders (dark corridor with 5 colored boxes)
- [ ] Hovering boxes changes cursor to pointer + shows label tooltip
- [ ] "ENTER TERMINAL ◈" button is visible top-right
- [ ] Clicking "ENTER TERMINAL ◈" switches to the role selector (existing UI)
- [ ] Clicking it again returns to 3D mode
- [ ] Mode persists after page refresh (localStorage)
- [ ] In DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` → auto-switches to terminal
- [ ] Resize browser to < 768px → auto-switches to terminal
- [ ] Clicking a box navigates to the correct route

---

## Phase 3 — Character Generation (Blender MCP)

**Goal:** Generate the white android character via Blender MCP, clean it up, rig it,
export GLB with embedded animations.

**Prerequisite:** Blender MCP must be running. See **Appendix A** for full setup.

### 3.1 Generate the base mesh

Use `mcp__blender__generate_hyper3d_model_via_text` with this prompt:

> A slim humanoid android character in a neutral T-pose, ready for rigging. YoRHa
> style from NieR:Automata. White and silver hard-surface armor panels with fine dark
> seams. Female body proportions. Featureless visor/mask face — no facial details
> needed. Low-poly stylized, clean manifold topology. Height approximately 1.7 Blender
> units. Suitable for game animation.

Poll with `mcp__blender__get_hyper3d_status` until status is `SUCCEEDED`.

Import with `mcp__blender__import_generated_asset`.

Take a viewport screenshot with `mcp__blender__get_viewport_screenshot` and evaluate
quality. If mesh quality is poor, try:
1. `mcp__blender__generate_hunyuan3d_model` as an alternative generator
2. Or `mcp__blender__search_sketchfab_models` for "android humanoid low poly CC0"

### 3.2 Mesh cleanup via Blender Python

Run the following cleanup script via `mcp__blender__execute_blender_code`:

```python
import bpy

# Select the generated character object (adjust name if different)
obj = bpy.context.scene.objects.get('GeneratedMesh') or bpy.context.active_object
if not obj:
    raise RuntimeError("No object found — check object name in Blender")

bpy.context.view_layer.objects.active = obj
obj.select_set(True)

# Apply any transforms
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Decimate to target ~4000 triangles for web performance
decimate = obj.modifiers.new(name='Decimate', type='DECIMATE')
decimate.ratio = 0.3  # adjust until triangle count is ~3000-5000
bpy.ops.object.modifier_apply(modifier='Decimate')

# Apply white PBR material
mat = bpy.data.materials.new(name='AndroidBody')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.92, 0.92, 0.92, 1.0)  # near-white
bsdf.inputs['Metallic'].default_value  = 0.75
bsdf.inputs['Roughness'].default_value = 0.28

# Clear existing materials and assign
obj.data.materials.clear()
obj.data.materials.append(mat)

print(f"Done. Triangles: {sum(len(p.vertices) - 2 for p in obj.data.polygons)}")
```

### 3.3 Rig and animate (Mixamo — manual browser step)

Mixamo cannot be automated — this is a brief manual step:

1. Export the cleaned mesh from Blender as FBX:
   - File → Export → FBX → check "Selected Objects" if needed
   - Save to a temp path, e.g., `android_temp.fbx`

2. Go to https://www.mixamo.com in browser

3. Upload the FBX under "Upload Character"

4. Mixamo auto-rigs it. If it fails, adjust the skeleton placement handles
   (chin, wrists, elbows, groin) and retry.

5. Once rigged, download these 3 animation clips (apply to the same character):
   - **Idle**: search "breathing idle" or "idle" — relaxed stand, loopable
   - **Run**: search "run" — standard run cycle, loopable, ~24fps
   - **Stop**: search "stop" or "standing up" — short transition, not looped
   - Download each as FBX, without skin (just animation), at 60fps

6. Import all FBX files into Blender:
   - File → Import → FBX for each animation file
   - The animations come in as separate objects; extract their action data

7. Rename the actions exactly:
   - `action_idle`
   - `action_run`
   - `action_stop`

Automating with Blender Python (after manual Mixamo download):
```python
import bpy

# Rename actions (adjust source names as they come from Mixamo)
for action in bpy.data.actions:
    if 'Idle' in action.name or 'idle' in action.name:
        action.name = 'action_idle'
    elif 'Run' in action.name or 'run' in action.name:
        action.name = 'action_run'
    elif 'Stop' in action.name or 'Stop' in action.name:
        action.name = 'action_stop'
print([a.name for a in bpy.data.actions])
```

### 3.4 Export GLB with animations

Run via `mcp__blender__execute_blender_code`. Replace the filepath with the absolute
path to your project's `public/models/` directory:

```python
import bpy, os

project_root = "/home/pablo/projects/portfolio-pablolerner"
output_path  = os.path.join(project_root, "public/models/android.glb")

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_texcoords=True,
    export_normals=True,
    use_selection=False,
)
print(f"Exported to: {output_path}")
print(f"File size: {os.path.getsize(output_path) / 1024:.1f} KB")
```

### 3.5 Optimize with gltf-transform

After export, run (requires `npx` or a global install of `@gltf-transform/cli`):

```bash
# Install CLI once if not present
npm install --save-dev @gltf-transform/cli

# Optimize
npx gltf-transform optimize \
  public/models/android.glb \
  public/models/android.glb \
  --compress draco \
  --texture-compress webp
```

**Target: ≤ 500KB after optimization.** If larger, go back to Blender and decimate further.

### 3.6 Validation for Phase 3

```bash
ls -lh public/models/android.glb     # check file size
npx gltf-transform inspect public/models/android.glb   # check triangles, animations
```

Expected output from inspect:
- Meshes: 1 (or a few if split by material)
- Triangles: ~3000–5000
- Animations: 3 (action_idle, action_run, action_stop)
- File size: ≤ 500KB

---

## Phase 4 — Character Integration in Three.js

**Goal:** Load `android.glb` into the scene, set up `AnimationMixer`, play idle by
default. Character stands at the corridor entry position.

Add the following inside `init3D()` in `SceneCanvas.astro`, after the placeholder
geometry block. The placeholders remain in the scene until Phase 9 (environment GLB)
replaces them.

### 4.1 GLTFLoader setup

Import at the top of the `<script>` (these are `three/addons` paths — Vite handles them):

```typescript
// These dynamic imports happen inside init3D(), after THREE is loaded:
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
```

### 4.2 Load android + AnimationMixer

```typescript
let mixer: THREE.AnimationMixer | null = null;
let clipIdle:  THREE.AnimationAction | null = null;
let clipRun:   THREE.AnimationAction | null = null;
let clipStop:  THREE.AnimationAction | null = null;
let characterRoot: THREE.Group | null = null;

const CHARACTER_START_X = -10;

gltfLoader.load(
  '/models/android.glb',
  (gltf) => {
    characterRoot = gltf.scene;
    characterRoot.position.set(CHARACTER_START_X, -1.0, 0.5); // on floor
    characterRoot.scale.setScalar(1.0); // adjust if model scale is wrong
    // Face direction of travel (positive X)
    characterRoot.rotation.y = Math.PI / 2;
    scene.add(characterRoot);

    mixer = new THREE.AnimationMixer(characterRoot);
    const clips = gltf.animations;

    const findClip = (name: string) => THREE.AnimationClip.findByName(clips, name);

    if (findClip('action_idle')) {
      clipIdle = mixer.clipAction(findClip('action_idle'));
      clipIdle.setLoop(THREE.LoopRepeat, Infinity);
      clipIdle.play();
      clipIdle.setEffectiveWeight(1);
    }
    if (findClip('action_run')) {
      clipRun = mixer.clipAction(findClip('action_run'));
      clipRun.setLoop(THREE.LoopRepeat, Infinity);
      clipRun.play();
      clipRun.setEffectiveWeight(0); // start at 0 — blended by scroll
    }
    if (findClip('action_stop')) {
      clipStop = mixer.clipAction(findClip('action_stop'));
      clipStop.setLoop(THREE.LoopOnce, 1);
      clipStop.clampWhenFinished = true;
    }
  },
  undefined,
  (err) => {
    // GLB load failure — scene still works without character (placeholder boxes remain)
    console.warn('[SceneCanvas] Failed to load android.glb:', err);
  }
);
```

### 4.3 Update `tick()` to advance mixer

In the `tick()` function, after `const _delta = clock.getDelta();`:

```typescript
if (mixer) mixer.update(_delta);
if (characterRoot) {
  // Character X position driven by GSAP in Phase 5
  // For now, expose a setter window.__setCharacterX
}
```

Expose setters for GSAP (Phase 5):
```typescript
(window as any).__setCharacterX = (x: number) => {
  if (characterRoot) characterRoot.position.x = x;
};
(window as any).__setRunWeight = (w: number) => {
  if (clipIdle) clipIdle.setEffectiveWeight(1 - w);
  if (clipRun)  clipRun.setEffectiveWeight(w);
};
```

### 4.4 Validation for Phase 4

In browser:
- [ ] Android character appears in the scene at the corridor entry
- [ ] Character plays idle animation (breathing)
- [ ] No console errors
- [ ] `renderer.info.render.triangles` in console is under 10K (placeholder + character)

---

## Phase 5 — GSAP ScrollTrigger (Lateral Movement)

**Goal:** Scroll position drives the character left → right through the corridor.
Camera follows with damped lag. Animation blends idle ↔ run based on scroll velocity.

**Known pitfall:** GSAP and Three.js `requestAnimationFrame` must NOT fight each other.
Drive character/camera state from GSAP's `onUpdate` callback. The `tick()` RAF reads
state from shared variables, not from its own time tracking for character movement.

### 5.1 Import GSAP in SceneCanvas.astro

Add inside `init3D()`, after THREE is loaded:

```typescript
const { default: gsap } = await import('gsap');
const { ScrollTrigger } = await import('gsap/ScrollTrigger');
gsap.registerPlugin(ScrollTrigger);
```

### 5.2 Set up the pinned scroll section

In `src/pages/en/index.astro`, wrap both the SceneCanvas and the home-grid in a
section with enough height for the scroll distance:

```html
<section id="scene-section" class="scene-section">
  <SceneCanvas />
  <div class="home-grid ...">...</div>
</section>
```

```css
.scene-section {
  /* The scroll distance = 5× viewport height */
  /* In 3D mode, pinning handles layout; in terminal mode, height is auto */
}
[data-portfolio-mode="3d"] .scene-section {
  height: 500vh;  /* scroll space for the full corridor */
}
[data-portfolio-mode="terminal"] .scene-section {
  height: auto;
}
```

### 5.3 ScrollTrigger in init3D()

```typescript
const CORRIDOR_LENGTH = 22;   // from x=-10 to x=+12
const CHARACTER_START_X = -10;
const CAMERA_LAG = 2;         // camera lags character by 2 units

// State read by tick()
let scrollProgress = 0;

ScrollTrigger.create({
  trigger: '#scene-section',
  start: 'top top',
  end: 'bottom bottom',
  scrub: 1.5,
  onUpdate: (self) => {
    scrollProgress = self.progress;

    // Move character
    const charX = CHARACTER_START_X + scrollProgress * CORRIDOR_LENGTH;
    if ((window as any).__setCharacterX) (window as any).__setCharacterX(charX);

    // Set camera target X (tick() lerps to it)
    targetCamX = charX - CAMERA_LAG;

    // Blend idle ↔ run by scroll velocity (0 = idle, 1 = full run)
    const vel = Math.abs(self.getVelocity());
    const runWeight = Math.min(vel / 500, 1);
    if ((window as any).__setRunWeight) (window as any).__setRunWeight(runWeight);
  },
});
```

### 5.4 Cleanup ScrollTrigger on page swap

Add to the `astro:before-swap` cleanup:
```typescript
ScrollTrigger.getAll().forEach(t => t.kill());
```

### 5.5 Validation for Phase 5

- [ ] Scrolling moves character left → right through corridor
- [ ] Camera follows with a slight delay (lag)
- [ ] While scrolling: character runs; when stopped: character idles
- [ ] Scroll works on both `/en/` and `/es/`
- [ ] No jitter between GSAP and Three.js render loop

---

## Phase 6 — Interactive Objects (Enhanced Raycaster)

The raycaster skeleton is already in Phase 2. Phase 6 adds the GSAP camera transition
before navigation, and the label tooltip positioning fix.

### 6.1 Wire GSAP camera transition on click

Update the click handler in `SceneCanvas.astro` (replace the plain navigate version):

```typescript
canvas.addEventListener('click', () => {
  if (!hoveredMesh || isTransitioning) return;
  const dest = destinationMap.get(hoveredMesh.name);
  if (!dest) return;

  isTransitioning = true;
  const targetPos = hoveredMesh.position.clone();

  // Zoom camera to object, then navigate
  gsap.to(camera.position, {
    x: targetPos.x,
    y: targetPos.y + 1.5,
    z: targetPos.z + 3.5,
    duration: 0.75,
    ease: 'power2.inOut',
    onComplete: () => {
      if (dest.startsWith('http') || dest.startsWith('mailto')) {
        window.open(dest, '_blank', 'noopener,noreferrer');
        // Reset camera position after external link
        gsap.to(camera.position, {
          x: targetCamX, y: 2.5, z: 6,
          duration: 0.5, ease: 'power2.out',
          onComplete: () => { isTransitioning = false; }
        });
      } else {
        window.location.href = dest;
        // isTransitioning stays true — page will navigate away
      }
    }
  });
});
```

### 6.2 Validation for Phase 6

- [ ] Hovering `mesh_console` shows "DATA ANALYST — VIEW RECORDS" label
- [ ] Hovering `mesh_server` shows "GITHUB PROFILE ↗" label
- [ ] Clicking `mesh_console` → camera zooms in → navigates to `/en/risk/`
- [ ] Clicking `mesh_server` → camera zooms in → opens GitHub in new tab → camera resets
- [ ] Keyboard users can navigate using the accessible nav (tab to links, Enter)

---

## Phase 7 — Mode Coexistence (Final Polish)

Mostly done in Phase 2. This phase audits and tightens the toggle behavior.

### 7.1 Checklist

- [ ] Switching to terminal mode mid-scroll (while ScrollTrigger is active) — call
  `ScrollTrigger.getAll().forEach(t => t.disable())` when switching to terminal; 
  `ScrollTrigger.getAll().forEach(t => t.enable())` when switching back to 3D.
- [ ] The terminal home-grid scroll behaves normally (not pinned) when in terminal mode.
- [ ] Toggle button says "ENTER 3D MODE ◈" in terminal mode and "ENTER TERMINAL ◈" in 3D.
- [ ] Button is visible and accessible in BOTH modes.
- [ ] ES pages (`/es/`) have identical behavior — SceneCanvas is language-agnostic.
- [ ] Deep links to `/en/risk/` etc. work regardless of mode (they bypass home entirely).
- [ ] Boot screen still shows on first visit (sessionStorage) — it overlays 3D mode too.

### 7.2 ScrollTrigger enable/disable on toggle

In the toggle button's click handler (SceneCanvas.astro), add:

```typescript
toggleBtn?.addEventListener('click', () => {
  const current = html.dataset.portfolioMode ?? '3d';
  const next = current === '3d' ? 'terminal' : '3d';
  html.dataset.portfolioMode = next;
  localStorage.setItem('pabloler-mode', next);

  // ScrollTrigger management
  if (next === 'terminal') {
    ScrollTrigger.getAll().forEach(t => t.disable(false));
  } else {
    ScrollTrigger.getAll().forEach(t => t.enable(false));
    if (!sceneInitialized) init3D();
  }

  if (toggleBtn) {
    toggleBtn.textContent = next === '3d' ? 'ENTER TERMINAL ◈' : 'ENTER 3D MODE ◈';
  }
});
```

---

## Phase 8 — Guardrails

### 8.1 All auto-fallback conditions (verify each in browser)

| Condition | How to test | Expected behavior |
|---|---|---|
| `prefers-reduced-motion: reduce` | DevTools → Rendering → Emulate | Auto-terminal, no prompt |
| `(hover: none)` | DevTools → Device emulation → mobile | Auto-terminal |
| `window.innerWidth < 768` | Resize browser to 700px | Auto-terminal |
| `[data-plain]` on html | Click CLEAR MODE in StatusBar | Auto-terminal |
| WebGL unavailable | DevTools → disable hardware acceleration + reload | Auto-terminal, no console errors surfaced |
| Three.js import fails | Corrupt network (Network tab → block three.*.js) | Auto-terminal, no console errors surfaced |
| GLB load fails | Block `/models/android.glb` in Network tab | Scene loads without character; placeholder boxes remain; navigation still works |
| Tab hidden | Switch to another tab | Render loop pauses |
| Canvas offscreen | Scroll past the scene section | Render loop pauses |

### 8.2 Branded loader (wired in Phase 2; verify GLB load progress)

When GLBs are loading in Phases 4 and 9, wire the LoadingManager:

```typescript
const loadingManager = new THREE.LoadingManager(
  () => {
    // All assets loaded
    const loaderEl = document.getElementById('scene-loader');
    if (loaderEl) {
      (loaderEl as HTMLElement).style.opacity = '0';
      setTimeout(() => { (loaderEl as HTMLElement).style.display = 'none'; }, 400);
    }
  },
  (_url, loaded, total) => {
    const pct = Math.round((loaded / total) * 100);
    const bar = document.getElementById('loader-bar');
    const pctEl = document.getElementById('loader-pct');
    if (bar) bar.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
  }
);
// Pass loadingManager to GLTFLoader:
const gltfLoader = new GLTFLoader(loadingManager);
```

### 8.3 First-visit hint

Show a scroll hint ("SCROLL TO EXPLORE ↓") on first visit in 3D mode, hidden after
first scroll:

```html
<div id="scroll-hint" class="scroll-hint" aria-hidden="true">
  SCROLL TO EXPLORE ↓
</div>
```

```css
.scroll-hint {
  position: fixed;
  bottom: 3rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  color: var(--sand-dim);
  animation: hint-blink 1.5s ease infinite;
  pointer-events: none;
}
@keyframes hint-blink {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1; }
}
[data-portfolio-mode="terminal"] .scroll-hint { display: none; }
```

```typescript
// In init3D(), after ScrollTrigger setup:
const hintEl = document.getElementById('scroll-hint');
ScrollTrigger.create({
  trigger: '#scene-section',
  start: 'top top+=10',
  onEnter: () => {
    if (hintEl) hintEl.style.display = 'none';
  },
  once: true,
});
```

---

## Phase 9 — Environment GLB (Blender Corridor Build)

**Goal:** Replace placeholder boxes with the actual YoRHa Operations Terminal Bay
corridor. This is the Blender modeling work.

### 9.1 Scene layout spec

The corridor runs along the X axis. Camera and character travel from x=-10 to x=+12.

```
Camera travel direction: ← to →

x: -10  -8      -5     -2  0   3       8      12  13
   Entry  Console  Data   AI  -  DS   Server  Comms  End
         [PRIMARY] Panels  SCR     Panel  Rack   Array
```

Interactive mesh positions (must be named exactly):

| Mesh name | Position | Object type |
|---|---|---|
| `mesh_console` | (-8, 0, -0.5) | Operator console / terminal desk |
| `mesh_ai_screen` | (-2, 1.2, -1.8) | Wall-mounted monitor, facing +Z |
| `mesh_ds_panel` | (3, 1.2, -1.8) | Smaller data terminal on wall |
| `mesh_server` | (8, 0.5, -0.8) | Server rack (tall, vertical) |
| `mesh_comms` | (13, 2, 0) | Comms antenna array |

### 9.2 CC0 asset sources

Use these instead of purchasing:
- **Quaternius** (quaternius.com) — `Modular Sci-Fi Megakit` (corridor panels, floors, junctions)
- **Quaternius** — `Sci-Fi Essentials Kit` (consoles, screens, holographic stands)
- **Kenney** (kenney.nl) — `Factory Kit` (pipes, cables, wall fixtures)
- **Poly Haven** (polyhaven.com) — floor/wall materials (KTX2 format, web-ready)

Download Poly Haven assets via Blender MCP: `mcp__blender__search_polyhaven_assets`
then `mcp__blender__download_polyhaven_asset`.

### 9.3 Blender MCP corridor setup

Use `mcp__blender__execute_blender_code` for batch operations:

**Step 1 — Base corridor structure:**
```python
import bpy, math

# Clear default objects
bpy.ops.wm.read_factory_settings(use_empty=True)

# ── Materials ──────────────────────────────────────────────────
def mk_mat(name, r, g, b, roughness=0.9, metallic=0.1):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
    bsdf.inputs['Roughness'].default_value  = roughness
    bsdf.inputs['Metallic'].default_value   = metallic
    return mat

mat_floor    = mk_mat('Floor',   0.145, 0.157, 0.137)  # bg-panel
mat_wall     = mk_mat('Wall',    0.180, 0.196, 0.161)  # bg-surface
mat_trim     = mk_mat('Trim',    0.290, 0.314, 0.267, roughness=0.5, metallic=0.6)  # ink-mid
mat_accent   = mk_mat('Accent',  0.371, 0.412, 0.533)  # ink
mat_screen   = mk_mat('Screen',  0.369, 0.906, 0.667, roughness=0.2, metallic=0.0)  # accent-bright
mat_screen.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (0.369, 0.906, 0.667, 1)
mat_screen.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.8

# ── Corridor floor ──────────────────────────────────────────────
bpy.ops.mesh.primitive_cube_add(size=1)
floor = bpy.context.active_object
floor.name = 'corridor_floor'
floor.scale = (24, 0.08, 3.5)
floor.location = (2, -1.04, 0)
floor.data.materials.append(mat_floor)

# ── Corridor ceiling ────────────────────────────────────────────
bpy.ops.mesh.primitive_cube_add(size=1)
ceiling = bpy.context.active_object
ceiling.name = 'corridor_ceiling'
ceiling.scale = (24, 0.05, 3.5)
ceiling.location = (2, 3.5, 0)
ceiling.data.materials.append(mat_floor)

# ── Back wall (Z = -2) ──────────────────────────────────────────
bpy.ops.mesh.primitive_cube_add(size=1)
wall_back = bpy.context.active_object
wall_back.name = 'corridor_wall_back'
wall_back.scale = (24, 2.3, 0.08)
wall_back.location = (2, 1.2, -2.0)
wall_back.data.materials.append(mat_wall)

print("Base corridor created")
```

**Step 2 — Add interactive mesh placeholders with correct names:**
```python
import bpy

def add_named_box(name, sx, sy, sz, px, py, pz, mat):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    obj.location = (px, py, pz)
    obj.data.materials.append(mat)
    return obj

mat_console = bpy.data.materials.get('Trim')
mat_screen  = bpy.data.materials.get('Screen')
mat_server  = bpy.data.materials.get('Floor')
mat_accent  = bpy.data.materials.get('Accent')

add_named_box('mesh_console',   0.8, 1.0, 0.5,   -8,  -0.05, -0.5,  mat_console)
add_named_box('mesh_ai_screen', 1.0, 0.6, 0.05,  -2,   1.2,  -1.85, mat_screen)
add_named_box('mesh_ds_panel',  0.75, 0.5, 0.05,  3,   1.2,  -1.85, mat_screen)
add_named_box('mesh_server',    0.4, 1.5, 0.4,    8,   0.46,  -0.8,  mat_server)
add_named_box('mesh_comms',     0.15, 0.15, 1.0,  13,  2.0,   0.0,   mat_accent)

print("Interactive meshes placed")
```

**Step 3 — Bake AO to vertex colors (optional, improves depth):**
```python
import bpy

# Switch to Cycles for baking
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 64

# Select all mesh objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.vertex_color_add()  # Add vertex color layer
bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
print("AO baked to vertex colors")
```

### 9.4 Export corridor GLB

```python
import bpy, os

project_root = "/home/pablo/projects/portfolio-pablolerner"
output_path  = os.path.join(project_root, "public/models/corridor.glb")

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_animations=False,
    export_materials='EXPORT',
    export_image_format='WEBP',
    use_selection=False,
)
print(f"Exported corridor: {os.path.getsize(output_path)/1024:.1f} KB")
```

### 9.5 Optimize with gltf-transform

```bash
npx gltf-transform optimize \
  public/models/corridor.glb \
  public/models/corridor.glb \
  --compress draco \
  --texture-compress ktx2

# Target: ≤ 1.5MB after optimization
ls -lh public/models/corridor.glb
```

### 9.6 Load corridor in SceneCanvas.astro

Replace the placeholder geometry block in `init3D()` with:

```typescript
gltfLoader.load(
  '/models/corridor.glb',
  (gltf) => {
    scene.add(gltf.scene);

    // Re-collect interactive meshes from loaded GLB
    interactiveMeshes.length = 0;
    ['mesh_console','mesh_ai_screen','mesh_ds_panel','mesh_server','mesh_comms']
      .forEach(name => {
        const obj = gltf.scene.getObjectByName(name);
        if (obj) interactiveMeshes.push(obj);
        else console.warn(`[SceneCanvas] mesh not found in GLB: ${name}`);
      });
  },
  undefined,
  (err) => {
    console.warn('[SceneCanvas] Failed to load corridor.glb:', err);
    // Placeholder boxes remain from Phase 2 — scene still navigable
  }
);
```

Remove the manual `mkBox()` calls once the GLB loads correctly. Keep them as a
fallback by checking `interactiveMeshes.length === 0` and adding placeholders if the
GLB load failed.

---

## Phase 10 — Post-processing (pmndrs)

**Goal:** Selective bloom on screen meshes and android emissive trim. SMAA for clean
edges. ACES filmic tone mapping.

### 10.1 Replace renderer.render() with EffectComposer

In `init3D()`, after renderer setup:

```typescript
const { EffectComposer } = await import('postprocessing');
const { EffectPass }     = await import('postprocessing');
const { RenderPass }     = await import('postprocessing');
const { SelectiveBloomEffect } = await import('postprocessing');
const { SMAAEffect }     = await import('postprocessing');
const { ToneMappingEffect, ToneMappingMode } = await import('postprocessing');

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping      = THREE.NoToneMapping; // let composer handle it

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// SelectiveBloom — only emissive meshes (screens, comms, android trim)
const bloomEffect = new SelectiveBloomEffect(scene, camera, {
  intensity: 1.4,
  luminanceThreshold: 0.65,
  luminanceSmoothing: 0.1,
  radius: 0.88,
  mipmapBlur: true,
});

// Add emissive meshes to bloom selection after GLB loads:
const addToBloom = (name: string) => {
  const obj = scene.getObjectByName(name);
  if (obj) obj.traverse(child => {
    if ((child as THREE.Mesh).isMesh) bloomEffect.selection.add(child as THREE.Mesh);
  });
};
// Call addToBloom for each screen mesh after GLB load:
// addToBloom('mesh_ai_screen'); addToBloom('mesh_ds_panel'); addToBloom('mesh_comms');

composer.addPass(new EffectPass(camera,
  bloomEffect,
  new SMAAEffect(),
  new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
));
```

In `tick()`, replace `renderer.render(scene, camera)` with:
```typescript
composer.render(_delta);
```

Add composer to cleanup:
```typescript
document.addEventListener('astro:before-swap', () => {
  // ... existing cleanup ...
  composer.dispose();
}, { once: true });
```

### 10.2 Validation for Phase 10

- [ ] Screen meshes (`mesh_ai_screen`, `mesh_ds_panel`, `mesh_comms`) glow mint-green
- [ ] Non-emissive geometry does NOT bloom (walls, floor, android body)
- [ ] Edges are clean (no jaggy geometry edges — SMAA working)
- [ ] Frame time ≤ 10ms in DevTools Performance panel
- [ ] No new TypeScript errors (`npm run astro check`)

---

## Phase 11 — Performance & Final Polish

### 11.1 Performance profiling

In the browser console during development:

```javascript
// Check draw calls and triangle count
console.log(renderer.info.render);
// { calls: N, triangles: N, points: N, lines: N, frame: N }
```

Target: `calls ≤ 80`. If above, identify the highest-draw-call objects and:
1. Use `InstancedMesh` for repeated corridor panels/wall tiles
2. Merge static geometry with `BufferGeometryUtils.mergeGeometries()`
3. Share materials across objects with identical appearance

### 11.2 InstancedMesh for repeated panels

```typescript
// Example: 20 repeated wall panels
const panelGeo = new THREE.BoxGeometry(0.8, 1.8, 0.05);
const panelMat = new THREE.MeshStandardMaterial({ color: 0x363b30 });
const panelCount = 20;
const panelInstances = new THREE.InstancedMesh(panelGeo, panelMat, panelCount);

const dummy = new THREE.Object3D();
for (let i = 0; i < panelCount; i++) {
  dummy.position.set(-10 + i * 1.2, 0.5, -1.9);
  dummy.updateMatrix();
  panelInstances.setMatrixAt(i, dummy.matrix);
}
panelInstances.instanceMatrix.needsUpdate = true;
scene.add(panelInstances);
```

### 11.3 On-demand rendering (battery optimization)

Only render when something needs to change:

```typescript
let needsRender = true;
let lastScrollProgress = -1;

function tick() {
  rafId = requestAnimationFrame(tick);
  if (!isVisible || isInTerminalMode()) return;

  const scrollChanged = scrollProgress !== lastScrollProgress;
  lastScrollProgress  = scrollProgress;
  const isAnimating   = mixer && clock.getDelta() > 0.001;

  if (!scrollChanged && !isAnimating && !needsRender) return;
  needsRender = false;

  // ... rest of tick ...
  composer.render(_delta);
}

// Mark dirty on any state change:
canvas.addEventListener('pointermove', () => { needsRender = true; }, { passive: true });
```

### 11.4 Lighthouse audit

```bash
npm run build && npm run preview
# Open http://localhost:4321/en/ in Chrome
# DevTools → Lighthouse → Performance, Accessibility, SEO
```

Targets:
- Performance: ≥ 90 (3D loads lazily after paint)
- Accessibility: ≥ 95 (accessible nav + aria-labels)
- SEO: ≥ 90 (existing hreflang + canonical tags intact)

### 11.5 Final validation checklist

- [ ] `npm run astro check` → 0 errors
- [ ] `npm run build` → clean build, no warnings about missing files
- [ ] All 9 pages render (EN home, EN risk/ai/ds, ES home, ES risk/ai/ds, root redirect)
- [ ] 3D mode: corridor renders, character runs, objects highlight, clicks navigate
- [ ] Terminal mode: existing role selector works perfectly, all project cards visible
- [ ] Toggle persists across refreshes
- [ ] All auto-fallbacks work (reduced-motion, touch, mobile, plain mode, WebGL fail)
- [ ] Loader shows during GLB fetch, fades when ready
- [ ] Scroll hint shows on first visit, hides after first scroll
- [ ] WCAG AA: all text over 3D scene has sufficient contrast
- [ ] Accessible nav links work with keyboard only (no mouse)
- [ ] ES pages behave identically to EN pages
- [ ] Three.js chunk is still code-split (not bundled with app code)
- [ ] Draw calls ≤ 80 in renderer.info
- [ ] Total 3D assets ≤ 2MB in public/models/

---

## Appendix A — Blender MCP Setup

Blender MCP connects Claude Code to a running Blender instance via the Model Context
Protocol. The Blender MCP tools (`mcp__blender__*`) will only work if this is set up.

### A1. Install the Blender addon

1. Download `addon.py` from https://github.com/ahujasid/blender-mcp
2. In Blender: Edit → Preferences → Add-ons → "Install..."
3. Select the downloaded `addon.py`, enable the checkbox
4. In Blender sidebar (N key) → "BlenderMCP" tab → check "Poly Haven" → click "Connect"
5. Blender shows "Connected" when ready

### A2. Verify the connection

Call `mcp__blender__get_scene_info` — it should return a JSON description of the
current Blender scene. If it times out, check:
- Blender is running with the addon enabled
- "Connect to Claude" was clicked (not just the addon installed)
- No firewall is blocking port 9876

### A3. The `execute_blender_code` tool

Most scene building in Phase 3 and 9 uses `mcp__blender__execute_blender_code`. It
runs arbitrary Python in Blender's scripting context. Outputs are in `print()` statements
returned as the tool result. Errors surface as Python tracebacks.

---

## Appendix B — GLB Export Spec from Blender

When exporting from Blender for use in Three.js:

| Setting | Value |
|---|---|
| Format | GLB (binary, single file) |
| Draco compression | Enabled, level 6 |
| Animations | Enabled for android.glb; Disabled for corridor.glb |
| Animation mode | ACTIONS (exports all named actions) |
| Image format | WEBP (for Blender export) → KTX2 via gltf-transform |
| Normals | Export |
| Texcoords | Export |
| Scale | 1.0 (apply scale before export with Ctrl+A → Scale) |
| Origin | Center of mass (apply before export) |
| Y-up | Default Blender export converts to Y-up (GLTFLoader expects Y-up) |

**Interactive mesh naming must be exact:** `mesh_console`, `mesh_ai_screen`,
`mesh_ds_panel`, `mesh_server`, `mesh_comms`. Three.js fetches them by name with
`scene.getObjectByName(name)`.

---

## Appendix C — gltf-transform Asset Pipeline

After every Blender GLB export, run optimization:

```bash
# One-time install (already in devDependencies after Phase 1)
# npm install --save-dev @gltf-transform/cli

# Android character
npx gltf-transform optimize \
  public/models/android.glb \
  public/models/android.glb \
  --compress draco \
  --texture-compress webp

# Corridor environment
npx gltf-transform optimize \
  public/models/corridor.glb \
  public/models/corridor.glb \
  --compress draco \
  --texture-compress ktx2

# Inspect result
npx gltf-transform inspect public/models/android.glb
npx gltf-transform inspect public/models/corridor.glb
```

For KTX2 textures, also add `KTX2Loader` to the GLTFLoader:

```typescript
const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('/basis/');
gltfLoader.setKTX2Loader(ktx2Loader);
```

Copy Basis transcoder to public: `cp -r node_modules/three/addons/libs/basis/ public/basis/`

---

## Appendix D — Licensing Checklist

Before shipping publicly, verify each asset:

| Asset | Source | License | Commercial OK? | Notes |
|---|---|---|---|---|
| Three.js | npm | MIT | ✅ Yes | — |
| GSAP 3.13+ | npm | GSAP Standard | ✅ Free, not OSS | Cannot fork/resell |
| pmndrs/postprocessing | npm | MIT | ✅ Yes | — |
| Android character (Rodin free) | Hyper3D | Rodin ToS §5 | ✅ Yes | Rodin output only, NOT ChatAvatar |
| Android character (Tripo Pro) | Tripo AI | Pro plan | ✅ Yes (paid) | Free plan is CC BY 4.0 public only |
| Android character (Meshy Pro) | Meshy | Pro plan | ✅ Yes (paid) | Free plan is CC BY 4.0 public |
| Corridor assets (Quaternius) | quaternius.com | CC0 | ✅ Yes | No attribution needed |
| Corridor assets (Kenney) | kenney.nl | CC0 | ✅ Yes | No attribution needed |
| Poly Haven materials | polyhaven.com | CC0 | ✅ Yes | No attribution needed |
| Mixamo animations | Adobe | Standard EULA | ⚠️ Verify | Commercial generally OK; do not redistribute separately |

---

## Appendix E — Known Pitfalls

| Pitfall | Description | Fix |
|---|---|---|
| GSAP + RAF jitter | Two animation loops fighting → jitter | Drive character/camera state from GSAP `onUpdate`; tick() only reads state |
| Draco decoder path | DRACOLoader needs decoder files served from a known URL | Copy from `node_modules/three/addons/libs/draco/` to `public/draco/` |
| `three/addons` imports | Must be dynamic imports inside `init3D()` so Vite code-splits them | Never top-level import in an `.astro` `<script>` |
| Mesh name mismatch | `getObjectByName()` returns null if Blender mesh name differs | Check exact names in Blender before export; log warnings if not found |
| ScrollTrigger + pin + terminal mode | Pinned section prevents normal scroll in terminal mode | Disable triggers on mode switch (`ScrollTrigger.getAll().forEach(t => t.disable())`) |
| Two renderers running | AmbientCanvas + SceneCanvas both active in 3D mode | CSS hides `#ambient-canvas` when `[data-portfolio-mode="3d"]` |
| GLB Y-axis | Three.js expects Y-up; Blender is Z-up — GLTF export handles conversion | Apply scale/rotation in Blender before export; use `Ctrl+A → All Transforms` |
| Mixamo FBX import | Mixamo FBX uses cm units → appears 100× too large in Blender | Scale imported FBX by 0.01 in Blender, apply scale before rigging |
| postprocessing + Three.js version | pmndrs postprocessing has peer deps on specific Three versions | Check `postprocessing` README for compatible Three.js version range |
| KTX2 in corridor.glb | KTX2Loader needs `KTX2Loader.setTranscoderPath()` pointing to Basis WASM | Copy `node_modules/three/addons/libs/basis/` to `public/basis/` |

---

## Appendix F — Content Still Needed from Pablo

These are blocked on Pablo providing the content. Do not guess or placeholder:

- [ ] CV PDF → place at `public/pablo-lerner-cv.pdf` (CV ↓ button already wired)
- [ ] Data Scientist repos → add to `src/data/projects.ts` `dsProjects` array
- [ ] LinkedIn About/bio text → needed for Phase 4 About page
- [ ] Architecture diagram + video for game case study (Phase 3 in original plan)
- [ ] Domain name for Cloudflare Pages deploy
