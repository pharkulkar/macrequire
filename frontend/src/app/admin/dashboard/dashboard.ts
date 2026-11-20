import { Skeleton, SkeletonRegion } from '../../shared/skeleton/skeleton';
import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TestSession } from '../../core/test-session';
import { AdminApi } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';
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
  imports: [Skeleton, SkeletonRegion, RouterLink],
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

    <div class="panel" aria-labelledby="test-h">
      <div class="spread">
        <div>
          <strong id="test-h">Test mode</strong>
          <div class="muted small">While test mode is on in a browser, the recommendations and Buy clicks made there are saved as <strong>test data</strong>: they are left out of every number on this dashboard and can be deleted below. Real visitors are never affected. A test session lasts 12 hours.</div>
        </div>
        @if (test.active()) {
          <button type="button" class="btn btn--secondary btn--sm" (click)="stopTest()">Stop test mode</button>
        } @else {
          <button type="button" class="btn btn--primary btn--sm" (click)="startTest()" [disabled]="testBusy()">Start test mode</button>
        }
      </div>
      @if (test.active()) {
        <p class="small"><strong>Test mode is on in this browser.</strong> Open the public site in this browser and use it as a visitor would.
          @if (testLink(); as l) { To test on a phone, open this link there: <input class="testlink" type="text" readonly [value]="l" aria-label="Test link" (focus)="$any($event.target).select()" /> <button type="button" class="link" (click)="copyLink(l)">{{ copied() ? 'Copied' : 'Copy' }}</button> }
        </p>
      }
      <p class="small">Test data saved so far: <strong>{{ testCounts()?.recommendations ?? 0 }}</strong> recommendations and <strong>{{ testCounts()?.clicks ?? 0 }}</strong> Buy clicks.
        @if (auth.isAdmin()) {
          <button type="button" class="link" (click)="deleteTestData()" [disabled]="testBusy() || ((testCounts()?.recommendations ?? 0) + (testCounts()?.clicks ?? 0)) === 0">Delete all test data</button>
        }
      </p>
      @if (testMsg()) { <div class="alert alert--ok" role="status">{{ testMsg() }}</div> }
    </div>

    @if (auth.isAdmin()) {
      <div class="panel panel--danger" aria-labelledby="clear-h">
        <div class="spread">
          <div>
            <strong id="clear-h">Delete all dashboard data</strong>
            <div class="muted small">Removes every saved recommendation and every recorded Buy click ({{ allCounts()?.recommendations ?? 0 }} and {{ allCounts()?.clicks ?? 0 }} right now), real and test, so the dashboard starts from zero. Prices, offers, the catalog and your settings are not touched.</div>
          </div>
          <button type="button" class="btn btn--danger btn--sm" (click)="openClear()" [disabled]="testBusy()">Delete all dashboard data…</button>
        </div>
      </div>
    }

    <dialog #clearDialog class="modal" aria-labelledby="clear-title" (close)="clearText = ''">
      <form method="dialog" (submit)="$event.preventDefault(); confirmClear()">
        <h2 id="clear-title">Delete all dashboard data?</h2>
        <p>This permanently deletes <strong>{{ allCounts()?.recommendations ?? 0 }} recommendations</strong> and <strong>{{ allCounts()?.clicks ?? 0 }} Buy clicks</strong>, including real visitors' activity. It cannot be undone.</p>
        <p class="small muted">Prices, offers, price history, the catalog and settings are kept.</p>
        <label for="clear-confirm" class="small">Type <strong>DELETE</strong> to confirm</label>
        <input id="clear-confirm" name="confirm" type="text" autocomplete="off" [value]="clearText" (input)="clearText = $any($event.target).value" />
        <div class="modal__actions">
          <button type="button" class="btn btn--secondary btn--sm" (click)="clearDialog.close()">Cancel</button>
          <button type="submit" class="btn btn--danger btn--sm" [disabled]="clearText.trim() !== 'DELETE' || testBusy()">Delete everything</button>
        </div>
      </form>
    </dialog>
    @if (error().length) { <div class="alert alert--error" role="alert">@for (l of error(); track l) { <div>{{ l }}</div> }</div> }
    @if (loading()) {
      <app-skeleton-region label="Loading dashboard">
        <div class="sk-grid" style="margin-bottom: 1rem">
          @for (n of skeletons; track n) { <div class="panel sk-lines"><app-skeleton width="45%" height="2rem" /><app-skeleton width="80%" height="0.8rem" /></div> }
        </div>
        <div class="panel sk-lines"><app-skeleton width="30%" height="1.1rem" /><app-skeleton height="90px" radius="10px" /></div>
      </app-skeleton-region>
    }

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
    .panel--danger { border-color: #f1b8b4; }
    .btn--danger { background: #b3261e; color: #fff; border-color: #b3261e; }
    .btn--danger:disabled { opacity: 0.5; cursor: not-allowed; }
    .modal { border: 0; border-radius: 16px; padding: 1.5rem; max-width: 460px; width: calc(100% - 2rem); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); }
    .modal::backdrop { background: rgba(0, 0, 0, 0.45); }
    .modal h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .modal input { width: 100%; margin-top: 0.35rem; padding: 0.55rem 0.7rem; font: inherit; border: 1px solid var(--border); border-radius: 8px; }
    .modal__actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1rem; }
    .testlink { width: min(100%, 26rem); font: inherit; font-size: 0.8rem; padding: 0.2rem 0.4rem; margin: 0 0.4rem; }
    .funnel { padding-left: 1.1rem; display: grid; gap: 0.5rem; margin: 0 0 0.75rem; font-size: 0.92rem; }
  `,
})
export class AdminDashboard implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AdminAuthService);
  protected readonly test = inject(TestSession);
  protected readonly testCounts = signal<{ recommendations: number; clicks: number } | null>(null);
  protected readonly testBusy = signal(false);
  protected readonly testMsg = signal('');
  protected readonly copied = signal(false);
  protected readonly allCounts = signal<{ recommendations: number; clicks: number } | null>(null);
  protected clearText = '';
  private readonly clearDialog = viewChild<ElementRef<HTMLDialogElement>>('clearDialog');
  protected readonly skeletons = [1, 2, 3, 4];
  protected readonly days = signal(30);
  protected readonly loading = signal(true);
  protected readonly error = signal<string[]>([]);
  protected readonly ov = signal<Overview | null>(null);
  protected readonly cl = signal<Clicks | null>(null);
  protected readonly cov = signal<Coverage | null>(null);

  ngOnInit() {
    this.load();
    this.loadTestCounts();
    this.test.refresh();
  }
  protected testLink() {
    return this.test.active() ? this.test.link() : null;
  }
  protected openClear() {
    this.clearText = '';
    this.loadTestCounts();
    this.clearDialog()?.nativeElement.showModal();
  }
  protected confirmClear() {
    if (this.clearText.trim() !== 'DELETE') return;
    this.testBusy.set(true);
    this.api.post<{ deleted: { recommendations: number; clicks: number } }>('/dashboard-data/clear', { confirm: 'DELETE' }).subscribe({
      next: (r) => {
        this.testBusy.set(false);
        this.clearDialog()?.nativeElement.close();
        this.testMsg.set(`Deleted ${r.deleted.recommendations} recommendations and ${r.deleted.clicks} Buy clicks. The dashboard now starts from zero.`);
        this.loadTestCounts();
        this.load();
      },
      error: (e) => { this.testBusy.set(false); this.clearDialog()?.nativeElement.close(); this.error.set(errorLines(e)); },
    });
  }
  private loadTestCounts() {
    this.api.get<{ recommendations: number; clicks: number }>('/dashboard-data').subscribe({ next: (c) => this.allCounts.set(c), error: () => undefined });
    this.api.get<{ recommendations: number; clicks: number }>('/test-data').subscribe({ next: (c) => this.testCounts.set(c), error: (e) => this.error.set(errorLines(e)) });
  }
  protected startTest() {
    this.testBusy.set(true);
    this.testMsg.set('');
    this.api.post<{ token: string; expiresAt: string }>('/test-session', {}).subscribe({
      next: (r) => { this.test.start(r.token, r.expiresAt); this.testBusy.set(false); this.testMsg.set('Test mode is on. Use the public site in this browser; everything you do is tagged as test.'); },
      error: (e) => { this.testBusy.set(false); this.error.set(errorLines(e)); },
    });
  }
  protected stopTest() {
    this.test.stop();
    this.loadTestCounts();
    this.testMsg.set('Test mode is off. New activity is recorded as real again.');
  }
  protected copyLink(link: string) {
    navigator.clipboard?.writeText(link).then(() => { this.copied.set(true); setTimeout(() => this.copied.set(false), 2000); }).catch(() => undefined);
  }
  protected deleteTestData() {
    const c = this.testCounts();
    if (!confirm(`Delete ${c?.recommendations ?? 0} test recommendations and ${c?.clicks ?? 0} test Buy clicks? Real data is not touched. This cannot be undone.`)) return;
    this.testBusy.set(true);
    this.api.delete<{ deleted: { recommendations: number; clicks: number } }>('/test-data').subscribe({
      next: (r) => { this.testBusy.set(false); this.testMsg.set(`Deleted ${r.deleted.recommendations} test recommendations and ${r.deleted.clicks} test clicks.`); this.loadTestCounts(); this.load(); },
      error: (e) => { this.testBusy.set(false); this.error.set(errorLines(e)); },
    });
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
