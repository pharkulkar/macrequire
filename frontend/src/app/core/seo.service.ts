import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { SITE_URL } from './site';

export interface SeoOptions {
  /** Page title without the brand; the brand is appended. */
  title: string;
  description: string;
  /** Path for the canonical URL, e.g. '/catalog/macbook-air'. Query strings are never part of it. */
  path: string;
  type?: 'website' | 'article';
  /** Keep the page out of search results (private or thin pages). */
  noindex?: boolean;
  /** Absolute or site-relative image for social cards. */
  image?: string;
  /** Structured data objects (schema.org). Rendered as JSON-LD. */
  jsonLd?: object[];
  /** ISO dates for articles. */
  published?: string;
  modified?: string;
}

const DEFAULT_IMAGE = '/og-default.png';

/** Per-page metadata for search engines, social previews and AI answer engines. Works during server rendering. */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly site = inject(SITE_URL).replace(/\/$/, '');

  abs(path: string): string {
    return /^https?:\/\//.test(path) ? path : `${this.site}${path.startsWith('/') ? path : '/' + path}`;
  }

  set(o: SeoOptions) {
    const full = o.title.includes(environment.siteName) ? o.title : `${o.title} | ${environment.siteName}`;
    const url = this.abs(o.path === '/' ? '/' : o.path.replace(/\/$/, ''));
    const image = this.abs(o.image ?? DEFAULT_IMAGE);

    this.title.setTitle(full);
    this.upsert({ name: 'description', content: o.description });
    this.upsert({ name: 'robots', content: o.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1' });

    this.upsert({ property: 'og:site_name', content: environment.siteName });
    this.upsert({ property: 'og:locale', content: 'en_US' });
    this.upsert({ property: 'og:type', content: o.type ?? 'website' });
    this.upsert({ property: 'og:title', content: full });
    this.upsert({ property: 'og:description', content: o.description });
    this.upsert({ property: 'og:url', content: url });
    this.upsert({ property: 'og:image', content: image });
    this.upsert({ property: 'og:image:width', content: '1200' });
    this.upsert({ property: 'og:image:height', content: '630' });
    this.upsert({ name: 'twitter:card', content: 'summary_large_image' });
    this.upsert({ name: 'twitter:title', content: full });
    this.upsert({ name: 'twitter:description', content: o.description });
    this.upsert({ name: 'twitter:image', content: image });

    if (o.type === 'article') {
      if (o.published) this.upsert({ property: 'article:published_time', content: o.published });
      if (o.modified) this.upsert({ property: 'article:modified_time', content: o.modified });
    } else {
      this.meta.removeTag("property='article:published_time'");
      this.meta.removeTag("property='article:modified_time'");
    }

    if (environment.googleSiteVerification) this.upsert({ name: 'google-site-verification', content: environment.googleSiteVerification });
    if (environment.bingSiteVerification) this.upsert({ name: 'msvalidate.01', content: environment.bingSiteVerification });

    this.canonical(o.noindex ? null : url);
    this.jsonLd(o.jsonLd ?? []);
  }

  private upsert(tag: { name?: string; property?: string; content: string }) {
    const selector = tag.name ? `name='${tag.name}'` : `property='${tag.property}'`;
    this.meta.updateTag(tag, selector);
  }

  private canonical(url: string | null) {
    const head = this.doc.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** Replaces this page's JSON-LD. Text is serialised and `<` escaped so content can never close the script tag. */
  private jsonLd(items: object[]) {
    const head = this.doc.head;
    head.querySelectorAll('script[data-seo="jsonld"]').forEach((n) => n.remove());
    for (const item of items) {
      const script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-seo', 'jsonld');
      script.textContent = JSON.stringify(item).replace(/</g, '\\u003c');
      head.appendChild(script);
    }
  }

  // ---------------------------------------------------------------- schema.org builders
  organization() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${this.site}/#organization`,
      name: environment.siteName,
      url: this.site,
      logo: this.abs('/logo.png'),
      description: 'MacRequire recommends the exact MacBook configuration that fits your apps, workload, budget and future needs.',
      ...(environment.contactEmail ? { email: environment.contactEmail } : {}),
    };
  }
  website() {
    return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${this.site}/#website`, name: environment.siteName, url: this.site, publisher: { '@id': `${this.site}/#organization` }, inLanguage: 'en-US' };
  }
  breadcrumbs(items: { name: string; path: string }[]) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: this.abs(it.path) })),
    };
  }
  faq(items: { q: string; a: string }[]) {
    return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) };
  }
  article(a: { headline: string; description: string; path: string; published: string; modified: string }) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.headline,
      description: a.description,
      mainEntityOfPage: this.abs(a.path),
      datePublished: a.published,
      dateModified: a.modified,
      inLanguage: 'en-US',
      author: { '@type': 'Organization', name: environment.siteName, url: this.site },
      publisher: { '@id': `${this.site}/#organization` },
      image: this.abs(DEFAULT_IMAGE),
    };
  }
}
