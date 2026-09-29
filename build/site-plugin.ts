/**
 * Renders the static pages from src/templates at build (and dev) time, injects the
 * head tags (SEO, social, JSON-LD, font preload) and emits robots.txt, sitemap.xml and
 * the web manifest from src/config.ts, so no placeholder ever ships in markup.
 */
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { contactEmail, site, siteUrl, socialLinks, studioName } from '../src/config.ts';
import { cloudflareHeaders } from './headers.ts';
import { meta, notFound, privacy } from '../src/content.ts';
import { homeBody } from '../src/templates/home.ts';
import { notFoundBody, privacyBody } from '../src/templates/pages.ts';

type Page = 'home' | '404' | 'privacy';

const PAPER = '#F1F2EE';

function pageOf(path: string): Page {
  if (path.endsWith('404.html')) return '404';
  if (path.endsWith('privacy.html')) return 'privacy';
  return 'home';
}

const abs = (p: string) => (siteUrl ? `${siteUrl}${p}` : null);

function titleFor(page: Page): string {
  const suffix = studioName ? ` | ${studioName}` : '';
  if (page === '404') return `${notFound.title}${suffix}`;
  if (page === 'privacy') return `${privacy.title}${suffix}`;
  return meta.title;
}

function jsonLd(): string {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    description: meta.description,
    address: { '@type': 'PostalAddress', addressLocality: site.locality, addressCountry: site.countryCode },
  };
  if (studioName) data.name = studioName;
  if (siteUrl) {
    data.url = `${siteUrl}/`;
    data.image = `${siteUrl}/og.png`;
  }
  if (contactEmail) data.email = contactEmail;
  if (socialLinks.length) data.sameAs = socialLinks.map((s) => s.href);
  // "<" is escaped so the JSON can never close the script element early.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function headTags(page: Page): HtmlTagDescriptor[] {
  const m = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' });
  const l = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'link', attrs, injectTo: 'head' });
  const title = titleFor(page);
  const path = page === 'home' ? '/' : page === 'privacy' ? '/privacy.html' : null;
  const tags: HtmlTagDescriptor[] = [
    { tag: 'title', children: title, injectTo: 'head' },
    m({ name: 'description', content: meta.description }),
    m({ name: 'theme-color', content: PAPER }),
    m({ name: 'color-scheme', content: 'light' }),
    l({ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }),
    l({ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }),
    l({ rel: 'manifest', href: '/manifest.webmanifest' }),
    m({ property: 'og:type', content: 'website' }),
    m({ property: 'og:title', content: title }),
    m({ property: 'og:description', content: meta.description }),
    m({ property: 'og:image', content: abs('/og.png') ?? '/og.png' }),
    m({ property: 'og:image:width', content: '1200' }),
    m({ property: 'og:image:height', content: '630' }),
    m({
      property: 'og:image:alt',
      content: 'A blank aluminium can whose label reads “Insert your brand here”.',
    }),
    m({ name: 'twitter:card', content: 'summary_large_image' }),
    m({ name: 'twitter:title', content: title }),
    m({ name: 'twitter:description', content: meta.description }),
    m({ name: 'twitter:image', content: abs('/og.png') ?? '/og.png' }),
  ];
  if (studioName) tags.push(m({ property: 'og:site_name', content: studioName }));
  if (path && siteUrl) {
    tags.push(l({ rel: 'canonical', href: `${siteUrl}${path}` }));
    tags.push(m({ property: 'og:url', content: `${siteUrl}${path}` }));
  }
  if (page === '404') tags.push(m({ name: 'robots', content: 'noindex' }));
  if (page === 'home') {
    tags.push({
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      children: jsonLd(),
      injectTo: 'head',
    });
  }
  return tags;
}

function manifest(): string {
  return JSON.stringify(
    {
      name: studioName ?? 'Websites for brands',
      short_name: studioName ?? 'Websites',
      description: meta.description,
      start_url: '/',
      display: 'standalone',
      background_color: PAPER,
      theme_color: PAPER,
      icons: [
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    null,
    2,
  );
}

function robots(): string {
  return `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`;
}

function sitemap(): string | null {
  if (!siteUrl) return null;
  const urls = ['/', '/privacy.html'].map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function sitePlugin(): Plugin {
  return {
    name: 'site-pages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(manifest());
          return;
        }
        if (req.url === '/robots.txt') {
          res.setHeader('Content-Type', 'text/plain');
          res.end(robots());
          return;
        }
        next();
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(htmlSource, ctx) {
        const page = pageOf(ctx.path || ctx.filename);
        const body = page === '404' ? notFoundBody() : page === 'privacy' ? privacyBody() : homeBody();
        return { html: htmlSource.replace('<!--app-->', body), tags: headTags(page) };
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest() });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots() });
      this.emitFile({ type: 'asset', fileName: '_headers', source: cloudflareHeaders() });
      const map = sitemap();
      if (map) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: map });
    },
  };
}

/**
 * Inlines the page stylesheet into the HTML: one render-blocking request fewer, which
 * matters most on slow mobile connections. (CSP allows inline styles: style-src 'unsafe-inline'.)
 */
export function inlineCssPlugin(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const inlined = new Set<string>();
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
        let html = String(file.source);
        html = html.replace(
          /<link rel="stylesheet"(?: crossorigin)? href="\/(assets\/[^"]+\.css)">/g,
          (tag, name: string) => {
            const css = bundle[name];
            if (!css || css.type !== 'asset') return tag;
            inlined.add(name);
            return `<style>${String(css.source)}</style>`;
          },
        );
        file.source = html;
      }
      // Keep the CSS files too: lazy chunks may still reference them.
      void inlined;
    },
  };
}

/** Preloads the Latin Archivo woff2 (the only font above the fold) once it has a hashed name. */
export function fontPreloadPlugin(): Plugin {
  return {
    name: 'font-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        const file = Object.keys(ctx.bundle).find((f) => /archivo-latin-wdth-normal.*\.woff2$/.test(f));
        if (!file) return [];
        return [
          {
            tag: 'link',
            attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}
