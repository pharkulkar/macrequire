import { formatStorage, round } from './math';
import { CategoryKey, CategoryScore, EngineInput, RankingComparison, ScoredConfiguration, Workload } from './types';

export const CATEGORY_NAMES: Record<CategoryKey, string> = {
  cpu: 'CPU performance',
  gpu: 'GPU performance',
  ram: 'memory (RAM)',
  storage: 'storage',
  compatibility: 'application compatibility',
  budget: 'budget fit',
  portability: 'portability',
  battery: 'battery life',
  future: 'future-proofing',
  display: 'display quality',
};

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);

const cat = (s: ScoredConfiguration, key: CategoryKey): CategoryScore => s.categories.find((c) => c.key === key)!;

/** Fills reasons, limitations, future assessment and the summary sentence for one scored configuration. */
export function explain(s: ScoredConfiguration, input: EngineInput, w: Workload): void {
  const c = s.candidate;
  const reasons: string[] = [];
  const limitations: string[] = [];

  const ram = cat(s, 'ram');
  const ramD = ram.detail as { headroomGB: number; band: string };
  if (ramD.band === 'MEETS_TARGET') {
    reasons.push(
      ramD.headroomGB >= 1
        ? `${c.ramGB}GB of unified memory covers the ~${w.ram.targetGB}GB your workload needs, with ${ramD.headroomGB}GB to spare.`
        : `${c.ramGB}GB of unified memory covers the ~${w.ram.targetGB}GB your workload needs.`,
    );
  } else if (ramD.band === 'BELOW_TARGET') {
    limitations.push(`${c.ramGB}GB is under the ~${w.ram.targetGB}GB target for comfortable use; heavy multitasking may slow down.`);
  } else {
    limitations.push(`${c.ramGB}GB is below the ~${w.ram.minimumGB}GB your workload needs just to run. Expect heavy memory pressure.`);
  }

  const compat = cat(s, 'compatibility');
  if (compat.applicable) {
    const per = (compat.detail.perApp as { name: string; score: number; issue?: string }[]) ?? [];
    const issues = per.filter((a) => a.issue);
    if (!issues.length) reasons.push(`Runs all ${per.length} of your selected application${per.length === 1 ? '' : 's'} within their recommended specs.`);
    for (const a of issues.slice(0, 3)) limitations.push(`${a.name}: ${a.issue}.`);
  }

  for (const key of ['cpu', 'gpu'] as const) {
    const x = cat(s, key);
    if (x.estimated) continue;
    const label = key.toUpperCase();
    if (x.score >= 85) {
      reasons.push(`${c.chipName} (${key === 'cpu' ? `${c.cpuCores}-core CPU` : `${c.gpuCores}-core GPU`}) has ample ${label} capacity for your workload.`);
    } else if (x.score < 60) {
      limitations.push(`${label} capacity is on the light side for your most demanding applications.`);
    }
  }

  const storage = cat(s, 'storage');
  if (storage.score >= 80) reasons.push(`${formatStorage(c.storageGB)} of storage leaves room for your apps and files (about ${formatStorage(w.storage.needGB)} needed).`);
  else if (storage.score < 60) limitations.push(`${formatStorage(c.storageGB)} of storage is tight for your apps and files (about ${formatStorage(w.storage.needGB)} needed). External storage may be needed.`);

  const pref = input.profile.preferences;
  const portability = cat(s, 'portability');
  if (!portability.estimated) {
    if (portability.score >= 85) reasons.push(`Light at ${c.weightKg}kg, easy to carry daily.`);
    else if (portability.score < 50 && (pref.portability ?? 0) >= 4) limitations.push(`At ${c.weightKg}kg it is heavier than ideal given how much you value portability.`);
  }
  const battery = cat(s, 'battery');
  if (!battery.estimated) {
    if (battery.score >= 85) reasons.push(`Up to ${c.batteryVideoHours} hours of video playback (Apple's claim).`);
    else if (battery.score < 60 && (pref.batteryLife ?? 0) >= 4) limitations.push(`Battery life (up to ${c.batteryVideoHours}h by Apple's claim) is shorter than the longest-lasting options.`);
  }

  // Price and budget
  const p = s.price;
  if (p.known && p.amount !== null && p.currency) {
    if (s.budgetStatus === 'WITHIN') reasons.push(`${money(p.amount, p.currency)} at ${p.merchant} is within your budget.`);
    if (s.budgetStatus === 'STRETCH' && s.extraCost !== null) limitations.push(`${money(p.amount, p.currency)} is ${money(s.extraCost, p.currency)} over your maximum budget.`);
  } else {
    limitations.push('No verified price yet, so your budget could not be applied to this option. Check the merchant for the current price.');
  }
  if (p.note && p.known) limitations.push(p.note);

  for (const pen of s.penalties) limitations.push(`${pen.description} (${pen.effect.toLowerCase()}).`);
  for (const x of s.categories) {
    if (x.estimated && x.applicable && x.key !== 'budget') limitations.push(`${CATEGORY_NAMES[x.key][0].toUpperCase()}${CATEGORY_NAMES[x.key].slice(1)} data was missing, so a conservative default score was used.`);
  }
  if (w.unsupportedApps.length) limitations.push(`${w.unsupportedApps.join(', ')} ${w.unsupportedApps.length === 1 ? 'is' : 'are'} not available on macOS and ${w.unsupportedApps.length === 1 ? 'is' : 'are'} not reflected in this score.`);

  s.reasons = reasons;
  s.limitations = [...new Set(limitations)];
  s.futureAssessment = futureAssessment(s, w);
  s.explanation = summarySentence(s, input);
  addCategoryNotes(s, input, w);
}

function futureAssessment(s: ScoredConfiguration, w: Workload): string {
  const f = cat(s, 'future');
  const d = f.detail as { ramHeadroomGB: number; storageHeadroomGB: number; ownershipYears: number };
  const tier = f.score >= 85 ? 'Strong' : f.score >= 70 ? 'Good' : f.score >= 55 ? 'Adequate' : 'Limited';
  const ram = d.ramHeadroomGB >= 0 ? `${s.candidate.ramGB}GB covers the ~${w.ram.futureGB}GB projected memory need` : `${s.candidate.ramGB}GB is ${Math.abs(d.ramHeadroomGB)}GB short of the ~${w.ram.futureGB}GB projected memory need`;
  const storage = d.storageHeadroomGB >= 0 ? `storage covers the projected ~${formatStorage(w.storage.futureNeedGB)}` : `storage may run short of the projected ~${formatStorage(w.storage.futureNeedGB)}`;
  return `${tier} outlook over ${d.ownershipYears} years: ${ram}, and ${storage}.`;
}

function summarySentence(s: ScoredConfiguration, input: EngineInput): string {
  const parts: string[] = [];
  const ram = cat(s, 'ram');
  if ((ram.detail as { band: string }).band === 'MEETS_TARGET') parts.push('provides sufficient unified memory for your workload');
  const compat = cat(s, 'compatibility');
  if (compat.applicable && compat.score >= 85) parts.push('supports your selected applications');
  const future = cat(s, 'future');
  const wantsFuture = Object.values(input.profile.future).some(Boolean) || input.futureApps.length > 0;
  if (future.score >= 75) parts.push(wantsFuture ? 'offers additional headroom for your expected future workload' : 'has headroom to stay useful over your ownership period');
  if (s.budgetStatus === 'WITHIN') parts.push('fits your budget');
  if (!parts.length) return 'Ranked on its overall balance of performance, memory, storage and price for your needs; see the limitations below.';
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : parts[0];
  return `Recommended because this configuration ${joined}.`;
}

/** Explains why `higher` outranks `lower` using the difference in weighted contributions. */
export function compareConfigurations(higher: ScoredConfiguration, lower: ScoredConfiguration): RankingComparison {
  const deltas = higher.categories
    .map((c) => ({ category: c.key, delta: round(c.contribution - cat(lower, c.key).contribution, 2) }))
    .filter((d) => Math.abs(d.delta) >= 0.05)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const gains = deltas.filter((d) => d.delta > 0).slice(0, 2);
  const losses = deltas.filter((d) => d.delta < 0).slice(0, 1);
  const gap = round(higher.finalScore - lower.finalScore, 1);

  if (gap < 0.05) {
    const sameClass = higher.candidate.ramGB === lower.candidate.ramGB && higher.candidate.storageGB === lower.candidate.storageGB;
    return {
      higherId: higher.candidate.id,
      lowerId: lower.candidate.id,
      summary: `${higher.candidate.label} and ${lower.candidate.label} score the same on every weighted category. ${higher.candidate.label} is listed first because it ${sameClass ? 'ranks first by model order' : 'is the more right-sized option (less memory or storage than the other)'}.`,
      deltas,
    };
  }
  const bits: string[] = [];
  if (gains.length) bits.push(`ranks ${gap} points above it mainly on ${gains.map((g) => `${CATEGORY_NAMES[g.category]} (+${g.delta})`).join(' and ')}`);
  else bits.push(`ranks ${gap} points above it`);
  if (losses.length) bits.push(`while trailing slightly on ${CATEGORY_NAMES[losses[0].category]} (${losses[0].delta})`);
  const lowerPenalty = lower.penalties.find((p) => !higher.penalties.some((hp) => hp.code === p.code));
  if (lowerPenalty) bits.push(`and the other option is penalised: ${lowerPenalty.description.charAt(0).toLowerCase()}${lowerPenalty.description.slice(1).replace(/\.$/, '')}`);

  return {
    higherId: higher.candidate.id,
    lowerId: lower.candidate.id,
    summary: `${higher.candidate.label} ${bits.join(', ')}.`,
    deltas,
  };
}

/** Short account of each category score, so the breakdown can be read without opening the raw numbers. */
function addCategoryNotes(s: ScoredConfiguration, input: EngineInput, w: Workload): void {
  const c = s.candidate;
  for (const x of s.categories) {
    const d = x.detail as Record<string, any>;
    let note: string;
    if (x.estimated && d.note) {
      note = d.note as string;
    } else {
      switch (x.key) {
        case 'cpu':
        case 'gpu':
          note = `Capability ${d.capabilityIndex} against about ${d.requiredIndex} needed (${d.ratio}x).`;
          break;
        case 'ram':
          note = `${c.ramGB}GB against a ~${w.ram.targetGB}GB target (~${w.ram.minimumGB}GB needed to run).`;
          break;
        case 'storage':
          note = `${d.usableGB}GB usable against about ${d.needGB}GB needed.`;
          break;
        case 'compatibility':
          note = x.applicable ? `${(d.perApp as unknown[]).length} selected application(s) checked for support, memory, CPU and GPU.` : 'No applications selected, so this category is not counted.';
          break;
        case 'budget':
          note =
            d.status === 'WITHIN'
              ? `${money(d.price, s.price.currency ?? input.profile.budget.currency)} against a ${money(d.max, input.profile.budget.currency)} maximum.`
              : d.status === 'STRETCH'
                ? `${money(d.extraCost, input.profile.budget.currency)} over your maximum.`
                : `${money(d.price, input.profile.budget.currency)} is well over your maximum.`;
          break;
        case 'portability':
          note = `${d.weightKg}kg, ${d.screenSizeInch}-inch screen${d.screenMismatch ? ` (you preferred about ${d.preferredScreenInch}-inch)` : ''}.`;
          break;
        case 'battery':
          note = `Up to ${d.videoHours} hours of video playback (Apple's claim).`;
          break;
        case 'display':
          note = `${d.brightnessNits} nits brightness${d.refreshRateHz ? `, up to ${d.refreshRateHz}Hz` : ''}.`;
          break;
        case 'future':
          note = `Over ${d.ownershipYears} years: ~${w.ram.futureGB}GB memory and ~${formatStorage(w.storage.futureNeedGB)} storage projected.`;
          break;
        default:
          note = '';
      }
    }
    if (!x.applicable && x.key === 'display') note = 'Not counted: you did not state a display-quality preference.';
    x.note = note;
  }
}
