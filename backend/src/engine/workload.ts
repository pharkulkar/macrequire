import { clamp, interp, round } from './math';
import { Rules, SyntheticDemand } from './rules';
import { EngineApp, EngineInput, Workload } from './types';

/**
 * Builds one combined workload from all selected applications.
 *
 * Requirements are NOT summed. Memory is modelled as:
 *   OS overhead + the largest application in full + every other application scaled by how much of it is
 *   realistically active at the same time (its concurrency factor x the user's overlap level).
 * CPU/GPU demand is similarly dominated by the heaviest app, with smaller contributions from the rest.
 * Storage is the exception: files are not shared between apps, so footprints are added.
 */

interface DemandItem {
  name: string;
  minRamGB: number;
  preferredRamGB: number;
  cpuDemand: number;
  gpuDemand: number;
  storageGB: number;
  concurrencyFactor: number;
}

const toItem = (a: EngineApp): DemandItem => ({
  name: a.name,
  minRamGB: a.minRamGB,
  preferredRamGB: a.preferredRamGB,
  cpuDemand: a.cpuDemand,
  gpuDemand: a.gpuDemand,
  storageGB: a.storageGB,
  concurrencyFactor: a.concurrencyFactor,
});

const synthetic = (name: string, s: SyntheticDemand): DemandItem => ({ name, ...s });

function combineRam(items: DemandItem[], factor: number, overlap: number, osGB: number, growth = 1) {
  const sized = items
    .map((i) => ({ name: i.name, ram: (i.minRamGB + factor * (i.preferredRamGB - i.minRamGB)) * growth, conc: i.concurrencyFactor }))
    .sort((a, b) => b.ram - a.ram);
  const drivers = sized.map((s, idx) => ({ name: s.name, ramGB: round(idx === 0 ? s.ram : s.ram * s.conc * overlap, 1) }));
  const total = osGB + drivers.reduce((sum, d) => sum + d.ramGB, 0);
  return { total, drivers };
}

function combineDemand(values: number[], secondaryFactor: number, multiplier: number, growth = 1) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  const rest = sorted.slice(1).reduce((s, v) => s + v, 0);
  return clamp((sorted[0] + rest * secondaryFactor) * multiplier * growth, 0, 10);
}

export function computeWorkload(input: EngineInput): Workload {
  const { profile, rules } = input;
  const r: Rules = rules;
  const notes: string[] = [];

  const unsupported = input.apps.filter((a) => !a.macSupported);
  const apps = input.apps.filter((a) => a.macSupported);
  const futureApps = input.futureApps.filter((a) => a.macSupported);
  if (unsupported.length) notes.push(`${unsupported.map((a) => a.name).join(', ')} ${unsupported.length === 1 ? 'is' : 'are'} not available on macOS and ${unsupported.length === 1 ? 'is' : 'are'} left out of the workload.`);

  const years = profile.preferences.ownershipYears ?? r.future.defaultOwnershipYears;
  const growth = 1 + r.future.growthPerYear * (years - 1);
  const f = r.intensity.ramFactor[profile.intensity];
  const overlap = r.intensity.overlap[profile.intensity];
  const cpuMult = r.intensity.cpuMultiplier[profile.intensity];
  const gpuMult = r.intensity.gpuMultiplier[profile.intensity];

  const basis: Workload['basis'] = apps.length ? 'applications' : 'baseline';
  const current = apps.map(toItem);

  // Future demand = current + future apps + "I may..." answers not already covered by a selected app.
  const covered = new Set([...apps, ...futureApps].map((a) => a.category));
  const flagItems: DemandItem[] = [];
  for (const [flag, demand] of Object.entries(r.future.flags)) {
    if ((profile.future as unknown as Record<string, boolean>)[flag] && !covered.has(demand.category)) {
      flagItems.push(synthetic(`Future: ${flag.replace(/([A-Z])/g, ' $1').toLowerCase()}`, demand));
    }
  }
  const futureItems = [...current, ...futureApps.map(toItem), ...flagItems];
  const futureOverlap = profile.future.multitaskDemandingApps ? Math.min(r.future.maxOverlap, overlap + r.future.multitaskOverlapBoost) : overlap;

  let minimumGB: number;
  let targetGB: number;
  let drivers: { name: string; ramGB: number }[];
  let cpuDemand: number;
  let gpuDemand: number;
  let appStorage: number;

  if (basis === 'applications') {
    minimumGB = combineRam(current, 0, overlap, r.os.overheadGB).total;
    const t = combineRam(current, f, overlap, r.os.overheadGB);
    targetGB = t.total;
    drivers = t.drivers;
    cpuDemand = combineDemand(current.map((i) => i.cpuDemand), r.compute.secondaryDemandFactor, cpuMult);
    gpuDemand = combineDemand(current.map((i) => i.gpuDemand), r.compute.secondaryDemandFactor, gpuMult);
    appStorage = current.reduce((s, i) => s + i.storageGB, 0);
  } else {
    targetGB = r.intensity.baselineRamGB[profile.intensity];
    minimumGB = targetGB * 0.6;
    drivers = [{ name: 'General baseline (no applications selected)', ramGB: round(targetGB - r.os.overheadGB, 1) }];
    cpuDemand = r.intensity.baselineCpuDemand[profile.intensity];
    gpuDemand = r.intensity.baselineGpuDemand[profile.intensity];
    appStorage = r.intensity.baselineStorageGB[profile.intensity];
    notes.push(`No applications were selected, so a general ${profile.intensity.toLowerCase()} baseline is used. Selecting applications gives a more accurate result.`);
  }

  // An explicit memory preference acts as a floor on the target.
  if (profile.preferences.ramGB && profile.preferences.ramGB > targetGB) {
    notes.push(`Your ${profile.preferences.ramGB}GB memory preference raises the target from ${round(targetGB, 1)}GB.`);
    targetGB = profile.preferences.ramGB;
  }
  minimumGB = Math.min(minimumGB, targetGB);

  const futureRam = combineRam(futureItems, f, futureOverlap, r.os.overheadGB, growth).total;
  const futureGB = Math.max(futureRam, targetGB);

  // Storage: footprints add up; user data grows with the ownership period.
  const data = r.intensity.userDataGB[profile.intensity];
  const futureStorageApps = futureItems.reduce((s, i) => s + i.storageGB, 0) + (basis === 'baseline' ? appStorage : 0);
  const headroom = 1 + r.storage.freeSpaceHeadroomFraction;
  let needGB = (r.storage.osReserveGB + appStorage + data) * headroom;
  let futureNeedGB = (r.storage.osReserveGB + futureStorageApps + data * growth) * headroom;
  if (profile.preferences.storageGB) {
    const wanted = profile.preferences.storageGB * r.storage.usableFraction;
    needGB = Math.max(needGB, wanted);
    futureNeedGB = Math.max(futureNeedGB, wanted);
  }

  const futureCpu = combineDemand(futureItems.map((i) => i.cpuDemand), r.compute.secondaryDemandFactor, cpuMult, growth);
  const futureGpu = combineDemand(futureItems.map((i) => i.gpuDemand), r.compute.secondaryDemandFactor, gpuMult, growth);

  return {
    basis,
    ram: { osOverheadGB: r.os.overheadGB, minimumGB: round(minimumGB, 1), targetGB: round(targetGB, 1), futureGB: round(futureGB, 1), drivers },
    storage: { needGB: Math.round(needGB), futureNeedGB: Math.round(futureNeedGB) },
    cpu: {
      demand: round(cpuDemand, 1),
      requiredIndex: round(interp(r.compute.demandToIndex, cpuDemand), 1),
      futureRequiredIndex: round(interp(r.compute.demandToIndex, Math.max(futureCpu, cpuDemand)), 1),
    },
    gpu: {
      demand: round(gpuDemand, 1),
      requiredIndex: round(interp(r.compute.demandToIndex, gpuDemand), 1),
      futureRequiredIndex: round(interp(r.compute.demandToIndex, Math.max(futureGpu, gpuDemand)), 1),
    },
    unsupportedApps: unsupported.map((a) => a.name),
    notes,
    ownershipYears: years,
  };
}
