# Diseño — UI "Capas separadas"

**Fecha:** 2026-08-20
**Rama:** `redesign/signalis`
**Estado:** aprobado por Pablo, pendiente de plan de implementación
**Dirección elegida:** A — Capas separadas (de tres presentadas en companion visual)

---

## 1. Problema

El sitio se percibe cargado e ilegible. El diagnóstico, medido en vivo sobre el código
actual con Playwright, encontró cuatro causas distintas que se leen como una sola:

1. **Bug de CSS.** En `Base.astro`, `#margin-rain-left { width: 100% }` gana por
   especificidad sobre `.margin-chrome { width: max(0px, calc((100vw - 1200px)/2)) }`. En
   un elemento `position: fixed`, `width: 100%` resuelve contra el viewport, así que cada
   canvas de lluvia mide 100vw. Como `.os-shell` no tiene `background-color`, las dos
   capas animadas se ven a través de todo el contenido del sitio.
2. **Densidad de movimiento.** 24 `@keyframes`, 36 declaraciones `animation:`, 10 en
   `infinite`, 17 loops de `setInterval`/RAF. Medido en `/en/risk/`: 42 elementos
   animándose simultáneamente y 3 canvas activos.
3. **Contraste bajo el mínimo declarado.** El atenuado de texto se hace con `opacity`,
   no con color. Contraste efectivo real, compositando sobre `--bg-void`:

   | Selector | Tamaño | Efectivo | AA 4.5:1 |
   |---|---|---|---|
   | `.sys-text`, `.panel-label`, `.role-sub`, `.stat-label` | 8.8–9.6px | 2.17:1 | ✗ |
   | `.cta-btn` | 10.4px | 3.96:1 | ✗ |
   | `.os-unit-id`, `.os-page`, `.os-status` | 8.8–9.6px | 2.17:1 | ✗ |

   Esto contradice dos afirmaciones de PRODUCT.md: *"WCAG 2.1 AA contrast for all text in
   the default state"* y *"Legibility is a hard floor, not a mode."* El toggle
   `[ CLEAR MODE ]` existe precisamente porque el estado por defecto no se lee.
4. **Navegación que miente.** El TabBar ofrece 5 destinos; existen 4 rutas. `PROFILE`,
   `SKILLS`, `ABOUT` y `CONTACT` devuelven 404, y `PROFILE` y `ABOUT` apuntan a la misma
   URL inexistente.

Defectos adicionales confirmados en captura: el título *Pablo Lerner* de la escena se
superpone con el chip HUD `UNIT::PL-7729`, y los conos de luz de las farolas se leen como
conos verdes sólidos en vez de luz.

## 2. Principio rector

> **La atmósfera vive únicamente donde el visitante puede caminar.**

Hoy toda superficie intenta ser juego y documento a la vez. La escena 3D conserva su clima
completo; las páginas de registro pasan a ser documento limpio. El vocabulario terminal
—mono, corchetes `[ ]`, numeración `01/07`, el cursor ◆— se conserva en ambas superficies:
esa es la identidad. Lo que se retira de la superficie documento es la **capa que se mueve**.

La regla se impone por **estructura, no por disciplina**: ningún efecto es opcional u
"olvidable" página por página. Si un efecto existe en documento, es un bug, no un descuido.

## 3. Arquitectura

`Base.astro` recibe una prop nueva:

```ts
surface?: 'game' | 'doc'   // default: 'doc'
```

El default es `'doc'` a propósito: una página nueva nace limpia y tiene que **pedir**
atmósfera explícitamente. Puntos de entrada actuales:

- `src/pages/{en,es}/index.astro` usan `Base` directo → `surface="game"`.
- `src/layouts/RoleLayout.astro` envuelve `Base` → fija `surface="doc"` para las páginas
  de rol. Los wrappers de página no tocan la prop.

`surface` es la **única** condición que decide la existencia de cada efecto:

| Elemento | `game` | `doc` |
|---|---|---|
| `AmbientCanvas` (Three.js) | montado | no se monta |
| Canvas de lluvia de márgenes | montados, en el margen real | no se emiten |
| Scanlines + grain (`body::before/::after`) | activos | no se pintan |
| `PortfolioScene` + personaje | sí | no |
| Footer de controles de juego | sí | footer de documento |
| Bandas de chrome | 3 | 2 |

Implementación: `surface` se refleja como atributo en `<html>` (`data-surface="game"`), y
los overlays de `global.css` se condicionan a `html[data-surface="game"]`. Los componentes
pesados (`AmbientCanvas`, canvas de lluvia) se excluyen del render de Astro con
condicional, no se ocultan con CSS — no deben descargarse ni ejecutarse en documento.

## 4. Superficie documento

- Fondo sólido `--bg-void`. Cero canvas, cero animación de fondo.
- Chrome de 5 bandas a 2: **identidad** (nombre · rol · CTAs) y **navegación**.
  Se retiran: la fila `UNIT::PL-7729 · SYS:OK · EN`, el `DotRow`, y el `StatusBar` de juego.
- `[ CV ↓ ]` y el toggle EN/ES aparecen **una sola vez** cada uno, en la banda de identidad.
  Hoy están duplicados entre header y StatusBar.
- Se elimina la telemetría inventada (`LAT:-34.6037 LON:-58.3816 · NODE:ACTIVE`) y los
  controles de juego (`◆ SELECT · ↵ CONFIRM · ESC BACK`) en páginas donde no hay juego.
- Se conserva el master-detail de `RoleLayout` (listbox numerado + dossier, navegación
  ↑↓): es funcional y no es ruido.

## 5. Superficie juego

La atmósfera se conserva íntegra. Se corrigen defectos, no clima:

- El título *Pablo Lerner* del intro deja de superponerse con el chip `UNIT::PL-7729`.
- Los conos de luz de farolas pasan a leerse como luz (opacidad y gradiente) o se retiran.
- **Jerarquía de eventos:** el encendido por proximidad de un board es el evento visual
  principal. Farolas, chevrons, partículas, neones y estrellas bajan por debajo de él en
  intensidad. No se elimina ninguno; se los subordina.
- La lluvia de márgenes queda efectivamente en el margen (ver §7) y sólo en esta superficie.

## 6. Control del personaje — sólo WASD

Se elimina todo movimiento por puntero. Tres caminos hoy, los tres se van:

| Qué | Dónde | Acción |
|---|---|---|
| Raycast al asfalto | `PortfolioScene.astro:1104` (`onCanvasClick`), `groundMesh` en `:474` | eliminar la rama de ground; conservar los hits de billboard |
| Fast-travel del minimapa | `PortfolioScene.astro:1291` (`onMinimapClick`) | eliminar el listener; el canvas vuelve a `pointer-events: none` |
| Auto-caminata desde filas del dossier | `PortfolioScene.astro:1423` | la fila cambia el registro mostrado; no mueve al personaje |

El minimapa queda como **display puro**. El click en un billboard sigue abriendo su
registro (es selección, no movimiento). Los CTA `PREV`/`NEXT` del dossier cambian de
registro sin caminar.

Esto ya está registrado como compromiso en PRODUCT.md.

## 7. Corrección del bug de la lluvia

Causa: colisión de especificidad entre el selector de ID y el de clase sobre el mismo
elemento, más `width: 100%` en `position: fixed`.

Correcciones, las tres necesarias:

1. Las reglas de tamaño de `#margin-rain-left` / `#margin-rain-right` no deben pisar el
   ancho de `.margin-chrome`. El ancho lo define una sola regla.
2. El ancho de margen se calcula contra el ancho real del shell (**1400px**, el valor de
   `max-width` de `.os-shell`), no contra 1200px. Hoy hay 100px de solapamiento por lado
   incluso con el ancho corregido.
3. `.os-shell` recibe `background-color: var(--bg-void)` para que ninguna capa de fondo
   se lea a través del contenido.

## 8. Tokens

El mecanismo a eliminar es `opacity` como atenuador de texto. La atenuación pasa a ser
color. Contrastes calculados sobre los tres fondos del sistema:

| Token | Hoy | Sobre void | Propuesto | Sobre void / panel / surface |
|---|---|---|---|---|
| `--sand-dim` | `#6b7280` | 3.96 ✗ | **`#838c9e`** | 5.67 / 5.40 / 5.10 ✓ |
| `--accent` (teal) | `#3d7a64` | 3.80 ✗ | sin cambio, **prohibido como texto** | decorativo: ◆, DotRow, rims |
| `--accent-flag` | `#9a7b2d` | 4.79, pero **4.30 sobre `--bg-surface` ✗** | sin cambio, **prohibido como texto** | sólo bordes y marcos |
| texto flagship | `--accent-flag` | ✗ | **`--accent-flag-bright` `#c9a94f`** | 8.46 / 8.06 / 7.61 ✓ |

Reglas nuevas, verificables:

- Ningún texto usa `opacity` para atenuarse. La opacidad queda reservada a elementos no
  textuales.
- Tamaño mínimo de texto: **11px** (hoy hay texto a 8.8px).
- Escala tipográfica con saltos reales en documento: 11 / 13 / 16 / 28px.
- `IM Fell English` (display) y `Share Tech Mono` (mono) conservan el carácter.
  `Inter` se mantiene como neutro de lectura en prosa.

**Se elimina el modo plain completo** — token block `[data-plain]`, el botón
`[ CLEAR MODE ]`, la clave `localStorage` `iron-dust-plain` y las 29 referencias
distribuidas en 7 archivos. Su razón de existir era que el default no cumplía AA; con §8
el default cumple.

## 9. Navegación

El TabBar lista **sólo rutas que existen**. Con el rol Data Scientist retirado (§10)
quedan tres destinos reales, y el nav pasa a ser exactamente:

| Etiqueta | Destino | Nota |
|---|---|---|
| `TERMINAL` | `/{lang}/` | la escena 3D — reemplaza al actual `PROJECTS` |
| `DATA ANALYST` | `/{lang}/risk/` | slug `risk` se conserva por estabilidad de routing |
| `AI ENGINEER` | `/{lang}/ai/` | |

`PROFILE`, `SKILLS`, `ABOUT` y `CONTACT` se retiran del nav hasta que esas páginas existan
(Fase 4 del roadmap). No se dejan como enlaces muertos ni como items deshabilitados.

## 10. Retiro del rol Data Scientist

PRODUCT.md ya lo declara retirado. Se elimina de: `src/pages/{en,es}/ds/`, la tercera
opción y su panel de preview en `PersonaSelector.astro`, la rama `ds` y el overlay
COMING SOON en `PortfolioScene.astro`, `RoleNav.astro`, `RoleLayout.astro` y `dsProjects`
en `projects.ts`.

Un tercer camino que sólo puede terminar en "COMING SOON" es peso muerto que compite con
la evidencia real.

## 11. Archivos muertos

Se eliminan `src/components/ui/SceneCanvas.astro` y `src/components/ui/ProjectCard.astro`.
CLAUDE.md ya los documenta como no usados; el grep lo confirma.

## 12. Transición entre superficies

El riesgo declarado de esta dirección es que el sitio se sienta como dos sitios pegados.
Mitigación: el cambio de capa se lee como **intencional y único**. El `.page-sweep` que ya
existe en `Base.astro` se reusa como señal de cambio de superficie — la atmósfera colapsa
en una línea al salir de la escena hacia un documento. Un solo gesto autorado, no una
lista de efectos. Respeta `prefers-reduced-motion` con `animation-duration: 0.01s`
(nunca `animation: none`, que mataría el `fill-mode`).

## 13. Accesibilidad e i18n

- AA en estado por defecto, sin toggle que descubrir.
- Toda animación ambiental respeta `prefers-reduced-motion`. El guard **nunca** se aplica
  a input del usuario (WASD, clicks) — `prefers-reduced-motion` viene activo por defecto
  en Windows.
- Paridad EN/ES completa en todos los cambios de copy y navegación. Registro rioplatense
  en ES; términos técnicos en inglés en ambos locales.

## 14. Criterios de aceptación

Verificables en vivo con el arnés Playwright, no declarados:

| # | Criterio | Estado actual medido |
|---|---|---|
| 1 | Contraste efectivo ≥ 4.5:1 en todo texto, estado por defecto, compositando `opacity` | 2.17:1 mínimo |
| 2 | Superficie `doc`: 0 elementos `<canvas>` | 3 |
| 3 | Superficie `doc`: ≤ 8 elementos con animación CSS activa | 42 |
| 4 | 0 rutas 404 en la navegación primaria | 4 de 5 rotas |
| 5 | Ningún input de puntero desplaza al personaje | 3 caminos activos |
| 6 | Ningún texto renderiza por debajo de 11px | mínimo 8.8px |
| 7 | Los canvas de lluvia no solapan `.os-shell` en ningún viewport ≥ 1400px | solapan siempre, a 100vw |
| 8 | `npm run astro check` sin errores nuevos | no medido (baseline a tomar antes de editar) |
| 9 | 0 referencias a `data-plain` / `iron-dust-plain` en `src/` | 29 |

## 15. Riesgos

- **Dos sitios pegados.** Mitigado por §12. Si tras la implementación la transición no se
  lee como intencional, se rediseña el gesto antes de dar el trabajo por cerrado.
- **`PortfolioScene.astro` tiene 2366 líneas.** Los cambios de §5 y §6 tocan un archivo
  grande y frágil. Se abordan como ediciones acotadas y verificadas una por una, no como
  una refactorización. Dividir el archivo queda **fuera de alcance**.
- **Regresión de estilo por scoping de Astro.** Los estilos del panel 3D inyectado por JS
  deben vivir en bloques `<style is:global>` anclados a un id contenedor; los estilos
  scoped de componente no alcanzan DOM creado en runtime.

## 16. Fuera de alcance

- La sala cenital SIGNALIS (retirada como objetivo en PRODUCT.md, 2026-08-20).
- Páginas About / Skills / Contact (Fase 4).
- Refactorización de `PortfolioScene.astro`.
- Cambio de la tipografía de prosa.
- Trabajo de rendimiento sobre el GLB de 7.8MB.

## 17. Cambios a PRODUCT.md

Aplicados el 2026-08-20 en el bloque *Brand Commitments*: la avenida reemplaza a la sala
SIGNALIS como mundo 3D comprometido; la atmósfera queda acotada a la superficie jugable;
el movimiento del personaje queda fijado a WASD únicamente.
