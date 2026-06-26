# Portfolio "YoRHa OS" — Plan de construcción con Claude Code

> Documento de contexto y plan de ejecución para construir un portfolio personal
> bilingüe (EN/ES) con interfaz inspirada en **NieR: Automata**.
> Pasale este archivo a Claude Code como punto de partida.

---

## 0. Contexto para el agente (leer primero)

Sos el desarrollador a cargo de construir el portfolio personal de **Pablo**, un
profesional de datos en transición: **Data Analyst → AI Engineer**, posicionándose
también como **Data Scientist**.

**Objetivo del sitio:** un portfolio que, según el rol que busque el reclutador,
le muestre los repositorios más relevantes (con demo, README claro y resultados).
El reclutador "accede a una unidad" distinta según el puesto:

- **Risk Analyst** — proyectos de datos, modelado de riesgo, análisis estadístico, dashboards, SQL.
- **AI Engineer** — FastAPI, LangChain, sistemas multi-agente, deploy de servicios de IA, tooling de Claude Code, y el videojuego con IA generativa.
- **Data Scientist** — pipelines de ML, NLP en español / clasificación de sentimiento, modelado, evaluación.

**Pieza central:** un videojuego propio que usa IA generativa en lugar de generación
procedural, donde la narrativa emerge de las memorias del propio jugador. Es el
proyecto estrella y debe presentarse como case study técnico, no como "side project".

**Idiomas:** el sitio es **bilingüe inglés + español**. El español debe leerse
nativo en registro **rioplatense** (no como traducción automática). Términos técnicos
(FastAPI, LangChain, deploy, etc.) quedan en inglés.

**Dirección estética — NieR: Automata (UI de YoRHa):**
La interfaz de NieR: Automata se siente como el sistema operativo de un androide.
Características a respetar con fidelidad:

- Paleta monocromática **arena/beige sobre fondo oscuro carbón** (no negro puro).
- Tipografía **serif fina** para títulos/UI (sensación de documento de archivo),
  monoespaciada para datos/metadata.
- Marcos finos de **1px**, esquinas marcadas (a veces con un pequeño "corte" diagonal),
  **cero border-radius** redondeado tipo web moderna.
- **Scanlines** sutiles y un leve grano/ruido sobre todo el fondo, como un CRT viejo.
- Menús tipo lista vertical con un **cursor/selector** que se desplaza (▶), con
  sonido sutil al navegar (opcional, respetando preferencias del usuario).
- Microtexto de "sistema" decorativo en los bordes (coordenadas, IDs de unidad,
  timestamps) — siempre legible, nunca tapando contenido.
- Transiciones limpias tipo "boot" / "loading" entre pantallas.

**Mapeo conceptual clave:** la pantalla de inicio es un **menú de acceso de YoRHa**.
El selector de rol = "seleccionar unidad / perfil de acceso". Cada repo = una
"entrada de datos" o "archivo de memoria" en el sistema. Esto conecta la estética
con la mecánica de selección de rol de forma nativa.

**No-objetivos / límites:**
- El theme nunca debe tapar la sustancia: cada proyecto a ≤2 clics de su repo + demo + diagrama de arquitectura.
- Siempre ofrecer un **"modo clásico / accesible"** y un **CV descargable** para el reclutador apurado.
- Piso de calidad: responsive hasta mobile, foco de teclado visible, `prefers-reduced-motion` respetado.

**Restricción de datos:** los repositorios reales de Pablo todavía no están
inventariados en este plan. Donde el plan diga "repos por rol", Pablo va a
proveer la lista; mientras tanto, usar placeholders claramente marcados.

---

## 1. Stack técnico recomendado

- **Framework:** Astro (output estático, casi cero JS, ideal para sitio de contenido + i18n nativo). Islas de React solo donde haga falta interactividad (selector, animaciones).
- **i18n:** Astro i18n con rutas con prefijo de locale (`/en/…`, `/es/…`). Slugs traducidos donde aporte.
- **SEO bilingüe:** tags `hreflang` recíprocos por locale + `x-default`. Usar **`es` genérico** (Google no soporta `es-419`) + `en`. Canonical autorreferencial.
- **Estilos:** CSS propio con custom properties (design tokens). Sin librería de componentes pesada; la estética es muy específica y conviene controlarla a mano.
- **Animación/efectos:** CSS para scanlines/grano/transiciones; JS mínimo para el cursor de menú y efectos de "boot".
- **Hosting:** Cloudflare Pages (o Vercel). Deploy automático desde GitHub.
- **Repo:** GitHub (obligatorio — es el deploy y parte del portfolio en sí).
- **Dominio:** comprar uno (~US$10–11/año) en Cloudflare Registrar o Porkbun. `.dev`, `.com` o `.ai`.

> Antes de escribir UI, leer la skill `frontend-design` si está disponible en el entorno,
> y derivar un sistema de tokens (4–6 colores nombrados, 2–3 tipografías, layout, elemento "firma").

---

## 2. Design tokens iniciales (punto de partida, ajustables)

```
/* Color — arena sobre carbón, estética YoRHa */
--bg-void:      #1f1d1a;  /* fondo carbón cálido, no negro puro */
--bg-panel:     #2a2723;  /* paneles/marcos */
--sand:         #cabf9f;  /* texto/UI principal (arena) */
--sand-dim:     #9c937b;  /* texto secundario/metadata */
--ink:          #454138;  /* líneas finas sobre arena (modo invertido) */
--accent:       #c0392b;  /* acento mínimo: alertas/estado activo (rojo apagado) */

/* Tipografía */
--font-display:  serif fina (ej. una serif tipo "Noto Serif" / similar, peso ligero);
--font-mono:     monoespaciada para datos/metadata/IDs;

/* Estructura */
--radius: 0;            /* sin redondeo */
--border: 1px solid var(--sand-dim);
--scanline-opacity: 0.04;
```

(El agente debe validar/afinar estos tokens contra la skill de frontend antes de codear.)

---

## 3. Plan por fases

### Fase 0 — Fundaciones y "boot del sistema"
**Meta:** esqueleto del proyecto + la identidad visual base funcionando.
- Inicializar proyecto Astro con TypeScript, estructura de carpetas, Git, `.gitignore`.
- Configurar i18n (`en` / `es`), con `en` como default y rutas con prefijo.
- Definir design tokens (sección 2) en CSS global; cargar tipografías.
- Implementar la capa estética base reutilizable: fondo carbón + **scanlines + grano** (CSS), marcos finos, microtexto de sistema en bordes.
- Componente de **pantalla de boot/loading** (animación corta tipo arranque de OS) que se muestra una vez.
- Layout base con el "chrome" de UI de YoRHa (encabezado/pie con metadata decorativa).
- Deploy temprano a Cloudflare Pages para tener URL viva desde el día 1.

**Entregable:** sitio que bootea, con la estética NieR aplicada, en ambos idiomas (aunque sea con contenido placeholder), ya deployado.

---

### Fase 1 — Home: menú de acceso YoRHa + selector de rol
**Meta:** la pantalla de inicio y la mecánica central de selección de rol.
- Construir la **home como menú de acceso**: lista vertical con cursor/selector navegable (mouse + teclado: flechas/Enter, foco visible).
- Implementar el **selector de rol / "perfil de acceso"**: tres opciones — Risk Analyst, AI Engineer, Data Scientist — presentadas como "unidades" seleccionables.
- Al elegir un rol, transición tipo "loading" hacia la vista de ese perfil (Fase 2).
- Hero con thesis: una línea de posicionamiento ("Data Analyst → AI Engineer · LLM & multi-agent systems · EN/ES") integrada al estilo de sistema.
- Toggle de idioma EN/ES y enlace a **modo clásico/accesible** + **descargar CV**, visibles pero discretos.

**Entregable:** home jugable/navegable donde el reclutador elige rol y entra a una vista filtrada (con repos placeholder por ahora).

---

### Fase 2 — Vistas por rol y tarjetas de repositorio
**Meta:** que cada rol muestre sus repos como "entradas de datos".
- Plantilla de **vista de rol**: encabezado de la "unidad" + lista de repos de ese rol.
- Componente **tarjeta de repo** ("archivo de memoria"): nombre, descripción (1 línea), lenguaje/stack, links a **repo + demo en vivo**, y estado (ej. "DEPLOYED"/"WIP") con la estética de sistema.
- Inventariar los repos reales de Pablo y asignarlos a uno o más roles (Pablo provee la lista). Marcar cuáles necesitan demo/diagrama antes de mostrarse.
- Priorizar por rol: 4–6 mejores repos, los que tengan demo + README claro + resultados cuantificables primero.
- Datos de proyectos en archivos de contenido (JSON/MD) bilingües, para editar sin tocar UI.

**Entregable:** los tres roles muestran repos reales seleccionados y jerarquizados, cada uno con su demo/links.

---

### Fase 3 — El videojuego como case study central
**Meta:** la pieza estrella, presentada a fondo.
- Página dedicada al **videojuego de IA generativa** como case study técnico:
  - El claim novedoso: IA generativa en lugar de generación procedural; narrativa que emerge de las memorias del jugador.
  - Diagrama de arquitectura (pipeline LLM/agentes, manejo de memoria/estado, estrategia de prompts/evals, control de costos).
  - Decisiones técnicas y tradeoffs.
  - Video/GIF de gameplay; build jugable o demo si existe (embed itch.io u hosteado).
- Integrarla visualmente como una "memoria destacada" del sistema, accesible desde la home y desde el rol de AI Engineer.

**Entregable:** case study completo del juego, enlazado como centro del portfolio.

---

### Fase 4 — Secciones de soporte (About, Blog, Contacto)
**Meta:** completar la narrativa y los puntos de contacto.
- **About / narrativa de carrera:** Data Analyst → AI Engineer → Data Scientist como un solo hilo coherente (analytics → shipping de servicios de IA → rigor de data science), bilingüe y en registro rioplatense en ES.
- **Technical writing / blog** (opcional pero recomendado): devlogs del juego, write-ups del tooling de Claude Code (skills, MCP servers, plugins, subagents, hooks).
- **Contacto:** LinkedIn, GitHub, email, y **CV descargable** (EN/ES).
- **Modo clásico/accesible:** versión sobria del contenido para reclutadores apurados o lectores de pantalla.

**Entregable:** sitio completo en contenido, con narrativa y contacto.

---

### Fase 5 — Pulido, accesibilidad, performance y "una pasada más"
**Meta:** llevar la calidad al piso profesional y rematar el detalle estético.
- **Accesibilidad:** foco de teclado visible en todo el menú, navegación completa por teclado, contraste suficiente, `prefers-reduced-motion` (desactiva scanlines pesadas/animaciones), texto alternativo, semántica correcta.
- **Mobile:** verificar que el menú-juego degrade bien; si la interacción tipo cursor no funciona en touch, ofrecer layout adaptado.
- **Performance:** Lighthouse, optimizar imágenes/GIF, minimizar JS, lazy-load.
- **SEO bilingüe:** verificar `hreflang`/`x-default`/canonical, metadatos por locale, sitemap.
- **Sonido (opcional):** efectos sutiles de navegación tipo YoRHa, siempre con opción de silenciar y respetando reduced-motion.
- **Pasada de crítica estética:** revisar contra referencias reales de la UI de NieR; "sacar un accesorio" — quitar lo que no sirva al brief.

**Entregable:** portfolio listo para mostrar, rápido, accesible y fiel a la estética.

---

### Fase 6 — Lanzamiento
**Meta:** publicarlo en serio.
- Comprar/conectar el **dominio** (Cloudflare Registrar o Porkbun) con SSL.
- Configurar dominio custom en Cloudflare Pages/Vercel.
- README del repo del portfolio explicando el proyecto (es portfolio en sí mismo).
- Revisión final de links/demos por rol; pin de los repos clave en el perfil de GitHub.
- Anunciar (LinkedIn).

**Entregable:** portfolio en vivo en dominio propio.

---

## 4. Pendientes que Pablo debe proveer
- [ ] Lista completa de repositorios (nombre, qué hace, lenguaje, ¿demo/deploy sí/no?).
- [ ] Asignación de cada repo a rol(es): Risk Analyst / AI Engineer / Data Scientist.
- [ ] Material del videojuego: video/GIF de gameplay, diagrama de arquitectura, link a build si existe.
- [ ] CV en EN y ES.
- [ ] Handle de GitHub, LinkedIn, email, dominio deseado.

## 5. Principios permanentes (recordar en cada fase)
1. El theme abre la puerta; la sustancia (repo + demo + diagrama + métricas) consigue el trabajo. Nunca tapar la evidencia.
2. Siempre disponible: modo clásico/accesible + CV descargable.
3. Fidelidad a NieR: monocromático arena/carbón, serif fina, marcos de 1px, scanlines sutiles, cero redondeo, microtexto de sistema.
4. Español en rioplatense nativo; términos técnicos en inglés.
5. Shippear temprano y por fases: tener URL viva desde la Fase 0 y mejorar incrementalmente.
6. Accesibilidad y mobile no son opcionales.
