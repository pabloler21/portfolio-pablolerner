// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://pablolerner.dev',
  server: { host: '0.0.0.0' },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
