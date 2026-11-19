import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Seo } from '../../core/seo.service';
import { CONTENT_DATES, prettyDate } from '../../core/site';
import { SiteData } from '../../core/site-data.service';
import { Breadcrumbs } from '../../shared/breadcrumbs/breadcrumbs';
import { Faq, FaqItem } from '../../shared/faq/faq';

const SLUG = 'how-much-ram-for-macbook';
const TITLE = 'How much memory (RAM) does a MacBook need?';
const SHOWN_APPS = ['vscode', 'chrome', 'figma', 'docker-desktop', 'xcode', 'android-studio', 'photoshop', 'final-cut-pro', 'premiere-pro', 'davinci-resolve', 'blender', 'ollama'];

@Component({
  selector: 'app-guide-ram',
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
          It depends on which apps you run at the same time. @if (m(); as d) { Our estimates for a general workload run from about {{ d.assumptions.baselineMemoryGB.BASIC }}GB for light use to about {{ d.assumptions.baselineMemoryGB.PROFESSIONAL }}GB for professional multi-app work, including macOS. }
          @if (range(); as r) { Every current MacBook configuration in our catalog starts at {{ r.min }}GB and goes up to {{ r.max }}GB. }
          Memory cannot be added after you buy, so choose for the heaviest work you expect over the next three to five years.
        </p>
      </div>

      <h2>What is unified memory?</h2>
      <p>
        On current MacBooks the processor and graphics share a single pool of memory, called unified memory. That is why memory matters for more than
        multitasking: video editing, 3D, design and local AI models all place their data in the same pool the rest of your apps use.
        The memory is part of the chip package, so the amount you choose when you buy is the amount you keep.
      </p>

      <h2>How we estimate the memory you need</h2>
      <ol>
        <li>We do not add up every app's requirement. The app that needs the most memory is counted in full, and each other app is counted by how much of it is usually active at the same time.</li>
        <li>@if (m(); as d) { macOS and background processes take about {{ d.assumptions.osOverheadGB }}GB. } @else { macOS and background processes take a few gigabytes. }</li>
        <li>Your workload level moves each app between its minimum and its preferred memory.</li>
        <li>@if (m(); as d) { For future needs we allow roughly {{ growth(d.assumptions.yearlyDemandGrowth) }}% more demand per year over your ownership period. } @else { For future needs we allow for growth over your ownership period. }</li>
      </ol>
      <p>The full method is on the <a routerLink="/methodology">methodology page</a>.</p>

      @if (m(); as d) {
        <h2>Starting points by workload</h2>
        <div class="table-scroll">
          <table>
            <caption>Total memory, including macOS, that we use as a starting estimate when we do not know your apps</caption>
            <thead><tr><th scope="col">Workload</th><th scope="col">Meaning</th><th scope="col" class="num">Memory</th></tr></thead>
            <tbody>
              <tr><th scope="row">Basic</th><td>Occasional use</td><td class="num">{{ d.assumptions.baselineMemoryGB.BASIC }}GB</td></tr>
              <tr><th scope="row">Moderate</th><td>Regular professional use</td><td class="num">{{ d.assumptions.baselineMemoryGB.MODERATE }}GB</td></tr>
              <tr><th scope="row">Heavy</th><td>Daily intensive use</td><td class="num">{{ d.assumptions.baselineMemoryGB.HEAVY }}GB</td></tr>
              <tr><th scope="row">Professional</th><td>Several demanding apps at once</td><td class="num">{{ d.assumptions.baselineMemoryGB.PROFESSIONAL }}GB</td></tr>
            </tbody>
          </table>
        </div>
        <p class="muted">These are MacRequire estimates, not measurements. Selecting your real apps in the questionnaire gives a more accurate figure.</p>
      }

      @if (rows().length) {
        <h2>Memory used by popular apps</h2>
        <div class="table-scroll">
          <table>
            <caption>Per-app memory figures. “Vendor” means the vendor published the figures; otherwise they are our estimates.</caption>
            <thead><tr><th scope="col">Application</th><th scope="col" class="num">Minimum</th><th scope="col" class="num">Preferred</th><th scope="col">Basis</th></tr></thead>
            <tbody>
              @for (a of rows(); track a.id) {
                <tr>
                  <th scope="row">{{ a.name }}</th>
                  <td class="num">{{ a.requirements?.minRamGB }}GB</td>
                  <td class="num">{{ a.requirements?.preferredRamGB }}GB</td>
                  <td>@if (a.requirements?.provenance?.basis === 'VENDOR_PUBLISHED') { <span class="badge badge--vendor">Vendor</span> } @else { <span class="badge">Estimate</span> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="muted">Several apps together need less than these figures added up, because they are not all busy at once. That is what the estimate above accounts for. See every app in the <a routerLink="/applications">application directory</a>.</p>
      }

      <h2>Frequently asked questions</h2>
      <app-faq [items]="faq()" />

      <div class="cta"><p>Tell us your apps and we will work out the memory for your exact workload.</p><a routerLink="/find" class="btn btn--primary">Find my MacBook</a></div>

      @if (sources().length) {
        <h2>Sources</h2>
        <ul class="sources">@for (s of sources(); track s.url) { <li><a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ s.label }}</a></li> }</ul>
      }
    </article>
  `,
})
export class GuideRam {
  private readonly seo = inject(Seo);
  private readonly data = inject(SiteData);
  protected readonly title = TITLE;
  protected readonly updated = prettyDate(CONTENT_DATES.guides);
  protected readonly crumbs = [{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }, { name: 'Memory (RAM)', path: `/guides/${SLUG}` }];

  protected readonly m = toSignal(this.data.methodology(), { initialValue: null });
  private readonly products = toSignal(this.data.products(), { initialValue: [] });
  private readonly apps = toSignal(this.data.applications(), { initialValue: [] });

  protected readonly growth = (g: number) => Math.round(g * 100);
  protected readonly range = computed(() => {
    const r = this.products().flatMap((p) => (p.memoryRangeGB ? [p.memoryRangeGB] : []));
    return r.length ? { min: Math.min(...r.map((x) => x[0])), max: Math.max(...r.map((x) => x[1])) } : null;
  });
  protected readonly rows = computed(() => SHOWN_APPS.flatMap((s) => this.apps().filter((a) => a.slug === s && a.requirements)));

  protected readonly faq = computed<FaqItem[]>(() => {
    const d = this.m();
    const r = this.range();
    const w = (k: string) => d?.scoring.categories.find((c) => c.key === k)?.percent;
    return [
      {
        q: 'Is 8GB of RAM enough for a MacBook?',
        a: r
          ? `The current MacBook lineup in our catalog starts at ${r.min}GB, so 8GB is not offered on current models.${d ? ` Our estimate for light, occasional use is about ${d.assumptions.baselineMemoryGB.BASIC}GB in total, including macOS.` : ''}`
          : 'It depends on your workload. Use the questionnaire to see the memory your own apps need.',
      },
      { q: 'Can I add more memory to a MacBook later?', a: 'No. On current MacBooks the memory is part of the chip package, so you cannot upgrade it after purchase. Choose the amount you will need over the whole time you plan to keep the laptop.' },
      {
        q: 'What matters more, the chip or the memory?',
        a: w('ram') !== undefined ? `It depends on the work, but memory is the heaviest single factor in our scoring at ${w('ram')}% of the total, compared with ${w('cpu')}% for the CPU and ${w('gpu')}% for the GPU. A fast chip with too little memory is penalized, because running out of memory slows everything down.` : 'Both matter. We weight memory most heavily because running out of memory slows everything down regardless of the chip.',
      },
      { q: 'How much memory do Docker, Xcode or local AI models need?', a: 'Our per-app figures are in the table on this page. Local AI models are limited mainly by memory, because the model has to fit in unified memory alongside everything else. When you combine apps, the total is lower than the sum because they are rarely all busy at once.' },
    ];
  });

  protected readonly sources = computed(() => {
    const out: { label: string; url: string }[] = [];
    for (const p of this.products()) if (p.officialSpecUrl) out.push({ label: `Apple tech specs: ${p.name}`, url: p.officialSpecUrl });
    for (const a of this.rows()) {
      const url = a.requirements?.provenance.sourceUrl;
      if (a.requirements?.provenance.basis === 'VENDOR_PUBLISHED' && url) out.push({ label: `${a.name} requirements (vendor)`, url });
    }
    return out;
  });

  constructor() {
    effect(() => {
      const description = 'How much memory a MacBook needs, how unified memory works, how we estimate your workload, and per-app memory figures with vendor-published numbers marked separately from estimates.';
      this.seo.set({
        title: TITLE,
        description,
        path: `/guides/${SLUG}`,
        type: 'article',
        published: CONTENT_DATES.guides,
        modified: CONTENT_DATES.guides,
        jsonLd: [
          this.seo.breadcrumbs(this.crumbs),
          this.seo.article({ headline: TITLE, description, path: `/guides/${SLUG}`, published: CONTENT_DATES.guides, modified: CONTENT_DATES.guides }),
          this.seo.faq(this.faq().map((f) => ({ q: f.q, a: f.a }))),
        ],
      });
    });
  }
}
