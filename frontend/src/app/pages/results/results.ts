import { Skeleton, SkeletonRegion } from '../../shared/skeleton/skeleton';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Seo } from '../../core/seo.service';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { formatMoney, formatStorage } from '../../core/format';
import { QuestionnaireStore } from '../../core/questionnaire.store';
import { LABEL_TEXT, LabelKey, RecommendationDto, ResultDto } from '../../core/recommendation.models';
import { RecommendationService } from '../../core/recommendation.service';
import { ResultCard } from '../../shared/result-card/result-card';

const HIGHLIGHT_ORDER: LabelKey[] = ['BEST_OVERALL', 'BEST_VALUE', 'BEST_PERFORMANCE', 'BEST_FUTURE'];

@Component({
  selector: 'app-results',
  imports: [Skeleton, SkeletonRegion, RouterLink, ResultCard],
  templateUrl: './results.html',
  styleUrl: './results.scss',
})
export class Results {
  /** Bound from the optional :id route param. Without it we return to the last recommendation, or generate one. */
  readonly id = input<string>();

  private readonly api = inject(RecommendationService);
  private readonly store = inject(QuestionnaireStore);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  protected readonly skeletons = [1, 2, 3];
  protected readonly rec = signal<RecommendationDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly active = signal(0);
  protected readonly error = signal<{ message: string; retry: boolean } | null>(null);

  protected readonly money = formatMoney;
  protected readonly storage = formatStorage;
  protected readonly labelText = LABEL_TEXT;

  protected readonly highlights = computed(() => {
    const r = this.rec();
    if (!r) return [];
    return HIGHLIGHT_ORDER.flatMap((label) => {
      const hit = r.matches.find((m) => m.labels.includes(label));
      return hit ? [{ label, result: hit }] : [];
    });
  });

  protected readonly summaryLine = computed(() => {
    const r = this.rec();
    if (!r) return '';
    const b = r.profile.budget;
    return `Budget up to ${formatMoney(b.max, b.currency)} · ${r.profile.intensity.charAt(0) + r.profile.intensity.slice(1).toLowerCase()} workload`;
  });

  constructor() {
    inject(Seo).set({ title: 'Your recommendations', description: 'Private page.', path: '/results', noindex: true });
    effect(() => {
      const id = this.id();
      if (id) {
        this.load(id);
        return;
      }
      const last = this.store.recommendationId();
      const profile = this.store.profile();
      if (last) {
        this.router.navigate(['/results', last], { replaceUrl: true });
      } else if (profile) {
        this.loading.set(true);
        this.api.create(profile).subscribe({
          next: (r) => {
            this.store.setRecommendationId(r.id);
            this.router.navigate(['/results', r.id], { replaceUrl: true });
          },
          error: () => this.fail(false),
        });
      } else {
        this.router.navigate(['/find'], { replaceUrl: true });
      }
    });
  }

  private load(id: string) {
    this.loading.set(true);
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (r) => {
        this.rec.set(r);
        this.loading.set(false);
        this.title.setTitle('Your MacBook recommendations | MacRequire');
      },
      error: (e) => {
        if (e?.status === 404) {
          this.store.clear();
          this.fail(false, 'We could not find that recommendation. It may have expired. Please answer the questions again.');
        } else this.fail(true);
      },
    });
  }

  private fail(retry: boolean, message = 'We could not load your recommendations. Please check your connection and try again.') {
    this.loading.set(false);
    this.error.set({ message, retry });
  }

  protected retry() {
    const id = this.id();
    if (id) this.load(id);
  }

  protected anchorFor(r: ResultDto) {
    return `rank-${r.rank}`;
  }

  protected scrollTo(r: ResultDto, ev: Event) {
    ev.preventDefault();
    const el = document.getElementById(this.anchorFor(r));
    el?.scrollIntoView({ behavior: this.reducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
    el?.focus({ preventScroll: true });
  }

  private reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private cardStep(track: HTMLElement) {
    const first = track.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || '0') : track.clientWidth;
  }

  /** Moves the carousel one card left (-1) or right (1). */
  protected step(track: HTMLElement, dir: -1 | 1) {
    track.scrollBy({ left: dir * this.cardStep(track), behavior: this.reducedMotion() ? 'auto' : 'smooth' });
  }

  protected onScroll(track: HTMLElement) {
    const max = track.children.length - 1;
    this.active.set(Math.max(0, Math.min(max, Math.round(track.scrollLeft / this.cardStep(track)))));
  }

  protected startOver() {
    this.store.clear();
    this.router.navigate(['/find']);
  }
}
