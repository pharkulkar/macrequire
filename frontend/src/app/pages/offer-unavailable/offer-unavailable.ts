import { Component , inject} from '@angular/core';
import { Seo } from '../../core/seo.service';
import { RouterLink } from '@angular/router';

/** Where the outbound endpoint sends people when an offer has been withdrawn or never existed. */
@Component({
  selector: 'app-offer-unavailable',
  imports: [RouterLink],
  template: `
    <section class="container wrap">
      <h1>That offer is no longer available</h1>
      <p>The merchant link you followed has been removed or is temporarily switched off. Prices and stock change often.</p>
      <div class="actions">
        <a routerLink="/catalog" class="btn btn--primary">Browse MacBooks</a>
        <a routerLink="/find" class="btn btn--secondary">Find my MacBook</a>
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: 6rem 0; text-align: center; max-width: 640px; }
    p { color: var(--text-muted); margin-bottom: 2rem; }
    .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
  `,
})
export class OfferUnavailable {
  constructor() {
    inject(Seo).set({ title: 'Offer unavailable', description: 'Private page.', path: '/offer-unavailable', noindex: true });
  }
}
