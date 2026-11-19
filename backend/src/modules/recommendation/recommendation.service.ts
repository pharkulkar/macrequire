import { Prisma } from '@prisma/client';
import {
  CATEGORY_KEYS,
  CategoryKey,
  defaultRules,
  defaultWeights,
  EngineInput,
  EngineOutput,
  mergeRules,
  mergeWeights,
  RankingComparison,
  recommend,
  Rules,
  Weights,
  ScoredConfiguration,
  scoreSpecific,
} from '../../engine';
import { HttpError, notFound } from '../../lib/errors';
import { catalogRepository } from '../catalog/catalog.repository';
import { bestIds, specHighlights, toConfigurationDto, toConfigurationDtos } from '../catalog/catalog.service';
import { RecommendationProfile } from './profile.schema';
import { recommendationRepository } from './recommendation.repository';
import { toCandidate, toEngineApp, toEngineProfile } from './recommendation.mapper';

export const SCORE_NOTICE =
  'Suitability scores are MacRequire estimates based on the information you provided and configurable assumptions about application demands. ' +
  'They are not benchmarks or guarantees. Specifications come from Apple; prices and stock are reported by merchants and may change.';

/** What we store per result so a recommendation can be shown again without recomputing. */
interface StoredExplanation {
  label: string;
  labels: string[];
  baseScore: number;
  reasons: string[];
  limitations: string[];
  futureAssessment: string;
  explanation: string;
  penalties: ScoredConfiguration['penalties'];
  price: ScoredConfiguration['price'];
  budgetStatus: ScoredConfiguration['budgetStatus'];
  extraCost: number | null;
  candidate: { ramGB: number; storageGB: number; chipName: string };
  variants: ScoredConfiguration['variants'];
}

interface BuiltInput {
  input: EngineInput;
  ruleSetId: string | null;
}

function profileFromRow(row: NonNullable<Awaited<ReturnType<typeof recommendationRepository.getProfile>>>): RecommendationProfile {
  const flags = row.futureNeeds as Omit<RecommendationProfile['future'], 'futureApplicationIds'>;
  return {
    useCases: row.useCases,
    applicationIds: row.applicationIds,
    intensity: row.intensity,
    future: { ...flags, futureApplicationIds: row.futureApplicationIds },
    budget: { country: row.country as 'IN' | 'US', currency: row.currency as 'INR' | 'USD', min: row.minBudget ?? 0, max: row.maxBudget },
    preferences: row.preferences as RecommendationProfile['preferences'],
  };
}

async function buildInput(profile: RecommendationProfile, configurationIds?: string[]): Promise<BuiltInput> {
  const appIds = [...new Set([...profile.applicationIds, ...profile.future.futureApplicationIds])];
  const [appRows, useCaseRows, ruleSet, configs] = await Promise.all([
    recommendationRepository.loadApplications(appIds),
    recommendationRepository.loadUseCases(profile.useCases),
    recommendationRepository.activeRuleSet(),
    configurationIds ? recommendationRepository.loadConfigurationsByIds(configurationIds) : recommendationRepository.loadActiveConfigurations(),
  ]);

  const unknownApps = appIds.filter((id) => !appRows.some((a) => a.id === id));
  if (unknownApps.length) throw new HttpError(400, 'Unknown application id(s)', { unknownApplicationIds: unknownApps });
  const unknownUseCases = profile.useCases.filter((s) => !useCaseRows.some((u) => u.slug === s));
  if (unknownUseCases.length) throw new HttpError(400, 'Unknown use case(s)', { unknownUseCases });

  if (configurationIds) {
    const missing = configurationIds.filter((id) => !configs.some((c) => c.id === id));
    if (missing.length) throw notFound(`Configuration(s) ${missing.join(', ')}`);
  }

  const byId = new Map(appRows.map((a) => [a.id, toEngineApp(a)]));
  const useCaseWeights: EngineInput['useCaseWeights'] = {};
  for (const u of useCaseRows) {
    useCaseWeights[u.slug] = Object.fromEntries(u.weights.filter((w) => (CATEGORY_KEYS as readonly string[]).includes(w.category)).map((w) => [w.category, w.multiplier])) as Partial<Record<CategoryKey, number>>;
  }

  const rules = mergeRules(defaultRules, ruleSet?.rules);
  const weights = ruleSet ? mergeWeights(ruleSet.weights) : defaultWeights;

  return {
    ruleSetId: ruleSet?.id ?? null,
    input: {
      profile: toEngineProfile(profile),
      apps: profile.applicationIds.map((id) => byId.get(id)!),
      futureApps: profile.future.futureApplicationIds.filter((id) => !profile.applicationIds.includes(id)).map((id) => byId.get(id)!),
      useCaseWeights,
      candidates: configs.map(toCandidate),
      weights,
      rules,
    },
  };
}

const categoryDto = (s: ScoredConfiguration, withDetail = false) =>
  s.categories.map((c) => ({
    key: c.key,
    score: c.score,
    weight: c.weight,
    contribution: c.contribution,
    applicable: c.applicable,
    estimated: c.estimated,
    note: c.note,
    ...(withDetail ? { detail: c.detail } : {}),
  }));

function resultDto(s: ScoredConfiguration, configuration: ReturnType<typeof toConfigurationDto> | null, extra: { rank?: number; resultId?: string } = {}) {
  return {
    ...extra,
    configurationId: s.candidate.id,
    label: s.candidate.label,
    configuration,
    finalScore: s.finalScore,
    labels: s.labels,
    categories: categoryDto(s),
    explanation: s.explanation,
    reasons: s.reasons,
    limitations: s.limitations,
    futureAssessment: s.futureAssessment,
    penalties: s.penalties,
    price: s.price,
    budgetStatus: s.budgetStatus,
    extraCost: s.extraCost,
    variants: s.variants,
  };
}

async function configDtos(ids: string[], country: string) {
  const rows = await catalogRepository.findConfigurations(ids);
  const dtos = await toConfigurationDtos(rows, country);
  return new Map(rows.map((r, i) => [r.id, dtos[i]]));
}

const brief = (s: ScoredConfiguration) => ({
  configurationId: s.candidate.id,
  label: s.candidate.label,
  finalScore: s.finalScore,
  baseScore: s.baseScore,
  labels: s.labels,
  categories: categoryDto(s),
  penalties: s.penalties,
  price: s.price,
  budgetStatus: s.budgetStatus,
  extraCost: s.extraCost,
  explanation: s.explanation,
  reasons: s.reasons,
  limitations: s.limitations,
  variants: s.variants,
});
const briefOutput = (o: EngineOutput) => ({
  engineVersion: o.engineVersion,
  workload: o.workload,
  warnings: o.warnings,
  matches: o.matches.map(brief),
  stretch: o.stretch.map(brief),
  comparisons: o.comparisons,
  stats: o.stats,
});

export const recommendationService = {
  /**
   * Admin preview: scores a profile with the live rules and with unsaved candidate rules/weights, side by side.
   * Nothing is stored and no recommendation is created.
   */
  async preview(profile: RecommendationProfile, overrides: { rules?: Rules; weights?: Weights }) {
    const { input } = await buildInput(profile);
    const current = recommend(input);
    const candidate = overrides.rules || overrides.weights ? recommend({ ...input, rules: overrides.rules ?? input.rules, weights: overrides.weights ?? input.weights }) : current;

    const ranks = (o: EngineOutput) => new Map([...o.matches, ...o.stretch].map((s, i) => [s.candidate.id, { rank: i + 1, score: s.finalScore, label: s.candidate.label }]));
    const a = ranks(current);
    const b = ranks(candidate);
    const ids = [...new Set([...a.keys(), ...b.keys()])];
    const changes = ids
      .map((id) => ({ configurationId: id, label: (b.get(id) ?? a.get(id))!.label, currentRank: a.get(id)?.rank ?? null, candidateRank: b.get(id)?.rank ?? null, currentScore: a.get(id)?.score ?? null, candidateScore: b.get(id)?.score ?? null }))
      .filter((c) => c.currentRank !== c.candidateRank || c.currentScore !== c.candidateScore);

    return { current: briefOutput(current), candidate: briefOutput(candidate), changes, identical: changes.length === 0 };
  },

  /** Runs the engine for a profile, stores the profile, results and score breakdowns, and returns the stored recommendation. */
  async create(profile: RecommendationProfile, opts: { isTest?: boolean } = {}) {
    const { input, ruleSetId } = await buildInput(profile);
    const out: EngineOutput = recommend(input);

    const ordered = [...out.matches, ...out.stretch];
    const topN = input.rules.results.topN;
    const resultsCreate: Prisma.RecommendationResultCreateWithoutProfileInput[] = ordered.map((s, i) => {
      const isStretch = i >= out.matches.length;
      const stored: StoredExplanation = {
        label: s.candidate.label,
        labels: s.labels,
        baseScore: s.baseScore,
        reasons: s.reasons,
        limitations: s.limitations,
        futureAssessment: s.futureAssessment,
        explanation: s.explanation,
        penalties: s.penalties,
        price: s.price,
        budgetStatus: s.budgetStatus,
        extraCost: s.extraCost,
        candidate: { ramGB: s.candidate.ramGB, storageGB: s.candidate.storageGB, chipName: s.candidate.chipName },
        variants: s.variants,
      };
      return {
        configuration: { connect: { id: s.candidate.id } },
        rank: isStretch ? topN + (i - out.matches.length) + 1 : i + 1,
        finalScore: s.finalScore,
        section: isStretch ? 'STRETCH' : (s.labels[0] ?? null),
        priceAtTime: s.price.amount,
        currency: s.price.currency,
        explanation: stored as unknown as Prisma.InputJsonValue,
        breakdown: {
          create: s.categories.map((c) => ({
            configuration: { connect: { id: s.candidate.id } },
            category: c.key,
            score: c.score,
            weight: c.weight,
            weighted: c.contribution,
            detail: { applicable: c.applicable, estimated: c.estimated, note: c.note, ...c.detail } as Prisma.InputJsonValue,
          })),
        },
      };
    });

    const { future } = profile;
    const row = await recommendationRepository.createProfileWithResults({
      ...(ruleSetId ? { ruleSet: { connect: { id: ruleSetId } } } : {}),
      country: profile.budget.country,
      currency: profile.budget.currency,
      minBudget: profile.budget.min,
      maxBudget: profile.budget.max,
      useCases: profile.useCases,
      applicationIds: profile.applicationIds,
      futureApplicationIds: future.futureApplicationIds,
      intensity: profile.intensity,
      futureNeeds: {
        learnMoreLanguages: future.learnMoreLanguages,
        startVideoEditing: future.startVideoEditing,
        runLocalAiModels: future.runLocalAiModels,
        useVirtualMachinesOrDocker: future.useVirtualMachinesOrDocker,
        multitaskDemandingApps: future.multitaskDemandingApps,
      },
      preferences: profile.preferences as Prisma.InputJsonValue,
      isTest: opts.isTest ?? false,
      engineVersion: out.engineVersion,
      summary: { workload: out.workload, warnings: out.warnings, comparisons: out.comparisons, stats: out.stats } as unknown as Prisma.InputJsonValue,
      results: { create: resultsCreate },
    });

    return this.get(row.id);
  },

  async get(id: string) {
    const row = await recommendationRepository.getProfile(id);
    if (!row) throw notFound('Recommendation');
    const summary = (row.summary ?? {}) as { workload?: unknown; warnings?: unknown[]; comparisons?: RankingComparison[]; stats?: unknown };
    const configs = await configDtos(row.results.map((r) => r.configurationId), row.country);

    // Results for configurations that are hidden right now are left out, and the ranks close up.
    const all = row.results;
    const visible = (section: (r: (typeof all)[number]) => boolean) => all.filter((r) => section(r) && configs.has(r.configurationId));
    const hiddenIds = new Set(all.filter((r) => !configs.has(r.configurationId)).map((r) => r.configurationId));
    const present = (r: (typeof row.results)[number], index: number) => {
      const e = r.explanation as unknown as StoredExplanation;
      return {
        resultId: r.id,
        rank: index + 1,
        configurationId: r.configurationId,
        label: e.label,
        configuration: configs.get(r.configurationId) ?? null,
        finalScore: r.finalScore,
        labels: e.labels,
        categories: r.breakdown
          .map((b) => ({ key: b.category, score: b.score, weight: b.weight, contribution: b.weighted, applicable: (b.detail as { applicable?: boolean })?.applicable ?? true, estimated: (b.detail as { estimated?: boolean })?.estimated ?? false, note: (b.detail as { note?: string })?.note ?? '' }))
          .sort((a, b) => CATEGORY_KEYS.indexOf(a.key as CategoryKey) - CATEGORY_KEYS.indexOf(b.key as CategoryKey)),
        explanation: e.explanation,
        reasons: e.reasons,
        limitations: e.limitations,
        futureAssessment: e.futureAssessment,
        penalties: e.penalties,
        price: e.price,
        budgetStatus: e.budgetStatus,
        extraCost: e.extraCost,
        variants: e.variants,
      };
    };

    return {
      id: row.id,
      createdAt: row.createdAt,
      engineVersion: row.engineVersion,
      profile: profileFromRow(row),
      workload: summary.workload ?? null,
      warnings: summary.warnings ?? [],
      matches: visible((r) => r.section !== 'STRETCH').map(present),
      stretch: visible((r) => r.section === 'STRETCH').map(present),
      comparisons: (summary.comparisons ?? []).filter((c) => !hiddenIds.has(c.higherId) && !hiddenIds.has(c.lowerId)),
      stats: summary.stats ?? null,
      notice: SCORE_NOTICE,
    };
  },

  /** Full per-category breakdown including the numbers behind each score. */
  async breakdown(id: string) {
    const row = await recommendationRepository.getProfile(id);
    if (!row) throw notFound('Recommendation');
    return {
      id: row.id,
      engineVersion: row.engineVersion,
      formula: 'finalScore = sum(categoryScore x weight) / sum(applicable weights), then penalties are applied. Scores are 0-100.',
      results: row.results.map((r) => ({
        resultId: r.id,
        rank: r.rank,
        configurationId: r.configurationId,
        label: (r.explanation as unknown as StoredExplanation).label,
        finalScore: r.finalScore,
        baseScore: (r.explanation as unknown as StoredExplanation).baseScore,
        penalties: (r.explanation as unknown as StoredExplanation).penalties,
        categories: r.breakdown
          .map((b) => ({ key: b.category, score: b.score, weight: b.weight, contribution: b.weighted, detail: b.detail }))
          .sort((a, b) => CATEGORY_KEYS.indexOf(a.key as CategoryKey) - CATEGORY_KEYS.indexOf(b.key as CategoryKey)),
      })),
      notice: SCORE_NOTICE,
    };
  },

  /** Scores 2-4 chosen configurations for a profile and explains how they differ. Nothing is stored. */
  async compare(args: { recommendationId?: string; profile?: RecommendationProfile; configurationIds: string[] }) {
    let profile = args.profile;
    if (args.recommendationId) {
      const row = await recommendationRepository.getProfile(args.recommendationId);
      if (!row) throw notFound('Recommendation');
      profile = profileFromRow(row);
    }
    if (!profile) throw new HttpError(400, 'Provide a recommendationId or a profile');

    const { input } = await buildInput(profile, args.configurationIds);
    const { workload, scored, comparisons } = scoreSpecific(input);
    const configs = await configDtos(args.configurationIds, profile.budget.country);

    const matrix = CATEGORY_KEYS.map((key) => ({
      category: key,
      scores: scored.map((s) => ({ configurationId: s.candidate.id, score: s.categories.find((c) => c.key === key)!.score, applicable: s.categories.find((c) => c.key === key)!.applicable })),
    }));

    // Keep the user's requested order for display; scores and rank come from the engine.
    const results = scored.map((s, i) => resultDto(s, configs.get(s.candidate.id) ?? null, { rank: i + 1 }));
    const ordered = args.configurationIds.map((id) => results.find((r) => r.configurationId === id)!);
    const specs = args.configurationIds.map((id) => configs.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
    const idOf = (r: (typeof results)[number]) => ({ id: r.configurationId, r });
    const scoreItems = ordered.map(idOf);
    const byCategory = Object.fromEntries(
      CATEGORY_KEYS.map((key) => [key, bestIds(scoreItems, (x) => (x.r.categories.find((c) => c.key === key)?.applicable ? x.r.categories.find((c) => c.key === key)!.score : null), 'max')]),
    );

    return {
      workload,
      results: ordered,
      matrix,
      comparisons,
      highlights: { specs: specHighlights(specs), finalScore: bestIds(scoreItems, (x) => x.r.finalScore, 'max'), categories: byCategory },
      notice: SCORE_NOTICE,
    };
  },
};
