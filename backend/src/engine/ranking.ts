import { compareConfigurations } from './explain';
import { Label, RankingComparison, ScoredConfiguration } from './types';
import { Rules } from './rules';

const unavailable = (s: ScoredConfiguration, country: string) => {
  const offers = s.candidate.offers.filter((o) => o.country === country);
  return offers.length > 0 && offers.every((o) => o.stock === 'OUT_OF_STOCK');
};

/** Higher score first; ties go to the more right-sized (smaller memory, then storage) and cheaper option. */
export const byRank = (a: ScoredConfiguration, b: ScoredConfiguration) =>
  b.finalScore - a.finalScore ||
  a.candidate.ramGB - b.candidate.ramGB ||
  a.candidate.storageGB - b.candidate.storageGB ||
  (a.price.amount ?? Infinity) - (b.price.amount ?? Infinity) ||
  a.candidate.id.localeCompare(b.candidate.id);

export interface RankResult {
  matches: ScoredConfiguration[];
  stretch: ScoredConfiguration[];
  excluded: Record<string, number>;
}

export function rank(scored: ScoredConfiguration[], country: string, rules: Rules): RankResult {
  const excluded: Record<string, number> = { outOfStock: 0, overBudget: 0 };
  const eligible: ScoredConfiguration[] = [];
  const stretchPool: ScoredConfiguration[] = [];

  for (const s of scored) {
    if (rules.results.excludeOutOfStock && unavailable(s, country)) {
      excluded.outOfStock++;
      continue;
    }
    if (s.budgetStatus === 'OVER') {
      excluded.overBudget++;
      continue;
    }
    if (s.budgetStatus === 'STRETCH') stretchPool.push(s);
    else eligible.push(s);
  }

  eligible.sort(byRank);
  const matches = pick(eligible, rules.results.topN, rules.results.groupStorageVariants, rules.results.equivalentScoreTolerance);

  assignLabels(matches, rules);

  // "Worth stretching": slightly over budget AND clearly better than the best option within budget.
  const bestWithin = eligible.find((s) => s.budgetStatus === 'WITHIN');
  const stretch = bestWithin
    ? stretchPool
        .filter((s) => s.finalScore >= rules.labels.minScore && s.finalScore >= bestWithin.finalScore + rules.budget.minScoreGainForStretch)
        .sort(byRank)
    : [];
  const stretchPicked = pick(stretch, rules.results.stretchN, rules.results.groupStorageVariants, rules.results.equivalentScoreTolerance);
  for (const s of stretchPicked) s.labels = ['STRETCH'];

  return { matches, stretch: stretchPicked, excluded };
}

/** Same model, chip variant and memory; only storage differs. */
const hardwareClass = (s: ScoredConfiguration) => {
  const c = s.candidate;
  return `${c.modelName}|${c.chipName}|${c.cpuCores}|${c.gpuCores}|${c.ramGB}`;
};
/** Same model and chip variant, any memory or storage. */
const chipVariant = (s: ScoredConfiguration) => {
  const c = s.candidate;
  return `${c.modelName}|${c.chipName}|${c.cpuCores}|${c.gpuCores}`;
};

/**
 * Takes the first `n` results from a ranked list. With grouping on:
 *  - only the best storage size of each hardware class is picked, and
 *  - a larger-memory variant of an already picked chip variant that scores within `tolerance` is folded in too.
 * Folded configurations were all scored on their own and are attached to the lead result as variants.
 */
function pick(ranked: ScoredConfiguration[], n: number, group: boolean, tolerance: number): ScoredConfiguration[] {
  if (!group) return ranked.slice(0, n);
  const chosen = new Map<string, ScoredConfiguration>();
  const addVariant = (lead: ScoredConfiguration, s: ScoredConfiguration) =>
    lead.variants.push({
      configurationId: s.candidate.id,
      ramGB: s.candidate.ramGB,
      storageGB: s.candidate.storageGB,
      finalScore: s.finalScore,
      price: s.price.amount,
      currency: s.price.currency,
      budgetStatus: s.budgetStatus,
    });

  for (const s of ranked) {
    const sameClass = chosen.get(hardwareClass(s));
    if (sameClass) {
      addVariant(sameClass, s);
      continue;
    }
    const equivalent = [...chosen.values()].find((l) => chipVariant(l) === chipVariant(s) && l.candidate.ramGB < s.candidate.ramGB && l.finalScore - s.finalScore < tolerance);
    if (equivalent) {
      addVariant(equivalent, s);
      continue;
    }
    if (chosen.size < n) chosen.set(hardwareClass(s), s);
  }
  return [...chosen.values()];
}

/**
 * Labels are only awarded to a configuration that genuinely wins the criterion by a margin,
 * and no configuration holds more than `maxPerConfiguration` labels.
 */
function assignLabels(matches: ScoredConfiguration[], rules: Rules) {
  const { minScore, margin, maxPerConfiguration } = rules.labels;
  const pool = matches.filter((m) => m.finalScore >= minScore);
  if (!pool.length) return;

  const award = (label: Label, winner: ScoredConfiguration | undefined) => {
    if (winner && winner.labels.length < maxPerConfiguration) winner.labels.push(label);
  };

  /** Best by `metric`; undefined if it does not beat the runner-up by `needed`. */
  const winnerBy = (metric: (s: ScoredConfiguration) => number | null, needed: number, relative = false) => {
    const ranked = pool
      .map((s) => ({ s, v: metric(s) }))
      .filter((x): x is { s: ScoredConfiguration; v: number } => x.v !== null)
      .sort((a, b) => b.v - a.v);
    if (!ranked.length) return undefined;
    if (ranked.length === 1) return ranked[0].s;
    const lead = relative ? (ranked[0].v - ranked[1].v) / Math.max(1e-9, ranked[1].v) : ranked[0].v - ranked[1].v;
    return lead >= needed ? ranked[0].s : undefined;
  };

  award('BEST_OVERALL', pool[0]);

  // Value needs a known in-budget price; it is skipped entirely when prices are unavailable.
  award(
    'BEST_VALUE',
    winnerBy((s) => (s.price.known && s.budgetStatus === 'WITHIN' && s.price.amount ? s.finalScore / s.price.amount : null), margin / 100, true),
  );
  award('BEST_PERFORMANCE', winnerBy((s) => s.capability, margin));
  award('BEST_FUTURE', winnerBy((s) => s.categories.find((c) => c.key === 'future')!.score, margin));
}

/** Adjacent-rank explanations: why each configuration sits above the next one. */
export function adjacentComparisons(ordered: ScoredConfiguration[]): RankingComparison[] {
  const out: RankingComparison[] = [];
  for (let i = 0; i < ordered.length - 1; i++) out.push(compareConfigurations(ordered[i], ordered[i + 1]));
  return out;
}
