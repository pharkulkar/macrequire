import { failureMessage } from '../../core/error-messages';
import { Skeleton, SkeletonRegion } from '../../shared/skeleton/skeleton';
import { DatePipe } from '@angular/common';
import { Component, RESPONSE_INIT, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Configuration, ProductDetail } from '../../core/catalog.models';
import { CatalogService } from '../../core/catalog.service';
import { CompareService } from '../../core/compare.service';
import { outboundUrl } from '../../core/outbound';
import { priceNote } from '../../core/price-history';
import { PriceHistory } from '../../shared/price-history/price-history';
import { Market } from '../../core/market.service';
import { ModelImage } from '../../shared/model-image/model-image';
import { Seo } from '../../core/seo.service';
import { formatMoney, formatRange, formatStorage } from '../../core/format';

@Component({
  selector: 'app-product-detail',
  imports: [Skeleton, SkeletonRegion, RouterLink, DatePipe, ModelImage, PriceHistory],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetailPage {
  /** Bound from the :id route param (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(Seo);
  protected readonly market = inject(Market);
  private readonly response = inject(RESPONSE_INIT, { optional: true });
  protected readonly compare = inject(CompareService);
  protected readonly compareFull = signal(false);

  protected readonly product = signal<ProductDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly chipFilter = signal('All');
  protected readonly selectedId = signal<string | null>(null);

  protected readonly chips = computed(() => ['All', ...new Set(this.product()?.configurations.map((c) => c.chip.name) ?? [])]);
  protected readonly rows = computed(() => {
    const f = this.chipFilter();
    return (this.product()?.configurations ?? []).filter((c) => f === 'All' || c.chip.name === f);
  });
  protected readonly selected = computed<Configuration | null>(() => {
    const rows = this.rows();
    return rows.find((c) => c.id === this.selectedId()) ?? rows[0] ?? null;
  });

  protected readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8];
  private readonly reloadTick = signal(0);
  protected retry() {
    this.reloadTick.update((n) => n + 1);
  }
  protected readonly money = formatMoney;
  protected readonly note = priceNote;
  protected readonly shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  protected readonly imageOf = (p: ProductDetail) => p.configurations[0]?.model.imageUrl ?? null;
  protected readonly buyUrl = (offerId: string) => outboundUrl(offerId, 'detail');

  protected toggleCompare(c: Configuration) {
    const ok = this.compare.toggle({ id: c.id, label: c.label });
    this.compareFull.set(!ok);
  }

  /** Answer-first summary generated from the catalog data, so it never drifts from the table below. */
  protected readonly intro = computed(() => {
    const p = this.product();
    if (!p) return '';
    const cs = p.configurations;
    const chips = [...new Set(cs.map((c) => c.chip.name))];
    const mem = cs.map((c) => c.memoryGB);
    const sto = cs.map((c) => c.storageGB);
    const mm = formatRange([Math.min(...mem), Math.max(...mem)], (n) => `${n}GB`);
    const ss = formatRange([Math.min(...sto), Math.max(...sto)], formatStorage);
    return `The ${p.name} comes in ${cs.length} configurations with ${chips.join(', ')}, ${mm} of unified memory and ${ss} of storage. Memory and storage cannot be upgraded after purchase, so choose the amounts you need.`;
  });

  /** Offers that can honestly be published as structured data: a real price, not sample data, in one currency. */
  private realOffers(p: ProductDetail) {
    return p.configurations
      .flatMap((c) => c.offers)
      .filter((o) => o.price !== null && o.priceSource !== 'SAMPLE' && o.currency === 'USD' && o.stock !== 'OUT_OF_STOCK');
  }

  private applySeo(p: ProductDetail) {
    const path = `/catalog/${p.slug}`;
    const description = `${p.name} configurations: ${[...new Set(p.configurations.map((c) => c.chip.name))].join(', ')}. Compare memory, storage, display, battery and ports from Apple’s specifications.`;
    const offers = this.realOffers(p);
    const prices = offers.map((o) => o.price as number);
    const product: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      brand: { '@type': 'Brand', name: 'Apple' },
      category: p.category,
      description,
      url: this.seo.abs(path),
      ...(this.imageOf(p) ? { image: this.seo.abs(this.imageOf(p)!) } : {}),
      ...(p.modelIdentifier ? { model: p.modelIdentifier } : {}),
    };
    if (prices.length) {
      product['offers'] = {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: prices.length,
      };
    }
    this.seo.set({
      title: `${p.name}: configurations, specs and prices`,
      description,
      path,
      image: this.imageOf(p) ?? undefined,
      jsonLd: [this.seo.breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Catalog', path: '/catalog' }, { name: p.name, path }]), product],
    });
  }

  constructor() {
    effect(() => {
      const slug = this.id();
      this.reloadTick(); // a new value here means "try again"
      const country = this.market.country(); // reload when the visitor's market changes
      this.loading.set(true);
      this.error.set(null);
      this.chipFilter.set('All');
      this.selectedId.set(null);
      this.catalog.getProduct(slug, country).subscribe({
        next: (p) => {
          this.product.set(p);
          this.applySeo(p);
          this.loading.set(false);
        },
        error: (e) => {
          if (e?.status === 404 && this.response) this.response.status = 404;
          this.seo.set({ title: e?.status === 404 ? 'MacBook not found' : 'MacBook unavailable', description: 'This MacBook page could not be shown.', path: `/catalog/${slug}`, noindex: true });
          this.error.set(e?.status === 404 ? "We couldn't find that MacBook. It may have been removed, or the link may be wrong." : failureMessage(e, 'load this MacBook'));
          this.loading.set(false);
        },
      });
    });
  }
}
