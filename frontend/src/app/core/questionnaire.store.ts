import { Injectable, signal } from '@angular/core';
import { AppLabel } from './applications.service';
import { BUDGET_CONFIG, Country, Intensity, Preferences, RecommendationProfile } from './profile.models';

/** Raw form values as held by the questionnaire's reactive form. */
export interface QuestionnaireFormValue {
  useCases: string[];
  applicationIds: string[];
  intensity: Intensity | null;
  future: {
    learnMoreLanguages: boolean;
    startVideoEditing: boolean;
    runLocalAiModels: boolean;
    useVirtualMachinesOrDocker: boolean;
    multitaskDemandingApps: boolean;
    futureApplicationIds: string[];
  };
  budget: { country: Country; min: number | null; max: number | null };
  preferences: {
    screenSizeInch: number | null;
    portability: number | null;
    batteryLife: number | null;
    displayQuality: number | null;
    performance: number | null;
    storageGB: number | null;
    ramGB: number | null;
    ownershipYears: number | null;
  };
}

interface Draft {
  step: number;
  value: QuestionnaireFormValue;
  labels: Record<string, AppLabel>;
}

const DRAFT_KEY = 'macrequire.questionnaire.draft.v1';
const PROFILE_KEY = 'macrequire.questionnaire.profile.v1';
const RESULT_KEY = 'macrequire.questionnaire.recommendation.v1';

/** Session-scoped persistence for the in-progress questionnaire and the final profile. */
@Injectable({ providedIn: 'root' })
export class QuestionnaireStore {
  /** The completed profile, ready to send to the recommendation API (Phase 4-5). */
  readonly profile = signal<RecommendationProfile | null>(this.read<RecommendationProfile>(PROFILE_KEY));

  /** Id of the most recent stored recommendation, so /results can return to it. */
  readonly recommendationId = signal<string | null>(this.read<string>(RESULT_KEY));

  setRecommendationId(id: string) {
    this.recommendationId.set(id);
    this.write(RESULT_KEY, id);
  }

  loadDraft(): Draft | null {
    return this.read<Draft>(DRAFT_KEY);
  }

  saveDraft(draft: Draft) {
    this.write(DRAFT_KEY, draft);
  }

  saveProfile(profile: RecommendationProfile) {
    this.profile.set(profile);
    this.write(PROFILE_KEY, profile);
  }

  clear() {
    this.profile.set(null);
    this.recommendationId.set(null);
    try {
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(PROFILE_KEY);
      sessionStorage.removeItem(RESULT_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  buildProfile(v: QuestionnaireFormValue): RecommendationProfile {
    const country = v.budget.country;
    const prefs: Preferences = {};
    for (const [k, val] of Object.entries(v.preferences)) {
      if (val !== null && val !== undefined) (prefs as Record<string, number>)[k] = val;
    }
    return {
      useCases: v.useCases,
      applicationIds: v.applicationIds,
      intensity: v.intensity as Intensity,
      future: { ...v.future, futureApplicationIds: v.future.futureApplicationIds.filter((id) => !v.applicationIds.includes(id)) },
      budget: { country, currency: BUDGET_CONFIG[country].currency, min: v.budget.min ?? 0, max: v.budget.max as number },
      preferences: prefs,
    };
  }

  private read<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable: the flow still works without persistence */
    }
  }
}
