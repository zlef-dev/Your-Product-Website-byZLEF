/** Starts `vite preview` on a free port for scripts that need the built site. */
import { existsSync } from 'node:fs';
import { preview } from 'vite';

export async function startPreview({ outDir = 'dist', port = 4180 } = {}) {
  if (!existsSync(`${outDir}/index.html`)) {
    throw new Error(`No build found in ${outDir}/. Run "npm run build" first.`);
  }
  const server = await preview({ preview: { port, strictPort: false }, build: { outDir }, logLevel: 'warn' });
  const url = server.resolvedUrls?.local?.[0]?.replace(/\/$/, '') ?? `http://localhost:${port}`;
  return { url, close: () => server.close() };
}

export function chromiumPath() {
  return process.env.CHROME_PATH || undefined;
}
