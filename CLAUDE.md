# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server — http://localhost:4321 (always use this, not npx astro dev --host)
npm run build         # production build → dist/
npm run preview       # serve production build locally
npm run astro check   # TypeScript / Astro type-checking
```

**WSL2 networking — read carefully, mistakes have been made here:**

- **Always use `npm run dev` with zero extra flags.** This binds to `127.0.0.1` only and goes through WSL2's built-in localhost forwarding → Windows browser reaches it at `http://localhost:4321/`.
- **Never run `npx astro dev --host 0.0.0.0` or `npx astro dev --host <ip>`.** Binding to `0.0.0.0` tells Windows Firewall the process is listening for external connections. Firewall may silently block it, causing `ERR_CONNECTION_REFUSED` on both `localhost:4321` and `192.168.1.33:4321` from the Windows browser. This happened in session and broke the dev server for the rest of the session.
- **Never use `npx astro dev` directly** (with or without flags) — only `npm run dev`. The skill runner has started the server with `--json` and `--host` flags in the past; those modes cause networking issues.
- **If localhost stops working** after a bad server restart: kill the broken process (`pkill -f "astro dev"`), then start fresh with `npm run dev`. If still blocked, check Windows Defender Firewall → "Allow an app through firewall" → Node.js must be checked for both Private and Public.
- **For curl smoke-tests from inside WSL2** (not from Windows browser): use `http://192.168.1.33:4321/` — localhost inside WSL2 does not reach the Windows-forwarded port.

## Project overview

Personal portfolio for **Pablo** — Data Analyst → AI Engineer / Data Scientist. Recruiters self-select a role (AI Engineer / Data Analyst / Data Scientist) and see the most relevant projects. Full context and phase plan in `PLAN_PORTFOLIO_NIER.md`.

## Stack

- **Astro 7** (static output, TypeScript strict)
- **CSS custom properties** for all theming — no UI library
- **Vanilla JS** for role selector, keyboard navigation, and terminal animation (no React yet — add only when truly needed)
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
- `prefers-reduced-motion`: boot screen → `display: none`; stagger reveal → `animation-duration: 0.01s` (instant, not removed — `animation: none` kills `fill-mode` and makes elements immediately visible)
- Accent (`#8fa882`) only on: `◆` cursor, active badge/border, active tab underline, lit dots in DotRow, terminal pip
- No pure black (#000); no pure white (#fff)

## Actual file structure (Phase 2 complete + terminal windows)

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
    RoleLayout.astro    # 3-column grid: RoleNav (280px) + <slot /> (1fr) + TerminalWindow (260px)
                        #   terminal content is role-specific (ai/risk/ds), defined inside layout
                        #   terminal column hidden at < 1024px
  components/
    ui/
      BootScreen.astro  # one-time OS-boot overlay (sessionStorage flag)
      TabBar.astro      # top nav tabs; props: active (tab id), lang
      DotRow.astro      # 40-dot row; dots animate left-to-right (28 ms stagger, CSS-only)
      StatusBar.astro   # bottom bar: keyboard hints · lang toggle (EN/ES) · CV link · coords
      RoleNav.astro     # left-panel nav for role pages: ◀ TERMINAL back link + 3 role links
      ProjectCard.astro # project card component: name, desc, stack tags, badge, GH link, demo link
      TerminalWindow.astro  # animated live-coding terminal panel
                            #   props: title (string), lines (readonly string[])
                            #   JS: typewriter effect — commands type at human speed (~80ms/char),
                            #       output lines print fast (~15ms/char), loops forever
                            #   prefers-reduced-motion: shows final state instantly, no animation
  pages/
    index.astro         # root → redirects to /en/
    en/
      index.astro       # home EN: role selector left + detail+terminal right (1fr 260px sub-grid)
      ai/index.astro    # AI Engineer — 6 real projects (Iris flagship)
      risk/index.astro  # Data Analyst — 7 real projects (FraudSense AI flagship)
      ds/index.astro    # Data Scientist — placeholder (coming soon)
    es/
      index.astro       # home ES: Rioplatense, same structure
      ai/index.astro    # ES mirrors (Rioplatense descriptions)
      risk/index.astro
      ds/index.astro
  content/
    projects/           # (empty — unused, data lives inline in role pages for now)
public/
  favicon.svg           # custom ◆ diamond favicon in IRON DUST palette
  favicon.ico           # fallback
theme-preview.html      # static preview of all theme variants (keep for reference)
PLAN_PORTFOLIO_NIER.md  # full project plan, phases, and pending items from Pablo
```

## TerminalWindow component

`src/components/ui/TerminalWindow.astro` — animated live-coding terminal panel.

Props:
```ts
{
  title: string;          // window title bar label (e.g. 'PROC::AGENT_RUNTIME')
  lines: readonly string[]; // lines to type out, loops forever
}
```

Animation behavior:
- Lines starting with `$` or `>>>` = command lines → typed at ~80ms/char (human pace) with a ~520ms pause after (simulates pressing Enter)
- All other lines = output lines → printed at ~15ms/char (machine pace) with an 80ms pause after
- After the full sequence, 2.2s pause then restarts from the top
- Multiple instances stagger their start time (random 500–2300ms) so they never sync
- `prefers-reduced-motion`: shows the last MAX_LINES instantly, cursor blink disabled

Terminal content per role (defined in `RoleLayout.astro`):
- `ai` → `PROC::AGENT_RUNTIME`: LangChain agent code + tool reasoning output
- `risk` → `PROC::DATA_PIPELINE`: psql session with SELECT query + fraud result rows
- `ds` → `PROC::ML_PIPELINE`: sklearn Pipeline build + GradientBoosting training epochs

Home page terminals (defined in `en/index.astro` + `es/index.astro`):
- `PROC::DEV_ENV`: git clone → pip install → `python iris.py` boot sequence
- `PROC::ANALYTICS`: fraud pipeline run with progress bar + precision/recall output

## Home page terminal layout

The home page `panel-right` is an internal sub-grid (`1fr 260px`):
- `.detail-area` — existing role detail content (aria-live="polite")
- `.terminal-area` — two stacked `TerminalWindow` components (aria-hidden="true")

Terminal area hides at `@media (max-width: 900px)`.

## ProjectCard component

`src/components/ui/ProjectCard.astro` — shared card used in all role pages.

Props:
```ts
{
  name: string;
  desc: string;
  stack: readonly string[];
  status: string;       // badge label: 'ACTIVE' | 'DEPLOYED' | 'BUILT' | 'TOOLING' | 'FLAGSHIP' etc.
  featured?: boolean;   // true → left accent border (border-left: 3px solid var(--accent))
  github: string;       // GitHub repo URL → "GH →" link
  demo?: string;        // optional live demo URL → "LIVE DEMO →" button
}
```

Usage in role pages: define a `projects` array in frontmatter, then `{projects.map(p => <ProjectCard {...p} />)}`.

## Real project data (Phase 2)

### AI Engineer (6 projects, github: pabloler21)
| Repo | Display name | Status | Demo |
|---|---|---|---|
| Iris | Iris — Personal AI Assistant | ACTIVE (flagship) | — |
| bot_curriculum | CV Evaluator + Job Board | DEPLOYED | https://bot-curriculum-1.onrender.com |
| prbot-hermes | Team Agent Ops — Hermes | DEPLOYED | — |
| TutorBot | Python TutorBot | BUILT | — |
| obsidian-job-tracker | Obsidian Job Tracker | TOOLING | — |
| workshop-challenge | Second Brain Challenge | BUILT | — |

### Data Analyst (7 projects, github: pabloler21)
| Repo | Display name | Status |
|---|---|---|
| fraud-risk-analytics | FraudSense AI | FLAGSHIP (featured) |
| credit-scoring-give-me-some-credit | Credit Scoring — Give Me Some Credit | BUILT |
| adventure-works-financial-dashboard | Adventure Works Financial Dashboard | BUILT |
| sql-fast-food-data-analysis | SQL Fast Food Data Analysis | BUILT |
| google-sheets-sales-analysis | Google Sheets Sales Analysis | BUILT |
| Proyecto_Final_Grupo_2 | Smart Inventory — Group Project | BUILT |
| proyecto_integrador_m4_python | Byogenesis Lab Location Analysis | BUILT |

### Data Scientist
Coming soon — no repos assigned yet.

## Stagger reveal animation (home pages)

Pure CSS, no JS event needed. Elements have `animation: fade-in-up 0.28s ease both` with staggered delays. `animation-fill-mode: both` keeps elements at `opacity: 0` during the delay period.

- **Return visit** (boot-seen in sessionStorage): delays 50 ms → 540 ms
- **First visit**: `html.first-boot` class set by `<script is:inline>` in BootScreen (runs in `<head>`, before body elements are parsed) → delays 3.2 s → 3.72 s, synchronized with boot screen fade-out
- `@media (prefers-reduced-motion: reduce)`: use `animation-duration: 0.01s !important` — **never** `animation: none` (that resets `fill-mode` and makes elements immediately visible)

## How Base.astro works

Every page wraps its content in `<Base>` with these props:

```astro
<Base title="Page Title" lang="en" activeTab="projects">
  <!-- page content goes here -->
</Base>
```

Props: `title` (string), `lang` ('en' | 'es'), `activeTab` (tab id string), `description` (optional SEO string).

## Role selector pattern (en/index.astro, es/index.astro)

Two-panel layout: left panel = list of 3 role buttons, right panel = detail + terminal sub-grid.

- Buttons have `data-role="ai|risk|ds"` and toggle `.selected` class + `◆` cursor on click
- Arrow up/down keyboard navigation is wired on `#role-menu`
- Detail panels use `.hidden` class to show/hide; `aria-live="polite"` on `.detail-area`
- Each role has a `#detail-{role}` div

## Three roles (content buckets)

| Role | URL slug | Focus |
|---|---|---|
| AI Engineer | `/ai/` | LLM systems, multi-agent, RAG, FastAPI, Claude API |
| Data Analyst | `/risk/` | Fraud detection, credit scoring, SQL, Power BI, dashboards |
| Data Scientist | `/ds/` | ML pipelines, NLP, classification, modeling |

Note: the URL slug is `/risk/` for Data Analyst (kept for routing stability — changing it would require redirect config).

## Phase status

| Phase | Status | Deliverable |
|---|---|---|
| 0 — Foundation | **DONE** (commit `9cb5c9b`) | Astro scaffold, IRON DUST theme, YoRHa chrome, boot screen, role selector stub |
| 1 — Navigation + Animation | **DONE** | Role pages (`/en/{role}/`), RoleNav, RoleLayout, boot-screen stagger reveal, DotRow charge |
| 2 — Project cards | **DONE** | Real GitHub repos as project cards (ProjectCard component, 13 projects across AI + Data Analyst) |
| 2.5 — Terminal windows | **DONE** | TerminalWindow component, live-coding ambient panels on home + role pages |
| 3 — Game case study | pending | Dedicated page with architecture diagram + gameplay video |
| 4 — About / Contact | pending | Career narrative (EN + ES), LinkedIn/GitHub/email |
| 5 — Polish | pending | Lighthouse, a11y audit, mobile, SEO |
| 6 — Launch | pending | Custom domain, Cloudflare Pages deploy |

## Pending from Pablo (blockers for real content)

- [ ] LinkedIn About/bio text — paste directly (LinkedIn blocks scraping)
- [ ] Data Scientist repos — none assigned yet
- [ ] CV in EN and ES (PDF) — place in `public/pablo-lerner-cv.pdf`
- [ ] Email address for contact page
- [ ] Desired domain name for Cloudflare Pages

## Content / i18n rules

- Spanish: Rioplatense register (*vos*, native phrasing — never a literal translation)
- Technical terms (FastAPI, LangChain, deploy, pipeline, etc.) stay in English in both locales
- SEO: use locale `es` (not `es-419`); reciprocal `hreflang` tags; canonical self-referencing
