// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  server: { host: '0.0.0.0' },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
