import { Component, inject } from '@angular/core';
import { RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../../core/seo.service';

/** A real "not found" page. On the server it sets HTTP status 404 so search engines drop the URL instead of indexing a soft 404. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="container wrap">
      <h1>Page not found</h1>
      <p>We could not find that page. It may have moved, or the link may be mistyped.</p>
      <div class="actions">
        <a routerLink="/" class="btn btn--primary">Go to the homepage</a>
        <a routerLink="/catalog" class="btn btn--secondary">Browse MacBooks</a>
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: 6rem 0; text-align: center; max-width: 560px; }
    p { color: var(--text-muted); margin-bottom: 2rem; }
    .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
  `,
})
export class NotFound {
  constructor() {
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response) response.status = 404;
    inject(Seo).set({ title: 'Page not found', description: 'The page you were looking for does not exist.', path: '/404', noindex: true });
  }
}
