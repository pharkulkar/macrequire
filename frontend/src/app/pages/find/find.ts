import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Seo } from '../../core/seo.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApplicationsService, UseCaseDto } from '../../core/applications.service';
import { RecommendationService } from '../../core/recommendation.service';
import { formatMoney } from '../../core/format';
import { DEFAULT_MARKET, Market } from '../../core/market.service';
import {
  BUDGET_CONFIG,
  Country,
  FUTURE_QUESTIONS,
  HOME_TILE_TO_USE_CASES,
  INTENSITY_OPTIONS,
  Intensity,
} from '../../core/profile.models';
import { QuestionnaireFormValue, QuestionnaireStore } from '../../core/questionnaire.store';
import { AppPicker } from '../../shared/app-picker/app-picker';

const STEPS = [
  { title: 'What do you use it for?', short: 'Usage' },
  { title: 'Which applications do you use?', short: 'Applications' },
  { title: 'How hard do you work it?', short: 'Workload' },
  { title: 'What about the next 3 to 5 years?', short: 'Future' },
  { title: 'What is your budget?', short: 'Budget' },
  { title: 'Anything else that matters?', short: 'Preferences' },
  { title: 'Review your answers', short: 'Review' },
] as const;

const REVIEW_STEP = STEPS.length;
const PREFERENCES_STEP = 6;

const nonEmpty = (c: AbstractControl): ValidationErrors | null => ((c.value as unknown[]).length ? null : { required: true });

const budgetRange = (g: AbstractControl): ValidationErrors | null => {
  const { min, max } = g.value as { min: number | null; max: number | null };
  return min !== null && max !== null && max < min ? { range: true } : null;
};

const nullable = <T>(v: T | null = null) => new FormControl<T | null>(v);

@Component({
  selector: 'app-find',
  imports: [ReactiveFormsModule, AppPicker],
  templateUrl: './find.html',
  styleUrl: './find.scss',
})
export class Find implements OnInit {
  private readonly market = inject(Market);
  constructor() {
    inject(Seo).set({ title: 'Find my MacBook', description: 'Private page.', path: '/find', noindex: true });
    // The questionnaire prices in the visitor's market. The market (header switch) decides the country and currency.
    effect(() => {
      if (!this.market.resolved()) return;
      const c = this.market.country();
      if (this.form.controls.budget.controls.country.value !== c) this.setCountry(c);
    });
  }

  private readonly apps = inject(ApplicationsService);
  private readonly store = inject(QuestionnaireStore);
  private readonly recommendations = inject(RecommendationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly steps = STEPS;
  protected readonly reviewStep = REVIEW_STEP;
  protected readonly preferencesStep = PREFERENCES_STEP;
  protected readonly intensityOptions = INTENSITY_OPTIONS;
  protected readonly futureQuestions = FUTURE_QUESTIONS;
  protected readonly budgetConfig = BUDGET_CONFIG;
  protected readonly countries: Country[] = environment.countries;
  protected readonly money = formatMoney;

  protected readonly step = signal(1);
  protected readonly attempted = signal(false);
  protected readonly useCases = signal<UseCaseDto[]>([]);
  protected readonly useCasesError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    useCases: new FormControl<string[]>([], { nonNullable: true, validators: [nonEmpty] }),
    applicationIds: new FormControl<string[]>([], { nonNullable: true }),
    intensity: new FormControl<Intensity | null>(null, [Validators.required]),
    future: new FormGroup({
      learnMoreLanguages: new FormControl(false, { nonNullable: true }),
      startVideoEditing: new FormControl(false, { nonNullable: true }),
      runLocalAiModels: new FormControl(false, { nonNullable: true }),
      useVirtualMachinesOrDocker: new FormControl(false, { nonNullable: true }),
      multitaskDemandingApps: new FormControl(false, { nonNullable: true }),
      futureApplicationIds: new FormControl<string[]>([], { nonNullable: true }),
    }),
    budget: new FormGroup(
      {
        country: new FormControl<Country>(DEFAULT_MARKET, { nonNullable: true }),
        min: nullable<number>(0),
        max: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
      },
      { validators: [budgetRange] },
    ),
    preferences: new FormGroup({
      screenSizeInch: nullable<number>(),
      portability: nullable<number>(),
      batteryLife: nullable<number>(),
      displayQuality: nullable<number>(),
      performance: nullable<number>(),
      storageGB: nullable<number>(),
      ramGB: nullable<number>(),
      ownershipYears: nullable<number>(),
    }),
  });

  /** Keeps template bindings reactive to form changes. */
  protected readonly value = signal<QuestionnaireFormValue>(this.form.getRawValue() as QuestionnaireFormValue);

  protected readonly suggestedCategories = computed(() => {
    const chosen = new Set(this.value().useCases);
    return [...new Set(this.useCases().filter((u) => chosen.has(u.slug)).flatMap((u) => u.appCategories))];
  });
  protected readonly selectedUseCaseNames = computed(() => {
    const chosen = new Set(this.value().useCases);
    return this.useCases().filter((u) => chosen.has(u.slug)).map((u) => u.name);
  });
  protected readonly country = computed(() => this.value().budget.country);
  protected readonly currencyConfig = computed(() => BUDGET_CONFIG[this.country()]);
  protected readonly appLabels = this.apps.labels;

  ngOnInit() {
    this.apps
      .useCases()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.useCases.set(r.data);
          if (tileSlugs) this.applyStarterApps(tileSlugs, r.data);
        },
        error: () => this.useCasesError.set(true),
      });

    const tile = this.route.snapshot.queryParamMap.get('useCase');
    const tileSlugs = tile ? HOME_TILE_TO_USE_CASES[tile] : undefined;
    // Starting from a home-page use case begins a fresh questionnaire, so it never mixes with an older saved draft.
    const draft = tileSlugs ? null : this.store.loadDraft();
    if (draft) {
      this.apps.restoreLabels(draft.labels ?? {});
      this.form.patchValue(draft.value);
      this.step.set(Math.min(Math.max(draft.step, 1), REVIEW_STEP));
    } else {
      this.preselectFromQuery();
    }
    this.value.set(this.form.getRawValue() as QuestionnaireFormValue);

    // The template state updates immediately; only the storage write is debounced.
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.value.set(this.form.getRawValue() as QuestionnaireFormValue));
    this.form.valueChanges.pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.persist());
  }

  private preselectFromQuery() {
    const tile = this.route.snapshot.queryParamMap.get('useCase');
    const slugs = tile ? HOME_TILE_TO_USE_CASES[tile] : undefined;
    if (slugs) this.form.controls.useCases.setValue(slugs);
  }
  /** Names of the use cases whose typical apps were preselected, shown as a note above the app picker. */
  protected readonly starterNote = signal<string | null>(null);
  /** Preselects the typical apps of the chosen home-page use cases, then removes the query so a refresh does not redo it. */
  private applyStarterApps(slugs: string[], all: UseCaseDto[]) {
    const chosen = all.filter((u) => slugs.includes(u.slug));
    const starters = new Map(chosen.flatMap((u) => u.starterApplications).map((a) => [a.id, a]));
    if (starters.size) {
      this.apps.remember([...starters.values()].map((a) => ({ ...a, category: '', notes: null, requirements: null })));
      this.form.controls.applicationIds.setValue([...starters.keys()]);
      this.starterNote.set(chosen.map((u) => u.name).join(' and '));
    }
    this.router.navigate([], { queryParams: { useCase: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private persist() {
    this.store.saveDraft({ step: this.step(), value: this.form.getRawValue() as QuestionnaireFormValue, labels: this.apps.labels() });
  }

  // ---- use cases
  protected hasUseCase(slug: string) {
    return this.value().useCases.includes(slug);
  }

  protected toggleUseCase(slug: string) {
    const ctrl = this.form.controls.useCases;
    ctrl.setValue(ctrl.value.includes(slug) ? ctrl.value.filter((s) => s !== slug) : [...ctrl.value, slug]);
    ctrl.markAsDirty();
  }

  // ---- budget
  protected setCountry(c: Country) {
    const g = this.form.controls.budget;
    if (g.controls.country.value === c) return;
    g.patchValue({ country: c, min: 0, max: null });
  }

  protected setMax(v: number) {
    this.form.controls.budget.controls.max.setValue(v);
  }

  protected get budgetError(): string | null {
    const g = this.form.controls.budget;
    if (!this.attempted() && !g.controls.max.touched) return null;
    if (g.controls.max.hasError('required') || g.controls.max.hasError('min')) return 'Enter a maximum budget greater than zero.';
    if (g.hasError('range')) return 'The maximum budget must be at least the minimum.';
    return null;
  }

  // ---- navigation
  protected stepValid(step: number): boolean {
    switch (step) {
      case 1: return this.form.controls.useCases.valid;
      case 3: return this.form.controls.intensity.valid;
      case 5: return this.form.controls.budget.valid;
      case REVIEW_STEP: return this.form.valid;
      default: return true;
    }
  }

  protected next() {
    if (!this.stepValid(this.step())) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      return;
    }
    this.go(this.step() + 1);
  }

  protected back() {
    this.go(this.step() - 1);
  }

  protected skip() {
    this.go(this.step() + 1);
  }

  protected goTo(step: number) {
    // Only allow jumping back, or forward over steps that are already valid.
    if (step < this.step() || [...Array(step - 1).keys()].every((i) => this.stepValid(i + 1))) this.go(step);
  }

  private go(step: number) {
    this.attempted.set(false);
    this.step.set(Math.min(Math.max(step, 1), REVIEW_STEP));
    this.persist();
    document.getElementById('step-heading')?.focus();
  }

  protected submit() {
    if (!this.form.valid) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      const bad = [1, 3, 5].find((s) => !this.stepValid(s));
      if (bad) this.go(bad);
      return;
    }
    const profile = this.store.buildProfile(this.form.getRawValue() as QuestionnaireFormValue);
    this.store.saveProfile(profile);
    this.submitError.set(null);
    this.submitting.set(true);
    this.recommendations.create(profile).subscribe({
      next: (rec) => {
        this.store.setRecommendationId(rec.id);
        this.submitting.set(false);
        this.router.navigate(['/results', rec.id]);
      },
      error: (e: HttpErrorResponse) => {
        this.submitting.set(false);
        this.submitError.set(
          e.status === 429
            ? 'You have made several requests in a short time. Please wait a minute and try again.'
            : e.status === 400
              ? 'Some of your answers could not be used. Please review them and try again.'
              : 'We could not generate your recommendations. Please check your connection and try again.',
        );
      },
    });
  }

  protected startOver() {
    this.store.clear();
    this.form.reset({ budget: { country: this.market.country(), min: 0, max: null } });
    this.go(1);
  }

  // ---- review helpers
  protected appNames(ids: string[]): string[] {
    return ids.map((id) => this.appLabels()[id]?.name ?? 'Unknown application');
  }

  protected intensityLabel(v: Intensity | null) {
    return INTENSITY_OPTIONS.find((o) => o.value === v)?.label ?? 'Not set';
  }

  protected futureSelected(): string[] {
    const f = this.value().future;
    return FUTURE_QUESTIONS.filter((q) => f[q.key]).map((q) => q.label);
  }

  protected prefSummary(): string[] {
    const p = this.value().preferences;
    const importance = (n: number | null) => (n ? `${n} of 5` : null);
    const rows: [string, string | null][] = [
      ['Screen size', p.screenSizeInch ? `about ${p.screenSizeInch}-inch` : null],
      ['Portability', importance(p.portability)],
      ['Battery life', importance(p.batteryLife)],
      ['Display quality', importance(p.displayQuality)],
      ['Performance', importance(p.performance)],
      ['Storage', p.storageGB ? (p.storageGB >= 1024 ? `${p.storageGB / 1024}TB` : `${p.storageGB}GB`) + ' or more' : null],
      ['Memory', p.ramGB ? `${p.ramGB}GB or more` : null],
      ['Keep for', p.ownershipYears ? `${p.ownershipYears} years` : null],
    ];
    return rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  }

  protected readonly screenSizes = [13, 14, 15, 16];
  protected readonly storageOptions = [256, 512, 1024, 2048, 4096];
  protected readonly ramOptions = [8, 16, 24, 32, 48, 64, 128];
  protected readonly yearOptions = [1, 2, 3, 4, 5, 6, 7];
  protected readonly importanceFields = [
    { key: 'portability', label: 'Portability' },
    { key: 'batteryLife', label: 'Battery life' },
    { key: 'displayQuality', label: 'Display quality' },
    { key: 'performance', label: 'Performance' },
  ] as const;
  protected readonly importanceLevels = [
    { value: 1, label: '1 - Not important' },
    { value: 2, label: '2' },
    { value: 3, label: '3 - Somewhat' },
    { value: 4, label: '4' },
    { value: 5, label: '5 - Very important' },
  ];
  protected storageLabel = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);
}
