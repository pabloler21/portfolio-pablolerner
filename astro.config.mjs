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
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
