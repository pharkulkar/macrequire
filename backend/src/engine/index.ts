import { explain } from './explain';
import { adjacentComparisons, byRank, rank } from './ranking';
import { availabilityFloors, effectiveWeights, scoreCandidate } from './scoring';
import { EngineInput, EngineOutput, ScoredConfiguration } from './types';
import { computeWorkload } from './workload';

export const ENGINE_VERSION = 'engine-1';

export * from './types';
export { defaultRules, defaultWeights, mergeRules, mergeWeights } from './rules';
export type { Rules } from './rules';
export { compareConfigurations } from './explain';

/** Scores every candidate and builds the explained, labelled result set. */
export function recommend(input: EngineInput): EngineOutput {
  const workload = computeWorkload(input);
  const weights = effectiveWeights(input, input.weights);
  const floors = availabilityFloors(input.candidates, input.rules.storage.usableFraction);

  const scored = input.candidates.map((c) => {
    const s = scoreCandidate(c, input, workload, weights, floors);
    explain(s, input, workload);
    return s;
  });

  const { matches, stretch, excluded } = rank(scored, input.profile.budget.country, input.rules);

  const warnings: EngineOutput['warnings'] = [];
  const country = input.profile.budget.country;
  if (workload.unsupportedApps.length) {
    warnings.push({ code: 'UNSUPPORTED_APPS', message: `Not available on macOS: ${workload.unsupportedApps.join(', ')}. They are not reflected in the scores.` });
  }
  if (workload.basis === 'baseline') {
    warnings.push({ code: 'NO_APPLICATIONS', message: 'No applications were selected, so results use a general baseline for your usage level.' });
  }
  const priced = scored.filter((s) => s.price.known).length;
  if (priced === 0) {
    warnings.push({ code: 'NO_PRICES', message: `Your budget could not be applied: there are no verified prices for ${country} yet. Results are ranked on suitability and prices must be checked with the merchant.` });
  } else if (priced < scored.length) {
    warnings.push({ code: 'PARTIAL_PRICES', message: `${scored.length - priced} of ${scored.length} configurations have no verified price in ${country}, so your budget could not be checked for them.` });
  }
  if (!matches.length) {
    warnings.push({ code: 'NO_MATCH', message: 'No configuration fits within your budget. Increase your maximum budget to see options.' });
  } else if (matches[0].finalScore < 50) {
    warnings.push({ code: 'LOW_FIT', message: 'No configuration is a strong match for this workload within your budget.' });
  }

  const ordered: ScoredConfiguration[] = [...matches];
  return {
    engineVersion: `${ENGINE_VERSION}/${input.rules.version}`,
    workload,
    warnings,
    matches,
    stretch,
    comparisons: adjacentComparisons(ordered),
    stats: { evaluated: scored.length, excluded },
  };
}

/** Scores specific configurations (no filtering or ranking limits), ordered best first. Used for comparisons. */
export function scoreSpecific(input: EngineInput): { workload: EngineOutput['workload']; scored: ScoredConfiguration[]; comparisons: EngineOutput['comparisons'] } {
  const workload = computeWorkload(input);
  const weights = effectiveWeights(input, input.weights);
  const floors = availabilityFloors(input.candidates, input.rules.storage.usableFraction);
  const scored = input.candidates
    .map((c) => {
      const s = scoreCandidate(c, input, workload, weights, floors);
      explain(s, input, workload);
      return s;
    })
    .sort(byRank);
  return { workload, scored, comparisons: adjacentComparisons(scored) };
}
