import { Skeleton, SkeletonRegion } from '../../shared/skeleton/skeleton';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Seo } from '../../core/seo.service';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Configuration } from '../../core/catalog.models';
import { CompareService, MAX_COMPARE } from '../../core/compare.service';
import { formatMoney } from '../../core/format';
import { outboundUrl } from '../../core/outbound';
import { Offer } from '../../core/catalog.models';
import { Market } from '../../core/market.service';
import { QuestionnaireStore } from '../../core/questionnaire.store';
import { CATEGORY_LABELS, CategoryKey, CompareDto, RankingComparison, ResultDto } from '../../core/recommendation.models';
import { RecommendationService } from '../../core/recommendation.service';

interface Column {
  id: string;
  config: Configuration | null;
  label: string;
  result: ResultDto | null;
}

interface Row {
  label: string;
  /** 'buy' rows render a purchase link instead of text. */
  kind?: 'buy';
  /** Key into the spec highlights from the API, or a score key. */
  highlight?: { type: 'spec' | 'finalScore' | 'category'; key?: string };
  text: (c: Column) => string;
  hint?: string;
}

const dash = '–';

@Component({
  selector: 'app-compare',
  imports: [Skeleton, SkeletonRegion, RouterLink],
  templateUrl: './compare.html',
  styleUrl: './compare.scss',
})
export class Compare {
  protected readonly skeletons = [1, 2, 3];
  protected readonly skeletonLines = [1, 2, 3, 4, 5, 6];
  protected readonly basket = inject(CompareService);
  private readonly api = inject(RecommendationService);
  private readonly store = inject(QuestionnaireStore);
  private readonly title = inject(Title);
  private readonly market = inject(Market);

  protected readonly max = MAX_COMPARE;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly columns = signal<Column[]>([]);
  protected readonly comparisons = signal<RankingComparison[]>([]);
  protected readonly scored = signal(false);
  protected readonly fellBack = signal(false);
  protected readonly specHighlights = signal<Record<string, string[]>>({});
  protected readonly finalHighlights = signal<string[]>([]);
  protected readonly categoryHighlights = signal<Record<string, string[]>>({});
  protected readonly notice = signal<string | null>(null);

  private readonly categoryScore = (c: Column, key: CategoryKey) => {
    const cat = c.result?.categories.find((x) => x.key === key);
    return cat && cat.applicable ? `${Math.round(cat.score)} / 100` : dash;
  };

  protected readonly rows = computed<Row[]>(() => {
    const scoreRows: Row[] = this.scored()
      ? [
          { label: 'Recommendation score', highlight: { type: 'finalScore' }, text: (c) => (c.result ? `${Math.round(c.result.finalScore)} / 100` : dash), hint: 'Overall fit for your answers' },
          { label: 'Application compatibility', highlight: { type: 'category', key: 'compatibility' }, text: (c) => this.categoryScore(c, 'compatibility') },
          { label: 'Future-proofing', highlight: { type: 'category', key: 'future' }, text: (c) => this.categoryScore(c, 'future') },
          { label: 'Memory fit', highlight: { type: 'category', key: 'ram' }, text: (c) => this.categoryScore(c, 'ram') },
        ]
      : [];
    const specRows: Row[] = [
      { label: 'Processor', text: (c) => c.config?.chip.name ?? dash },
      { label: 'CPU cores', highlight: { type: 'spec', key: 'cpuCores' }, text: (c) => (c.config ? `${c.config.chip.cpuCores}-core` : dash) },
      { label: 'GPU cores', highlight: { type: 'spec', key: 'gpuCores' }, text: (c) => (c.config ? `${c.config.chip.gpuCores}-core` : dash) },
      { label: 'Memory', highlight: { type: 'spec', key: 'memoryGB' }, text: (c) => (c.config ? `${c.config.memoryGB}GB unified` : dash) },
      { label: 'Memory bandwidth', highlight: { type: 'spec', key: 'memoryBandwidthGBs' }, text: (c) => (c.config?.chip.memoryBandwidthGBs ? `${c.config.chip.memoryBandwidthGBs}GB/s (chip max)` : dash) },
      { label: 'Storage', highlight: { type: 'spec', key: 'storageGB' }, text: (c) => (c.config ? `${c.config.storageLabel} SSD` : dash) },
      { label: 'Display', text: (c) => (c.config?.display ? `${c.config.display.technology}, ${c.config.display.resolution}` : dash) },
      { label: 'Brightness', highlight: { type: 'spec', key: 'brightnessNits' }, text: (c) => (c.config?.display?.brightnessNits ? `${c.config.display.brightnessNits} nits (${c.config.display.brightnessNote ?? 'rated'})` : dash) },
      { label: 'Battery (video)', highlight: { type: 'spec', key: 'batteryVideoHours' }, text: (c) => (c.config?.battery?.videoHours ? `Up to ${c.config.battery.videoHours}h (Apple claim)` : dash), hint: 'Real-world results vary' },
      { label: 'Weight', highlight: { type: 'spec', key: 'weightKg' }, text: (c) => (c.config?.weightKg ? `${c.config.weightKg}kg` : dash) },
      {
        label: 'Price',
        highlight: { type: 'spec', key: 'price' },
        text: (c) => {
          const p = c.result?.price.known ? c.result.price : null;
          if (p && p.amount !== null && p.currency) return `${formatMoney(p.amount, p.currency)}${p.merchant ? ` at ${p.merchant}` : ''}`;
          const lp = c.config?.lowestPrice;
          return lp ? formatMoney(lp.amount, lp.currency) : 'Not verified yet';
        },
        hint: 'Merchant-reported',
      },
      { label: 'Buy', kind: 'buy', text: () => '' },
    ];
    return [...scoreRows, ...specRows];
  });

  constructor() {
    inject(Seo).set({ title: 'Compare configurations', description: 'Private page.', path: '/compare', noindex: true });
    this.title.setTitle('Compare configurations | MacRequire');
    effect(() => {
      if (!this.market.resolved()) return;
      this.market.country();
      const ids = this.basket.ids();
      if (ids.length < 2) {
        this.columns.set([]);
        this.comparisons.set([]);
        this.error.set(null);
        this.loading.set(false);
        return;
      }
      this.load(ids);
    });
  }

  private load(ids: string[]) {
    this.loading.set(true);
    this.error.set(null);
    const recId = this.store.recommendationId();
    if (recId) {
      this.api.compareScored(recId, ids).subscribe({
        next: (r) => this.applyScored(r, ids),
        error: (e) => {
          // An expired recommendation should not block a plain spec comparison.
          if (e?.status === 404 || e?.status === 400) {
            this.fellBack.set(true);
            this.loadSpecs(ids);
          } else this.fail();
        },
      });
    } else {
      this.fellBack.set(false);
      this.loadSpecs(ids);
    }
  }

  private applyScored(r: CompareDto, ids: string[]) {
    this.scored.set(true);
    this.fellBack.set(false);
    this.columns.set(ids.map((id) => {
      const res = r.results.find((x) => x.configurationId === id) ?? null;
      return { id, config: res?.configuration ?? null, label: res?.label ?? id, result: res };
    }));
    this.comparisons.set(r.comparisons);
    this.specHighlights.set(r.highlights.specs);
    this.finalHighlights.set(r.highlights.finalScore);
    this.categoryHighlights.set(r.highlights.categories);
    this.notice.set(r.notice);
    this.loading.set(false);
  }

  private loadSpecs(ids: string[]) {
    this.api.compareSpecs(ids, this.market.country()).subscribe({
      next: (r) => {
        this.scored.set(false);
        this.columns.set(ids.map((id) => {
          const cfg = r.data.find((c) => c.id === id) ?? null;
          return { id, config: cfg, label: cfg?.label ?? id, result: null };
        }));
        this.comparisons.set([]);
        this.specHighlights.set(r.highlights);
        this.finalHighlights.set([]);
        this.categoryHighlights.set({});
        this.notice.set(null);
        this.loading.set(false);
      },
      error: () => this.fail(),
    });
  }

  private fail() {
    this.error.set('We could not load the comparison. Please check your connection and try again.');
    this.loading.set(false);
  }

  protected retry() {
    const ids = this.basket.ids();
    if (ids.length >= 2) this.load(ids);
  }

  protected isBest(row: Row, col: Column): boolean {
    const h = row.highlight;
    if (!h) return false;
    if (h.type === 'finalScore') return this.finalHighlights().includes(col.id);
    if (h.type === 'category') return (this.categoryHighlights()[h.key!] ?? []).includes(col.id);
    return (this.specHighlights()[h.key!] ?? []).includes(col.id);
  }

  /** Cheapest in-stock offer in the user's market. */
  protected buyOffer(c: Column): Offer | null {
    const country = this.store.profile()?.budget.country ?? this.market.country();
    const usable = (c.config?.offers ?? []).filter((o) => o.stock !== 'OUT_OF_STOCK' && (!country || o.country === country));
    return usable.length ? [...usable].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0] : null;
  }

  protected buyHref(c: Column): string | null {
    const o = this.buyOffer(c);
    return o ? outboundUrl(o.id, 'compare', c.result?.resultId) : null;
  }

  protected categoryName = (k: CategoryKey) => CATEGORY_LABELS[k];
}
