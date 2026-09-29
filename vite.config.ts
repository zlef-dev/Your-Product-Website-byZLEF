import { resolve } from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';
import { SECURITY_HEADERS } from './build/headers.ts';
import { fontPreloadPlugin, inlineCssPlugin, sitePlugin } from './build/site-plugin.ts';

export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [sitePlugin(), fontPreloadPlugin(), inlineCssPlugin()];
  if (mode === 'analyze') {
    plugins.push(
      visualizer({ filename: 'qa/bundle.html', gzipSize: true, template: 'treemap' }) as PluginOption,
    );
  }
  return {
    plugins,
    build: {
      target: 'es2022',
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rolldownOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          notFound: resolve(import.meta.dirname, '404.html'),
          privacy: resolve(import.meta.dirname, 'privacy.html'),
        },
      },
    },
    worker: { format: 'es' },
    // Preview serves the production headers, so tests run under the real CSP.
    preview: { port: 4173, strictPort: true, headers: SECURITY_HEADERS },
    server: { port: 5173 },
  };
});
