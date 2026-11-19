import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../core/admin-api.service';
import { errorLines } from '../core/admin-http';

interface Count { count: number }
interface Overview {
  range: { from: string; to: string };
  recommendations: { total: number; byDay: { day: string; count: number }[]; byCountry: { country: string; count: number }[] };
  mostRecommended: ({ label: string } & Count)[];
  mostOftenFirst: ({ label: string } & Count)[];
  popularUseCases: ({ name: string } & Count)[];
  popularApplications: ({ name: string } & Count)[];
  intensity: { intensity: string; count: number }[];
  budgets: { currency: string; median: number; average: number }[];
  notes: string[];
}
interface Clicks {
  totals: { clicks: number; offersClicked: number; affiliateLinkClicks: number; plainLinkClicks: number };
  byDay: { day: string; clicks: number }[];
  byMerchant: { merchant: string; country: string; clicks: number }[];
  byCountry: { country: string; clicks: number }[];
  bySource: { source: string; clicks: number }[];
  topConfigurations: { label: string; clicks: number }[];
  topModels: { model: string; clicks: number }[];
  funnel: { recommendationsGenerated: number; recommendationsWithClicks: number; clicksFromRecommendations: number; clickThroughRate: number | null };
  notes: string[];
}
interface Coverage { overall: { country: string; totalConfigurations: number; withFreshInStockPrice: number; withAnyOffer: number; withStalePriceOnly: number; allOutOfStock: number; staleDays: number } }

const iso = (d: Date) => d.toISOString().slice(0, 10);

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  styleUrl: '../admin-common.scss',
  template: `
    <div class="spread">
      <div><h1>Dashboard</h1><p class="lead">How people use MacRequire, and how well the catalog is priced.</p></div>
      <div class="field">
        <label for="range">Period</label>
        <select id="range" [value]="days()" (change)="setDays(+$any($event.target).value)">
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        </select>
      </div>
    </div>

    @if (error().length) { <div class="alert alert--error" role="alert">@for (l of error(); track l) { <div>{{ l }}</div> }</div> }
    @if (loading()) { <p class="muted" role="status">Loading…</p> }

    @if (cov(); as c) {
      <div class="panel">
        <div class="spread">
          <div>
            <strong>Pricing health ({{ c.overall.country }})</strong>
            <div class="muted small">Budgets can only be applied to configurations with a fresh, in-stock, verified price (checked within {{ c.overall.staleDays }} days).</div>
          </div>
          <a routerLink="/admin/pricing" class="btn btn--secondary btn--sm">Manage prices</a>
        </div>
        <div class="stats mt">
          <div class="stat"><span class="stat__n">{{ c.overall.withFreshInStockPrice }} <span class="muted small">/ {{ c.overall.totalConfigurations }}</span></span><span class="stat__l">configurations with a fresh price</span></div>
          <div class="stat"><span class="stat__n">{{ c.overall.withStalePriceOnly }}</span><span class="stat__l">only have a stale price</span></div>
          <div class="stat"><span class="stat__n">{{ c.overall.allOutOfStock }}</span><span class="stat__l">out of stock everywhere</span></div>
          <div class="stat"><span class="stat__n">{{ c.overall.totalConfigurations - c.overall.withAnyOffer }}</span><span class="stat__l">have no offer at all</span></div>
        </div>
        @if (c.overall.withFreshInStockPrice === 0) { <div class="alert alert--warn">No configuration has a fresh price yet, so shoppers see “price not verified” and budgets cannot be applied. Import prices on the <a routerLink="/admin/imports">CSV imports</a> page.</div> }
      </div>
    }

    @if (ov(); as o) {
      <div class="stats">
        <div class="stat"><span class="stat__n">{{ o.recommendations.total }}</span><span class="stat__l">recommendations generated</span></div>
        <div class="stat"><span class="stat__n">{{ cl()?.totals?.clicks ?? 0 }}</span><span class="stat__l">outbound clicks</span></div>
        <div class="stat"><span class="stat__n">{{ cl()?.totals?.affiliateLinkClicks ?? 0 }}</span><span class="stat__l">on affiliate links</span></div>
        <div class="stat"><span class="stat__n">{{ cl()?.funnel?.clickThroughRate === null || cl()?.funnel?.clickThroughRate === undefined ? '–' : cl()!.funnel.clickThroughRate + '%' }}</span><span class="stat__l">recommendations leading to a click</span></div>
      </div>

      @if (o.recommendations.byDay.length) {
        <div class="panel">
          <h2>Recommendations per day</h2>
          <div class="spark" role="img" [attr.aria-label]="'Recommendations per day, ' + o.recommendations.byDay.length + ' days with activity'">
            @for (d of o.recommendations.byDay; track d.day) { <span class="spark__bar" [style.height.%]="pct(d.count, maxDay(o))" [title]="d.day + ': ' + d.count"></span> }
          </div>
        </div>
      }

      <div class="cols">
        <div class="panel"><h2>Most recommended configurations</h2>
          @if (o.mostRecommended.length) { <ul class="bars">@for (r of o.mostRecommended; track r.label) { <li><span class="bars__label" [title]="r.label">{{ r.label }}</span><span class="bars__track"><span class="bars__fill" [style.width.%]="pct(r.count, o.mostRecommended[0].count)"></span></span><span class="bars__n">{{ r.count }}</span></li> }</ul> } @else { <p class="empty">No recommendations in this period.</p> }
        </div>
        <div class="panel"><h2>Most often ranked first</h2>
          @if (o.mostOftenFirst.length) { <ul class="bars">@for (r of o.mostOftenFirst; track r.label) { <li><span class="bars__label" [title]="r.label">{{ r.label }}</span><span class="bars__track"><span class="bars__fill" [style.width.%]="pct(r.count, o.mostOftenFirst[0].count)"></span></span><span class="bars__n">{{ r.count }}</span></li> }</ul> } @else { <p class="empty">No data yet.</p> }
        </div>
        <div class="panel"><h2>Popular use cases</h2>
          @if (o.popularUseCases.length) { <ul class="bars">@for (r of o.popularUseCases; track r.name) { <li><span class="bars__label">{{ r.name }}</span><span class="bars__track"><span class="bars__fill" [style.width.%]="pct(r.count, o.popularUseCases[0].count)"></span></span><span class="bars__n">{{ r.count }}</span></li> }</ul> } @else { <p class="empty">No data yet.</p> }
        </div>
        <div class="panel"><h2>Popular applications</h2>
          @if (o.popularApplications.length) { <ul class="bars">@for (r of o.popularApplications; track r.name) { <li><span class="bars__label">{{ r.name }}</span><span class="bars__track"><span class="bars__fill" [style.width.%]="pct(r.count, o.popularApplications[0].count)"></span></span><span class="bars__n">{{ r.count }}</span></li> }</ul> } @else { <p class="empty">No data yet.</p> }
        </div>
        <div class="panel"><h2>Workload and budgets</h2>
          @for (i of o.intensity; track i.intensity) { <span class="badge">{{ i.intensity }} · {{ i.count }}</span>{{ ' ' }} }
          @for (b of o.budgets; track b.currency) { <p class="small muted mt">Maximum budget ({{ b.currency }}): median {{ b.median }}, average {{ b.average }}</p> }
          @for (c of o.recommendations.byCountry; track c.country) { <p class="small muted">{{ c.country }}: {{ c.count }} recommendations</p> }
        </div>
      </div>
    }

    @if (cl(); as c) {
      <h3>Outbound clicks</h3>
      <div class="cols">
        <div class="panel"><h2>By merchant</h2>
          @if (c.byMerchant.length) { <ul class="bars">@for (r of c.byMerchant; track r.merchant) { <li><span class="bars__label">{{ r.merchant }} ({{ r.country }})</span><span class="bars__track"><span class="bars__fill" [style.width.%]="pct(r.clicks, c.byMerchant[0].clicks)"></span></span><span class="bars__n">{{ r.clicks }}</span></li> }</ul> } @else { <p class="empty">No clicks in this period.</p> }
        </div>
        <div class="panel"><h2>By source and country</h2>
          @for (r of c.bySource; track r.source) { <span class="badge">{{ r.source }} · {{ r.clicks }}</span>{{ ' ' }} }
          <div class="mt">@for (r of c.byCountry; track r.country) { <span class="badge">{{ r.country }} · {{ r.clicks }}</span>{{ ' ' }} }</div>
          <p class="small muted mt">Country is the country of the merchant offer clicked, not the visitor's location.</p>
        </div>
        <div class="panel"><h2>Most clicked configurations</h2>
          @if (c.topConfigurations.length) { <ul class="bars">@for (r of c.topConfigurations; track r.label) { <li><span class="bars__label" [title]="r.label">{{ r.label }}</span><span class="bars__track"><span class="bars__fill" [style.width.%]="pct(r.clicks, c.topConfigurations[0].clicks)"></span></span><span class="bars__n">{{ r.clicks }}</span></li> }</ul> } @else { <p class="empty">No clicks yet.</p> }
        </div>
        <div class="panel"><h2>Funnel</h2>
          <ol class="funnel">
            <li><strong>{{ c.funnel.recommendationsGenerated }}</strong> recommendations generated</li>
            <li><strong>{{ c.funnel.recommendationsWithClicks }}</strong> led to at least one click</li>
            <li><strong>{{ c.funnel.clicksFromRecommendations }}</strong> clicks traced to a recommendation</li>
          </ol>
          <p class="small muted">Clicks from the catalog and comparison pages can't be tied to a recommendation, so they aren't in this funnel.</p>
        </div>
      </div>
      <div class="alert alert--warn mt">@for (n of c.notes; track n) { <div>{{ n }}</div> }</div>
    }
  `,
  styles: `
    .spark { display: flex; align-items: flex-end; gap: 3px; height: 90px; }
    .spark__bar { flex: 1; min-width: 4px; background: var(--accent); border-radius: 3px 3px 0 0; min-height: 3px; opacity: 0.85; }
    .funnel { padding-left: 1.1rem; display: grid; gap: 0.5rem; margin: 0 0 0.75rem; font-size: 0.92rem; }
  `,
})
export class AdminDashboard implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly days = signal(30);
  protected readonly loading = signal(true);
  protected readonly error = signal<string[]>([]);
  protected readonly ov = signal<Overview | null>(null);
  protected readonly cl = signal<Clicks | null>(null);
  protected readonly cov = signal<Coverage | null>(null);

  ngOnInit() {
    this.load();
  }

  protected setDays(n: number) {
    this.days.set(n);
    this.load();
  }

  protected pct(n: number, max: number) {
    return max > 0 ? Math.max(3, Math.round((n / max) * 100)) : 0;
  }
  protected maxDay(o: Overview) {
    return Math.max(...o.recommendations.byDay.map((d) => d.count), 1);
  }

  private load() {
    this.loading.set(true);
    this.error.set([]);
    const to = new Date();
    const from = new Date(Date.now() - (this.days() - 1) * 86_400_000);
    const range = { from: iso(from), to: iso(to) };
    forkJoin({
      ov: this.api.get<Overview>('/analytics/overview', range),
      cl: this.api.get<Clicks>('/analytics/clicks', range),
      cov: this.api.get<Coverage>('/pricing/coverage', { country: 'US' }),
    }).subscribe({
      next: (r) => {
        this.ov.set(r.ov);
        this.cl.set(r.cl);
        this.cov.set(r.cov);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorLines(e));
        this.loading.set(false);
      },
    });
  }
}
