import { CONTENT_DATES } from './site';

export interface GuideMeta {
  slug: string;
  title: string;
  /** Short answer shown on the hub and used as the meta description. */
  summary: string;
  updated: string;
}

export const GUIDES: GuideMeta[] = [
  {
    slug: 'how-much-ram-for-macbook',
    title: 'How much memory (RAM) does a MacBook need?',
    summary: 'How unified memory works, how we estimate the memory a workload needs, and example requirements for popular apps, with vendor-published figures marked separately from estimates.',
    updated: CONTENT_DATES.guides,
  },
  {
    slug: 'macbook-air-vs-macbook-pro',
    title: 'MacBook Air vs MacBook Pro: specifications compared',
    summary: 'A side-by-side table of every current MacBook model in our catalog: chips, memory and storage ranges, display, battery, weight and ports, taken from Apple’s specifications.',
    updated: CONTENT_DATES.guides,
  },
  {
    slug: 'how-much-storage-for-macbook',
    title: 'How much storage does a MacBook need?',
    summary: 'How much space macOS and common apps take, why storage cannot be upgraded later, and how we estimate the capacity a workload needs.',
    updated: CONTENT_DATES.guides,
  },
];

/** Public, indexable pages other than the dynamic product pages. Shared by the sitemap and llms.txt. */
export const STATIC_PAGES: { path: string; title: string; description: string; lastmod?: string }[] = [
  { path: '/', title: 'MacRequire', description: 'Find the MacBook configuration that fits your apps, workload and budget.' },
  { path: '/catalog', title: 'MacBook catalog', description: 'Every current MacBook model and exact configuration with specifications from Apple.' },
  { path: '/applications', title: 'Application directory', description: 'The hardware profile we use for each application: memory, CPU, GPU and storage.' },
  { path: '/guides', title: 'MacBook buying guides', description: 'Answer-first guides to memory, storage and choosing between MacBook models.', lastmod: CONTENT_DATES.guides },
  ...GUIDES.map((g) => ({ path: `/guides/${g.slug}`, title: g.title, description: g.summary, lastmod: g.updated })),
  { path: '/methodology', title: 'How MacRequire scores MacBooks', description: 'The scoring categories, weights, assumptions and data sources behind every recommendation.', lastmod: CONTENT_DATES.guides },
  { path: '/about', title: 'About MacRequire', description: 'Who MacRequire is, how it is funded and how it handles corrections.' },
  { path: '/affiliate-disclosure', title: 'Affiliate disclosure', description: 'How MacRequire earns money and why it does not affect recommendations.' },
  { path: '/privacy', title: 'Privacy policy', description: 'What MacRequire collects, why, and your choices.', lastmod: CONTENT_DATES.privacy },
  { path: '/terms', title: 'Terms of use', description: 'The terms for using MacRequire.', lastmod: CONTENT_DATES.terms },
];
