export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  generation: string;
  releaseYear: number;
  modelIdentifier: string | null;
  screenSizeInch: number;
  imageUrl: string | null;
  officialSpecUrl: string | null;
  verifiedAt: string | null;
  configurationCount: number;
  chips: string[];
  memoryRangeGB: [number, number] | null;
  storageRangeGB: [number, number] | null;
}

export interface Offer {
  id: string;
  merchant: { id: string; slug: string; name: string };
  country: string;
  currency: string;
  price: number | null;
  listPrice: number | null;
  stock: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LIMITED' | 'UNKNOWN';
  priceVerifiedAt: string | null;
  priceSource: string;
  hasAffiliateLink: boolean;
  outboundPath: string;
  /** Recorded price history: lowest recorded price and the previous price. Null until a price has been recorded. */
  priceStats?: { lowest: { amount: number; recordedAt: string }; previous: { amount: number; recordedAt: string } | null; observations: number; priceChanges: number; since: string } | null;
}

export interface Configuration {
  id: string;
  label: string;
  sku: string | null;
  model: {
    id: string;
    slug: string;
    name: string;
    category: string;
    generation: string;
    releaseYear: number;
    screenSizeInch: number;
    imageUrl: string | null;
    officialSpecUrl: string | null;
  };
  chip: {
    name: string;
    family: string;
    tier: string;
    cpuCores: number;
    gpuCores: number;
    superCores: number | null;
    performanceCores: number | null;
    efficiencyCores: number | null;
    neuralEngineCores: number | null;
    neuralEngineNote: string | null;
    memoryBandwidthGBs: number | null;
  };
  memoryGB: number;
  storageGB: number;
  storageLabel: string;
  colors: string[];
  display: {
    technology: string | null;
    resolution: string | null;
    refreshRateHz: number | null;
    brightnessNits: number | null;
    brightnessNote: string | null;
  } | null;
  battery: { capacityWh: number | null; videoHours: number | null; webHours: number | null } | null;
  weightKg: number | null;
  ports: string[];
  wireless: string | null;
  camera: string | null;
  audio: string | null;
  externalDisplays: string | null;
  provenance: {
    specSource: string;
    specVerifiedAt: string | null;
    verification: 'STORE_CONFIRMED' | 'CTO_DERIVED' | 'ADMIN_VERIFIED';
    verificationNote: string | null;
    sourceUrl: string | null;
  };
  offers: Offer[];
  lowestPrice: { amount: number; currency: string; merchant: string; country: string } | null;
  /** Lowest price recorded across this configuration's offers (from history, not only today's price). */
  lowestRecorded?: { amount: number; currency: string; merchant: string; recordedAt: string } | null;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  category: string;
  generation: string;
  releaseYear: number;
  modelIdentifier: string | null;
  screenSizeInch: number;
  officialSpecUrl: string | null;
  verifiedAt: string | null;
  configurations: Configuration[];
}

export interface Paged<T> {
  data: T[];
  pagination: Pagination;
}
