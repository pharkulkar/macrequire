import { prepareSeries, RangeKey } from './price-history';
import { loadPriceStats, PriceStats } from './price-stats';
import { DEFAULT_MARKET } from '../../lib/markets';
import { buildLink } from '../affiliate/links';
import { notFound } from '../../lib/errors';
import { catalogRepository, ConfigurationRecord } from './catalog.repository';
import { ListConfigurationsQuery, ListProductsQuery } from './catalog.schemas';

/** Storage is held in GB with 1TB = 1024GB. */
export const formatStorage = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);

const configLabel = (c: ConfigurationRecord) =>
  `${c.chip.name} (${c.cpuCores}-core CPU, ${c.gpuCores}-core GPU) · ${c.ramGB}GB · ${formatStorage(c.storageGB)}`;

/** Public offer shape. The affiliate URL is intentionally never exposed: clicks go through /api/outbound. */
const toPublicOffer = (o: ConfigurationRecord['offers'][number], stats?: PriceStats) => ({
  id: o.id,
  merchant: { id: o.merchant.id, slug: o.merchant.slug, name: o.merchant.name },
  country: o.country,
  currency: o.currency,
  price: o.price,
  listPrice: o.listPrice,
  stock: o.stock,
  priceVerifiedAt: o.priceVerifiedAt,
  priceSource: o.source,
  hasAffiliateLink: buildLink(o.merchant, o).linkType === 'AFFILIATE',
  outboundPath: `/api/outbound/${o.id}`,
  /** Recorded price history for this offer: lowest ever recorded and the previous price. Null until a price has been recorded. */
  priceStats: stats ? { lowest: stats.lowest, previous: stats.previous, observations: stats.observations, priceChanges: stats.priceChanges, since: stats.since } : null,
});

const VERIFICATION_NOTES: Record<string, string> = {
  STORE_CONFIRMED: 'An Apple store page exists for this exact combination.',
  CTO_DERIVED: 'Derived from Apple\'s documented configure-to-order options. Confirm availability at checkout.',
  ADMIN_VERIFIED: 'Confirmed by a MacRequire administrator.',
};

/** `country` limits the offers (and the lowest price) to one market, so shoppers never see another country's prices. */
export function toConfigurationDto(c: ConfigurationRecord, country?: string, stats?: Map<string, PriceStats>) {
  const offers = country ? c.offers.filter((o) => o.country === country) : c.offers;
  const s = c.specification;
  const extra = (s?.extra ?? {}) as { brightnessNote?: string; webBatteryHours?: number };
  return {
    id: c.id,
    label: configLabel(c),
    sku: c.sku,
    model: {
      id: c.model.id,
      slug: c.model.slug,
      name: c.model.name,
      category: c.model.category,
      generation: c.model.generation,
      releaseYear: c.model.releaseYear,
      screenSizeInch: c.model.screenSizeInch,
      imageUrl: c.model.imageUrl,
      officialSpecUrl: c.model.officialSpecUrl,
    },
    chip: {
      name: c.chip.name,
      family: c.chip.family,
      tier: c.chip.tier,
      cpuCores: c.cpuCores,
      gpuCores: c.gpuCores,
      superCores: c.chip.superCores,
      performanceCores: c.chip.performanceCores,
      efficiencyCores: c.chip.efficiencyCores,
      neuralEngineCores: c.chip.neuralEngineCores,
      neuralEngineNote: c.chip.neuralEngineNote,
      memoryBandwidthGBs: c.chip.memoryBandwidthGBs,
    },
    memoryGB: c.ramGB,
    storageGB: c.storageGB,
    storageLabel: formatStorage(c.storageGB),
    colors: c.colors,
    display: s && {
      technology: s.displayTech,
      resolution: s.displayResolution,
      refreshRateHz: s.refreshRateHz,
      brightnessNits: s.brightnessNits,
      brightnessNote: extra.brightnessNote ?? null,
    },
    battery: s && { capacityWh: s.batteryWh, videoHours: s.batteryLifeHours, webHours: extra.webBatteryHours ?? null },
    weightKg: s?.weightKg ?? null,
    ports: s?.ports ?? [],
    wireless: s?.wireless ?? null,
    camera: s?.camera ?? null,
    audio: s?.audio ?? null,
    externalDisplays: s?.externalDisplays ?? null,
    provenance: {
      specSource: c.source,
      specVerifiedAt: c.verifiedAt,
      verification: c.verification,
      verificationNote: VERIFICATION_NOTES[c.verification] ?? null,
      sourceUrl: s?.sourceUrl ?? c.model.officialSpecUrl,
    },
    offers: offers.map((o) => toPublicOffer(o, stats?.get(o.id))),
    // Prices are merchant-reported. None is shown unless an active offer carries one.
    lowestPrice: lowestPrice(offers),
    // The lowest price recorded across this configuration's offers (history, not only today's price).
    lowestRecorded: lowestRecorded(offers, stats),
  };
}

function lowestRecorded(offers: ConfigurationRecord['offers'], stats?: Map<string, PriceStats>) {
  let best: { amount: number; currency: string; merchant: string; recordedAt: Date } | null = null;
  for (const o of offers) {
    const s = stats?.get(o.id);
    if (s && (!best || s.lowest.amount < best.amount)) best = { amount: s.lowest.amount, currency: o.currency, merchant: o.merchant.name, recordedAt: s.lowest.recordedAt };
  }
  return best;
}
/** Builds public configuration DTOs, loading each offer's price history in one batch. */
export async function toConfigurationDtos(records: ConfigurationRecord[], country?: string) {
  const offerIds = records.flatMap((c) => c.offers.filter((o) => !country || o.country === country).map((o) => o.id));
  const stats = await loadPriceStats(offerIds);
  return records.map((c) => toConfigurationDto(c, country, stats));
}
function lowestPrice(offers: ConfigurationRecord['offers']) {
  const priced = offers.filter((o) => o.price != null && o.stock !== 'OUT_OF_STOCK');
  if (!priced.length) return null;
  const best = priced.reduce((a, b) => (a.price! <= b.price! ? a : b));
  return { amount: best.price!, currency: best.currency, merchant: best.merchant.name, country: best.country };
}

const paginate = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

type ConfigurationDto = ReturnType<typeof toConfigurationDto>;

/**
 * Ids holding the best value of an attribute. Returns [] when fewer than two values exist or all are equal,
 * because a tie is not a "strongest".
 */
export function bestIds<T extends { id: string }>(items: T[], pick: (item: T) => number | null | undefined, dir: 'max' | 'min'): string[] {
  const vals = items.map((c) => ({ id: c.id, v: pick(c) })).filter((x): x is { id: string; v: number } => x.v != null);
  if (vals.length < 2) return [];
  const target = dir === 'max' ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
  if (vals.every((x) => x.v === target)) return [];
  return vals.filter((x) => x.v === target).map((x) => x.id);
}

export function specHighlights(data: ConfigurationDto[]) {
  return {
    cpuCores: bestIds(data, (c) => c.chip.cpuCores, 'max'),
    gpuCores: bestIds(data, (c) => c.chip.gpuCores, 'max'),
    memoryGB: bestIds(data, (c) => c.memoryGB, 'max'),
    storageGB: bestIds(data, (c) => c.storageGB, 'max'),
    memoryBandwidthGBs: bestIds(data, (c) => c.chip.memoryBandwidthGBs, 'max'),
    brightnessNits: bestIds(data, (c) => c.display?.brightnessNits, 'max'),
    batteryVideoHours: bestIds(data, (c) => c.battery?.videoHours, 'max'),
    weightKg: bestIds(data, (c) => c.weightKg, 'min'),
    price: bestIds(data, (c) => c.lowestPrice?.amount, 'min'),
  };
}

export const catalogService = {
  async listProducts(q: ListProductsQuery) {
    const { total, items } = await catalogRepository.listModels(q);
    return {
      data: items.map((m) => {
        const rams = m.configurations.map((c) => c.ramGB);
        const storages = m.configurations.map((c) => c.storageGB);
        return {
          id: m.id,
          slug: m.slug,
          name: m.name,
          category: m.category,
          generation: m.generation,
          releaseYear: m.releaseYear,
          modelIdentifier: m.modelIdentifier,
          screenSizeInch: m.screenSizeInch,
          imageUrl: m.imageUrl,
          officialSpecUrl: m.officialSpecUrl,
          verifiedAt: m.verifiedAt,
          configurationCount: m.configurations.length,
          chips: [...new Set(m.configurations.map((c) => c.chip.name))],
          memoryRangeGB: rams.length ? [Math.min(...rams), Math.max(...rams)] : null,
          storageRangeGB: storages.length ? [Math.min(...storages), Math.max(...storages)] : null,
        };
      }),
      pagination: paginate(q.page, q.pageSize, total),
    };
  },

  async getProduct(idOrSlug: string, country: string = DEFAULT_MARKET) {
    const model = await catalogRepository.findModel(idOrSlug);
    if (!model) throw notFound('Product');
    const configs = await catalogRepository.listConfigurationsForModel(model.id);
    return { ...model, configurations: await toConfigurationDtos(configs, country) };
  },

  async listProductConfigurations(idOrSlug: string, country: string = DEFAULT_MARKET) {
    const model = await catalogRepository.findModel(idOrSlug);
    if (!model) throw notFound('Product');
    const configs = await catalogRepository.listConfigurationsForModel(model.id);
    return { data: await toConfigurationDtos(configs, country) };
  },

  async listConfigurations(q: ListConfigurationsQuery & { country?: string }) {
    const { total, items } = await catalogRepository.listConfigurations(q);
    return { data: await toConfigurationDtos(items, q.country ?? DEFAULT_MARKET), pagination: paginate(q.page, q.pageSize, total) };
  },

  async getConfiguration(id: string, country: string = DEFAULT_MARKET) {
    const c = await catalogRepository.findConfiguration(id);
    if (!c) throw notFound('Configuration');
    return (await toConfigurationDtos([c], country))[0];
  },

  /** Returns configurations in the requested order, with the best value per comparable attribute. */
  async compare(ids: string[], country: string = DEFAULT_MARKET) {
    const found = await catalogRepository.findConfigurations(ids);
    const byId = new Map(found.map((c) => [c.id, c]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) throw notFound(`Configuration(s) ${missing.join(', ')}`);
    const data = await toConfigurationDtos(ids.map((id) => byId.get(id)!), country);

    return {
      data,
      highlights: specHighlights(data),
      notes: ['Recommendation score and application compatibility are added to comparisons once a recommendation profile is supplied (Phase 4-5).'],
    };
  },

  async listMerchants(country?: string) {
    return { data: await catalogRepository.listMerchants(country) };
  },

  /** Price history for one configuration in one market, split per seller and ready to chart. */
  async priceHistory(configurationId: string, country: string = DEFAULT_MARKET, range: RangeKey = '90d') {
    const config = await catalogRepository.findConfiguration(configurationId);
    if (!config) throw notFound('Configuration');
    const offers = config.offers.filter((o) => o.country === country);
    const records = offers.length ? await catalogRepository.priceRecords(offers.map((o) => o.id)) : [];
    const byOffer = new Map<string, { price: number; recordedAt: Date }[]>();
    for (const r of records) byOffer.set(r.offerId, [...(byOffer.get(r.offerId) ?? []), { price: r.price!, recordedAt: r.recordedAt }]);
    const series = offers.map((o) => ({
      offerId: o.id,
      merchant: { id: o.merchant.id, name: o.merchant.name },
      currency: o.currency,
      current: o.price,
      outOfStock: o.stock === 'OUT_OF_STOCK',
      points: prepareSeries(byOffer.get(o.id) ?? [], range),
    }));
    // Extremes over what is drawn, plus today's price.
    let lowest: { amount: number; at: string; merchant: string } | null = null;
    let highest: { amount: number; at: string; merchant: string } | null = null;
    for (const s of series) {
      for (const p of s.points) {
        if (!lowest || p.price < lowest.amount) lowest = { amount: p.price, at: p.at, merchant: s.merchant.name };
        if (!highest || p.price > highest.amount) highest = { amount: p.price, at: p.at, merchant: s.merchant.name };
      }
    }
    const first = records.length ? records[0].recordedAt : null; // records are oldest first
    return {
      data: { country, currency: series[0]?.currency ?? null, range, since: first, series, lowest, highest },
    };
  },
  async listOffers(configurationId: string, country: string = DEFAULT_MARKET) {
    const config = await catalogRepository.findConfiguration(configurationId);
    if (!config) throw notFound('Configuration');
    const offers = await catalogRepository.listOffers(configurationId, country);
    return {
      data: offers.map((o) => ({
        id: o.id,
        merchant: { id: o.merchant.id, slug: o.merchant.slug, name: o.merchant.name },
        country: o.country,
        currency: o.currency,
        price: o.price,
        listPrice: o.listPrice,
        stock: o.stock,
        priceVerifiedAt: o.priceVerifiedAt,
        priceSource: o.source,
        hasAffiliateLink: buildLink(o.merchant, o).linkType === 'AFFILIATE',
        outboundPath: `/api/outbound/${o.id}`,
      })),
    };
  },
};
