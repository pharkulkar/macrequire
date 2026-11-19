import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { priceNote } from '../../core/price-history';
import { ModelImage } from '../model-image/model-image';
import { RouterLink } from '@angular/router';
import { Offer } from '../../core/catalog.models';
import { CompareService } from '../../core/compare.service';
import { formatMoney, formatStorage } from '../../core/format';
import { outboundUrl } from '../../core/outbound';
import { CATEGORY_LABELS, LABEL_TEXT, ResultDto } from '../../core/recommendation.models';

@Component({
  selector: 'app-result-card',
  imports: [RouterLink, DecimalPipe, ModelImage],
  templateUrl: './result-card.html',
  styleUrl: './result-card.scss',
})
export class ResultCard {
  readonly result = input.required<ResultDto>();
  /** The country the user searched in; decides which merchant offers can be shown. */
  readonly country = input.required<string>();
  readonly currency = input.required<string>();
  readonly stretch = input(false);

  protected readonly compare = inject(CompareService);
  protected readonly expanded = signal(false);
  protected readonly compareFullHint = signal(false);

  protected readonly money = formatMoney;
  protected readonly storage = formatStorage;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly labelText = LABEL_TEXT;

  protected readonly config = computed(() => this.result().configuration);
  protected readonly inCompare = computed(() => this.compare.has(this.result().configurationId));

  protected readonly tier = computed(() => {
    const s = this.result().finalScore;
    return s >= 85 ? { name: 'Strong match', cls: 'strong' } : s >= 70 ? { name: 'Good match', cls: 'good' } : s >= 55 ? { name: 'Fair match', cls: 'fair' } : { name: 'Weak match', cls: 'weak' };
  });

  /** Circle circumference for r=44, used to draw the score ring. */
  protected readonly ringLength = 2 * Math.PI * 44;
  protected readonly ringOffset = computed(() => this.ringLength * (1 - Math.min(100, Math.max(0, this.result().finalScore)) / 100));

  protected readonly totalWeight = computed(() => this.result().categories.filter((c) => c.applicable).reduce((s, c) => s + c.weight, 0));

  /** The offer behind the displayed price, or the cheapest purchasable offer in the user's country. */
  protected readonly offer = computed<Offer | null>(() => {
    const cfg = this.config();
    if (!cfg) return null;
    const usable = cfg.offers.filter((o) => o.country === this.country() && o.stock !== 'OUT_OF_STOCK');
    if (!usable.length) return null;
    const priced = this.result().price.offerId;
    return usable.find((o) => o.id === priced) ?? [...usable].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0];
  });

  /** Price history note for the offer behind the displayed price. */
  protected readonly historyNote = computed(() => priceNote(this.config()?.offers.find((o) => o.id === this.result().price.offerId)));
  protected readonly isSamplePrice = computed(() => {
    const id = this.result().price.offerId;
    const o = this.config()?.offers.find((x) => x.id === id);
    return o?.priceSource === 'SAMPLE';
  });

  /**
   * Outbound clicks are recorded and redirected by the API (Phase 6). The link carries only the source and
   * result ids; the merchant URL is never rewritten here.
   */
  protected readonly buyHref = computed(() => {
    const o = this.offer();
    return o ? outboundUrl(o.id, 'recommendation', this.result().resultId) : null;
  });

  protected pct(weight: number) {
    return this.totalWeight() ? Math.round((weight / this.totalWeight()) * 100) : 0;
  }

  protected toggleCompare() {
    const r = this.result();
    const ok = this.compare.toggle({ id: r.configurationId, label: r.label });
    this.compareFullHint.set(!ok);
  }

  protected barClass(score: number) {
    return score >= 85 ? 'strong' : score >= 70 ? 'good' : score >= 55 ? 'fair' : 'weak';
  }
}
