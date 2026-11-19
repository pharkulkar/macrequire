import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CONTENT_DATES, prettyDate } from '../../core/site';
import { Seo } from '../../core/seo.service';
import { Breadcrumbs } from '../../shared/breadcrumbs/breadcrumbs';

@Component({
  selector: 'app-terms',
  imports: [RouterLink, Breadcrumbs],
  styleUrl: '../prose.scss',
  template: `
    <article class="container prose">
      <app-breadcrumbs [items]="[{ name: 'Home', path: '/' }, { name: 'Terms of use', path: '/terms' }]" />
      <h1>Terms of use</h1>
      <p class="updated">Last updated {{ updated }}</p>
      <p>By using {{ site }} you agree to these terms. If you do not agree, please do not use the site.</p>

      <h2>What the site is</h2>
      <p>
        {{ site }} is an information service that helps you compare MacBook configurations. It is not a store: we do not sell computers, take payment or
        ship anything. Purchases are completed on the merchant's website under the merchant's terms.
      </p>

      <h2>Information, estimates and accuracy</h2>
      <ul>
        <li>Specifications come from Apple's published pages and may change. Check the merchant or Apple before buying.</li>
        <li>Prices and stock are reported by merchants, change often and may be out of date. They are shown before tax unless stated otherwise.</li>
        <li>Suitability scores, memory and storage needs, and application requirements are our own estimates built on stated assumptions. They are not benchmarks, guarantees or professional advice. See <a routerLink="/methodology">how we score</a>.</li>
        <li>We try to keep information correct but provide it “as is”, without warranties of any kind.</li>
      </ul>

      <h2>Affiliate links</h2>
      <p>Some links to merchants are affiliate links, and we may earn a commission if you buy. This does not change your price or our scores. See the <a routerLink="/affiliate-disclosure">affiliate disclosure</a>.</p>

      <h2>Trademarks</h2>
      <p>Apple, Mac, MacBook, MacBook Air, MacBook Pro and related names are trademarks of Apple Inc. {{ site }} is independent and is not affiliated with, endorsed by or sponsored by Apple Inc. Other names belong to their owners.</p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to disrupt the site, bypass its rate limits or access areas that are not public.</li>
        <li>Do not misuse automated tools in a way that harms the service. Search engines and AI assistants are welcome to read our public pages; see <code>robots.txt</code> for the rules.</li>
        <li>You may quote short extracts with a link back to the page. Please do not republish our content or data wholesale.</li>
      </ul>

      <h2>Third-party sites</h2>
      <p>Links to merchants and other sites are provided for convenience. We do not control those sites and are not responsible for their content, prices, products or practices.</p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {{ site }} and its operators are not liable for any indirect, incidental or consequential loss, or for any
        purchase decision you make using the site. Nothing in these terms limits liability that cannot be limited by law.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will post the new version here with a new date. Continued use means you accept the changes.
        @if (email) { Questions or corrections: <a [href]="'mailto:' + email">{{ email }}</a>. }
      </p>
      <p>See also our <a routerLink="/privacy">privacy policy</a>.</p>
    </article>
  `,
})
export class Terms {
  protected readonly site = environment.siteName;
  protected readonly email = environment.contactEmail;
  protected readonly updated = prettyDate(CONTENT_DATES.terms);

  constructor() {
    const seo = inject(Seo);
    seo.set({
      title: 'Terms of use',
      description: 'The terms for using MacRequire: an independent information service, not a store, with estimates, merchant-reported prices and affiliate links.',
      path: '/terms',
      jsonLd: [seo.breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Terms of use', path: '/terms' }])],
    });
  }
}
