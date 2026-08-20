# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: hiring decision-makers at AI startups and small product companies — technical
founders, engineering leads, and the senior engineers they hand a candidate to. They are
skim-first readers evaluating many candidates; they arrive from a LinkedIn link or a job
application, give the site well under a minute on first pass, and are looking for a reason
to keep reading rather than a reason to stop.

Secondary: recruiters and talent sourcers who do not read code and need to extract role,
stack, and contact quickly.

Market target is remote/international, English-leading, with Spanish maintained at parity
for regional applications.

## Product Purpose

A personal portfolio whose single job is to get Pablo Lerner hired as an **AI Engineer**.
Success is a hiring conversation started — an email, a LinkedIn message, or a GitHub visit
that leads to one. It is not traffic, time-on-site, or completion of any interactive
sequence.

## Positioning

Pablo builds AI systems that **run unattended in production he operates himself** — not
notebooks, not demos that need a babysitter. The differentiating evidence is operational:
services on a self-hosted VPS under `systemd`, durable task queues that survive restarts,
RAG indexes at real scale, live endpoints anyone can hit right now. Most candidates at this
level show model experiments; the claim a neighboring portfolio could not truthfully copy
is that these things have uptime.

Data analysis and ML modeling are genuine adjacent skills and stay on the site, but they
are supporting range, not the headline.

## Operating Context

Evaluation happens in a browser tab opened between other tasks, often alongside the
candidate's GitHub and LinkedIn in neighboring tabs. Readers cross-check claims against the
linked repositories. Desktop is the dominant evaluation surface; mobile matters for the
first-glance pass from a phone.

## Capabilities and Constraints

- Astro static output; no server runtime at the portfolio layer.
- Bilingual EN/ES, both locale-prefixed, reciprocal `hreflang`, canonical self-referencing.
- Spanish uses Rioplatense register (*vos*). Technical terms (FastAPI, LangChain, deploy,
  pipeline, stack) stay in English in both locales.
- Three.js is already a dependency and an interactive 3D surface is a binding requirement
  (see Brand Commitments).
- Character model asset: `public/models/android.glb` (7.8MB) — a large, load-bearing
  download that constrains the first-viewport budget.
- **Data Scientist is retired as a role.** No DS projects exist and none are planned; the
  third role and its COMING SOON state come out rather than being designed around.
- Live demo currently deployed: CV Evaluator at `https://aurea.pablolerner.dev`.

## Brand Commitments

- Name: Pablo Lerner. Domain: `pablolerner.dev`.
- The site must remain an interactive 3D, game-like experience — this is a binding
  constraint from the owner, not a stylistic option.
- **The avenue is the committed 3D world** (owner decision, 2026-08-20, superseding the
  SIGNALIS room). The visitor walks a character down a night street in third-person; each
  project is a billboard that powers on as the character approaches. The SIGNALIS top-down
  room is retired as a target: it is no longer a brand commitment, and the avenue is not a
  stepping stone toward it. Palette, character design, and props stay original.
- **Atmosphere is scoped to the playable surface.** Grain, scanlines, margin rain and the
  ambient canvas exist only where the visitor can walk. Record pages are documents: no
  ambient layer, no game chrome. Direction "Capas separadas", chosen 2026-08-20 — see
  `docs/superpowers/specs/2026-08-20-ui-capas-separadas-design.md`.
- **The character is moved by WASD only.** No pointer-driven movement of any kind: no
  click-to-walk on the ground, no minimap fast-travel, no auto-walk from record rows.
- Contact surface: GitHub `pabloler21`, LinkedIn `pablo-lerner-591180336`,
  email `lerner.pb@gmail.com`.

## Evidence on Hand

Real and defensible as **operational** evidence:

- **Iris** — personal AI assistant, 24/7 on homelab Linux, Discord interface, RAG over
  personal documents, automated weekly digest from 8+ RSS feeds. 1.2M vectors indexed;
  runs unattended under `systemd`.
- **Team Agent Ops (Hermes)** — multi-agent team bot replacing n8n workflows; BullMQ/Redis
  durable queue, Discord, GitHub MCP integration. No dropped tasks on restart.
- **CV Evaluator** — FastAPI + Claude AI resume/ATS analyzer, self-hosted behind Caddy,
  wakes on demand. **Live and clickable** at `https://aurea.pablolerner.dev`.

Real but **learning-context** evidence — numbers are truthfully measured, but on public or
practice datasets, not production business data. These must never be presented in a way
that implies employer work:

- FraudSense AI — AUC-ROC 0.971, precision 0.943, 1.85M rows.
- Credit scoring, e-commerce inventory, SQL analyses, and the remaining risk projects.

Professional experience: BI Analyst at Uplin HR, Jan–Mar 2026.

Confirmed as arriving before launch: CV PDF at `public/pablo-lerner-cv.pdf`, and bio /
career-narrative copy for About.

Absent — must not be fabricated: client testimonials, employer names beyond Uplin HR,
revenue or business-impact figures, user counts, uptime percentages, benchmark comparisons
against named products.

## Product Principles

1. **Operational proof leads.** A thing that is running and clickable outranks a thing that
   scored well. The live demo and the unattended services are the argument.
2. **Provenance travels with every number.** A metric from a public dataset is labeled as
   such at the point it is read, never only in a footnote. Credibility is the asset being
   protected; an unqualified 0.971 spends it.
3. **The interactive layer must never gate the evidence.** The 3D world is the reason to
   stay, not the toll to enter. Every project must be reachable without playing.
4. **Legibility is a hard floor, not a mode.** Text must be readable at WCAG AA in the
   site's default state, without the visitor discovering a toggle.
5. **Range without dilution.** Data analysis stays visible as supporting evidence and never
   competes with AI engineering for the primary claim.

## Accessibility & Inclusion

WCAG 2.1 AA contrast for all text in the default state is a product requirement, established
directly by the owner. Keyboard operation of all navigation and project selection is
required; the 3D world is keyboard-driven (WASD) by design and pointer-driven character
movement is explicitly out of scope. All ambient motion must respect
`prefers-reduced-motion`, and the site must be fully usable with motion disabled.
