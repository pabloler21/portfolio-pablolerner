# PLAN — Phase 3.6: Animación · WASD · Billboards · Typewriter

**Estado:** PENDIENTE  
**Fecha:** 2026-07-01  
**Archivo central:** `src/components/ui/PortfolioScene.astro`

---

## Contexto

La ciudad cyberpunk funciona (calle, edificios, billboards, panel de proyectos, PersonaSelector). Quedan 4 problemas/mejoras identificados visualmente:

1. **T-pose** — el personaje carga el GLB pero queda en bind pose. El `AnimationMixer` existe pero ninguna acción está activa porque `findByName` no encuentra los clips.
2. **Billboards muy altos** — frame en `y=9.5`, polo de 9 unidades. Desde la cámara en perspectiva de calle quedan fuera de cuadro o muy lejos.
3. **Sin movimiento libre** — solo click-to-navigate. El usuario quiere explorar con WASD.
4. **Texto del panel instantáneo** — los proyectos aparecen de golpe. Se quiere efecto typewriter estilo terminal YoRHa.

---

## Arquitectura de agentes

```
┌─────────────────────────────────────────────────────────┐
│  ORQUESTADOR (Claude Code principal)                    │
│  - Lee estado actual del archivo                        │
│  - Lanza Subagente A y B en paralelo (worktrees)        │
│  - Mergea resultados                                    │
│  - Corre build final y reporta                          │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
                ▼                     ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│  SUBAGENTE A         │   │  SUBAGENTE B                 │
│  Animation + WASD    │   │  Billboards + Typewriter     │
│                      │   │                              │
│  Secciones tocadas:  │   │  Secciones tocadas:          │
│  - shared state      │   │  - buildBillboard()          │
│  - init() eventos    │   │  - showPanel()               │
│  - gltf try/catch    │   │  - typeOut() helper (nueva)  │
│  - tick() movement   │   │                              │
│  - onCanvasClick()   │   │                              │
└──────────────────────┘   └──────────────────────────────┘
```

Los subagentes trabajan en secciones distintas del script. Si se usan worktrees aislados pueden correr en paralelo sin conflicto. En secuencia: A primero (movimiento), B segundo (visual).

---

## Subagente A — Animación + WASD

**Archivo:** `src/components/ui/PortfolioScene.astro` (sección `<script>`)

### A1 — Fix T-pose

**Root cause:** `THREE.AnimationClip.findByName(clips, 'Walk_Loop')` requiere match exacto. Si el exportador de Blender agrega prefijo de objeto o varía el casing, `walkClip` y `idleClip` quedan `null` → mixer sin acciones activas → bind pose (T-pose).

**Cambio** — en el bloque `try/catch` del GLTFLoader, después de `const clips = gltf.animations`:

```js
// ANTES
const walkClip = THREE.AnimationClip.findByName(clips, 'Walk_Loop');
const idleClip = THREE.AnimationClip.findByName(clips, 'Idle_Loop');

// DESPUÉS
const walkClip = clips.find(c => c.name.toLowerCase().includes('walk')) ?? null;
const idleClip = clips.find(c => c.name.toLowerCase().includes('idle'))
              ?? clips.find(c => !c.name.toLowerCase().includes('walk'))
              ?? null;
```

Si `idleClip` sigue siendo null después del fallback, usar `clips[0]` para garantizar que alguna animación inicia (evitar T-pose silencioso).

### A2 — Estado compartido WASD

Agregar al bloque de shared state (junto a `let mixer = null` etc.):

```js
const keys = {};
const WALK_SPEED = 0.1;
```

### A3 — Key listeners en init()

Agregar después del bloque de event listeners existente (canvas click, canvas mousemove, ps-back, etc.):

```js
/* WASD — scoped to movement keys only so we don't block browser shortcuts */
const WASD_CODES = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
document.addEventListener('keydown', e => {
  if (WASD_CODES.includes(e.code)) { keys[e.code] = true; e.preventDefault(); }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
```

### A4 — Bloque de movimiento en tick()

Reemplazar el bloque actual de character movement (desde `const dx = targetX - charX` hasta `if (isMoving) onArrival(activeZone); isMoving = false;`) con:

```js
/* WASD input */
const wsadX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
const wsadZ = (keys['KeyS'] || keys['ArrowDown']  ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp']   ? 1 : 0);
const wsadOn = !reduced && (wsadX !== 0 || wsadZ !== 0);

let nowMoving = false;

if (wsadOn) {
  const len = Math.sqrt(wsadX * wsadX + wsadZ * wsadZ);
  charX += (wsadX / len) * WALK_SPEED;
  charZ += (wsadZ / len) * WALK_SPEED;
  if (charGroup) charGroup.rotation.y = Math.atan2(wsadX, wsadZ);
  targetX = charX; targetZ = charZ;  /* cancel any pending click-target */
  nowMoving = true;
} else {
  /* auto-walk toward click target */
  const dx = targetX - charX;
  const dz = targetZ - charZ;
  const dist2 = dx * dx + dz * dz;
  if (dist2 > 0.003) {
    charX += dx * (reduced ? 1 : 0.035);
    charZ += dz * (reduced ? 1 : 0.035);
    if (charGroup && dist2 > 0.01) charGroup.rotation.y = Math.atan2(dx, dz);
    nowMoving = true;
  } else {
    if (isMoving) onArrival(activeZone);
    nowMoving = false;
  }
}
isMoving = nowMoving;
```

### A5 — onCanvasClick abre panel directo

```js
// ANTES
function onCanvasClick(THREE, e) {
  const zone = getZoneHit(THREE, e);
  if (zone) navigateTo(zone);
}

// DESPUÉS
function onCanvasClick(THREE, e) {
  const zone = getZoneHit(THREE, e);
  if (zone) showPanel(zone);
}
```

El usuario explora con WASD, cuando ve un cartel lo clickea y el panel abre directamente sin animación de caminata forzada.

### A6 — HUD hint actualizado

```js
// ANTES
const hintLabel = lang === 'en' ? 'CLICK BILLBOARD TO NAVIGATE' : 'CLICK CARTEL PARA NAVEGAR';

// DESPUÉS
const hintLabel = lang === 'en' ? 'WASD TO WALK · CLICK BILLBOARD' : 'WASD PARA CAMINAR · CLICK CARTEL';
```

---

## Subagente B — Billboards + Typewriter

**Archivo:** `src/components/ui/PortfolioScene.astro` (funciones `buildBillboard`, `showPanel`, nueva `typeOut`)

### B1 — Billboards más bajos

Cambios en `buildBillboard(THREE, key, zone)`:

| Elemento | Valor actual | Valor nuevo |
|---|---|---|
| Pole `CylinderGeometry` height | `9` | `5` |
| Pole `position.y` | `4.5` | `2.5` |
| Frame `position.y` | `9.5` | `4.5` |
| Texture billboard `position.y` | `9.5` | `4.5` |
| Hitbox `position.y` | `9.5` | `4.5` |
| Label sprite `position.y` | `12.2` | `7.0` |
| PointLight `position.y` | `9` | `5.0` |

Con cámara a `y=4.0` siguiendo al personaje, los billboards a `y=4.5` quedan a la altura de la vista — legibles desde frente y desde lejos.

El offset de la textura (signZ: `±0.07`) y la hitbox (`±0.08`) no cambian — solo la `y`.

### B2 — Helper typeOut

Agregar antes de la función `showPanel`:

```js
function typeOut(el, text, msPerChar) {
  el.textContent = '';
  let i = 0;
  (function step() {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(step, msPerChar);
    }
  })();
}
```

### B3 — showPanel con typewriter + stagger

Modificar `showPanel(zone)`:

1. **Panel title** → typewriter a 28ms/char:
   ```js
   typeOut(document.getElementById('panel-title'), zoneLabels[zone], 28);
   ```

2. **Sys text** → asignar instantáneo (es metadata, no contenido principal):
   ```js
   document.getElementById('panel-sys').textContent =
     'BILLBOARD::' + zoneLabels[zone].toUpperCase() + ' · ' + (zoneProjects[zone].length || 0) + ' PROJECTS';
   ```

3. **Cards** → cada card aparece con stagger + typewriter en el nombre:
   ```js
   projects.forEach((p, idx) => {
     const el = document.createElement('div');
     el.className = 'panel-card' + (p.featured ? ' featured' : '');
     el.style.opacity = '0';
     el.style.transition = 'opacity 0.2s ease';
     el.innerHTML = `
       <div class="card-top">
         <span class="card-badge">${p.status}</span>
         <div class="card-links">
           ${p.demo ? `<a href="${p.demo}" target="_blank" rel="noopener" class="card-link">LIVE ↗</a>` : ''}
           <a href="${p.github}" target="_blank" rel="noopener" class="card-link">CODE ↗</a>
         </div>
       </div>
       <div class="card-name"></div>
       <div class="card-desc">${p.desc}</div>
       ${p.outcome ? `<div class="card-outcome">◆ ${p.outcome}</div>` : ''}
     `;
     cards.appendChild(el);

     setTimeout(() => {
       el.style.opacity = '1';
       typeOut(el.querySelector('.card-name'), p.name, 18);
     }, idx * 120 + 80);
   });
   ```

**Nota:** `card-desc` y `card-outcome` se revelan con el fade-in de la card (opacity transition). Solo el nombre hace typewriter — es lo más impactante sin ser lento.

---

## Orquestador — Pasos de integración

1. Lanzar A y B en paralelo (o en secuencia si no se usan worktrees)
2. Si en paralelo: mergear manualmente los cambios de cada worktree al main
3. Correr `npm run build` — verificar 0 errores
4. Confirmar con Pablo que recarga `localhost:4321` y ve:
   - Personaje en idle animation (no T-pose)
   - WASD mueve el personaje con walk animation
   - Billboards visibles a nivel de calle
   - Click en cartel → panel con typewriter

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Clips siguen sin encontrarse incluso con `includes()` | Fallback final: `clips[0]` para idle, `clips[1]` para walk si existen |
| WASD bloquea scroll de página en otros contextos | `preventDefault()` solo para `WASD_CODES` — otras teclas no bloqueadas |
| Typewriter muy lento con nombres largos | Cap: si `text.length > 40` usar `msPerChar = 10` |
| Billboard y hitbox desalineados al bajar y | El signZ offset es relativo a `zone.z`, no a `y` — no se afecta |
| `onCanvasClick` sin walk puede sentirse abrupto | Panel ya tiene transition `0.3s ease` al abrir — suficiente feedback |

---

## Checklist de verificación

- [ ] `npm run build` sin errores
- [ ] Personaje en idle animation al cargar (no T-pose)
- [ ] WASD mueve el personaje; walk animation activa al moverse
- [ ] Click en billboard → panel abre con typewriter en título y card-names
- [ ] Billboards visibles a nivel de calle desde perspectiva de cámara
- [ ] HUD muestra "WASD TO WALK · CLICK BILLBOARD"
- [ ] Reducción de movimiento: WASD inactivo, animaciones instantáneas
- [ ] Mobile fallback 2D intacto (no afectado por cambios)
