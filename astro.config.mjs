// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://pablolerner.dev',
  server: { host: '0.0.0.0' },
  // React entra SOLO por los controles tactiles de la escena 3D
  // (src/components/ui/TouchControls.tsx). Es la unica isla React del sitio:
  // todo lo demas es Astro estatico + JS vanilla. Si alguna vez se saca ese
  // componente, esta integracion se va con el.
  integrations: [react()],
  /* /ai/ y /risk/ se fundieron en /projects/. Se declaran como redirect y no
     se borran a secas porque hay links repartidos afuera (CV, LinkedIn,
     postulaciones) que apuntan a las dos viejas; en salida estatica Astro emite
     una pagina de meta-refresh. */
  redirects: {
    '/en/ai': '/en/projects', '/en/risk': '/en/projects',
    '/es/ai': '/es/projects', '/es/risk': '/es/projects',
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
