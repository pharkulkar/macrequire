import { Candidate, EngineApp, EngineOffer, EngineProfile } from '../../engine';
import { RecommendationProfile } from './profile.schema';
import { AppRecord, CandidateRecord } from './recommendation.repository';

/** Converts database rows into the plain shapes the engine understands. */

export function toCandidate(c: CandidateRecord): Candidate {
  const spec = c.specification;
  // Capability indices are stored for the chip's maximum configuration; scale to this configuration's cores.
  const cpuIndex = c.chip.cpuPerfIndex * (c.cpuCores / c.chip.cpuCores);
  const gpuIndex = c.chip.gpuPerfIndex * (c.gpuCores / c.chip.gpuCores);
  const offers: EngineOffer[] = c.offers.map((o) => ({
    id: o.id,
    merchantName: o.merchant.name,
    country: o.country as 'IN' | 'US',
    currency: o.currency,
    price: o.price,
    listPrice: o.listPrice,
    stock: o.stock,
  }));
  return {
    id: c.id,
    label: `${c.model.name} · ${c.chip.name} (${c.cpuCores}-core CPU, ${c.gpuCores}-core GPU) · ${c.ramGB}GB · ${c.storageGB >= 1024 ? `${c.storageGB / 1024}TB` : `${c.storageGB}GB`}`,
    modelName: c.model.name,
    category: c.model.category,
    generation: c.model.generation,
    screenSizeInch: c.model.screenSizeInch,
    chipName: c.chip.name,
    cpuCores: c.cpuCores,
    gpuCores: c.gpuCores,
    ramGB: c.ramGB,
    storageGB: c.storageGB,
    cpuIndex,
    gpuIndex,
    family: c.chip.family,
    weightKg: spec?.weightKg ?? null,
    batteryVideoHours: spec?.batteryLifeHours ?? null,
    brightnessNits: spec?.brightnessNits ?? null,
    refreshRateHz: spec?.refreshRateHz ?? null,
    offers,
  };
}

export function toEngineApp(a: AppRecord): EngineApp {
  const r = a.requirements;
  if (!r) throw new Error(`Application ${a.slug} has no requirements configured`);
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    macSupported: a.macSupported,
    minRamGB: r.minRamGB,
    preferredRamGB: r.preferredRamGB,
    cpuDemand: r.cpuDemand,
    gpuDemand: r.gpuDemand,
    storageGB: r.storageGB,
    concurrencyFactor: r.concurrencyFactor,
    needsAppleSilicon: r.needsAppleSilicon,
  };
}

export function toEngineProfile(p: RecommendationProfile): EngineProfile {
  const { future, budget, preferences } = p;
  return {
    useCases: p.useCases,
    intensity: p.intensity,
    future: {
      learnMoreLanguages: future.learnMoreLanguages,
      startVideoEditing: future.startVideoEditing,
      runLocalAiModels: future.runLocalAiModels,
      useVirtualMachinesOrDocker: future.useVirtualMachinesOrDocker,
      multitaskDemandingApps: future.multitaskDemandingApps,
    },
    budget: { country: budget.country, currency: budget.currency, min: budget.min, max: budget.max },
    preferences,
  };
}
