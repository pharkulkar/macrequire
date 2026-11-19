import { notFound } from '../../lib/errors';
import { ApplicationRecord, applicationsRepository } from './applications.repository';
import { ListApplicationsQuery, SearchApplicationsQuery } from './applications.schemas';

export function toApplicationDto(a: ApplicationRecord) {
  const r = a.requirements;
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    category: a.category,
    macSupported: a.macSupported,
    notes: a.notes,
    requirements: r && {
      minRamGB: r.minRamGB,
      preferredRamGB: r.preferredRamGB,
      cpuDemand: r.cpuDemand,
      gpuDemand: r.gpuDemand,
      storageGB: r.storageGB,
      intensity: r.intensity,
      concurrencyFactor: r.concurrencyFactor,
      needsAppleSilicon: r.needsAppleSilicon,
      extra: r.extra,
      provenance: {
        basis: r.basis,
        note: r.basisNote,
        sourceUrl: r.sourceUrl,
        verifiedAt: r.verifiedAt,
      },
    },
  };
}

/** Lower is better. */
function rank(a: ApplicationRecord, q: string) {
  const name = a.name.toLowerCase();
  const needle = q.toLowerCase();
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  if (name.split(/[\s/()-]+/).some((w) => w.startsWith(needle))) return 2;
  if (name.includes(needle)) return 3;
  if (a.aliases.some((x) => x === needle)) return 4;
  if (a.aliases.some((x) => x.includes(needle))) return 5;
  return 6;
}

export const applicationsService = {
  async list(q: ListApplicationsQuery) {
    const { total, items } = await applicationsRepository.list(q);
    return {
      data: items.map(toApplicationDto),
      pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
    };
  },

  async search({ q, limit }: SearchApplicationsQuery) {
    const items = await applicationsRepository.search(q, limit);
    const ranked = items
      .map((a) => ({ a, r: rank(a, q) }))
      .sort((x, y) => x.r - y.r || x.a.name.localeCompare(y.a.name))
      .slice(0, limit)
      .map((x) => toApplicationDto(x.a));
    return { data: ranked };
  },

  async get(idOrSlug: string) {
    const a = await applicationsRepository.find(idOrSlug);
    if (!a) throw notFound('Application');
    return toApplicationDto(a);
  },

  async categories() {
    return { data: await applicationsRepository.categories() };
  },

  async useCases() {
    const rows = await applicationsRepository.listUseCases();
    const slugs = [...new Set(rows.flatMap((u) => u.starterApps))];
    const apps = await applicationsRepository.findStarterApps(slugs);
    const bySlug = new Map(apps.map((a) => [a.slug, a]));
    return {
      data: rows.map((u) => ({
        id: u.id,
        slug: u.slug,
        name: u.name,
        description: u.description,
        appCategories: u.appCategories,
        /** Typical apps preselected when a visitor starts from this use case. */
        starterApplications: u.starterApps.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!] : [])),
        weights: Object.fromEntries(u.weights.map((w) => [w.category, w.multiplier])),
      })),
    };
  },
};
