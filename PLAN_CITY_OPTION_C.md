# PLAN — City Portfolio Overhaul (Option C: Atmospheric Procedural)

**Decisión:** 2026-07-01  
**Estado:** PENDIENTE — ejecutar tras reinicio de PC  
**Objetivo:** Reemplazar el home 3D actual (zone pads isométricos) por una ciudad cyberpunk atmosférica donde los proyectos son carteles en una calle.

---

## Concepto

```
[Overlay: ¿Quién sos?]     PersonaSelector.astro (nuevo)
  Recruiter / Engineer / Founder
         ↓
[Escena: Ciudad carga]     PortfolioScene.astro (rediseñado)
  9S aparece al inicio de una calle
  Edificios a los lados, niebla al fondo
  3 billboards alternados con proyectos
         ↓
[Click billboard]          Panel lateral existente (sin cambios)
  Proyectos del rol seleccionado
```

---

## Arquitectura de archivos

### Nuevos
```
src/components/ui/PersonaSelector.astro   ← overlay de persona
public/hdri/cobblestone_street_night_1k.hdr  ← Polyhaven HDRI
```

### Modificados
```
src/components/ui/PortfolioScene.astro    ← overhaul completo de escena
src/pages/en/index.astro                  ← montar PersonaSelector
src/pages/es/index.astro                  ← ídem ES
```

### Intactos (no tocar)
```
src/data/projects.ts          ← fuente de proyectos
src/layouts/Base.astro        ← chrome OS
src/components/ui/AmbientCanvas.astro
public/models/android.glb     ← 9S con Rigify + animaciones
```

---

## Agentes y tracks

### Subagente A — UI Track (PersonaSelector)
**Puede ejecutarse en paralelo con B**

#### A1 — Crear `PersonaSelector.astro`
Componente standalone, overlay fullscreen que aparece **una sola vez por sesión** (flag en `sessionStorage('nier-persona')`).

UI:
```
┌─────────────────────────────────────────────┐
│  UNIT::VISITOR — PROC::IDENTIFY             │
│                                             │
│  Who are you?                               │
│                                             │
│  [ RECRUITER ]  evaluating portfolio        │
│  [ ENGINEER  ]  reviewing technical depth   │
│  [ FOUNDER   ]  assessing problem-solving   │
└─────────────────────────────────────────────┘
```

Reglas de diseño:
- Fondo: `--bg-void` a 95% opacity (translucent)
- Borde externo: `--ink-mid`
- Opción seleccionada: `border-left: 3px solid --accent-bright`
- Hover: `border-left: 2px solid --accent`
- Font: `--font-mono` para etiquetas, `--font-display` para título
- Sin border-radius
- No afecta el contenido por ahora (solo persiste la persona para uso futuro)
- Al seleccionar → overlay se cierra con `opacity: 0` → `display: none` (0.3s)

Props: ninguno. El overlay se auto-oculta en `sessionStorage`.

#### A2 — Montar en `en/index.astro` y `es/index.astro`
```astro
import PersonaSelector from '../../components/ui/PersonaSelector.astro';
---
<PersonaSelector />
<PortfolioScene lang={lang} />
```

El componente hace el check de sessionStorage en su propio script — si ya tiene valor, no renderiza nada.

---

### Subagente B — Assets Track (Blender MCP)
**Puede ejecutarse en paralelo con A**

#### B1 — Descargar HDRI vía Blender MCP
```python
mcp__blender__download_polyhaven_asset(
    asset_id='cobblestone_street_night',
    asset_type='hdris',
    resolution='1k',
    file_format='hdr'
)
```
El archivo se descarga en el path de Blender (Windows): `C:\Users\pablo\AppData\Roaming\Blender Foundation\Blender\*\datafiles\...`
Verificar el path exacto con `get_polyhaven_status` + inspeccionando el output.

#### B2 — Copiar a `public/hdri/`
```bash
# El MCP guarda el HDR en algún path de Blender/Windows
# Buscar y copiar:
find /mnt/c/Users/pablo -name "cobblestone_street_night_1k.hdr" 2>/dev/null
cp <path_encontrado> /home/pablo/projects/portfolio-pablolerner/public/hdri/cobblestone_street_night_1k.hdr
```

#### B3 — (Opcional) Props Polyhaven
Si el tiempo lo permite, descargar:
- `Lantern_01` (models, 1k) → `public/models/props/lantern.glb` — faroles de calle
- `Barrel_01` (models, 1k) → `public/models/props/barrel.glb` — props industriales

Estos son opcionales y se agregan en Phase Polish si el scene base ya está funcionando.

---

### Subagente C — Scene Track (PortfolioScene overhaul)
**Secuencial — empieza tras A y B**

Este es el trabajo central. El agente recibe el contexto del plan y modifica `PortfolioScene.astro`.

#### C1 — Redefinir ZONES para geometría de calle

Reemplazar las posiciones actuales por una calle lineal. Los billboards se alternan a izquierda y derecha:

```javascript
const ZONES = {
  da: { x: -7, z: -8,  color: 0x5ee7aa, side: 'left'  },  // DA — izquierda
  ai: { x:  7, z: -18, color: 0x8fa882, side: 'right' },  // AI — derecha
  ds: { x: -7, z: -28, color: 0x787668, side: 'left'  },  // DS — izquierda
};
const CENTER = { x: 0, z: 4 };  // punto de inicio del personaje (más hacia la cámara)
```

Las keys `da`, `ai`, `ds` quedan iguales → `navigateTo()` y el panel no cambian.

#### C2 — Geometría de calle (buildStreet)

Función separada `buildStreet(THREE, scene)` que construye:

```javascript
// 1. Floor (asfalto)
PlaneGeometry(22, 80) en y=0, color #1b1e1a, centrado en z=-28

// 2. Sidewalks (veredas)
PlaneGeometry(6, 80) en x=±11, y=0.01, color #252820

// 3. Lane line (centro de calle)
PlaneGeometry(0.12, 4.5) repetido cada 9 unidades de z=-4 a z=-60, color #363b30

// 4. Edificios izquierda (x ≈ -14)
Posiciones: z=-6, -15, -24, -33, -42
Heights: 14, 20, 11, 17, 13 (variar para skyline)
BoxGeometry(w, h, 3.5) + EdgesGeometry (color --ink) + ventanas emissivas

// 5. Edificios derecha (x ≈ +14)
Posiciones: z=-6, -15, -24, -33, -42
Heights: 16, 12, 22, 15, 18

// 6. Ventanas emissivas (Option C — diferenciador)
PlaneGeometry(0.55, 0.38) por ventana
Material: MeshBasicMaterial { color: #8fa882, opacity: 0.55 }
~60% de ventanas encendidas (Math.random() < 0.6)
Solo en la cara que mira a la calle
```

#### C3 — Fog + iluminación atmosférica

```javascript
// Fog
scene.fog = new THREE.FogExp2(0x1b1e1a, 0.038);

// Luces base
scene.add(new THREE.HemisphereLight(0x2e3229, 0x1b1e1a, 0.9));
const key = new THREE.DirectionalLight(0xb0ac9c, 0.7);
key.position.set(8, 20, 5);
scene.add(key);

// Ambient fill
scene.add(new THREE.AmbientLight(0x252820, 0.5));
```

#### C4 — Ajuste de cámara para perspectiva de calle

Cámara actual: `position(0, 4, 9)` mirando `(0, 0.5, -1)` — isométrica alta.

Nueva cámara inicial:
```javascript
camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 80);
camera.position.set(0, 4.5, 12);
camera.lookAt(0, 2, -5);
```

Camera follow (línea ~528 actual) ajustar:
```javascript
// Actual:
camera.position.set(camTgtX, 3.2, camTgtZ + 6.5);
camera.lookAt(lookX, 0.7, lookZ - 1.0);

// Nuevo (vista de calle, cámara más baja, mira al frente):
camera.position.set(camTgtX * 0.3, 4.0, camTgtZ + 9);
camera.lookAt(camTgtX * 0.2, 1.8, camTgtZ - 6);
```

#### C5 — Billboards 3D (reemplaza zone pads)

Cada zone genera un billboard en lugar de un pad flat:

```javascript
function buildBillboard(THREE, scene, zone, key, projectData) {
  // Pole
  CylinderGeometry(0.07, 0.07, 9) → y=4.5 → color #363b30

  // Frame
  BoxGeometry(5.2, 3, 0.12) → y=9.5
  EdgesGeometry → color zone.color (mint para DA, olive para AI, dim para DS)
  Rotación Y leve: side === 'left' ? +0.06rad : -0.06rad (mira al centro)

  // Canvas texture (proyecto más destacado del zone)
  canvas 512×320 con:
    - barra izquierda --accent-bright (4px)
    - "SYSTEM::PROJECT · {ROLE}" en sand-dim
    - nombre del proyecto en sand bold
    - stack en sand-dim pequeño
    - "◆ outcome" en accent-bright
    - "[ REVIEW ↗ ]" CTA

  // Hitbox invisible (para raycaster — reemplaza el pad)
  PlaneGeometry(5.2, 3) invisible, misma posición que frame
  userData = { zone: key }  ← raycaster lo detecta igual que antes

  // Glow light
  PointLight(zone.color, 3.0, 16) → y=9, encima del billboard
}
```

El raycaster existente (`intersectObjects(zoneMeshes.map(z => z.mesh))`) funciona sin cambios si los hitboxes tienen `userData.zone`.

#### C6 — HDRI como environment map

```javascript
// Lazy load AFTER scene renders first frame
async function loadHDRI(THREE, scene, renderer) {
  const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js');
  const loader = new RGBELoader();
  loader.load('/hdri/cobblestone_street_night_1k.hdr', (texture) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromEquirectangular(texture).texture;
    scene.environment = envMap;       // reflections en materiales
    // scene.background = envMap;    // NO — background es void oscuro
    texture.dispose();
    pmrem.dispose();
  });
}
// Llamar tras primer render:
requestIdleCallback(() => loadHDRI(THREE, scene, renderer), { timeout: 3000 });
```

Si el HDR no carga (offline / error), el scene funciona igual sin environment map.

#### C7 — Panel lateral: ajuste mínimo de texto

El panel ya funciona. Solo cambiar:
```javascript
// Antes:
document.getElementById('panel-sys').textContent = 'ZONE · ' + N + ' RECORDS';

// Después:
document.getElementById('panel-sys').textContent = 'BILLBOARD::' + zoneLabels[zone].toUpperCase() + ' · ' + N + ' PROJECTS';
```

#### C8 — Verificar mobile fallback

El fallback 2D (`ps-fallback`) ya existe con links a `/en/risk/`, `/en/ai/`, `/en/ds/`. Confirmar que sigue activo en `width < 768`. No hay cambios necesarios.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `RGBELoader` no en core de Three.js | Import desde `three/examples/jsm/loaders/RGBELoader.js` — disponible en Three.js 0.160+ |
| Raycaster no detecta frame 3D (BoxGeometry fino) | Hitbox invisible PlaneGeometry por encima — mismo pattern que los pads actuales |
| FogExp2 density demasiado fuerte en mobile | Guard: `const fogDensity = window.innerWidth < 768 ? 0 : 0.038` |
| HDRI 1k (~600KB) bloquea first render | Lazy con `requestIdleCallback` post-primer-frame |
| Billboard CanvasTexture con texto — font no cargada | Usar `document.fonts.ready.then(...)` antes de dibujar el canvas, fallback a `"Courier New"` |
| `navigateTo(zone)` tiene offset `pos.z + 2.2` hardcodeado | Cambiar a `pos.z + 3.5` para que el char quede frente al cartel, no debajo |
| Camera follow actual usa `camTgtZ + 6.5` | Ajustar a `camTgtZ + 9` para dar más perspectiva de calle |

---

## Secuencia de ejecución

```
┌─────────────────────────────────────────────────┐
│  FASE 1 (paralelo) — ~1 día                     │
│  Subagente A: PersonaSelector.astro             │
│  Subagente B: HDRI download + copy              │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  FASE 2 (secuencial) — ~1-2 días                │
│  Subagente C: PortfolioScene overhaul           │
│  Goals C1 → C8 en orden                         │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  FASE 3 — Integración + polish                  │
│  Orchestrator: combinar todo, verificar         │
│  ES mirror: es/index.astro                      │
│  Polish: fog, hover glow, transitions           │
└─────────────────────────────────────────────────┘
```

---

## Checklist de verificación final

- [ ] PersonaSelector aparece en primera visita, no en segunda
- [ ] Persona se guarda en sessionStorage
- [ ] Ciudad carga: calle + edificios + niebla visible
- [ ] 3 billboards visibles con datos reales de `projects.ts`
- [ ] Click en billboard → panel lateral con proyectos del role
- [ ] 9S camina hacia el billboard al hacer click
- [ ] Camera sigue al personaje con perspectiva de calle
- [ ] HDRI aplica reflecciones en materiales (no como background)
- [ ] Mobile: 2D fallback activo, links a /risk/ /ai/ /ds/ funcionan
- [ ] ES: mismo comportamiento en /es/
- [ ] `prefers-reduced-motion`: escena muestra estado final sin animaciones
- [ ] Build de producción sin errores (`npm run build`)
