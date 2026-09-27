# Records: scrollbar con tema + scramble de vuelta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las barras de scroll del sitio usen la paleta IRON DUST en vez de la del sistema, y que el texto del proyecto abierto vuelva a "escribirse" con símbolos al seleccionarlo.

**Architecture:** La scrollbar se tematiza en `global.css` (una sola vez, para todo el sitio) con tokens nuevos en `tokens.css`: pseudo-elementos `::-webkit-scrollbar` para Chromium/Safari (control total: esquina viva, sin flechas) y `scrollbar-color` sólo donde no existen (Firefox) — en Chromium ≥121 las propiedades estándar anulan los pseudo-elementos. El scramble ya existe (`scrambleIn` en `RecordsLayout.astro`) pero sale temprano con `prefers-reduced-motion`, que Windows trae encendido de fábrica: se quita esa guarda (el scramble no desplaza nada, cambia glifos en el lugar — lección 53), se lo pasa a máquina de escribir (prefijo asentado + cabeza corta de símbolos + resto reservado invisible, así el párrafo no salta de alto) y se extiende a la misión y al resultado.

**Tech Stack:** Astro 7, CSS custom properties, vanilla TS, Playwright (`scripts/verify-ui.mjs`).

**Spec:** pedido directo del usuario (2026-09-27), sin spec aparte.

## Global Constraints

- Zero `border-radius` — también en el thumb.
- `--accent-bright` (mint) sólo para estados interactivos: el thumb en reposo NO es mint; se enciende al pasar/arrastrar.
- No `#000` / `#fff`. Colores sólo desde tokens.
- Un commit por cambio mínimo (regla nueva de CLAUDE.md). Cada commit con build verde.
- Deploy con `npm run deploy` al final, después de `npm run verify` en verde.

---

### Task 1: Regla de commits en CLAUDE.md

**Files:** Modify `CLAUDE.md` (sección nueva `## Commits`, después de `## Commands`).

- [ ] Agregar la regla: separar al máximo, un commit por cambio atómico que compile y pase su arnés; tokens, estilos, lógica, tests y docs van en commits distintos.
- [ ] `git commit -m "docs(CLAUDE.md): regla — commits separados al máximo"`

### Task 2: Tokens de scrollbar

**Files:** Modify `src/styles/tokens.css`

```css
  /* Scrollbar */
  --scroll-w:        6px;
  --scroll-track:    var(--bg-void);
  --scroll-thumb:    var(--ink-mid);
  --scroll-thumb-on: var(--accent-bright);
```

- [ ] Agregar y commitear: `style(tokens): tokens de la scrollbar`

### Task 3: Scrollbar Chromium/Safari

**Files:** Modify `src/styles/global.css`

```css
::-webkit-scrollbar { width: var(--scroll-w); height: var(--scroll-w); }
::-webkit-scrollbar-track { background: var(--scroll-track); }
::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 0; }
::-webkit-scrollbar-button { display: none; }
::-webkit-scrollbar-corner { background: var(--scroll-track); }
```

- [ ] Commit: `style(global): scrollbar con la paleta en Chromium y Safari`

### Task 4: Estados del thumb (hover del contenedor, hover, arrastre)

```css
:hover::-webkit-scrollbar-thumb { background: var(--sand-dim); }
::-webkit-scrollbar-thumb:hover { background: var(--scroll-thumb-on); }
::-webkit-scrollbar-thumb:active { background: var(--scroll-thumb-on); box-shadow: 0 0 6px var(--scroll-thumb-on); }
```

- [ ] Commit: `style(global): el thumb se enciende al pasar y al arrastrar`

### Task 5: Fallback Firefox

```css
@supports not selector(::-webkit-scrollbar) {
  * { scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) var(--scroll-track); }
}
```

- [ ] Commit: `style(global): scrollbar con la paleta en Firefox`

### Task 6: C23 — la scrollbar no es la del sistema

**Files:** Modify `scripts/verify-ui.mjs`

Mide `offsetWidth - clientWidth` de `.dossier-list` a 1920×1080: la scrollbar clásica de Chromium headless mide 15px; con el tema tiene que medir `--scroll-w` (6). Falsable: sin Task 3 da 15.

- [ ] Correr `npm run verify:ui`, C23 verde. Mutar (comentar Task 3) → C23 rojo. Restaurar.
- [ ] Commit: `test(verify:ui): C23 — la scrollbar lleva la paleta`

### Task 7: El scramble deja de apagarse con reduced-motion

**Files:** Modify `src/layouts/RecordsLayout.astro` (`scrambleIn`)

- [ ] Borrar `if (reducedMotion.matches) { el.textContent = text; return; }`, con comentario de por qué (lección 53).
- [ ] Commit: `fix(records): el scramble vuelve — reduced-motion lo apagaba en Windows`

### Task 8: Máquina de escribir con cabeza de símbolos

`scrambleIn(el, text, ms)` arma: `texto asentado` + `HEAD` (8) símbolos + resto en `<span class="scr-ghost">` con `color: transparent` (reserva el alto). Usa nodos de texto, nunca `innerHTML` con el texto del proyecto. Duración escala con el largo: `clamp(480, len*6, 1100)` ms.

- [ ] Commit: `feat(records): el scramble escribe con una cabeza de símbolos`

### Task 9: También misión y resultado

- [ ] `select()` corre `scrambleIn` sobre `.detail-title`, `.detail-problem` y `.outcome-value` (los tres con `data-text`).
- [ ] Commit: `feat(records): la misión y el resultado también se escriben`

### Task 10: C24 — el scramble corre, aun con reduced-motion

Con `reducedMotion: 'reduce'`, clic en la fila 2: a los ~120ms `.detail-problem` ≠ texto final y contiene un símbolo de `◆◇▸▪░▒▓`; a los 1500ms es idéntico al final. Mutar Task 7 → rojo.

- [ ] Commit: `test(verify:ui): C24 — el scramble corre aun con reduced-motion`

### Task 11: Docs + push + deploy

- [ ] CLAUDE.md: fila de fase 3.25 + lección 65. Commit `docs(CLAUDE.md): fase 3.25 y lección 65`.
- [ ] `npm run verify` verde → `git push` → `npm run deploy` (verifica md5 en vivo).
