# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server — localhost:4321
npm run build      # production build
npm run preview    # preview production build
npm run astro check  # TypeScript / Astro type-checking
```

## Project overview

Personal portfolio for **Pablo** — Data Analyst → AI Engineer / Data Scientist. Recruiters self-select a role and see the most relevant projects. Full context and phase plan in `PLAN_PORTFOLIO_NIER.md`.

## Stack

- **Astro 7** (static output, TypeScript strict)
- **React islands** only where interactivity is required (keyboard-navigable selectors)
- **CSS custom properties** for all theming — no UI library
- **i18n:** Astro native i18n, locales `en` (default) and `es`, routes prefixed (`/en/…`, `/es/…`)
- **Hosting:** Cloudflare Pages

## Design system — IRON DUST theme

Inspired by NieR: Automata's YoRHa OS UI. Differentiated by olive-grey background and pale olive accent instead of NieR's warm charcoal + red.

```css
--bg-void:      #1b1e1a;   /* dark olive-grey — main bg */
--bg-panel:     #252820;   /* panels, selected rows, active tabs */
--sand:         #c4c0a8;   /* primary text */
--sand-dim:     #626858;   /* secondary text, metadata, inactive tabs */
--ink:          #363b30;   /* borders, lines, dotted separators */
--accent:       #8fa882;   /* pale olive — cursor ◆, badges, featured border, active underline */
--font-display: 'IM Fell English', serif;   /* light serif for titles/UI */
--font-mono:    'Share Tech Mono', monospace;  /* data, IDs, coordinates */
--radius:       0;          /* zero rounding — always */
--border:       1px solid var(--ink);
--scanline-opacity: 0.04;
```

**Hard constraints:**
- Zero `border-radius` anywhere — ever
- Scanlines + grain over the entire background (CSS only, no JS)
- `prefers-reduced-motion`: disables boot animation and scanlines
- Accent (`#8fa882`) only on: cursor `◆`, active badge/border, active tab underline, lit dots
- No pure black (#000); no pure white (#fff)

## Architecture

```
src/
  styles/
    tokens.css          # CSS custom properties (above)
    global.css          # reset, scanlines, grain, font import, base typography
  layouts/
    Base.astro          # YoRHa chrome: tab-bar header + dot-row + status-bar footer
  components/
    ui/
      BootScreen.astro  # one-time OS-boot animation overlay
      TabBar.astro      # top navigation
      DotRow.astro      # decorative dot-matrix band
      StatusBar.astro   # bottom bar: controls + lang toggle + coordinates
  pages/
    index.astro         # root: redirect to /en/
    en/index.astro      # role selector (English)
    es/index.astro      # role selector (Spanish)
  content/
    projects/           # JSON/MD files per project, bilingual, role-tagged
```

## Three roles (content buckets)

| Role | Focus |
|---|---|
| Risk Analyst | Data projects, statistical modeling, dashboards, SQL |
| AI Engineer | FastAPI, LangChain, multi-agent, AI service deploy, Claude Code tooling |
| Data Scientist | ML pipelines, NLP / Spanish sentiment, modeling, evaluation |

Flagship: **Generative Narrative Game** — lives in AI Engineer, linked from home.

## Content / i18n rules

- Spanish: Rioplatense register (*vos*, native phrasing — not a translation)
- Technical terms (FastAPI, LangChain, deploy, etc.) stay in English in both locales
- SEO: `es` (not `es-419`), reciprocal `hreflang`, canonical self-referencing
