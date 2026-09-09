# Diseño — Perfil único: la calle empieza sola

**Fecha:** 2026-09-09
**Rama:** `feat/perfil-unico`
**Estado:** aprobado por Pablo en chat, pendiente de plan de implementación
**Enfoque elegido:** B — extirpar el rol (de dos presentados)

---

## 1. Qué se pide

Textual: *"quiero que saques la seleccion de rol del principio. que no deje seleccionar ni
ai engineer ni data analyst. lo que quiero que sea uno solo, que apenas entren ya se vea el
juego."* Los carteles pasan a ser los proyectos de AI Engineer más FraudSense, más tres
repos nuevos: [LlamaRAG](https://github.com/pabloler21/LlamaRAG),
[support-json](https://github.com/pabloler21/support-json) y
[Tarnish](https://github.com/pabloler21/Tarnish).

Esto coincide con lo que PRODUCT.md ya declara y el sitio todavía no hacía: *"A personal
portfolio whose single job is to get Pablo Lerner hired as an **AI Engineer**"*, con el
análisis de datos como *"supporting range, not the headline"*. El selector de rol repartía
el portfolio en dos mitades simétricas y le pedía al visitante —que da menos de un minuto
en la primera pasada— que eligiera cuál mirar antes de haber visto nada.

## 2. Decisiones tomadas en el brainstorm

| Pregunta | Decisión de Pablo |
|---|---|
| Qué pasa con `/ai/` y `/risk/` | Se funden en **una sola página de records** |
| Nombre del perfil único | **AI Engineer & Data Analyst**, en ese orden |
| Flagship | **CV Evaluator** (`bot-curriculum`) |
| Apertura de la calle | `support-json` → `LlamaRAG` → `Tarnish` |
| Los otros 6 proyectos de datos | **Quedan en la página, no en la calle** |

El orden del medio de la avenida y todo lo que sigue es propuesta de esta spec.

## 3. Estado real del código (corrige a CLAUDE.md)

CLAUDE.md documenta un banner de llegada (`#ps-banner` / `showBanner`), un HUD de RECORDS
(`#ps-records`), un end-cap (`drawEndcapCanvas`) y farolas cada 9.5u. **Nada de eso existe
hoy en `PortfolioScene.astro`**: el end-cap fue reemplazado por el obelisco en `z = -84`
que navega a contacto, el HUD quedó reducido al minimapa y las farolas se retiraron. Lo
que sí está cableado al rol, y es lo que hay que desarmar:

| Símbolo | Uso |
|---|---|
| `zoneProjects` | dict `{risk, ai, ds}` → arrays de proyectos mapeados |
| `activeRole` | rol elegido; guarda de dedupe del handler `nier:zone` |
| `activeZone` | duplicado de `activeRole` para el pulso de la luz del flagship (línea 2248) |
| `zoneMeshes` / `userData.zone` | hitboxes de cartel |
| `zoneLabels` | cabecera del canvas del cartel y título del panel vacío |
| `allUrl[zone]` | href del `[ VIEW ALL RECORDS → ]` del dossier |
| `buildRoleBillboards(THREE, role)` / `disposeRoleBillboards()` | construcción y destrucción por rol |
| `showPanel(zone, projIdx)` · `populateProjectsDrawer(zone)` · `navigateTo(zone)` | reciben zona |
| evento `nier:zone` + `sessionStorage['nier-persona']` | handshake selector ↔ escena ↔ audio ↔ TouchControls |

## 4. Enfoque

**A — colapsar a una zona** (descartado): dejar la maquinaria y que haya una sola clave.
Diff mínimo, pero deja escrito un enum de un solo miembro. La lección 17 del repo dice que
cuando el contenido se filtra entre modos hay que hacer que los objetos sean *scoped* al
modo; el corolario es que cuando el modo desaparece, el scope tiene que desaparecer con él,
no quedar en uno.

**B — extirpar el rol** (elegido): el rol deja de existir como dimensión. La escena tiene
`streetProjects` y `buildBillboards(THREE)`. Se borran `activeRole`, `activeZone`, el
evento `nier:zone`, el handshake de `sessionStorage` y la guarda de dedupe —que existía
únicamente porque el evento llegaba dos veces (lección 18); sin evento, no hay carrera que
desempatar. Son ~40 sitios mecánicos en un archivo de 3005 líneas, cubiertos por los tres
arneses.

## 5. Datos — `src/data/projects.ts`

### 5.1 Interfaz

`ProjectData` gana un campo:

```ts
track: 'ai' | 'data';   // qué mitad del perfil evidencia este proyecto
```

`track` no es derivable en la escena: al canvas del cartel le llega un objeto plano
mapeado, no el array de origen, y la cabecera de cada cartel lo usa (§6.3).

### 5.2 Exports

```ts
export const aiProjects: ProjectData[];      // 9 — orden de documento
export const dataProjects: ProjectData[];    // 7 — orden de documento (renombra riskProjects)
export const streetProjects: ProjectData[];  // 10 — orden de caminata, compuesto por id
```

`streetProjects` se compone por id sobre los otros dos, con un `pick` que tira al construir
si un id no existe:

```ts
const byId = new Map([...aiProjects, ...dataProjects].map(p => [p.id, p]));
const pick = (id: string): ProjectData => {
  const p = byId.get(id);
  if (!p) throw new Error(`streetProjects: id desconocido "${id}"`);
  return p;
};

export const streetProjects = [
  'support-json', 'llamarag', 'tarnish',
  'second-brain', 'tutorbot', 'obsidian-tracker',
  'hermes', 'fraudsense', 'iris',
  'bot-curriculum',
].map(pick);
```

Se elige composición por id y no un `street: number` en cada proyecto porque el orden de la
avenida es **una** decisión y tiene que leerse en **un** lugar; repartido en diez campos
numéricos se desincroniza en el primer reordenamiento.

### 5.3 Invariante de flagship, verificada al construir

Hoy hay dos proyectos con `featured: true` (`iris` y `fraudsense`) y la escena resuelve el
empate por convención implícita: índice 0 del array es el flagship y el orden de caminata es
`[1..N-1, 0]`. Esa convención se retira. El array **es** el orden de caminata y el flagship
es el último. Para que las dos cosas no puedan separarse en silencio, el módulo lo comprueba
al evaluarse (build y dev):

```ts
const flagships = streetProjects.filter(p => p.featured);
if (flagships.length !== 1 || !streetProjects.at(-1)!.featured) {
  throw new Error('streetProjects: debe haber exactamente un featured y tiene que ir último');
}
```

Es preferible a un check en `verify:ui` porque falla en el build, no después, y porque el
arnés mide HTML construido: un dato mal ordenado saldría igual como HTML válido.

### 5.4 `featured` deja de coincidir con `status`

`fraudsense` pasa de `status: 'FLAGSHIP'` / `statusEs: 'DESTACADO'` a `BUILT` /
`COMPLETADO`, y pierde `featured`. `iris` pierde `featured`. `bot-curriculum` gana
`featured: true` y **conserva** `status: 'DEPLOYED'`: `status` describe el estado del
proyecto y `featured` el rango, y el hecho más fuerte de CV Evaluator es que está
desplegado y se puede tocar (`aurea.pablolerner.dev`). El tratamiento ámbar del cartel
flagship ya sale de la geometría y de `featured`, no del texto del badge.

### 5.5 Los tres proyectos nuevos

Contenido tomado de los README, no inventado.

**`support-json`** · `track: 'ai'` · `status: ACTIVE` / `ACTIVO` · sin demo pública
(la interfaz web corre local en `127.0.0.1:8000`)
`stack: ['Python', 'FastAPI', 'Pydantic', 'OpenAI', 'pytest', 'uv']`

- **en.name** — `Support JSON — Ticket Triage`
- **en.problem** — `Support assistant that turns a free-text ticket into structured JSON: one model call classifies it, drafts the reply and recommends the next action.`
- **en.outcome** — `~US$0.00027 per call · 88 offline tests · per-call metrics and safety log`
- **es.name** — `Support JSON — Triage de Tickets`
- **es.problem** — `Asistente de soporte que convierte un ticket en texto libre a JSON estructurado: una sola llamada al modelo clasifica, redacta la respuesta y recomienda la acción.`
- **es.outcome** — `~US$0,00027 por llamada · 88 tests offline · métricas y safety log por llamada`

**`llamarag`** · `track: 'ai'` · `status: BUILT` / `COMPLETADO` · sin demo
`stack: ['Python', 'LlamaIndex', 'ChromaDB', 'OpenAI', 'pytest']`

- **en.name** — `LlamaRAG — FAQ Retrieval`
- **en.problem** — `RAG over an HR SaaS FAQ fielding 200+ repeated questions a day: sentence-level chunking, vector search, and answers with source attribution instead of manual doc lookup.`
- **en.outcome** — `88.9% relevance at top_k=3 · 0.25 similarity floor blocks out-of-domain answers`
- **es.name** — `LlamaRAG — Recuperación sobre FAQ`
- **es.problem** — `RAG sobre la FAQ de un SaaS de RRHH con 200+ consultas repetidas por día: chunking por oración, búsqueda vectorial y respuestas con atribución de fuente en vez de buscar a mano en la documentación.`
- **es.outcome** — `88,9% de relevancia en top_k=3 · umbral de similitud 0,25 corta lo que está fuera de dominio`

**`tarnish`** · `track: 'ai'` · `status: DEPLOYED` · `demo: 'https://tarnish.pablolerner.dev'`
`stack: ['Python', 'Playwright', 'Claude CLI', 'Langfuse', 'pytest', 'uv']`

- **en.name** — `Tarnish — LLM Red Teaming`
- **en.problem** — `Autonomous red teaming for LLM apps: attacks a target through its own input surface, proposes a fix for every finding, and re-runs the campaign to prove the fix closed it.`
- **en.outcome** — `No finding without a fix · no fix called verified without a re-run · live demo`
- **es.name** — `Tarnish — Red Teaming de LLMs`
- **es.problem** — `Red teaming autónomo de apps con LLM: ataca al objetivo por su propia superficie de entrada, propone un arreglo para cada hallazgo y vuelve a correr la campaña para probar que lo cerró.`
- **es.outcome** — `Ningún hallazgo sin arreglo · ningún arreglo dado por verificado sin re-corrida · demo en vivo`

Tarnish ya corre en el mismo VPS que el resto (CLAUDE.md lo lista entre los proyectos con
*lazy wake*), así que la demo es una URL que ya existe, no una promesa.

### 5.6 Orden de la avenida y por qué

| # | Proyecto | track | Razón |
|---|---|---|---|
| 1 | support-json | ai | Pedido explícito |
| 2 | LlamaRAG | ai | Pedido explícito |
| 3 | Tarnish | ai | Pedido explícito |
| 4 | Second Brain Challenge | ai | Los tres sin métrica quedan juntos en el medio |
| 5 | Python TutorBot | ai | ídem |
| 6 | Obsidian Job Tracker | ai | ídem |
| 7 | Team Agent Ops — Hermes | ai | Arranca la subida: colas durables en producción |
| 8 | FraudSense AI | **data** | Las métricas más duras del portfolio |
| 9 | Iris | ai | 1.2M vectores corriendo sin supervisión |
| 10 | **CV Evaluator** | ai | Flagship: ámbar, 6.0×4.0, cierra la caminata |

FraudSense va en el puesto 8 y no al final del bloque: es el único cartel `data` de la
calle y enterrado entre los livianos no se lee como lo que es. En el noveno y décimo lugar
quedan los dos proyectos con uptime, que es la evidencia que PRODUCT.md declara
diferencial.

## 6. Escena 3D — `PortfolioScene.astro`

### 6.1 Frontmatter

```ts
import { streetProjects } from '../../data/projects.ts';

const boards = streetProjects.map(p => mapProj(p, lang));   // mapProj gana `track`
const profileLabel = 'AI ENGINEER & DATA ANALYST';
const trackLabels  = { ai: 'AI ENGINEER', data: 'DATA ANALYST' };
const allUrl       = `/${lang}/projects/`;                  // string, no dict
```

El `<script type="application/json" id="ps-data">` pasa a llevar
`{ boards, trackLabels, allUrl, allLabel, dossier, contactUrl }`. Desaparecen `zoneProjects`
y `zoneLabels`.

### 6.2 Renombres y borrados

| Antes | Después |
|---|---|
| `buildRoleBillboards(THREE, role)` | `buildBillboards(THREE)` |
| `disposeRoleBillboards()` | *se borra* — no hay reconstrucción; los carteles se crean una vez en `init()` |
| `roleBillGroup` / `roleBillRefs` | `billGroup` / `billRefs` |
| `zoneMeshes` | `boardMeshes` |
| `userData = { zone: role, projIdx }` | `userData = { projIdx }` |
| `showPanel(zone, projIdx)` | `showPanel(projIdx)` |
| `populateProjectsDrawer(zone)` | `populateProjectsDrawer()` |
| `navigateTo(zone)` | *se borra* — al arrancar el personaje ya está en la entrada |
| `activeRole` · `activeZone` | *se borran* |
| `obj.userData.zone === activeZone` (pulso de luz, L2248) | `obj.userData.flagship === true` |
| `order = [1..N-1, 0]` en el build | *se borra* — el array ya es el orden |
| listener `nier:zone` + fallback de `sessionStorage` | *se borran* |

`disposeRoleBillboards` se borra en vez de conservarse "por las dudas": su única razón de
existir era el cambio de rol. Si más adelante hiciera falta reconstruir, es más barato
volver a escribirla que mantener viva una función que nadie llama.

### 6.3 Cabecera del cartel

`drawBillboardCanvas(ctx, w, h, proj, key, isHero)` recibe hoy la zona y escribe
`SYSTEM::PROJECT · ` + `zoneLabels[key]`. Pasa a escribir `trackLabels[proj.track]`, o sea
`AI ENGINEER` en nueve carteles y `DATA ANALYST` en el de FraudSense. Es la forma más barata
de que las dos mitades de la identidad se vean **en la calle** y no sólo en la franja de
arriba, ahora que no hay selector que las nombre.

### 6.4 Construcción en `init()`

Los carteles se construyen justo después de precargar las fuentes (donde hoy está el
comentario *"No billboards at init"*) y antes de la carga del GLB. `populateProjectsDrawer()`
se llama en la misma línea. El orden importa: el cajón se arma leyendo `billRefs`, así que
va después de `buildBillboards`.

## 7. Geometría de la avenida

Diez carteles a `bz = -10 - k*10` llegan a **z = −100**; el mundo actual termina en −87 y
el obelisco está en −84. **La separación de 10u y la banda de proximidad de 4.5 no se
tocan**: la banda mide 9u de ancho y con menos de 10u de separación dos carteles se
encienden en el mismo frame y `showPanel` compite consigo mismo. Se mueve el fondo del
mundo, conservando cada distancia relativa actual.

| Constante | Hoy | Nuevo | Relación conservada |
|---|---|---|---|
| Cartel más profundo | −70 | **−100** | `-10 - (N-1)*10` |
| `OBELISK_Z` | −84 | **−114** | 14u detrás del último cartel |
| `BOUND_Z_MIN` | −87 | **−117** | `OBELISK_Z − 3` (el obelisco se toca) |
| Asfalto `PlaneGeometry(22, L)` @ z | 100 @ −34 | **130 @ −49** | borde cercano +16, borde lejano = obelisco |
| Veredas `PlaneGeometry(6, L)` @ z | 100 @ −34 | **130 @ −49** | ídem |
| Bacheo `for (dz = -4; dz > X; dz -= 9)` | −82 | **−112** | `OBELISK_Z + 2` |
| Edificios `bZs` | 8 pares hasta −69 | **12 pares hasta −105** | se suman −78, −87, −96, −105 con sus alturas |
| Skyline z | −96 | **−126** | 12u detrás del obelisco |
| Estrellas `-12 - rand*S` | 92 | **122** | cubren hasta el skyline |
| Niebla `FogExp2` | 0.011 | **≈0.0086** | misma extinción óptica sobre el skyline (`0.011 × 108/138`) |
| Minimapa `MM.mz` rango z | [6, −90] | **[6, −120]** | pasa `BOUND_Z_MIN` |
| Minimapa: línea de calle | `mz(-88)` | **`mz(-118)`** | ídem |

`MM` queda:

```js
mz:   (z)  => 12 + ((z + 120) / 126) * 166,
invZ: (py) => ((py - 12) / 166) * 126 - 120,
```

Los carteles neón (`SIGNS`) hoy se agotan en z = −42, con lo que la mitad de atrás de una
avenida de 100u quedaría desnuda: se suman tres, en −60, −78 y −96, alternando lado con el
mismo patrón de `x`, `y` y color.

**Costo para el jugador:** 100u en vez de 70u. A `WALK_SPEED 0.042 × SPRINT_MULT 2.1 × 60fps
= 5.29 u/s`, la avenida pasa de ~13s a ~19s corriendo de punta a punta. Los autos
estacionados (`k ∈ [1,3,5]`) y los charcos (`CRATER_ZS = [-5, -35]`) no se tocan: están
anclados al comienzo de la avenida, que no se movió, y la calibración del salto depende del
ancho del charco, no del largo de la calle.

## 8. Home, intro y audio

### 8.1 Home

`src/pages/en/index.astro` y `src/pages/es/index.astro` pierden el import y el uso de
`<PersonaSelector />`. `src/components/ui/PersonaSelector.astro` se borra (698 líneas).

### 8.2 Intro

La intro cinematográfica **se queda**: es la única puerta de entrada que le queda al sitio y
es lo que evita que el visitante caiga de golpe en una calle sin contexto. Cambia sólo su
condición de disparo, que hoy pregunta por el rol elegido:

```js
if (!sessionStorage.getItem('nier-persona') && !reduced)   // antes
if (!sessionStorage.getItem('nier-visited') && !reduced)   // después
```

y la escena escribe `sessionStorage.setItem('nier-visited', '1')` al terminar la intro
(hoy lo escribía `PersonaSelector` al elegir). El overlay `#ps-hero` sigue desvaneciéndose
en `introT > 0.72`; al terminar, el control es del jugador sin pantalla intermedia. La clase
`.wait` de `PersonaSelector` desaparece con el componente.

### 8.3 Audio — el punto delicado

El click de rol era **el gesto que el navegador exige** para permitir audio. Sin selector no
hay gesto garantizado al cargar. `startAmbient()` se mueve al final de `init()` y se apoya
en el camino que **ya existe** para las recargas: si el contexto queda `suspended`, arma un
`pointerdown` / `keydown` de un solo uso que lo despierta. O sea, la música entra en el
primer toque real del visitante —que en esta pantalla es la primera tecla de movimiento— y
no antes.

Lo que se retira con el evento: la nota de CLAUDE.md sobre que `startAmbient()` va *antes*
de la guarda de dedupe deja de aplicar, porque no hay ni evento ni guarda.

Sin cambios: `<html data-audio>` sigue diciendo si suena, el botón sigue diciendo la
preferencia, `localStorage['nier-audio']` sigue recordando el apagado, y el contexto se
sigue suspendiendo con la pestaña oculta.

## 9. Controles táctiles — `TouchControls.tsx`

Se cae el estado `personaChosen`, su listener de `nier:zone` y la lectura de
`sessionStorage['nier-persona']`. La guarda de render queda:

```tsx
if (!isTouch || !sceneUp) return null;
```

El motivo original de esconderlos —el overlay del selector tenía `z-index: 9000` y se comía
el dedo— desaparece con el overlay. `nier:scene-ready` sigue siendo el único contrato entre
la escena y la isla.

## 10. Página de records

### 10.1 Rutas

`/en/projects/` y `/es/projects/`. Mismo slug en los dos locales, como ya hacen `contact`,
`ai` y `risk`. `/en|es/ai/` y `/en|es/risk/` se retiran como páginas y se declaran en
`astro.config.mjs`:

```js
redirects: {
  '/en/ai': '/en/projects', '/en/risk': '/en/projects',
  '/es/ai': '/es/projects', '/es/risk': '/es/projects',
},
```

En salida estática Astro emite una página de meta-refresh. Los links ya repartidos (CV,
LinkedIn, mensajes) siguen funcionando.

### 10.2 Orden del documento ≠ orden de la calle

El orden de la avenida es una decisión de ritmo de juego. La página es un documento que lee
alguien que evalúa candidatos, y ahí el agrupamiento por especialidad gana:

- **AI ENGINEER · 09** — CV Evaluator (flagship) primero, después Iris, Hermes, Tarnish, support-json, LlamaRAG, TutorBot, Second Brain, Obsidian Tracker
- **DATA ANALYST · 07** — FraudSense AI primero, después Credit Scoring, E-commerce Inventory, Adventure Works, SQL Fast Food, Byogenesis, Google Sheets

Numeración corrida `01`–`16` en el listbox, con una fila divisoria no seleccionable entre
los dos bloques.

### 10.3 Layout

`RoleLayout.astro` → **`RecordsLayout.astro`**. Props: se van `role` y `badgeBright`; se van
los dos `termContent` y queda `PROC::AGENT_RUNTIME` (el perfil lidera con AI Engineer);
`projects` se parte en `ai: DossierProject[]` y `data: DossierProject[]` para poder dibujar
el divisor. El resto del componente —grilla de 3 columnas, HUD de stats, master-detail con
↑↓, scramble— no se toca.

`RoleNav.astro` → **`DocNav.astro`**. Pierde el menú de dos roles (`UNIT SELECTION`), que ya
no selecciona nada. Conserva el back-link a `STREET`/`CALLE` y el bloque meta. En el lugar
del menú van dos entradas que **seleccionan el primer archivo de cada bloque** en el listbox
que ya existe: `AI ENGINEER · 09` y `DATA ANALYST · 07`. Se reusa la máquina de selección
del listbox, no un scroll a un ancla.

### 10.4 Stats del HUD

```
SPECIALIZATION  LLM systems · Multi-agent · RAG · Tool-calling
FLAGSHIP        CV EVALUATOR — ATS RESUME ANALYSIS
                deployed at aurea.pablolerner.dev · clean-architecture REST API
RANGE           Fraud detection · Credit risk · SQL · Power BI
STATUS          ACTIVE · OPEN TO WORK          (bright)
```

`RANGE` reemplaza a `TOOLS` para que el bloque de datos esté nombrado en la cabecera: es lo
que sostiene la mitad "Data Analyst" del título.

## 11. Navegación e identidad

- **TabBar**: dos pestañas. `STREET`/`CALLE` → `/{lang}/` · `PROJECTS`/`PROYECTOS` →
  `/{lang}/projects/`. `activeTab` pasa de `'ai' | 'risk' | 'terminal'` a
  `'terminal' | 'projects'`.
- **Franja de identidad** (`Base.astro`, líneas 100-103): `Data Analyst & AI Engineer` →
  **`AI Engineer & Data Analyst`** en ambos locales. Hoy el ternario devuelve el mismo
  string en las dos ramas; se colapsa a una constante.
- **`description` por defecto** de `Base.astro`: `Pablo Lerner — Data Analyst · AI Engineer
  · Data Scientist` → `Pablo Lerner — AI Engineer & Data Analyst`. `Data Scientist` estaba
  retirado del sitio desde la fase 3.19 y seguía en el meta.
- **Fallback sin WebGL** (`.ps-fallback`): deja de ofrecer dos roles; un solo link a
  `/{lang}/projects/`.
- **Cambio de idioma y `hreflang`**: no se tocan. `Base.astro` resuelve la página hermana
  con `import.meta.glob('/src/pages/**/*.astro')`, así que agregar `projects/` y quitar
  `ai/` y `risk/` se propaga solo.

## 12. Arneses

### 12.1 Cambios en los existentes

| Check | Cambio |
|---|---|
| `verify-ui.mjs` `DOC_PAGES` | `['/en/risk/','/en/ai/','/es/risk/','/es/ai/']` → `['/en/projects/','/es/projects/']` |
| `verify-ui` C4 (nav sin 404) | Barre las dos pestañas nuevas; debe además seguir a los redirects y confirmar que `/en/ai/` y `/en/risk/` resuelven, no 404 |
| `verify-ui` C11/C12 | Toman la lista nueva de páginas documento: 2 en vez de 4 |
| `verify-ui` C13 | Barre `[...DOC_PAGES, '/en/contact/', '/es/contact/']`: pasa de 6 páginas × 2 anchos (12 combinaciones) a 4 × 2 (8) |
| `verify-mobile` M3 | *"Ocultos con el selector abierto"* → **se borra**: no hay selector |
| `verify-mobile` M3b | *"Aparecen al elegir rol"* → *"Aparecen apenas la escena está lista"*: espera `nier:scene-ready`, sin ningún tap previo |
| `verify-mobile` M17 | *"La musica arranca al elegir rol"* → *"La musica arranca al primer toque"*: `data-audio` en `off`/ausente al cargar, en `on` después del primer `pointerdown` |
| `verify-mobile` M9/M11/M13/M14/M15 | Dejan de tapear `.persona-opt`; entran a la escena directo |
| `verify-jump` | Sin cambios: `JUMP_DUR`, `JUMP_SPEED_MULT` y `CRATER_ZS` no se tocan |
| `verify-character` | Sin cambios |
| `verify-audio` | Sin cambios: mide la señal renderizada offline, no el cableado |

### 12.2 Checks nuevos

- **C14 — `/en|es/ai/` y `/en|es/risk/` no mueren.** Las cuatro rutas viejas existen en
  `dist/` y apuntan a `/{lang}/projects/`.
- **M21 — la calle arranca sola.** Al cargar `/en/`, sin ningún gesto, `document` reporta
  10 carteles construidos. Se mide sobre `billRefs` expuesto igual que hoy se mide
  `data-audio`: por un atributo que el producto ya escribe (`<html data-boards="10">`), no
  por un gancho de test.
- **M22 — el último cartel entra en el mundo.** El `bz` más profundo de `billRefs` es mayor
  que `BOUND_Z_MIN`, y el obelisco está más allá del último cartel. Esto es lo que atrapa la
  regresión si mañana se suma un proyecto 11 sin estirar la calle.

**M21 y M22 se corren primero contra el código sin el fix** (lección 48): si un arnés nuevo
no falla contra el estado anterior, no está midiendo nada.

## 13. Documentación

- **CLAUDE.md**: se reescriben las secciones `PortfolioScene`, `Three roles`, `File
  structure`, `Projects data file` y `Musica ambiente` (el párrafo del gesto). Se corrigen
  de paso las tres cosas que ya estaban desactualizadas antes de este cambio: el end-cap
  (es un obelisco), el banner de llegada y el HUD de RECORDS (no existen), y las farolas
  (retiradas). Se agrega la fase 3.20.
- **PRODUCT.md**: la sección de posicionamiento ya dice lo que el sitio va a hacer; se
  actualiza sólo donde nombra el selector de rol o las dos páginas.
- **Lección nueva (51)**: *un handshake por evento entre dos componentes sobrevive al
  componente que lo justificaba.* `nier:zone`, su fallback de `sessionStorage`, su guarda de
  dedupe y las tres cosas que dependían de él (audio, controles táctiles, construcción de
  carteles) existían todos por un click que ahora no está. Al sacar un componente hay que
  buscar quién escucha lo que despachaba, no sólo quién lo importa.

## 14. Fuera de alcance

No se tocan: joystick y `MOVE_MULT`, salto y charcos, obelisco → contacto (sólo se mueve su
z), formulario de contacto y su servicio, deploy, motor de audio (`src/lib/ambient.ts`),
personaje y su GLB, lluvia de márgenes, rail de contacto, BootScreen.

## 15. Riesgos

1. **Refactor amplio en un archivo de 3005 líneas sin tests unitarios.** Mitigación: los
   renombres son mecánicos y `verify:mobile` recorre el camino real del usuario de punta a
   punta. El orden de trabajo va de los datos hacia afuera, para que cada paso deje el sitio
   construyendo.
2. **La niebla es un ajuste a ojo.** El 0.0086 sale de una regla de tres sobre la distancia
   al skyline; hay que mirarlo. Si la avenida queda lechosa o el fondo del mundo se ve
   demasiado nítido, se corrige por observación, no por fórmula.
3. **El audio ahora depende de un toque que puede no llegar.** Un visitante que mira la
   escena sin tocar nada no escucha música. Es correcto —es la política del navegador— pero
   es un cambio de comportamiento respecto de hoy, donde el click de rol era obligatorio.
4. **La avenida se hace un 43% más larga.** ~19s corriendo de punta a punta. Si al caminarla
   se siente vacía, la palanca es sumar dressing entre carteles, no acercarlos: la
   separación de 10u está atada a la banda de proximidad de 4.5.
