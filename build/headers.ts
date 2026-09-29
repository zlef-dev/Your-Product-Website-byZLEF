/**
 * Security and caching headers. One source for Cloudflare Pages (`dist/_headers`) and for
 * `vite preview`, so the e2e suite runs under the same Content-Security-Policy as production.
 */
export const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://api.web3forms.com",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** Cloudflare Pages `_headers`: security headers everywhere, long-lived caching for hashed assets. */
export function cloudflareHeaders(): string {
  const all = Object.entries(SECURITY_HEADERS)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');
  return `/*\n${all}\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`;
}
