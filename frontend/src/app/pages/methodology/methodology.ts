import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Seo } from '../../core/seo.service';
import { CONTENT_DATES } from '../../core/site';
import { CATEGORY_DESCRIPTIONS, SiteData } from '../../core/site-data.service';
import { Breadcrumbs } from '../../shared/breadcrumbs/breadcrumbs';

@Component({
  selector: 'app-methodology',
  imports: [RouterLink, DatePipe, Breadcrumbs],
  styleUrl: '../prose.scss',
  template: `
    <article class="container prose">
      <app-breadcrumbs [items]="crumbs" />
      <h1>How MacRequire scores MacBooks</h1>
      <p class="updated">This page shows the live settings the recommendation engine is using right now.</p>

      <div class="answer">
        <strong class="label">In short</strong>
        <p>
          MacRequire scores every MacBook configuration separately (chip, cores, memory and storage) against your applications, workload, budget and
          future needs, then ranks them. The score is an estimate built from published specifications, merchant prices and our own explicit assumptions.
          It is not a benchmark.
        </p>
      </div>

      <h2>What goes into a score</h2>
      <p>Each configuration gets a 0 to 100 score in each category. The final score is the weighted average of the categories that apply to you.</p>
      @if (m(); as d) {
        <div class="table-scroll">
          <table>
            <caption>Category weights currently used (share of the nine core categories)</caption>
            <thead><tr><th scope="col">Category</th><th scope="col" class="num">Weight</th><th scope="col">What it asks</th></tr></thead>
            <tbody>
              @for (c of d.scoring.categories; track c.key) {
                <tr><th scope="row">{{ desc[c.key]?.name ?? c.key }}</th><td class="num">{{ c.percent }}%</td><td>{{ desc[c.key]?.what }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="muted">{{ d.scoring.note }}</p>
      } @else {
        <p class="muted">The live weights are temporarily unavailable. The nine categories are CPU, GPU, memory, storage, application compatibility, budget, portability, battery and future-proofing.</p>
      }

      <h2>How we combine your applications</h2>
      <ol>
        <li>We do not add up every application's requirements, because apps share a computer. The largest memory user is counted in full, and each other app is counted according to how much of it is typically active at the same time.</li>
        <li>Your workload level (basic, moderate, heavy or professional) decides where each app sits between its minimum and preferred memory.</li>
        <li>@if (m(); as d) { macOS and background processes reserve about {{ d.assumptions.osOverheadGB }}GB. } @else { macOS and background processes reserve some memory. } Future applications and “I may…” answers add to a separate, larger estimate for the years ahead.</li>
        <li>A configuration with too little memory is penalized heavily, however fast its chip is. Configurations above your budget are left out. Capacity far beyond what you need receives a small deduction.</li>
      </ol>

      <h2>Where the data comes from</h2>
      @if (m(); as d) {
        <ul>
          <li><strong>Specifications:</strong> Apple's published tech-spec pages. Of {{ d.data.configurations.total }} configurations, {{ d.data.configurations.storeConfirmed }} were seen as ready-to-buy variants in Apple's store and {{ d.data.configurations.configureToOrderDerived }} follow from Apple's documented configure-to-order options (labelled “configure-to-order” on the site).
            @if (d.data.specificationsLastVerified; as when) { Specifications were last verified on {{ when | date: 'longDate' }}. }</li>
          <li><strong>Prices and stock:</strong> reported by merchants and shown with the merchant's name. They change often and are not guaranteed.</li>
          <li><strong>Application requirements:</strong> {{ d.data.applications.total }} applications. For {{ d.data.applications.vendorPublishedMemory }} of them the memory figures come from the vendor's own page; the remaining requirement figures, and all CPU, GPU and storage demands, are our estimates. The <a routerLink="/applications">application directory</a> labels which is which.</li>
        </ul>
      }

      <h2>What we do not know</h2>
      <ul>
        @if (m(); as d) { @if (d.data.cpuGpuIndexBasis === 'core-count proxy') { <li>CPU and GPU capability is currently estimated from core counts, not from benchmarks. Benchmark-based values would be more precise, and we say so rather than imply otherwise.</li> } }
        <li>Battery figures are Apple's claims for video playback. Your results will differ.</li>
        <li>Application requirements depend on how you use each app (project size, number of tabs, model size). We use typical values and explain them.</li>
        <li>Prices can change between the moment we check and the moment you buy.</li>
      </ul>

      <h2>Independence</h2>
      <p>
        Some purchase links are affiliate links, and we may earn a commission. Commission rates are never an input to a score, and a configuration is not
        ranked higher because a merchant pays more. Read the <a routerLink="/affiliate-disclosure">affiliate disclosure</a>.
      </p>

      <h2>Corrections</h2>
      <p>
        If you find something wrong, tell us and we will check it against the source and fix it.
        @if (email) { Write to <a [href]="'mailto:' + email">{{ email }}</a>. }
      </p>

      <div class="cta"><p>Ready to see how your own workload scores?</p><a routerLink="/find" class="btn btn--primary">Find my MacBook</a></div>
    </article>
  `,
})
export class MethodologyPage {
  private readonly seo = inject(Seo);
  protected readonly m = toSignal(inject(SiteData).methodology(), { initialValue: null });
  protected readonly desc = CATEGORY_DESCRIPTIONS;
  protected readonly email = environment.contactEmail;
  protected readonly crumbs = [{ name: 'Home', path: '/' }, { name: 'How we score', path: '/methodology' }];

  constructor() {
    this.seo.set({
      title: 'How MacRequire scores MacBooks',
      description: 'The categories, weights, assumptions and data sources behind every MacRequire recommendation, plus what the scores cannot tell you.',
      path: '/methodology',
      type: 'article',
      modified: CONTENT_DATES.guides,
      jsonLd: [this.seo.breadcrumbs(this.crumbs), this.seo.article({ headline: 'How MacRequire scores MacBooks', description: 'The categories, weights, assumptions and data sources behind every MacRequire recommendation.', path: '/methodology', published: CONTENT_DATES.guides, modified: CONTENT_DATES.guides })],
    });
  }
}
