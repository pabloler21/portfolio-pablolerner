# Plan — Phase 3.11: Margin Chrome — Dynamic Characters

## Objective

Replace the static vertical text in the browser-margin chrome panels (`Base.astro`) with animated, living content:
- **Left panel** — Matrix-style character rain (canvas, falling hex/NieR characters)
- **Right panel** — Live system clock (HH:MM:SS.ms) + periodic scramble effect on status codes

---

## Current state

`src/layouts/Base.astro` — two `<div class="margin-chrome">` elements with static text:

```html
<div class="margin-chrome margin-chrome-left" aria-hidden="true">
  PROC::ANALYSIS · SYS:OK · MEM:78% · UNIT::PL-7729 · IRON DUST v2 · ...
</div>
<div class="margin-chrome margin-chrome-right" aria-hidden="true">
  LAT:-34.0897 · LON:-58.3817 · UNIT::PL-7729 · SYS:OK · 2026.07.01 · ...
</div>
```

The existing scan-line `::after` pseudo-element stays intact on both panels.

---

## Left panel — Matrix character rain

### HTML change

Replace the static div with a canvas:

```html
<canvas id="margin-rain-left" class="margin-chrome margin-chrome-left" aria-hidden="true"></canvas>
```

No text content — the canvas fills itself via JS.

### Character set

Mix of:
- Hex digits: `0123456789ABCDEF`
- NieR-style symbols: `◆ ◇ ▸ ▪ ▫ ║ ─ ═ ▌ ▐ ░ ▒ ▓`
- Latin chars that look like code: `XZQV⌃⌄⌀∅∞`

Primary color: `#787668` (sand-dim). Occasional bright character: `#5ee7aa` (accent-bright), ~8% probability.

### Canvas rendering logic

```
INIT:
  columns = floor(canvas.width / CHAR_SIZE)   // ~1–2 columns in narrow panel
  drops[] = random start row per column        // stagger initial positions
  
EACH FRAME (RAF ~60fps):
  // Fade trail — semi-transparent overlay
  ctx.fillStyle = 'rgba(27,30,26,0.18)'
  ctx.fillRect(0, 0, W, H)
  
  FOR each column i:
    char = randomChar()
    x = i * CHAR_SIZE
    y = drops[i] * CHAR_SIZE
    
    color = Math.random() < 0.08 ? '#5ee7aa' : '#787668'
    
    // Bright leading character
    ctx.fillStyle = color === '#5ee7aa' ? color : '#B0AC9C'
    ctx.fillText(char, x, y)
    
    IF drops[i] * CHAR_SIZE > H AND Math.random() > 0.96:
      drops[i] = 0   // reset column, staggered
    ELSE:
      drops[i]++
```

### Canvas sizing

The canvas must resize when the panel width changes (window resize). Use `ResizeObserver` on the canvas element itself.

```js
const ro = new ResizeObserver(() => { resizeCanvas(); });
ro.observe(canvas);
```

On resize: clear canvas, recompute columns/drops array.

### Font

`'Share Tech Mono', monospace` — same as the rest of the site. Size: `10px` for max density in narrow panel.

### Performance

- Single `requestAnimationFrame` loop, no external deps
- Canvas fill is GPU-accelerated
- Auto-stops when panel width = 0 (viewport ≤ 1200px) — canvas hidden, loop skips via `canvas.offsetWidth < 4` check
- Respects `prefers-reduced-motion`: skip RAF loop entirely, draw one static frame of scattered characters at 30% opacity

---

## Right panel — Live clock + scramble

### HTML change

Replace static div with structured spans:

```html
<div class="margin-chrome margin-chrome-right" aria-hidden="true">
  <span class="mc-static">LAT:-34.0897 · LON:-58.3817 · </span>
  <span class="mc-scramble" data-target="UNIT::PL-7729">UNIT::PL-7729</span>
  <span class="mc-static"> · </span>
  <span class="mc-clock">00:00:00.000</span>
  <span class="mc-static"> · </span>
  <span class="mc-scramble" data-target="SYS:OK">SYS:OK</span>
  <span class="mc-static"> · MEM:78% · IRON DUST v2 · LAT:-34.0897 · LON:-58.3817</span>
</div>
```

### Clock update

```js
function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  const ms = String(now.getMilliseconds()).padStart(3,'0');
  clockEl.textContent = `${hh}:${mm}:${ss}.${ms}`;
}
setInterval(tickClock, 80);  // ~12 updates/sec — snappy but not jittery
```

### Scramble effect

Every 3–7 seconds (random interval), one of the `.mc-scramble` spans cycles through random characters for 600ms before settling on `data-target`:

```
PHASE 1 (0–600ms): replace each char with random from SCRAMBLE_CHARS every 80ms
PHASE 2 (600ms):   restore data-target text

SCRAMBLE_CHARS = '◆◇▸▪░▒▓XZQV0123456789ABCDEF:#!?─═║'
```

```js
function scramble(el) {
  const target = el.dataset.target;
  const dur = 600;
  const interval = 80;
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += interval;
    if (elapsed >= dur) {
      el.textContent = target;
      clearInterval(timer);
      return;
    }
    el.textContent = target.split('').map(c =>
      c === ':' || c === ' ' ? c
      : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
    ).join('');
  }, interval);
}

function scheduleScramble() {
  const delay = 3000 + Math.random() * 4000;
  setTimeout(() => {
    const els = document.querySelectorAll('.mc-scramble');
    scramble(els[Math.floor(Math.random() * els.length)]);
    scheduleScramble();
  }, delay);
}
scheduleScramble();
```

### Reduced motion

- Clock: still updates (it's data, not animation)
- Scramble: skip entirely (no `setInterval` for scramble)
- Canvas rain: single static frame, no RAF

---

## CSS changes

The existing `.margin-chrome` CSS rules stay mostly the same. Two adjustments:

1. The `<canvas>` element needs `display: block` and `width: 100%; height: 100%` so it fills the panel:

```css
#margin-rain-left {
  display: block;
  width: 100%;
  height: 100%;
}
```

2. The right panel already uses `writing-mode: vertical-lr` — the spans inside it inherit this automatically, so the clock and scramble spans render vertically with no extra CSS.

3. Add `color: var(--accent-bright)` to `.mc-clock` for the live clock to stand out:

```css
.mc-clock {
  color: var(--accent-bright);
  opacity: 0.85;
}
```

---

## Implementation location

All JS goes into a single `<script is:inline>` block at the bottom of `Base.astro` (after `</div>` closing `.os-shell`). Inline because:
- It references DOM elements by ID
- No imports needed (pure DOM + canvas API)
- Astro would try to bundle/transform a regular `<script>` and interfere with the `is:inline` pattern not needed here

Actually: use a regular `<script>` (Vite-processed) but wrap in `document.addEventListener('DOMContentLoaded', ...)`. This is consistent with the rest of the codebase pattern.

---

## File changes summary

| File | Change |
|---|---|
| `src/layouts/Base.astro` | Replace left panel div → canvas; replace right panel div → structured spans; add `<script>` with rain + clock + scramble logic |

No other files touched.

---

## Verification checklist

- [ ] `npm run build` — 0 errors
- [ ] Browser ≥ 1200px wide: both panels visible
- [ ] Left panel: characters falling, occasional mint flash
- [ ] Right panel: clock updating, scramble fires on `.mc-scramble` spans
- [ ] Resize to ≤ 1200px: panels collapse to 0 width, RAF loop stops
- [ ] `prefers-reduced-motion: reduce` in browser: left panel static, no scramble, clock still ticks
- [ ] No console errors

---

## Non-goals (out of scope)

- Audio / sound effects
- Changing the color palette
- Any changes outside Base.astro
- Mobile behavior (panels already hidden at ≤ 1200px)
