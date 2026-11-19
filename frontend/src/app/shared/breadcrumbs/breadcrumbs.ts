import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb { name: string; path: string }

/** Visible breadcrumb trail. The matching structured data is added by the page through Seo.breadcrumbs(). */
@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink],
  template: `
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        @for (c of items(); track c.path; let last = $last) {
          <li>@if (last) { <span aria-current="page">{{ c.name }}</span> } @else { <a [routerLink]="c.path">{{ c.name }}</a> }</li>
        }
      </ol>
    </nav>
  `,
  styles: `
    ol { list-style: none; display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 1.25rem; padding: 0; font-size: 0.85rem; color: var(--text-muted); }
    li:not(:last-child)::after { content: '/'; margin-left: 0.4rem; color: var(--border); }
    a { color: var(--text-muted); &:hover { color: var(--accent); } }
  `,
})
export class Breadcrumbs {
  readonly items = input.required<Crumb[]>();
}
