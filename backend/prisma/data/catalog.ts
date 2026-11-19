/**
 * MacRequire catalog seed data.
 *
 * Every specification below was read from Apple's official support pages on VERIFIED_AT.
 * Nothing here is a price, merchant listing or affiliate link.
 *
 * Coverage (be explicit about what is NOT here):
 *  - Apple Silicon MacBooks currently sold on Apple's store with the "standard display" /
 *    Liquid Retina XDR panels, as of VERIFIED_AT.
 *  - NOT included: PROLED XDR MacBook Pro models (Oct 2026), nano-texture display option as
 *    a separate record, and historical / Intel models. Add them via the admin CSV import.
 *
 * Verification levels for each configuration:
 *  - STORE_CONFIRMED: an Apple store page for that exact combination was observed.
 *  - CTO_DERIVED: combination follows from Apple's documented configure-to-order options for
 *    that chip variant. Exact checkout availability was NOT individually confirmed.
 */

export const VERIFIED_AT = new Date('2026-11-12T00:00:00Z');
export type Verification = 'STORE_CONFIRMED' | 'CTO_DERIVED';

export const SPEC_URLS = {
  air13: 'https://support.apple.com/en-us/126320',
  air15: 'https://support.apple.com/en-us/126321',
  pro14M5: 'https://support.apple.com/en-us/125405',
  pro14ProMax: 'https://support.apple.com/en-us/126318',
  pro16ProMax: 'https://support.apple.com/en-us/126319',
  pro14M6: 'https://support.apple.com/en-us/148300',
  identifyPro: 'https://support.apple.com/en-us/108052',
};

const PERF_BASIS =
  'Placeholder proxy: cpuPerfIndex = max CPU cores / 18 * 100, gpuPerfIndex = max GPU cores / 40 * 100. ' +
  'Not a benchmark. Replace with benchmark-derived values via the admin panel.';

const idx = (cpu: number, gpu: number) => ({
  cpuPerfIndex: Math.round((cpu / 18) * 100),
  gpuPerfIndex: Math.round((gpu / 40) * 100),
  perfIndexBasis: PERF_BASIS,
});

export interface ChipSeed {
  name: string;
  family: string;
  tier: 'BASE' | 'PRO' | 'MAX';
  cpuCores: number; // maximum for the chip
  superCores?: number;
  performanceCores?: number;
  efficiencyCores?: number;
  gpuCores: number; // maximum for the chip
  neuralEngineCores: number;
  neuralEngineNote?: string;
  memoryBandwidthGBs: number; // maximum for the chip
  maxMemoryGB: number;
  cpuPerfIndex: number;
  gpuPerfIndex: number;
  perfIndexBasis: string;
  sourceUrl: string;
}

export const chips: ChipSeed[] = [
  {
    name: 'M5', family: 'M5', tier: 'BASE', cpuCores: 10, superCores: 4, efficiencyCores: 6, gpuCores: 10,
    neuralEngineCores: 16, memoryBandwidthGBs: 153, maxMemoryGB: 32, ...idx(10, 10), sourceUrl: SPEC_URLS.air13,
  },
  {
    name: 'M5 Pro', family: 'M5', tier: 'PRO', cpuCores: 18, superCores: 6, performanceCores: 12, gpuCores: 20,
    neuralEngineCores: 16, memoryBandwidthGBs: 307, maxMemoryGB: 64, ...idx(18, 20), sourceUrl: SPEC_URLS.pro14ProMax,
  },
  {
    name: 'M5 Max', family: 'M5', tier: 'MAX', cpuCores: 18, superCores: 6, performanceCores: 12, gpuCores: 40,
    neuralEngineCores: 16, memoryBandwidthGBs: 614, maxMemoryGB: 128, ...idx(18, 40), sourceUrl: SPEC_URLS.pro14ProMax,
  },
  {
    name: 'M6', family: 'M6', tier: 'BASE', cpuCores: 12, superCores: 2, performanceCores: 4, efficiencyCores: 6, gpuCores: 12,
    neuralEngineCores: 32, neuralEngineNote: 'Dual 16-core Neural Engine', memoryBandwidthGBs: 170, maxMemoryGB: 32,
    ...idx(12, 12), sourceUrl: SPEC_URLS.pro14M6,
  },
];

export interface SpecSeed {
  displayTech: string;
  displayResolution: string;
  refreshRateHz?: number;
  brightnessNits: number;
  brightnessNote: string;
  batteryWh: number;
  batteryLifeHours: number; // Apple-claimed video streaming
  webBatteryHours: number; // Apple-claimed wireless web
  weightKg: number;
  ports: string[];
  wireless: string;
  camera: string;
  audio: string;
  externalDisplays: string;
}

export interface ConfigSeed {
  chip: string;
  cpuCores: number;
  gpuCores: number;
  ramGB: number;
  storageGB: number;
  spec: SpecSeed;
}

export interface ModelSeed {
  slug: string;
  name: string;
  category: 'MacBook Air' | 'MacBook Pro';
  generation: string;
  releaseYear: number;
  modelIdentifier?: string;
  screenSizeInch: number;
  officialSpecUrl: string;
  colors: string[];
  configs: ConfigSeed[];
}

// ----- shared spec fragments (all from the pages in SPEC_URLS) -----
const airAudio = 'Four-speaker sound system, three-mic array with directional beamforming';
const proAudio = 'High-fidelity six-speaker sound system with force-cancelling woofers, studio-quality three-mic array';
const airPorts = ['2x Thunderbolt 4 (USB-C)', 'MagSafe 3', '3.5 mm headphone jack'];
const proPorts = (tb: string) => [`3x ${tb} (USB-C)`, 'HDMI', 'SDXC card slot', 'MagSafe 3', '3.5 mm headphone jack'];
const camera = '12MP Center Stage camera with Desk View';

const air13Spec: SpecSeed = {
  displayTech: 'Liquid Retina (IPS LED-backlit)', displayResolution: '2560x1664 (224 ppi), 13.6-inch', brightnessNits: 500,
  brightnessNote: 'Maximum brightness', batteryWh: 53.8, batteryLifeHours: 18, webBatteryHours: 15, weightKg: 1.23,
  ports: airPorts, wireless: 'Wi-Fi 7 (802.11be), Bluetooth 6 (Apple N1)', camera, audio: airAudio,
  externalDisplays: 'Up to two external displays',
};
const air15Spec: SpecSeed = {
  ...air13Spec, displayResolution: '2880x1864 (224 ppi), 15.3-inch', batteryWh: 66.5, weightKg: 1.51,
};
const xdr = (res: string) => ({
  displayTech: 'Liquid Retina XDR (mini-LED), ProMotion', displayResolution: res, refreshRateHz: 120, brightnessNits: 1000,
  brightnessNote: 'SDR brightness, outdoor', camera, audio: proAudio,
});
const pro14M5Spec: SpecSeed = {
  ...xdr('3024x1964 (254 ppi), 14.2-inch'), batteryWh: 72.4, batteryLifeHours: 24, webBatteryHours: 16, weightKg: 1.55,
  ports: proPorts('Thunderbolt 4'), wireless: 'Wi-Fi 6E (802.11ax), Bluetooth 5.3', externalDisplays: 'Up to two external displays',
};
const pro14Pro: SpecSeed = {
  ...xdr('3024x1964 (254 ppi), 14.2-inch'), batteryWh: 72.4, batteryLifeHours: 22, webBatteryHours: 14, weightKg: 1.6,
  ports: proPorts('Thunderbolt 5'), wireless: 'Wi-Fi 7, Bluetooth 6', externalDisplays: 'Up to three external displays',
};
const pro14Max: SpecSeed = {
  ...pro14Pro, batteryLifeHours: 20, webBatteryHours: 13, weightKg: 1.62, externalDisplays: 'Up to four external displays',
};
const pro16Pro: SpecSeed = {
  ...pro14Pro, displayResolution: '3456x2234 (254 ppi), 16.2-inch', batteryWh: 100, batteryLifeHours: 24, webBatteryHours: 17,
  weightKg: 2.14,
};
const pro16Max: SpecSeed = {
  ...pro16Pro, batteryLifeHours: 22, webBatteryHours: 16, weightKg: 2.15, externalDisplays: 'Up to four external displays',
};
const pro14M6Spec: SpecSeed = {
  ...pro14M5Spec, wireless: 'Wi-Fi 7 (802.11be), Bluetooth 6',
};

/** Storage is stored in GB using 1TB = 1024GB (display layer converts back to TB). */
const GB = (tb: number) => tb * 1024;

const cross = (chip: string, cpu: number, gpu: number, rams: number[], storages: number[], spec: SpecSeed): ConfigSeed[] =>
  rams.flatMap((ramGB) => storages.map((storageGB) => ({ chip, cpuCores: cpu, gpuCores: gpu, ramGB, storageGB, spec })));

const S512 = 512;
const S1 = GB(1);
const S2 = GB(2);
const S4 = GB(4);
const S8 = GB(8);

export const models: ModelSeed[] = [
  {
    slug: 'macbook-air-13-m5-2026', name: 'MacBook Air 13-inch (M5, 2026)', category: 'MacBook Air', generation: 'M5',
    releaseYear: 2026, screenSizeInch: 13.6, officialSpecUrl: SPEC_URLS.air13, colors: ['Sky Blue', 'Silver', 'Starlight', 'Midnight'],
    configs: [
      // Base 8-core GPU model: Apple documents no memory/storage upgrades for it.
      { chip: 'M5', cpuCores: 10, gpuCores: 8, ramGB: 16, storageGB: S512, spec: air13Spec },
      ...cross('M5', 10, 10, [16, 24, 32], [S512, S1, S2, S4], air13Spec),
    ],
  },
  {
    slug: 'macbook-air-15-m5-2026', name: 'MacBook Air 15-inch (M5, 2026)', category: 'MacBook Air', generation: 'M5',
    releaseYear: 2026, screenSizeInch: 15.3, officialSpecUrl: SPEC_URLS.air15, colors: ['Sky Blue', 'Silver', 'Starlight', 'Midnight'],
    configs: cross('M5', 10, 10, [16, 24, 32], [S512, S1, S2, S4], air15Spec),
  },
  {
    slug: 'macbook-pro-14-m5-2025', name: 'MacBook Pro 14-inch (M5, 2025)', category: 'MacBook Pro', generation: 'M5',
    releaseYear: 2025, modelIdentifier: 'Mac17,2', screenSizeInch: 14.2, officialSpecUrl: SPEC_URLS.pro14M5, colors: ['Space Black', 'Silver'],
    // Apple lists base storage as 512GB or 1TB (varies by region).
    configs: cross('M5', 10, 10, [16, 24, 32], [S512, S1, S2, S4], pro14M5Spec),
  },
  {
    slug: 'macbook-pro-14-m5-pro-max-2026', name: 'MacBook Pro 14-inch (M5 Pro / M5 Max, 2026)', category: 'MacBook Pro',
    generation: 'M5', releaseYear: 2026, modelIdentifier: 'Mac17,7, Mac17,9', screenSizeInch: 14.2,
    officialSpecUrl: SPEC_URLS.pro14ProMax, colors: ['Space Black', 'Silver'],
    configs: [
      ...cross('M5 Pro', 15, 16, [24, 48], [S1, S2, S4], pro14Pro),
      ...cross('M5 Pro', 18, 20, [24, 48, 64], [S1, S2, S4], pro14Pro),
      ...cross('M5 Max', 18, 32, [36], [S2, S4, S8], pro14Max),
      ...cross('M5 Max', 18, 40, [48, 64, 128], [S2, S4, S8], pro14Max),
    ],
  },
  {
    slug: 'macbook-pro-16-m5-pro-max-2026', name: 'MacBook Pro 16-inch (M5 Pro / M5 Max, 2026)', category: 'MacBook Pro',
    generation: 'M5', releaseYear: 2026, modelIdentifier: 'Mac17,6, Mac17,8', screenSizeInch: 16.2,
    officialSpecUrl: SPEC_URLS.pro16ProMax, colors: ['Space Black', 'Silver'],
    configs: [
      ...cross('M5 Pro', 18, 20, [24, 48, 64], [S1, S2, S4], pro16Pro),
      ...cross('M5 Max', 18, 32, [36], [S2, S4, S8], pro16Max),
      ...cross('M5 Max', 18, 40, [48, 64, 128], [S2, S4, S8], pro16Max),
    ],
  },
  {
    slug: 'macbook-pro-14-m6-2026', name: 'MacBook Pro 14-inch (M6, 2026)', category: 'MacBook Pro', generation: 'M6',
    releaseYear: 2026, modelIdentifier: 'Mac18,1', screenSizeInch: 14.2, officialSpecUrl: SPEC_URLS.pro14M6, colors: ['Space Black', 'Silver'],
    configs: cross('M6', 12, 12, [16, 24, 32], [S1, S2, S4], pro14M6Spec),
  },
];

/**
 * Exact combinations for which an Apple store page was observed on VERIFIED_AT.
 * Key: `${modelSlug}|${cpu}|${gpu}|${ram}|${storageGB}`
 */
const k = (slug: string, cpu: number, gpu: number, ram: number, storage: number) => `${slug}|${cpu}|${gpu}|${ram}|${storage}`;
const a13 = 'macbook-air-13-m5-2026';
const a15 = 'macbook-air-15-m5-2026';
const p14 = 'macbook-pro-14-m5-2025';
const p14pm = 'macbook-pro-14-m5-pro-max-2026';
const p16 = 'macbook-pro-16-m5-pro-max-2026';
const p14m6 = 'macbook-pro-14-m6-2026';

export const storeConfirmed = new Set<string>([
  k(a13, 10, 8, 16, S512), k(a13, 10, 10, 16, S1), k(a13, 10, 10, 24, S512), k(a13, 10, 10, 24, S1), k(a13, 10, 10, 32, S1),
  k(a15, 10, 10, 16, S512), k(a15, 10, 10, 16, S1), k(a15, 10, 10, 24, S512), k(a15, 10, 10, 24, S1), k(a15, 10, 10, 32, S2),
  k(p14, 10, 10, 16, S1), k(p14, 10, 10, 24, S1),
  k(p14pm, 15, 16, 24, S1), k(p14pm, 15, 16, 24, S2), k(p14pm, 15, 16, 48, S1),
  k(p14pm, 18, 20, 24, S2), k(p14pm, 18, 20, 48, S2),
  k(p14pm, 18, 32, 36, S2),
  k(p16, 18, 20, 24, S1), k(p16, 18, 32, 36, S2), k(p16, 18, 40, 128, S2),
  k(p14m6, 12, 12, 16, S1), k(p14m6, 12, 12, 24, S1), k(p14m6, 12, 12, 32, S1),
]);

export const verificationFor = (slug: string, c: ConfigSeed): Verification =>
  storeConfirmed.has(k(slug, c.cpuCores, c.gpuCores, c.ramGB, c.storageGB)) ? 'STORE_CONFIRMED' : 'CTO_DERIVED';
