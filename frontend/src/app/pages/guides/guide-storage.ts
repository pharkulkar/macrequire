import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { formatStorage } from '../../core/format';
import { Seo } from '../../core/seo.service';
import { CONTENT_DATES, prettyDate } from '../../core/site';
import { SiteData } from '../../core/site-data.service';
import { Breadcrumbs } from '../../shared/breadcrumbs/breadcrumbs';
import { Faq, FaqItem } from '../../shared/faq/faq';

const SLUG = 'how-much-storage-for-macbook';
const TITLE = 'How much storage does a MacBook need?';

@Component({
  selector: 'app-guide-storage',
  imports: [RouterLink, Breadcrumbs, Faq],
  styleUrl: '../prose.scss',
  template: `
    <article class="container prose">
      <app-breadcrumbs [items]="crumbs" />
      <h1>{{ title }}</h1>
      <p class="updated">Updated {{ updated }}. Figures below come from our live catalog and settings.</p>

      <div class="answer">
        <strong class="label">Short answer</strong>
        <p>
          Storage is fixed when you buy, so plan for your biggest projects plus free space.
          @if (range(); as r) { Current MacBook configurations in our catalog range from {{ fmt(r.min) }} to {{ fmt(r.max) }}. }
          @if (m(); as d) { We set aside about {{ d.assumptions.osStorageReserveGB }}GB for macOS and treat about {{ pct(d.assumptions.usableStorageFraction) }}% of the advertised capacity as usable. }
          Creative apps and their project files, not the apps themselves, usually decide how much you need.
        </p>
      </div>

      <h2>Why you cannot upgrade it later</h2>
      <p>The storage in current MacBooks is built in, so the capacity you choose at purchase is the capacity you keep. You can add an external drive for archives and media, but your apps and active projects are most comfortable on internal storage.</p>

      <h2>How we estimate the storage you need</h2>
      <ol>
        <li>@if (m(); as d) { Start with about {{ d.assumptions.osStorageReserveGB }}GB for macOS and system files. } @else { Start with space for macOS and system files. }</li>
        <li>Add the footprint of each app you selected. Unlike memory, storage is not shared between apps, so these add up.</li>
        <li>Add space for your own files and projects, which grows with how intensively you work.</li>
        <li>Keep free space. A drive that is almost full is slower and harder to maintain, so we require headroom.</li>
        <li>@if (m(); as d) { Only about {{ pct(d.assumptions.usableStorageFraction) }}% of the advertised capacity counts as usable in our estimate. }</li>
      </ol>
      <p>See the <a routerLink="/methodology">methodology page</a> for the settings we use.</p>

      @if (heavy().length) {
        <h2>Apps with the largest storage footprints</h2>
        <div class="table-scroll">
          <table>
            <caption>Typical footprint including working data. These are our estimates; your project sizes will differ.</caption>
            <thead><tr><th scope="col">Application</th><th scope="col">Category</th><th scope="col" class="num">Footprint</th></tr></thead>
            <tbody>@for (a of heavy(); track a.id) { <tr><th scope="row">{{ a.name }}</th><td>{{ a.category }}</td><td class="num">about {{ fmt(a.requirements!.storageGB) }}</td></tr> }</tbody>
          </table>
        </div>
      }

      <h2>Frequently asked questions</h2>
      <app-faq [items]="faq()" />

      <div class="cta"><p>Add your apps and we will work out the storage for your workload.</p><a routerLink="/find" class="btn btn--primary">Find my MacBook</a></div>
    </article>
  `,
})
export class GuideStorage {
  private readonly seo = inject(Seo);
  private readonly data = inject(SiteData);
  protected readonly title = TITLE;
  protected readonly fmt = formatStorage;
  protected readonly updated = prettyDate(CONTENT_DATES.guides);
  protected readonly crumbs = [{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }, { name: 'Storage', path: `/guides/${SLUG}` }];

  protected readonly m = toSignal(this.data.methodology(), { initialValue: null });
  private readonly products = toSignal(this.data.products(), { initialValue: [] });
  private readonly apps = toSignal(this.data.applications(), { initialValue: [] });

  protected readonly pct = (f: number) => Math.round(f * 100);
  protected readonly range = computed(() => {
    const r = this.products().flatMap((p) => (p.storageRangeGB ? [p.storageRangeGB] : []));
    return r.length ? { min: Math.min(...r.map((x) => x[0])), max: Math.max(...r.map((x) => x[1])) } : null;
  });
  protected readonly heavy = computed(() =>
    this.apps().filter((a) => a.macSupported && (a.requirements?.storageGB ?? 0) >= 30).sort((a, b) => b.requirements!.storageGB - a.requirements!.storageGB).slice(0, 10),
  );

  protected readonly faq = computed<FaqItem[]>(() => {
    const r = this.range();
    return [
      { q: 'Can I upgrade a MacBook’s storage later?', a: 'No. The storage is built in, so you cannot upgrade it after purchase. An external drive can hold archives and media, but it does not add internal capacity.' },
      { q: 'How much storage is enough for most people?', a: r ? `It depends on your apps and files. Current configurations in our catalog range from ${formatStorage(r.min)} to ${formatStorage(r.max)}. Light users with cloud-stored files need the least; video, photo, music and 3D work need the most. Use the questionnaire to estimate yours.` : 'It depends on your apps and files. Use the questionnaire to estimate yours.' },
      { q: 'Why does the usable space look smaller than the advertised size?', a: 'macOS and its system files use part of the drive, and storage is advertised in decimal units while computers often report it differently. We therefore count only a fraction of the advertised capacity as usable when we estimate your needs.' },
      { q: 'Does a bigger drive make a MacBook faster?', a: 'Not by itself. We score storage as capacity for your files plus free space, not as speed.' },
    ];
  });

  constructor() {
    effect(() => {
      const description = 'How much storage a MacBook needs, why it cannot be upgraded later, and which apps have the largest storage footprints, with our method for estimating capacity.';
      this.seo.set({
        title: TITLE,
        description,
        path: `/guides/${SLUG}`,
        type: 'article',
        published: CONTENT_DATES.guides,
        modified: CONTENT_DATES.guides,
        jsonLd: [this.seo.breadcrumbs(this.crumbs), this.seo.article({ headline: TITLE, description, path: `/guides/${SLUG}`, published: CONTENT_DATES.guides, modified: CONTENT_DATES.guides }), this.seo.faq(this.faq().map((f) => ({ q: f.q, a: f.a })))],
      });
    });
  }
}
