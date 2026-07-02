/**
 * Single source of truth for all project data.
 * Edit this file to update project cards across all pages (EN + ES).
 *
 * Each project has:
 *   - github / demo: links (use '' for no link)
 *   - stack: tech tags shown on the card
 *   - status: EN badge label (shown as-is; override per locale below if needed)
 *   - featured: true → left accent border
 *   - en / es: localized content (name, problem, outcome)
 *       problem: one-line statement of what problem the project solves
 *       outcome: key metric or concrete result (optional — leave '' to hide)
 */

export interface ProjectData {
  id: string;
  github: string;
  demo?: string;
  stack: readonly string[];
  status: string;
  statusEs?: string;
  featured?: boolean;
  en: { name: string; problem: string; outcome: string };
  es: { name: string; problem: string; outcome: string };
}

// ────────────────────────────────────────────────────────────────
// AI ENGINEER projects
// ────────────────────────────────────────────────────────────────
export const aiProjects: ProjectData[] = [
  {
    id: 'iris',
    github: 'https://github.com/pabloler21/Iris',
    stack: ['Python', 'LangChain', 'Qdrant', 'Discord', 'FastAPI', 'systemd'],
    status: 'ACTIVE',
    statusEs: 'ACTIVO',
    featured: true,
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
    id: 'bot-curriculum',
    github: 'https://github.com/pabloler21/bot_curriculum',
    demo: 'https://bot-curriculum-1.onrender.com',
    stack: ['FastAPI', 'LangChain', 'Claude AI', 'Python', 'Pydantic', 'SlowAPI', 'Render'],
    status: 'DEPLOYED',
    statusEs: 'DEPLOYED',
    en: {
      name: 'CV Evaluator',
      problem: 'Web app that analyzes resumes for ATS compatibility using Claude AI — returns a structured score with keywords, formatting issues, and actionable recommendations.',
      outcome: 'REST API with clean architecture (routes / handlers / business logic) · live on Render',
    },
    es: {
      name: 'CV Evaluator',
      problem: 'App web que analiza CVs para compatibilidad ATS con Claude AI — devuelve un score estructurado con palabras clave, problemas de formato y recomendaciones accionables.',
      outcome: 'API REST con arquitectura limpia (routes / handlers / lógica) · en vivo en Render',
    },
  },
  {
    id: 'hermes',
    github: 'https://github.com/pabloler21/prbot-hermes',
    stack: ['Python', 'LangChain', 'BullMQ', 'Redis', 'Discord', 'MCP'],
    status: 'DEPLOYED',
    statusEs: 'DEPLOYED',
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
    id: 'tutorbot',
    github: 'https://github.com/pabloler21/TutorBot',
    stack: ['Python', 'LangChain', 'Gradio'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
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
    id: 'obsidian-tracker',
    github: 'https://github.com/pabloler21/obsidian-job-tracker',
    stack: ['Claude Code', 'Markdown', 'Obsidian'],
    status: 'TOOLING',
    statusEs: 'HERRAMIENTA',
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
  {
    id: 'second-brain',
    github: 'https://github.com/pabloler21/workshop-challenge',
    stack: ['Python', 'AI Agents', 'Computer Vision'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
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
];

// ────────────────────────────────────────────────────────────────
// DATA ANALYST projects
// ────────────────────────────────────────────────────────────────
export const riskProjects: ProjectData[] = [
  {
    id: 'fraudsense',
    github: 'https://github.com/pabloler21/fraud-risk-analytics',
    stack: ['Python', 'PostgreSQL', 'scikit-learn', 'Power BI', 'FastAPI', 'Claude API'],
    status: 'FLAGSHIP',
    statusEs: 'DESTACADO',
    featured: true,
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
    id: 'adventure-works',
    github: 'https://github.com/pabloler21/adventure-works-financial-dashboard',
    stack: ['Power BI', 'DAX', 'Data Modeling'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
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
    id: 'sheets-sales',
    github: 'https://github.com/pabloler21/google-sheets-sales-analysis',
    stack: ['Google Sheets', 'Data Viz', 'Formulas'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
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
  {
    id: 'smart-inventory',
    github: 'https://github.com/pabloler21/Proyecto_Final_Grupo_2',
    stack: ['Python', 'BigQuery', 'Power BI', 'Streamlit', 'scikit-learn', 'Pandas'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
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
    id: 'byogenesis',
    github: 'https://github.com/pabloler21/proyecto_integrador_m4_python',
    stack: ['Python', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn'],
    status: 'BUILT',
    statusEs: 'COMPLETADO',
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
];

// ────────────────────────────────────────────────────────────────
// DATA SCIENTIST projects
// ────────────────────────────────────────────────────────────────
// TODO: add repos once Pablo assigns them
export const dsProjects: ProjectData[] = [];
