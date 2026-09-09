/**
 * Single source of truth for all project data.
 * Edit this file to update project content across the site (EN + ES).
 *
 * Each project has:
 *   - github / demo: links (use '' for no link)
 *   - stack: tech tags shown on the card
 *   - status: EN badge label (shown as-is; override per locale below if needed)
 *   - track: which half of the profile this project is evidence for. NOT
 *       derivable downstream — the 3D scene receives a flat mapped object, not
 *       the array it came from, and each billboard prints its own track header.
 *   - featured: flagship. EXACTLY ONE project site-wide (see the invariant at
 *       the bottom of this file). Drives the amber treatment everywhere.
 *   - en / es: localized content (name, problem, outcome)
 *       problem: one-line statement of what problem the project solves
 *       outcome: key metric or concrete result (optional — leave '' to hide)
 *
 * `status` describes the STATE of a project (built / deployed / active);
 * `featured` describes its RANK. They are independent on purpose: the flagship
 * keeps DEPLOYED because "you can go touch it right now" is the strongest fact
 * about it, and the amber flagship treatment comes from `featured`.
 */

export interface ProjectData {
  id: string;
  github: string;
  demo?: string;
  stack: readonly string[];
  status: string;
  statusEs?: string;
  track: 'ai' | 'data';
  featured?: boolean;
  en: { name: string; problem: string; outcome: string };
  es: { name: string; problem: string; outcome: string };
}

// ────────────────────────────────────────────────────────────────
// AI ENGINEER — document order (flagship first)
// ────────────────────────────────────────────────────────────────
export const aiProjects: ProjectData[] = [
  {
    id: 'bot-curriculum',
    github: 'https://github.com/pabloler21/bot_curriculum',
    demo: 'https://aurea.pablolerner.dev',
    stack: ['FastAPI', 'LangChain', 'Claude AI', 'Python', 'Pydantic', 'SlowAPI', 'Caddy'],
    status: 'DEPLOYED',
    statusEs: 'DEPLOYED',
    track: 'ai',
    featured: true,
    en: {
      name: 'CV Evaluator',
      problem: 'Web app that analyzes resumes for ATS compatibility using Claude AI — returns a structured score with keywords, formatting issues, and actionable recommendations.',
      outcome: 'REST API with clean architecture (routes / handlers / business logic) · self-hosted, wakes on demand',
    },
    es: {
      name: 'CV Evaluator',
      problem: 'App web que analiza CVs para compatibilidad ATS con Claude AI — devuelve un score estructurado con palabras clave, problemas de formato y recomendaciones accionables.',
      outcome: 'API REST con arquitectura limpia (routes / handlers / lógica) · self-hosted, arranca bajo demanda',
    },
  },
  {
    id: 'iris',
    github: 'https://github.com/pabloler21/Iris',
    stack: ['Python', 'LangChain', 'Qdrant', 'Discord', 'FastAPI', 'systemd'],
    status: 'ACTIVE',
    statusEs: 'ACTIVO',
    track: 'ai',
    en: {
      name: 'Iris — Personal AI Assistant',
      problem: '24/7 personal AI on homelab Linux: Discord interface, RAG over personal docs, automated weekly AI news digest from 8+ RSS feeds.',
      outcome: '1.2M vectors indexed · runs unattended on systemd',
    },
    es: {
      name: 'Iris — Asistente de IA Personal',
      problem: 'IA personal disponible 24/7 en homelab Linux: interfaz por Discord, RAG sobre documentos propios, digest semanal automatizado de noticias de IA.',
      outcome: '1.2M vectores indexados · corre sin supervisión en systemd',
    },
  },
  {
    id: 'hermes',
    github: 'https://github.com/pabloler21/prbot-hermes',
    stack: ['Python', 'LangChain', 'BullMQ', 'Redis', 'Discord', 'MCP'],
    status: 'DEPLOYED',
    statusEs: 'DEPLOYED',
    track: 'ai',
    en: {
      name: 'Team Agent Ops — Hermes',
      problem: 'Multi-agent team bot replacing fragile n8n workflows: Hermes LLM + BullMQ/Redis durable task queue + Discord + GitHub MCP integration.',
      outcome: 'Durable queues — no dropped tasks on restart',
    },
    es: {
      name: 'Team Agent Ops — Hermes',
      problem: 'Bot multi-agente de equipo que reemplaza workflows frágiles de n8n: Hermes LLM + cola durable BullMQ/Redis + Discord + integración GitHub vía MCP.',
      outcome: 'Colas durables — sin tareas perdidas al reiniciar',
    },
  },
  {
    id: 'tarnish',
    github: 'https://github.com/pabloler21/Tarnish',
    demo: 'https://tarnish.pablolerner.dev',
    stack: ['Python', 'Playwright', 'Claude CLI', 'Langfuse', 'pytest', 'uv'],
    status: 'DEPLOYED',
    statusEs: 'DEPLOYED',
    track: 'ai',
    en: {
      name: 'Tarnish — LLM Red Teaming',
      problem: 'Autonomous red teaming for LLM apps: attacks a target through its own input surface, proposes a fix for every finding, and re-runs the campaign to prove the fix closed it.',
      outcome: 'No finding without a fix · no fix called verified without a re-run · live demo',
    },
    es: {
      name: 'Tarnish — Red Teaming de LLMs',
      problem: 'Red teaming autónomo de apps con LLM: ataca al objetivo por su propia superficie de entrada, propone un arreglo para cada hallazgo y vuelve a correr la campaña para probar que lo cerró.',
      outcome: 'Ningún hallazgo sin arreglo · ningún arreglo dado por verificado sin re-corrida · demo en vivo',
    },
  },
  {
    id: 'support-json',
    github: 'https://github.com/pabloler21/support-json',
    stack: ['Python', 'FastAPI', 'Pydantic', 'OpenAI', 'pytest', 'uv'],
    status: 'ACTIVE',
    statusEs: 'ACTIVO',
    track: 'ai',
    en: {
      name: 'Support JSON — Ticket Triage',
      problem: 'Support assistant that turns a free-text ticket into structured JSON: one model call classifies it, drafts the reply and recommends the next action.',
      outcome: '~US$0.00027 per call · 88 offline tests · per-call metrics and safety log',
    },
    es: {
      name: 'Support JSON — Triage de Tickets',
      problem: 'Asistente de soporte que convierte un ticket en texto libre a JSON estructurado: una sola llamada al modelo clasifica, redacta la respuesta y recomienda la acción.',
      outcome: '~US$0,00027 por llamada · 88 tests offline · métricas y safety log por llamada',
    },
  },
  {
    id: 'llamarag',
    github: 'https://github.com/pabloler21/LlamaRAG',
    stack: ['Python', 'LlamaIndex', 'ChromaDB', 'OpenAI', 'pytest'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'ai',
    en: {
      name: 'LlamaRAG — FAQ Retrieval',
      problem: 'RAG over an HR SaaS FAQ fielding 200+ repeated questions a day: sentence-level chunking, vector search, and answers with source attribution instead of manual doc lookup.',
      outcome: '88.9% relevance at top_k=3 · 0.25 similarity floor blocks out-of-domain answers',
    },
    es: {
      name: 'LlamaRAG — Recuperación sobre FAQ',
      problem: 'RAG sobre la FAQ de un SaaS de RRHH con 200+ consultas repetidas por día: chunking por oración, búsqueda vectorial y respuestas con atribución de fuente en vez de buscar a mano en la documentación.',
      outcome: '88,9% de relevancia en top_k=3 · umbral de similitud 0,25 corta lo que está fuera de dominio',
    },
  },
  {
    id: 'tutorbot',
    github: 'https://github.com/pabloler21/TutorBot',
    stack: ['Python', 'LangChain', 'Gradio'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'ai',
    en: {
      name: 'Python TutorBot',
      problem: 'Agentic Python tutor with tool-calling: on-demand Stack Overflow search, persistent conversational memory, Gradio chat interface.',
      outcome: '',
    },
    es: {
      name: 'Python TutorBot',
      problem: 'Tutor agéntico de Python con tool-calling: búsqueda en Stack Overflow bajo demanda, memoria conversacional, interfaz Gradio.',
      outcome: '',
    },
  },
  {
    id: 'second-brain',
    github: 'https://github.com/pabloler21/workshop-challenge',
    stack: ['Python', 'AI Agents', 'Computer Vision'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'ai',
    en: {
      name: 'Second Brain Challenge',
      problem: 'AI agent that parses WhatsApp bank-transfer receipt images into structured records — agentic document parsing pipeline built for Galo\'s workshop.',
      outcome: '',
    },
    es: {
      name: 'Second Brain Challenge',
      problem: 'Agente de IA que procesa imágenes de comprobantes de transferencia por WhatsApp — pipeline agéntico de análisis documental para el workshop de Galo.',
      outcome: '',
    },
  },
  {
    id: 'obsidian-tracker',
    github: 'https://github.com/pabloler21/obsidian-job-tracker',
    stack: ['Claude Code', 'Markdown', 'Obsidian'],
    status: 'TOOLING',
    statusEs: 'HERRAMIENTA',
    track: 'ai',
    en: {
      name: 'Obsidian Job Tracker',
      problem: 'Claude Code slash commands for structured job-search tracking inside Obsidian vaults — AI-powered workflow tooling for personal knowledge management.',
      outcome: '',
    },
    es: {
      name: 'Obsidian Job Tracker',
      problem: 'Slash commands de Claude Code para rastrear búsqueda laboral dentro de Obsidian — tooling personalizado con IA para gestión del conocimiento personal.',
      outcome: '',
    },
  },
];

// ────────────────────────────────────────────────────────────────
// DATA ANALYST — document order (strongest first)
// ────────────────────────────────────────────────────────────────
export const dataProjects: ProjectData[] = [
  {
    id: 'fraudsense',
    github: 'https://github.com/pabloler21/fraud-risk-analytics',
    stack: ['Python', 'PostgreSQL', 'scikit-learn', 'Power BI', 'FastAPI', 'Claude API'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'data',
    en: {
      name: 'FraudSense AI — Fraud Risk Analytics',
      problem: 'End-to-end fraud detection pipeline: SQL pattern mining on 1.85M transactions → EDA → ML modeling → Power BI dashboard → AI explanation API.',
      outcome: 'AUC-ROC 0.971 · precision 0.943 · recall 0.871',
    },
    es: {
      name: 'FraudSense AI — Análisis de Riesgo de Fraude',
      problem: 'Pipeline completo de detección de fraude: minería SQL en 1.85M transacciones → EDA → modelado ML → dashboard Power BI → API de explicaciones con IA.',
      outcome: 'AUC-ROC 0.971 · precisión 0.943 · recall 0.871',
    },
  },
  {
    id: 'credit-scoring',
    github: 'https://github.com/pabloler21/credit-scoring-give-me-some-credit',
    stack: ['Python', 'scikit-learn', 'XGBoost', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'data',
    en: {
      name: 'Credit Scoring — Credit Risk Assessment',
      problem: 'Credit default probability model on 150K+ records: full EDA, feature engineering, multiple ML model evaluation, and classification precision improved via decision threshold optimization.',
      outcome: '150K+ records · improved precision via threshold optimization',
    },
    es: {
      name: 'Credit Scoring — Evaluación de Riesgo Crediticio',
      problem: 'Modelo de probabilidad de incumplimiento crediticio en 150K+ registros: EDA completo, ingeniería de features, evaluación de múltiples modelos ML, y precisión mejorada optimizando umbrales de decisión.',
      outcome: '150K+ registros · precisión mejorada optimizando umbrales de decisión',
    },
  },
  {
    id: 'smart-inventory',
    github: 'https://github.com/pabloler21/Proyecto_Final_Grupo_2',
    stack: ['Python', 'BigQuery', 'Power BI', 'Streamlit', 'scikit-learn', 'Pandas'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'data',
    en: {
      name: 'E-commerce Inventory Optimization',
      problem: 'Inventory optimization solution: ETL/EDA in Python, 500K+ records centralized in BigQuery, Power BI dashboards for real-time support, and a Random Forest overstock risk model integrated into Streamlit.',
      outcome: '~30% at-risk SKUs identified · 500K+ records in BigQuery',
    },
    es: {
      name: 'Optimización de Inventario E-commerce',
      problem: 'Solución de optimización de inventario: ETL/EDA en Python, 500K+ registros centralizados en BigQuery, dashboards Power BI y modelo Random Forest de riesgo de sobrestock integrado en Streamlit.',
      outcome: '~30% de SKUs en riesgo identificados · 500K+ registros en BigQuery',
    },
  },
  {
    id: 'adventure-works',
    github: 'https://github.com/pabloler21/adventure-works-financial-dashboard',
    stack: ['Power BI', 'DAX', 'Data Modeling'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'data',
    en: {
      name: 'Adventure Works Financial Dashboard',
      problem: 'Interactive financial KPI dashboard on Adventure Works data: revenue, costs, margins, and commercial performance across product lines.',
      outcome: '',
    },
    es: {
      name: 'Adventure Works Financial Dashboard',
      problem: 'Dashboard interactivo de KPIs financieros sobre datos de Adventure Works: ingresos, costos, márgenes y performance comercial por línea de producto.',
      outcome: '',
    },
  },
  {
    id: 'fast-food-sql',
    github: 'https://github.com/pabloler21/sql-fast-food-data-analysis',
    stack: ['SQL', 'T-SQL', 'Data Modeling'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'data',
    en: {
      name: 'SQL Fast Food Data Analysis',
      problem: 'Relational database design and analytical queries for a fast food ordering system — data modeling, multi-table JOINs, aggregation and window functions.',
      outcome: '',
    },
    es: {
      name: 'Análisis SQL Fast Food',
      problem: 'Diseño de base relacional y queries analíticas para un sistema de pedidos de comida rápida — modelado de datos, JOINs multi-tabla, funciones de ventana.',
      outcome: '',
    },
  },
  {
    id: 'byogenesis',
    github: 'https://github.com/pabloler21/proyecto_integrador_m4_python',
    stack: ['Python', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'data',
    en: {
      name: 'Byogenesis Lab Location Analysis',
      problem: 'Geospatial analysis to determine optimal countries for biotech lab expansion using 2021 COVID-19 case data and vaccination correlation modeling.',
      outcome: '',
    },
    es: {
      name: 'Análisis de Ubicación — Byogenesis Labs',
      problem: 'Análisis geoespacial para determinar países óptimos de expansión de laboratorio biotecnológico usando datos de COVID-19 2021 y correlación con vacunación.',
      outcome: '',
    },
  },
  {
    id: 'sheets-sales',
    github: 'https://github.com/pabloler21/google-sheets-sales-analysis',
    stack: ['Google Sheets', 'Data Viz', 'Formulas'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
    track: 'data',
    en: {
      name: 'Google Sheets Sales Analysis',
      problem: 'Automated sales reporting and trend analysis built entirely in Google Sheets: live KPI dashboard, formulas, and dynamic charting.',
      outcome: '',
    },
    es: {
      name: 'Análisis de Ventas en Google Sheets',
      problem: 'Reporting automatizado y análisis de tendencias de ventas en Google Sheets: dashboard de KPIs en vivo, fórmulas y gráficos dinámicos.',
      outcome: '',
    },
  },
];

// ────────────────────────────────────────────────────────────────
// THE AVENUE — walk order of the 3D street
// ────────────────────────────────────────────────────────────────
/* The order of the avenue is ONE decision, so it is written in ONE place.
   Spread across a `street: number` field on each project it would drift apart
   on the first reorder. Composed by id so a rename fails the build instead of
   silently dropping a billboard.

   Pacing: the three newest projects open, the three without a headline metric
   sit in the middle, and the walk climbs Hermes → FraudSense → Iris → flagship.
   FraudSense sits at 8 and not at the end of a "data block" because it is the
   only data board on the street — buried among the lighter ones it does not
   read as what it is. */
const byId = new Map<string, ProjectData>(
  [...aiProjects, ...dataProjects].map(p => [p.id, p])
);

const pick = (id: string): ProjectData => {
  const p = byId.get(id);
  if (!p) throw new Error(`streetProjects: id desconocido "${id}"`);
  return p;
};

export const streetProjects: ProjectData[] = [
  'support-json',
  'llamarag',
  'tarnish',
  'second-brain',
  'tutorbot',
  'obsidian-tracker',
  'hermes',
  'fraudsense',
  'iris',
  'bot-curriculum',
].map(pick);

/* The array IS the walk order and the flagship is its LAST board — the old
   convention ("index 0 is the flagship, walk order is [1..N-1, 0]") is gone.
   Checked here, at module evaluation, so a mismatch fails the build instead of
   shipping as perfectly valid HTML that a harness would never flag. */
const flagships = streetProjects.filter(p => p.featured);
if (flagships.length !== 1 || !streetProjects[streetProjects.length - 1].featured) {
  throw new Error(
    'streetProjects: debe haber exactamente un featured y tiene que ir último ' +
    `(hay ${flagships.length}: ${flagships.map(p => p.id).join(', ') || 'ninguno'})`
  );
}
