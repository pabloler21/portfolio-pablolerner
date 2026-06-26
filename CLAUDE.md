# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server — http://localhost:4321
npm run build         # production build → dist/
npm run preview       # serve production build locally
npm run astro check   # TypeScript / Astro type-checking
```

## Project overview

Personal portfolio for **Pablo** — Data Analyst → AI Engineer / Data Scientist. Recruiters self-select a role (AI Engineer / Risk Analyst / Data Scientist) and see the most relevant projects. Full context and phase plan in `PLAN_PORTFOLIO_NIER.md`.

## Stack

- **Astro 7** (static output, TypeScript strict)
- **CSS custom properties** for all theming — no UI library
- **Vanilla JS** for role selector and keyboard navigation (no React yet — add only when truly needed)
- **i18n:** Astro native i18n, locales `en` (default) and `es`, both prefixed (`/en/…`, `/es/…`)
- **Hosting:** Cloudflare Pages (target)

## Design system — IRON DUST theme

Inspired by NieR: Automata's YoRHa OS UI. Differentiated by olive-grey background and pale-olive accent instead of NieR's warm charcoal + red. Tokens live in `src/styles/tokens.css`.

```css
--bg-void:      #1b1e1a;   /* dark olive-grey — main bg */
--bg-panel:     #252820;   /* panels, selected rows, active tabs */
--sand:         #c4c0a8;   /* primary text */
--sand-dim:     #626858;   /* secondary text, metadata, inactive tabs */
--ink:          #363b30;   /* borders, lines, dotted separators */
--accent:       #8fa882;   /* pale olive — cursor ◆, badges, featured border, active underline */
--font-display: 'IM Fell English', Georgia, serif;
--font-mono:    'Share Tech Mono', 'Courier New', monospace;
--radius:       0px;        /* zero rounding — always */
--border:       1px solid var(--ink);
--scanline-opacity: 0.04;
--grain-opacity:    0.045;
```

**Hard constraints:**
- Zero `border-radius` anywhere — ever
- Scanlines + animated grain are CSS-only overlays on `body::before` / `body::after`
- `prefers-reduced-motion`: removes both overlays and skips the boot animation
- Accent (`#8fa882`) only on: `◆` cursor, active badge/border, active tab underline, lit dots in DotRow
- No pure black (#000); no pure white (#fff)

## Actual file structure (Phase 0 complete)

```
src/
  styles/
    tokens.css          # all CSS custom properties
    global.css          # reset, scanlines, grain, Google Fonts import, base type
  layouts/
    Base.astro          # YoRHa OS chrome wrapper used by every page
                        #   → title row (UNIT ID / page title / SYS status)
                        #   → TabBar + DotRow (header)
                        #   → <slot /> (main content)
                        #   → StatusBar (footer)
  components/
    ui/
      BootScreen.astro  # one-time OS-boot overlay (sessionStorage flag)
                        #   skipped automatically on prefers-reduced-motion
      TabBar.astro      # top nav tabs; props: active (tab id), lang
      DotRow.astro      # 40-dot decorative row; lit dots use --accent
      StatusBar.astro   # bottom bar: keyboard hints · lang toggle (EN/ES) · CV link · coords
  pages/
    index.astro         # root → redirects to /en/
    en/index.astro      # home EN: two-panel role selector
    es/index.astro      # home ES: same in Rioplatense Spanish
  content/
    projects/           # (empty — Phase 2) JSON/MD per project, bilingual, role-tagged
public/
  favicon.svg           # custom ◆ diamond favicon in IRON DUST palette
  favicon.ico           # fallback
theme-preview.html      # static preview of all theme variants (keep for reference)
PLAN_PORTFOLIO_NIER.md  # full project plan, phases, and pending items from Pablo
```

## How Base.astro works

Every page wraps its content in `<Base>` with these props:

```astro
<Base title="Page Title" lang="en" activeTab="projects">
  <!-- page content goes here -->
</Base>
```

Props: `title` (string), `lang` ('en' | 'es'), `activeTab` (tab id string), `description` (optional SEO string).

## Role selector pattern (en/index.astro, es/index.astro)

Two-panel layout: left panel = list of 3 role buttons, right panel = detail for selected role.

- Buttons have `data-role="ai|risk|ds"` and toggle `.selected` class + `◆` cursor on click
- Arrow up/down keyboard navigation is wired on `#role-menu`
- Detail panels use `.hidden` class to show/hide; `aria-live="polite"` on container
- Each role has a `#detail-{role}` div

## Phase status

| Phase | Status | Deliverable |
|---|---|---|
| 0 — Foundation | **DONE** (commit `9cb5c9b`) | Astro scaffold, IRON DUST theme, YoRHa chrome, boot screen, role selector stub |
| 1 — Navigation | pending | Role click navigates to `/en/{role}/` filtered view |
| 2 — Project cards | pending | Real repos as "memory file" cards (needs Pablo's repo list) |
| 3 — Game case study | pending | Dedicated page with architecture diagram + gameplay video |
| 4 — About / Contact | pending | Career narrative (EN + ES), LinkedIn/GitHub/email |
| 5 — Polish | pending | Lighthouse, a11y audit, mobile, SEO |
| 6 — Launch | pending | Custom domain, Cloudflare Pages deploy |

## Pending from Pablo (blockers for real content)

- [ ] Full repo list: name, what it does, language, demo/deploy Y/N
- [ ] Role assignment for each repo
- [ ] Game material: video/GIF, architecture diagram, playable build link
- [ ] CV in EN and ES (PDF) — place in `public/pablo-lerner-cv.pdf`
- [ ] GitHub handle, LinkedIn URL, email, desired domain name

## Three roles (content buckets)

| Role | Focus |
|---|---|
| AI Engineer | FastAPI, LangChain, multi-agent systems, AI service deploy, Claude Code tooling |
| Risk Analyst | Data projects, statistical modeling, dashboards, SQL |
| Data Scientist | ML pipelines, NLP / Spanish sentiment classification, modeling, evaluation |

Flagship: **Generative Narrative Game** — AI generative instead of procedural generation; narrative emerges from player memories. Lives in AI Engineer, linked from home. Needs its own case study page (Phase 3).

## Content / i18n rules

- Spanish: Rioplatense register (*vos*, native phrasing — never a literal translation)
- Technical terms (FastAPI, LangChain, deploy, pipeline, etc.) stay in English in both locales
- SEO: use locale `es` (not `es-419`); reciprocal `hreflang` tags; canonical self-referencing
- All project data will live in `src/content/projects/` as bilingual JSON/MD (Phase 2)
