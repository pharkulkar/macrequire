import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDES } from '../../core/guides';
import { Seo } from '../../core/seo.service';
import { prettyDate } from '../../core/site';
import { Breadcrumbs } from '../../shared/breadcrumbs/breadcrumbs';

@Component({
  selector: 'app-guides-hub',
  imports: [RouterLink, Breadcrumbs],
  styleUrl: '../prose.scss',
  template: `
    <section class="container prose">
      <app-breadcrumbs [items]="crumbs" />
      <h1>MacBook buying guides</h1>
      <p class="muted">Short, direct answers to the questions that decide which MacBook to buy. The numbers come from our own catalog and scoring data.</p>
      <ul class="list">
        @for (g of guides; track g.slug) {
          <li>
            <a [routerLink]="['/guides', g.slug]"><h2>{{ g.title }}</h2></a>
            <p>{{ g.summary }}</p>
            <p class="muted small">Updated {{ pretty(g.updated) }}</p>
          </li>
        }
        <li>
          <a routerLink="/methodology"><h2>How MacRequire scores MacBooks</h2></a>
          <p>The categories, weights, assumptions and data sources behind every recommendation.</p>
        </li>
      </ul>
    </section>
  `,
  styles: `
    .list { list-style: none; padding: 0; display: grid; gap: 1rem; }
    li { border: 1px solid var(--border); border-radius: 14px; padding: 1.25rem 1.5rem; }
    h2 { font-size: 1.2rem; margin: 0 0 0.4rem; }
    a { text-decoration: none; color: inherit; &:hover h2 { color: var(--accent); } }
    p { margin: 0 0 0.4rem; }
    .small { font-size: 0.82rem; }
  `,
})
export class GuidesHub {
  protected readonly guides = GUIDES;
  protected readonly pretty = prettyDate;
  protected readonly crumbs = [{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }];

  constructor() {
    const seo = inject(Seo);
    seo.set({
      title: 'MacBook buying guides',
      description: 'Answer-first guides to MacBook memory, storage and choosing between the Air and the Pro, built from our own catalog and scoring data.',
      path: '/guides',
      jsonLd: [
        seo.breadcrumbs(this.crumbs),
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'MacBook buying guides', url: seo.abs('/guides'), hasPart: GUIDES.map((g) => ({ '@type': 'Article', headline: g.title, url: seo.abs(`/guides/${g.slug}`) })) },
      ],
    });
  }
}
