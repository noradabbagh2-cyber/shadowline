import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Makes the production build runnable by double-clicking dist/index.html
 * (file://) as well as from any static host: one classic script, relative paths.
 */
function classicScript(): Plugin {
  return {
    name: 'shadowline-classic-script',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html.replace(/<script type="module" crossorigin/g, '<script defer').replace(/ crossorigin/g, ''),
    },
  };
}

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.bin'],
  plugins: [react(), classicScript()],
  build: {
    assetsInlineLimit: 0,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
});
