import { Component, inject } from '@angular/core';
import { Seo } from '../../core/seo.service';

@Component({
  selector: 'app-affiliate-disclosure',
  template: `
    <article class="container prose">
      <h1>Affiliate Disclosure</h1>
      <p>
        MacRequire earns revenue through affiliate programs. When you click a "Buy" link and purchase from a merchant,
        we may receive a commission from that merchant at no additional cost to you.
      </p>
      <h2>How this affects the site</h2>
      <ul>
        <li>Commission rates and affiliate relationships are never used as inputs to a recommendation score.</li>
        <li>We record outbound clicks (product, merchant, country and time) to understand which pages are useful. We do not store your raw IP address.</li>
        <li>We do not claim sales or commissions beyond what affiliate networks report to us.</li>
        <li>Prices and stock shown are reported by merchants, may be out of date, and should be confirmed on the merchant's site.</li>
      </ul>
      <p>MacRequire is an independent site and is not affiliated with or endorsed by Apple Inc.</p>
    </article>
  `,
  styleUrl: '../prose.scss',
})
export class AffiliateDisclosure {
  constructor() {
    inject(Seo).set({
      title: 'Affiliate Disclosure',
      description: 'How MacRequire earns money from affiliate links, what we record about outbound clicks, and why commissions never change a recommendation.',
      path: '/affiliate-disclosure',
    });
  }
}
