import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { formatRange, formatStorage } from '../../core/format';
import { Seo } from '../../core/seo.service';
import { CONTENT_DATES, prettyDate } from '../../core/site';
import { SiteData } from '../../core/site-data.service';
import { Breadcrumbs } from '../../shared/breadcrumbs/breadcrumbs';
import { Faq, FaqItem } from '../../shared/faq/faq';

const SLUG = 'macbook-air-vs-macbook-pro';
const TITLE = 'MacBook Air vs MacBook Pro: specifications compared';

interface Row {
  slug: string;
  name: string;
  category: string;
  screen: string;
  chips: string[];
  memory: [number, number];
  storage: [number, number];
  display: string;
  brightness: number | null;
  battery: [number, number] | null;
  weight: [number, number] | null;
  ports: string[];
}

const range = (nums: number[]): [number, number] | null => (nums.length ? [Math.min(...nums), Math.max(...nums)] : null);
const unique = <T>(xs: T[]) => [...new Set(xs)];

@Component({
  selector: 'app-guide-air-vs-pro',
  imports: [RouterLink, Breadcrumbs, Faq],
  styleUrl: '../prose.scss',
  template: `
    <article class="container prose">
      <app-breadcrumbs [items]="crumbs" />
      <h1>{{ title }}</h1>
      <p class="updated">Updated {{ updated }}. The table is generated from our catalog, which is based on Apple’s published specifications.</p>

      <div class="answer">
        <strong class="label">Short answer</strong>
        <p>
          @if (rows().length) {
            The main differences are the chips, the memory and storage you can configure, the display and the weight.
            @if (lightest(); as l) { The lightest model in our catalog is the {{ l.name }}. }
            @if (mostMemory(); as m) { The most memory available is {{ m.memory[1] }}GB, on the {{ m.name }}. }
            Which one fits depends on your apps, so compare your workload rather than the names.
          } @else {
            The main differences are the chips, the memory and storage you can configure, the display and the weight. Which one fits depends on your apps.
          }
        </p>
      </div>

      @if (rows().length) {
        <h2>Specifications by model</h2>
        <div class="table-scroll">
          <table>
            <caption>Ranges cover every configuration of each model in our catalog.</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Screen</th>
                <th scope="col">Chips</th>
                <th scope="col">Memory</th>
                <th scope="col">Storage</th>
                <th scope="col">Display</th>
                <th scope="col">Video playback battery</th>
                <th scope="col">Weight</th>
                <th scope="col">Ports</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.slug) {
                <tr>
                  <th scope="row"><a [routerLink]="['/catalog', r.slug]">{{ r.name }}</a></th>
                  <td>{{ r.screen }}</td>
                  <td>{{ r.chips.join(', ') }}</td>
                  <td>{{ fmtMem(r.memory) }}</td>
                  <td>{{ fmtStore(r.storage) }}</td>
                  <td>{{ r.display }}@if (r.brightness) {, up to {{ r.brightness }} nits}</td>
                  <td>{{ fmtHours(r.battery) }}</td>
                  <td>{{ fmtWeight(r.weight) }}</td>
                  <td>{{ r.ports.join(', ') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <h2>How to choose</h2>
      <ul>
        <li>Start from your apps. Memory and storage cannot be upgraded after purchase, so the right amount matters more than the model name.</li>
        <li>Check the display and weight if you carry the laptop daily.</li>
        <li>Check the ports if you connect external displays or accessories.</li>
        <li>Battery hours are Apple’s claims for specific tests. Real use varies.</li>
      </ul>
      <p>Our <a routerLink="/methodology">methodology</a> explains how we score each configuration for your workload.</p>

      <h2>Frequently asked questions</h2>
      <app-faq [items]="faq()" />

      <div class="cta"><p>Tell us your apps and budget and we will pick the exact configuration.</p><a routerLink="/find" class="btn btn--primary">Find my MacBook</a></div>
    </article>
  `,
})
export class GuideAirVsPro {
  private readonly seo = inject(Seo);
  private readonly data = inject(SiteData);
  protected readonly title = TITLE;
  protected readonly updated = prettyDate(CONTENT_DATES.guides);
  protected readonly crumbs = [{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }, { name: 'Air vs Pro', path: `/guides/${SLUG}` }];

  private readonly configs = toSignal(this.data.configurations(), { initialValue: [] });

  protected readonly rows = computed<Row[]>(() => {
    const byModel = new Map<string, typeof this.configs extends () => infer T ? T : never>();
    for (const c of this.configs()) {
      const list = byModel.get(c.model.slug) ?? [];
      list.push(c);
      byModel.set(c.model.slug, list);
    }
    return [...byModel.values()]
      .map((cs) => {
        const m = cs[0].model;
        const displays = unique(cs.map((c) => c.display?.technology).filter((x): x is string => !!x));
        return {
          slug: m.slug,
          name: m.name,
          category: m.category,
          screen: `${m.screenSizeInch}-inch`,
          chips: unique(cs.map((c) => c.chip.name)),
          memory: range(cs.map((c) => c.memoryGB))!,
          storage: range(cs.map((c) => c.storageGB))!,
          display: displays.join(', ') || 'n/a',
          brightness: range(cs.map((c) => c.display?.brightnessNits ?? 0).filter((n) => n > 0))?.[1] ?? null,
          battery: range(cs.map((c) => c.battery?.videoHours ?? 0).filter((n) => n > 0)),
          weight: range(cs.map((c) => c.weightKg ?? 0).filter((n) => n > 0)),
          ports: unique(cs.flatMap((c) => c.ports)),
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.screen.localeCompare(b.screen));
  });

  protected readonly lightest = computed(() => this.rows().filter((r) => r.weight).sort((a, b) => a.weight![0] - b.weight![0])[0] ?? null);
  protected readonly longest = computed(() => this.rows().filter((r) => r.battery).sort((a, b) => b.battery![1] - a.battery![1])[0] ?? null);
  protected readonly mostMemory = computed(() => [...this.rows()].sort((a, b) => b.memory[1] - a.memory[1])[0] ?? null);

  protected readonly fmtMem = (r: [number, number]) => formatRange(r, (n) => `${n}GB`);
  protected readonly fmtStore = (r: [number, number]) => formatRange(r, formatStorage);
  protected readonly fmtHours = (r: [number, number] | null) => formatRange(r, (n) => `${n} hours`);
  protected readonly fmtWeight = (r: [number, number] | null) => formatRange(r, (n) => `${n} kg`);

  protected readonly faq = computed<FaqItem[]>(() => {
    const items: FaqItem[] = [];
    const l = this.lightest();
    const b = this.longest();
    const m = this.mostMemory();
    if (l) items.push({ q: 'Which MacBook is the lightest?', a: `In our catalog, the ${l.name} has the lowest weight, starting at ${l.weight![0]} kg.` });
    if (b) items.push({ q: 'Which MacBook has the longest battery life?', a: `By Apple’s claimed video playback hours, the ${b.name} is highest at up to ${b.battery![1]} hours. Real use varies with what you do.` });
    if (m) items.push({ q: 'Which MacBook can have the most memory?', a: `The ${m.name} can be configured with up to ${m.memory[1]}GB of memory. Memory cannot be upgraded after purchase.` });
    items.push({ q: 'Can I upgrade memory or storage later?', a: 'No. Memory and storage are built in, so choose the amounts you need when you buy. An external drive can add space for files.' });
    items.push({ q: 'Is the MacBook Pro always better than the MacBook Air?', a: 'Not for every person. The best choice depends on the apps you run, the memory and storage they need, and how much you value weight and price. We score each exact configuration against your workload.' });
    return items;
  });

  constructor() {
    effect(() => {
      const description = 'Compare every MacBook Air and MacBook Pro in our catalog: chips, memory and storage ranges, display, battery, weight and ports, from Apple’s specifications.';
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
