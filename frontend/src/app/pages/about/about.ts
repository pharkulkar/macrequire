import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../../core/seo.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  template: `
    <article class="container prose">
      <h1>About MacRequire</h1>
      <p>
        Most buying guides stop at the model name. But a MacBook Air with 16GB of memory and one with 24GB are
        different machines for different people. MacRequire scores every individual configuration against the work you
        actually do.
      </p>
      <h2>How recommendations work</h2>
      <p>
        You describe your use cases, applications, workload, budget and expected future needs. A scoring engine on our
        server evaluates CPU, GPU, memory, storage, application compatibility, budget, portability, battery and
        future-proofing for each configuration, then ranks them and explains the result.
      </p>
      <h2>What is data and what is an estimate</h2>
      <ul>
        <li><strong>Specifications</strong> come from official Apple sources or verified imports, with the verification date recorded.</li>
        <li><strong>Prices and availability</strong> are reported by merchants and can change at any time.</li>
        <li><strong>Suitability scores</strong> are our own estimates, not guarantees of performance.</li>
      </ul>
      <h2>How we are funded</h2>
      <p>We fund the site through affiliate links. See the <a routerLink="/affiliate-disclosure">affiliate disclosure</a>. Commissions never change a score.</p>
      <h2>Method</h2>
      <p>The categories, weights and assumptions are published on the <a routerLink="/methodology">methodology page</a>, and the <a routerLink="/guides">guides</a> explain memory, storage and model differences.</p>
      <h2>Corrections</h2>
      <p>If you find a wrong specification, price or application requirement, tell us and we will check it against the source and fix it.
        @if (email) { Write to <a [href]="'mailto:' + email">{{ email }}</a>. }</p>
    </article>
  `,
  styleUrl: '../prose.scss',
})
export class About {
  protected readonly email = environment.contactEmail;
  constructor() {
    inject(Seo).set({
      title: 'About MacRequire',
      description: 'Who MacRequire is, how its MacBook recommendations work, how the site is funded and how corrections are handled.',
      path: '/about',
    });
  }
}
