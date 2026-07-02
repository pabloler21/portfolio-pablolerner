## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## 3D Side-Scroller Implementation Context

The project has a detailed implementation plan for the 3D landing page:
**`PLAN_BLENDER_MCP_NIER.md`**. Read this file fully before working on any 3D,
Blender, or Three.js task. It is the single source of truth for the YoRHa
Operations Terminal Bay scene.

### Key architectural decisions (locked)

- **Stack:** Astro + vanilla Three.js `^0.185.0`. **Do NOT add React, R3F, or any
  other framework renderer.**
- **Add-on packages:** `gsap` ^3.13.0 and `postprocessing` ^7.x are expected to be
  installed in Phase 1.
- **3D assets:** `public/models/android.glb` (character) and
  `public/models/corridor.glb` (environment). Assets are built in Blender and must
  stay under the performance budget defined in the plan.
- **Draco decoder:** must be copied to `public/draco/` from
  `node_modules/three/addons/libs/draco/`.
- **Mode system:** the page toggles between `'3d'` and `'terminal'` modes via
  `localStorage['pabloler-mode']` and `html[data-portfolio-mode]`. Both modes live
  on the same URLs (`/en/`, `/es/`).
- **Auto-fallback to terminal mode** is required for:
  - `prefers-reduced-motion: reduce`
  - `(hover: none)` touch devices
  - viewport `< 768px`
  - `data-plain` on `<html>`
  - missing WebGL context
  - failed `import('three')`

### Blender MCP connection

All Blender work in this project is done through the **Blender MCP** (Model Context
Protocol) tools.

- **Host:** `localhost`
- **Port:** `9876`
- **Tool prefix:** `mcp__blender__*`
- **Verification:** call `mcp__blender__get_scene_info` before starting any Blender
  operation to confirm the connection is alive.
- Blender Python scripts are executed via `mcp__blender__execute_blender_code`.
- Asset generation uses `mcp__blender__generate_hyper3d_model_via_text` and related
  Hyper3D / Hunyuan3D / Sketchfab tools.

Make sure the Blender MCP addon is installed, enabled, and showing "Connected" in
Blender's sidebar before running any MCP tool.

### Existing code you must NOT rewrite

The terminal portfolio is fully built. Treat these as read-only unless the plan
explicitly asks you to modify them:

- `src/styles/tokens.css`
- `src/styles/global.css`
- `src/layouts/Base.astro`
- `src/layouts/RoleLayout.astro`
- `src/pages/en/index.astro` and `src/pages/es/index.astro` (except for the
  specific 3D wiring in the plan)
- `src/data/projects.ts`
- `src/components/ui/AmbientCanvas.astro`
- `src/components/ui/ProjectCard.astro`
- `src/components/ui/BootScreen.astro`, `StatusBar.astro`, `TabBar.astro`,
  `DotRow.astro`

### Interactive mesh names (Blender ↔ Three.js contract)

These names must match exactly in Blender and in the Three.js raycaster code:

| Mesh name | Destination |
|---|---|
| `mesh_console` | `/en/risk/` |
| `mesh_ai_screen` | `/en/ai/` |
| `mesh_ds_panel` | `/en/ds/` |
| `mesh_server` | `https://github.com/pabloler21` |
| `mesh_comms` | `mailto:lerner.pb@gmail.com` |

### Validation gates

After any implementation phase in `PLAN_BLENDER_MCP_NIER.md`, run:

```bash
npm run astro check   # TypeScript must be error-free
npm run build         # production build must succeed
```

Do not proceed to the next phase until both commands pass.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
