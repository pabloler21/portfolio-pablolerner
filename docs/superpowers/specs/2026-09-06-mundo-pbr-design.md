# Diseño — El mundo sube a donde está el personaje

**Fecha:** 2026-09-06
**Rama:** `redesign/mundo-pbr`
**Estado:** aprobado por Pablo, pendiente de plan de implementación
**Dirección elegida:** A — La ciudad se vuelve real (de tres presentadas en companion visual)
**Calibración elegida:** A2 — media (de tres presentadas en companion visual)

---

## 1. Problema

Remy se siente pegado encima de la escena, no dentro de ella. Lee como una **antorcha
naranja fluorescente** en una ciudad azul fría.

El diagnóstico, medido en vivo sobre la escena construida —no leído del código:

| Medición | Valor |
|---|---|
| `MeshBasicMaterial` en la escena | **23** |
| `MeshStandardMaterial` en la escena | **0** |
| Luces en la escena | 5 |
| Objetos que esas 5 luces iluminan | **1** (Remy) |
| Geometría de toda la ciudad | ~25 primitivas |
| `renderer.toneMapping` | sin definir |

Tres causas encadenadas, en orden de importancia:

1. **El personaje está iluminado por otro mundo.** `PortfolioScene.astro:995` carga
   `cobblestone_street_night_1k.hdr` como `scene.environment`: un HDRI de una calle
   empedrada real de noche, con luz de sodio cálida. Como toda la ciudad es `MeshBasic`
   —material que no recibe luz— ese HDRI **no ilumina nada más que a Remy**. Es un
   environment map que existe exclusivamente para el personaje y le aplica la luz de
   una película distinta a la que se ve en pantalla.
2. **No hay tone mapping.** El renderer define `outputColorSpace` pero nunca
   `toneMapping`. Los altos recortan.
3. **El bloom agarra justo eso.** `UnrealBloomPass(0.6, 0.4, threshold 0.4)` toma los
   altos recortados de brazos, hombros y muslos y los difumina.

Y por debajo de las tres: **no tiene sombra de contacto** (`shadowMap.enabled = false`),
así que flota. Los carteles tienen anillo en el piso y las farolas disco de glow; el
personaje no tiene nada que lo apoye.

La ciudad no está limitada por Three.js. Está limitada por una decisión de estilo:
edificios, veredas, farolas y skyline son planos pintados, no objetos iluminados.

---

## 2. Principio rector

> **La luz es del mundo. La interfaz no se ilumina.**

Todo lo que es **atmósfera** —asfalto, veredas, edificios, postes, líneas de carril—
pasa a PBR iluminado con sombras.

Todo lo que es **información** —carteles, end-cap, HUD, minimapa, chevrons, anillos de
piso, unit tag, dossier, neones, skyline— queda exactamente como está: plano, self-lit,
gráfico, cero radius.

No es una regla nueva. Es la misma doctrina de `surface: 'game' | 'doc'` de la fase 3.19
—*la atmósfera existe sólo donde el visitante puede caminar*— aplicada **adentro** de la
escena 3D en vez de entre páginas.

Este principio es el guardarraíl contra el único riesgo real de la dirección A: que
iluminar todo corra el sitio de "terminal YoRHa" a "juego indie de ciudad nocturna".

---

## 3. Calibración

Se renderizaron tres niveles de luz sobre la escena real (parche temporal por query
param, mismo encuadre / misma posición / mismo bloom). Elegida **A2**:

| Parámetro | A1 sobria | **A2 elegida** | A3 cinematográfica |
|---|---|---|---|
| `toneMappingExposure` | 0.95 | **1.25** | 1.55 |
| `HemisphereLight.intensity` | 1.2 | **2.0** | 2.7 |
| `AmbientLight.intensity` | 0.50 | **0.85** | 1.10 |
| `DirectionalLight.intensity` | 1.0 | **1.7** | 2.4 |
| Farolas (cantidad × intensidad) | 6 × 14 | **8 × 24** | 8 × 34 |

**Por qué A2.** A1 arregla el color y rompe la legibilidad por el otro lado: el personaje
se pierde por falta de luz en vez de por exceso, y los edificios se aplastan a negro.
A3 es la mejor imagen suelta pero las fachadas iluminadas empiezan a leerse como
geometría de juego — es exactamente el riesgo de §2.

En A2 se leen remera, shorts y piernas, hay sombra proyectada visible en el asfalto, y
los edificios siguen siendo siluetas negras con ventanas: la planitud gráfica sobrevive.

---

## 4. Pipeline de render

```js
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
```

**Bloom re-calibrado:** `UnrealBloomPass(size, 0.45, 0.35, 0.62)` — de `(0.6, 0.4, 0.4)`.

El umbral actual de 0.4 existe porque no había nada emisivo legítimo en la escena: lo
único que lo superaba era el personaje. Con pantallas y farolas self-lit el umbral sube
para que el bloom agarre pantallas, no piel.

`RenderPass` entrega lineal y el tone mapping lo aplica `OutputPass`, así que
**`toneMappingExposure` no cambia qué objetos hacen bloom** — sólo el brillo final.
El umbral se calibra contra la luz de escena, no contra la exposición.

**HDRI eliminado sin reemplazo.** Se borran `loadHDRI()`, su `requestIdleCallback`, y el
archivo `public/hdri/cobblestone_street_night_1k.hdr`. Con hemisférica + farolas reales
alcanza. Beneficio secundario: **1.7 MB menos** de descarga.

---

## 5. Materiales

Regla de partición, validada en el preview:

```
MeshBasic opaco y sin .map      →  MeshStandardMaterial (roughness .93, metalness .04)
transparent | additive | .map   →  intacto
```

No es heurística: mapea 1:1 con §2. Todo lo que tiene `.map` es una pantalla canvas
(información); todo lo transparente o aditivo es un glow (información/FX).

Convierte: asfalto, veredas, líneas de carril, edificios, postes y cabezas de farola.
Deja intactos: ventanas, conos de glow, carteles, end-cap, anillos de piso, chevrons,
partículas, estrellas, neones, skyline.

**Se construyen así desde el origen, no por `traverse` post-hoc.** La conversión por
traversal fue correcta para un preview descartable, pero en producción es el antipatrón
de la lección 17 —estado pisado sobre un conjunto fijo de objetos—. `buildStreet()` y
`buildCityDressing()` crean `MeshStandardMaterial` directamente.

---

## 6. Luz

| Luz | Rol | Intensidad | Sombra |
|---|---|---|---|
| `HemisphereLight(0x2a3040, 0x0d0f14)` | ambiente cielo/piso | 2.0 | no |
| `DirectionalLight(0xa0a8b8)` | luna — **única** que proyecta | 1.7 | **sí** |
| `PointLight(0xcfe3d8)` × 8 | pozos de luz en el asfalto | 24, dist 16, decay 2 | no |
| `AmbientLight(0x1c2030)` | relleno | 0.85 | no |
| ~~`PointLight` del personaje~~ | **eliminada** | — | — |

### Presupuesto rotativo de farolas — pool fijo

Las 8 point lights se crean **una sola vez** y se **reposicionan** a los 8 postes más
cercanos al personaje. Nunca se crean ni se destruyen durante el juego.

Esto no es una optimización de GC: **en Three.js cambiar la cantidad de luces de la
escena fuerza a recompilar el shader de todos los materiales iluminados**. Un pool de
tamaño constante que sólo se mueve evita ese hitch por completo.

Recálculo con throttle **cada 4 frames**, montado sobre el mismo contador que ya usa el
chequeo de proximidad de los carteles — no por frame.

---

## 7. Sombras

- **Proyectan:** edificios, postes de farola, personaje.
- **Reciben:** asfalto, veredas.
- **Una sola luz con `castShadow`:** la direccional. Ocho farolas con sombra serían 48
  renders de cara de cubo por frame — inviable.

**La shadow camera sigue al personaje** en vez de cubrir la avenida entera:

```js
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.bias = -0.0007;
const c = dir.shadow.camera;
c.left = -14; c.right = 14; c.top = 14; c.bottom = -14; c.near = 1; c.far = 60;
dir.position.set(charX + 8, 20, charZ + 6);
dir.target.position.set(charX, 0, charZ);
```

Una caja de 28u sobre 2048² da ~73 texels/unidad, contra ~32 si cubriera la avenida
completa. Misma memoria, sombra mucho más nítida. La posición y el target se actualizan
en el mismo throttle de 4 frames que las farolas.

---

## 8. El personaje

- **Se elimina** el `PointLight(0xcfd8e6, 0.85, 8)` colgado de `charGroup`. Era una
  prótesis para un personaje sin mundo; con mundo no hace falta. Su comentario en
  `PortfolioScene.astro` y la nota correspondiente en `CLAUDE.md` se actualizan.
- **El GLB no se toca.** Mismos materiales, mismo rig, mismos clips
  (`Running` / `Walking` / `Idle`), mismo pipeline de animación. La regla de CLAUDE.md
  —*el personaje conserva SUS materiales*— sigue vigente y ahora por fin tiene sentido:
  conserva sus materiales **porque hay una escena que los ilumina**.
- `castShadow` y `receiveShadow` en sus meshes.

---

## 9. Rendimiento

Punto de partida: 0 shadow maps, todo `MeshBasic`. Extremadamente barato.
Punto de llegada: 1 shadow map 2048², ~25 materiales Standard, 8 point lights.

**El riesgo son las point lights:** cada una encarece el fragment shader de todo material
iluminado. Palancas si no da, en orden: bajar a 4 farolas → shadow map a 1024² →
`BasicShadowMap` en lugar de `PCFSoftShadowMap`.

**Se mide y se reporta frame time; no se pone un gate.** Headless SwiftShader corre ~10×
más lento que una GPU real (lecciones 3 y 20), así que cualquier umbral absoluto en
`verify:ui` mentiría. La comparación válida es relativa: mismo equipo, antes contra
después.

---

## 10. Lo que no cambia

Carteles y su contenido canvas · end-cap · dossier · minimapa · HUD de records ·
chevrons · anillos de piso · partículas · estrellas · neones · skyline · WASD y sprint ·
cámara y su lag · layout de avenida · proximidad y power-on · PersonaSelector ·
intro cinematográfica · páginas de rol · tokens CSS · i18n.

**Cero cambios.**

---

## 11. Archivos muertos

`dist/models/` pesa **55 MB** y sólo se referencia `remy.glb` (7.3 MB). Se despliegan
48 MB de GLBs muertos.

| Archivo | Acción |
|---|---|
| `remy.glb` | queda en `public/models/` |
| `android_backup.glb` | **mover** a `assets/models/` (fuera de `public/`, sigue en el repo) |
| `android.glb`, `android_previous.glb`, `android_pre_bake.glb`, `android_broken_spider.glb`, `320a534d668f46859f4f61579e3ef4ad.glb` | `git rm` |
| `public/hdri/cobblestone_street_night_1k.hdr` | `git rm` (§4) |

CLAUDE.md marca `android_backup.glb` como **PERMANENT BACKUP — never overwrite**. Mover
no es sobrescribir: el archivo se conserva, sólo deja de desplegarse. Los cinco borrados
siguen recuperables del historial de git.

Resultado esperado: `dist/models/` de 55 MB → **7.3 MB**. Sumado al HDRI de §4, el
deploy baja **49.7 MB** en total.

> **Pendiente de confirmación de Pablo.** Si prefiere que `android_backup.glb` siga en
> `public/`, el paso se reduce a borrar los otros cinco y `dist/models/` queda en 13.5 MB.

---

## 12. Accesibilidad y `prefers-reduced-motion`

PBR y sombras **no son movimiento**: quedan activos con `prefers-reduced-motion: reduce`.
El guard sigue aplicando sólo donde ya aplica —bloom, intro cinematográfica— según la
lección 8: el guard es para animación visual, nunca para input ni para el estado base.

No hay texto nuevo, así que no hay impacto en contraste ni en el piso de 11px. Los
criterios C1/C6 de `verify:ui` no se tocan.

---

## 13. Criterios de aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| A1 | `toneMapping = ACESFilmic`, `exposure = 1.25` | grep en fuente |
| A2 | Cero referencias a `RGBELoader` / `scene.environment`; `public/hdri/` no existe | grep + `ls` |
| A3 | `charGroup` no contiene ningún `PointLight` | grep en fuente |
| A4 | Cantidad de luces constante durante el juego (pool fijo) | grep: creación de luces sólo en init |
| A5 | Asfalto, veredas y edificios usan `MeshStandardMaterial` | grep en `buildStreet` |
| A6 | Carteles, anillos, chevrons y glows siguen `MeshBasic` | grep |
| A7 | Exactamente un `castShadow = true` sobre una luz | grep |
| A8 | `dist/models/` ≤ 8 MB (≤ 14 MB si Pablo conserva `android_backup.glb` en `public/`, ver §11) | `du -sh dist/models` |
| A9 | `npm run verify:ui` sigue 9/9 | ejecución |
| A10 | Frame time reportado antes/después en el mismo equipo | probe de RAF |
| A11 | Captura de la escena: sin naranja, con sombra proyectada | revisión visual de Pablo |

---

## 14. Plan de commits

Pablo pidió **commits chicos y frecuentes, testeados, con push a medida**. Cada paso
cierra con build + captura de la escena + commit + push.

| # | Paso | Verificación |
|---|---|---|
| 1 | Tone mapping ACES + eliminar HDRI y `loadHDRI()` | captura: desaparece el naranja |
| 2 | Materiales PBR construidos en `buildStreet` / `buildCityDressing` | captura + `verify:ui` |
| 3 | Shadow map + shadow camera siguiendo al personaje | captura: sombra proyectada |
| 4 | Pool fijo de 8 farolas con presupuesto rotativo | captura + frame time |
| 5 | Eliminar el `PointLight` del personaje + `castShadow` en sus meshes | captura |
| 6 | Re-calibrar bloom a `(0.45, 0.35, 0.62)` | captura |
| 7 | Limpieza de GLBs muertos y del HDRI | `du -sh dist/models` |
| 8 | Actualizar `CLAUDE.md` (fase 3.20, lecciones nuevas) | lectura |

---

## 15. Riesgos

| Riesgo | Mitigación |
|---|---|
| **Perder la identidad YoRHa.** Iluminar todo corre el sitio a "juego indie de ciudad nocturna". | §2 es el guardarraíl y A2 es la calibración que lo respeta. Si una captura empieza a leerse como juego, bajar hacia A1, no subir hacia A3. |
| **Las 8 point lights matan el frame rate.** | Palancas escalonadas en §9. Se mide en el paso 4, no al final. |
| **La sombra del personaje se ve mal por la dirección de la luna.** | La direccional queda a `(charX+8, 20, charZ+6)`: sombra hacia atrás-izquierda, no bajo los pies. Si igual no ancla, sumar un blob oscuro como refuerzo — barato y compatible. |
| **Recompilación de shaders al mover farolas.** | Pool de tamaño constante (§6). El criterio A4 lo verifica. |
| **Los edificios quedan negros y la escena pierde legibilidad de fondo.** | Es lo que pasó en A1. A2 ya lo resuelve; las ventanas siguen self-lit y sostienen la silueta. |

---

## 16. Fuera de alcance

- **Dirección C** (mundo abstracto: vacío + grilla infinita + monolitos). Descartada
  para esta iteración, **no descartada como futuro**: A es prerequisito de C —tone
  mapping, shadow maps y materiales PBR hacen falta igual— así que este trabajo no se
  tira si más adelante se toma C.
- **Dirección B** (toon en el personaje). Descartada: cierra A y C.
- Reemplazar el modelo, el rig o los clips de animación.
- Cambiar el layout de la avenida o la cantidad de carteles.
- Fases 4 (About/Contact), 5 (polish) y 6 (launch).

---

## 17. Cambios a CLAUDE.md

Al cerrar la implementación:

- Nueva fila en **Phase status**: `3.20 — Mundo PBR` con el resumen de esta spec.
- **Design system:** agregar el principio de §2 como constraint dura.
- **PortfolioScene:** reescribir el bloque de materiales del personaje —la nota actual
  explica por qué se le colgó un `PointLight`, que ahora se elimina— y documentar el
  pool fijo de farolas y la shadow camera móvil.
- **Assets:** actualizar rutas tras la limpieza de §11; quitar el HDRI del árbol.
- **Lecciones aprendidas**, candidatas:
  - Un environment map sobre una escena de `MeshBasic` ilumina exactamente un objeto:
    el único que usa materiales que reciben luz. El personaje no estaba mal iluminado,
    estaba iluminado por otro mundo.
  - Cambiar la cantidad de luces de la escena recompila el shader de todos los materiales
    iluminados. Un presupuesto dinámico de luces se implementa con un pool fijo que se
    reposiciona, nunca creando y destruyendo.
  - Con `EffectComposer`, `RenderPass` entrega lineal y el tone mapping lo aplica
    `OutputPass`: el umbral del bloom se calibra contra la luz de escena, no contra
    `toneMappingExposure`.
