import { failureMessage } from '../../core/error-messages';
import { Skeleton, SkeletonRegion } from '../../shared/skeleton/skeleton';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog.service';
import { ProductSummary } from '../../core/catalog.models';
import { formatRange, formatStorage } from '../../core/format';
import { ModelImage } from '../../shared/model-image/model-image';
import { Seo } from '../../core/seo.service';

@Component({
  selector: 'app-catalog',
  imports: [Skeleton, SkeletonRegion, RouterLink, ModelImage],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class Catalog implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(Seo);

  protected readonly skeletons = [1, 2, 3, 4, 5, 6];
  protected readonly categories = ['All', 'MacBook Air', 'MacBook Pro'];
  protected readonly category = signal('All');
  protected readonly products = signal<ProductSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly memory = (r: [number, number] | null) => formatRange(r, (n) => `${n}GB`);
  protected readonly storage = (r: [number, number] | null) => formatRange(r, formatStorage);

  ngOnInit() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const c = params.get('category');
      this.category.set(c && this.categories.includes(c) ? c : 'All');
      this.load();
    });
  }

  protected select(category: string) {
    this.router.navigate([], { queryParams: { category: category === 'All' ? null : category }, queryParamsHandling: 'merge' });
  }

  private applySeo(list: ProductSummary[]) {
    this.seo.set({
      title: 'MacBook Catalog: every model and configuration',
      description: 'Every current MacBook Air and MacBook Pro in our catalog, with chips, memory and storage options sourced from Apple’s specifications and linked to the official page.',
      path: '/catalog',
      jsonLd: [
        this.seo.breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Catalog', path: '/catalog' }]),
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: this.seo.abs(`/catalog/${p.slug}`) })),
        },
      ],
    });
  }

  protected retry() {
    this.load();
  }
  private load() {
    this.loading.set(true);
    this.error.set(null);
    const category = this.category() === 'All' ? undefined : this.category();
    this.catalog.listProducts({ category, pageSize: 50 }).subscribe({
      next: (res) => {
        this.products.set(res.data);
        this.applySeo(res.data);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(failureMessage(e, 'load the catalog'));
        this.loading.set(false);
      },
    });
  }
}
