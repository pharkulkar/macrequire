import { Skeleton } from '../../shared/skeleton/skeleton';
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApi, Paged } from '../core/admin-api.service';
import { errorLines } from '../core/admin-http';

interface Merchant { id: string; slug: string; name: string; country: string; isActive: boolean }
interface Program { id: string; name: string; country: string; merchant: { id: string } }
interface Offer {
  id: string;
  configuration: { id: string; modelName: string; label: string };
  merchant: { id: string; slug: string; name: string; country: string };
  program: { id: string; name: string } | null;
  country: string; currency: string;
  price: number | null; listPrice: number | null;
  stock: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LIMITED' | 'UNKNOWN';
  regularUrl: string; productId: string | null; finalLink: string; plainLink: string; affiliateUrl: string | null; hasAffiliateLink: boolean;
  source: string; priceVerifiedAt: string | null; stale: boolean; isActive: boolean;
}
interface ModelRow { id: string; name: string }
interface ConfigRow { id: string; label: string }
interface HistoryRow { id: string; price: number | null; listPrice: number | null; currency: string; stock: string; recordedAt: string }
interface Coverage {
  overall: { country: string; totalConfigurations: number; withFreshInStockPrice: number; withAnyOffer: number; withStalePriceOnly: number; allOutOfStock: number; staleDays: number };
}

interface Form {
  id: string | null; // null = creating
  modelId: string; configurationId: string; merchantId: string; programId: string;
  price: number | null; listPrice: number | null; stock: Offer['stock'];
  regularUrl: string; productId: string; affiliateUrl: string; source: string;
}

const emptyForm = (): Form => ({ id: null, modelId: '', configurationId: '', merchantId: '', programId: '', price: null, listPrice: null, stock: 'UNKNOWN', regularUrl: '', productId: '', affiliateUrl: '', source: 'ADMIN_VERIFIED' });

@Component({
  selector: 'app-admin-pricing',
  imports: [Skeleton, FormsModule, DatePipe, RouterLink],
  styleUrl: '../admin-common.scss',
  template: `
    <div class="spread">
      <div><h1>Pricing &amp; offers</h1><p class="lead">Prices, stock and links per configuration and merchant. Every price change is kept in the history.</p></div>
      <div><button type="button" class="btn btn--primary btn--sm" (click)="startCreate()">Add offer</button> <a routerLink="/admin/imports" class="btn btn--secondary btn--sm">Bulk import (CSV)</a></div>
    </div>

    @if (msg()) { <div class="alert alert--ok" role="status">{{ msg() }}</div> }
    @if (errors().length) { <div class="alert alert--error" role="alert"><ul>@for (l of errors(); track l) { <li>{{ l }}</li> }</ul></div> }

    @if (cov(); as c) {
      <div class="stats">
        <div class="stat"><span class="stat__n">{{ c.overall.withFreshInStockPrice }}<span class="muted small"> / {{ c.overall.totalConfigurations }}</span></span><span class="stat__l">{{ c.overall.country }} configurations with a fresh, in-stock price</span></div>
        <div class="stat"><span class="stat__n">{{ c.overall.withStalePriceOnly }}</span><span class="stat__l">prices older than {{ c.overall.staleDays }} days</span></div>
        <div class="stat"><span class="stat__n">{{ c.overall.allOutOfStock }}</span><span class="stat__l">out of stock everywhere</span></div>
        <div class="stat"><span class="stat__n">{{ c.overall.totalConfigurations - c.overall.withAnyOffer }}</span><span class="stat__l">with no offer</span></div>
      </div>
    }

    @if (form(); as f) {
      <form class="panel" (ngSubmit)="save()" #ff="ngForm">
        <h2>{{ f.id ? 'Edit offer' : 'New offer' }}</h2>
        <div class="form-grid">
          @if (!f.id) {
            <div class="field"><label for="o-model">Model</label>
              <select id="o-model" name="model" [(ngModel)]="f.modelId" (ngModelChange)="loadConfigs($event)"><option value="">Choose…</option>@for (m of models(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }</select></div>
            <div class="field wide"><label for="o-config">Configuration</label>
              <select id="o-config" name="config" [(ngModel)]="f.configurationId"><option value="">Choose…</option>@for (c of configs(); track c.id) { <option [value]="c.id">{{ c.label }}</option> }</select></div>
            <div class="field"><label for="o-merchant">Merchant</label>
              <select id="o-merchant" name="merchant" [(ngModel)]="f.merchantId"><option value="">Choose…</option>@for (m of activeMerchants(); track m.id) { <option [value]="m.id">{{ m.name }} ({{ m.country }})</option> }</select></div>
          } @else {
            <div class="field wide"><span class="lbl">Configuration</span><div>{{ editing()?.configuration?.modelName }} · {{ editing()?.configuration?.label }}</div><div class="muted small">{{ editing()?.merchant?.name }} ({{ editing()?.country }}, {{ editing()?.currency }})</div></div>
          }
          <div class="field"><label for="o-program">Affiliate program</label>
            <select id="o-program" name="program" [(ngModel)]="f.programId"><option value="">None</option>@for (p of programsFor(f); track p.id) { <option [value]="p.id">{{ p.name }}</option> }</select></div>
          <div class="field"><label for="o-price">Price {{ currencyFor(f) }}</label><input id="o-price" name="price" type="number" min="0" step="0.01" [(ngModel)]="f.price" placeholder="Not verified" /></div>
          <div class="field"><label for="o-list">List price {{ currencyFor(f) }}</label><input id="o-list" name="list" type="number" min="0" step="0.01" [(ngModel)]="f.listPrice" /></div>
          <div class="field"><label for="o-stock">Stock</label>
            <select id="o-stock" name="stock" [(ngModel)]="f.stock"><option value="IN_STOCK">In stock</option><option value="LIMITED">Limited</option><option value="OUT_OF_STOCK">Out of stock</option><option value="UNKNOWN">Unknown</option></select></div>
          <div class="field"><label for="o-source">Price source</label>
            <select id="o-source" name="source" [(ngModel)]="f.source"><option value="ADMIN_VERIFIED">Admin verified</option><option value="MERCHANT_FEED">Merchant feed</option><option value="OFFICIAL_APPLE">Official Apple</option><option value="SAMPLE">Sample (test data)</option></select></div>
          <div class="field"><label for="o-pid">Product ID (ASIN for Amazon, SKU for Best Buy)</label><input id="o-pid" name="pid" type="text" [(ngModel)]="f.productId" placeholder="B0XXXXXXXX" autocomplete="off" /></div>
          <div class="field wide"><label for="o-reg">Regular product URL (https). Optional when a product ID is given and the merchant has a link template</label><input id="o-reg" name="reg" type="url" [(ngModel)]="f.regularUrl" placeholder="https://…" /></div>
          <div class="field wide"><label for="o-aff">Affiliate URL override (https, used exactly as typed). Leave empty to use the merchant's affiliate ID</label><input id="o-aff" name="aff" type="url" [(ngModel)]="f.affiliateUrl" placeholder="Usually empty" /></div>
        </div>
        <button class="btn btn--primary btn--sm" type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save offer' }}</button>
        <button class="btn btn--secondary btn--sm" type="button" (click)="cancel()">Cancel</button>
      </form>
    }

    <div class="toolbar">
      <div class="field"><label for="f-m">Merchant</label><select id="f-m" [(ngModel)]="fMerchant" (ngModelChange)="reload(1)"><option value="">All</option>@for (m of merchants(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }</select></div>
      <div class="field"><label for="f-c">Country</label><select id="f-c" [(ngModel)]="fCountry" (ngModelChange)="reload(1)"><option value="">All</option><option value="US">US</option><option value="IN">India</option></select></div>
      <div class="field"><label for="f-a">Status</label><select id="f-a" [(ngModel)]="fActive" (ngModelChange)="reload(1)"><option value="">All</option><option value="true">Active</option><option value="false">Deactivated</option></select></div>
      <label class="checkline"><input type="checkbox" [(ngModel)]="fStale" (ngModelChange)="reload(1)" /> Only missing or stale (7+ days)</label>
    </div>

    <div class="table-wrap">
      <table class="grid">
        <caption class="sr-only">Merchant offers</caption>
        <thead><tr><th scope="col">Configuration</th><th scope="col">Merchant</th><th scope="col" class="num">Price</th><th scope="col">Stock</th><th scope="col">Verified</th><th scope="col">Links</th><th scope="col">Actions</th></tr></thead>
        <tbody>
          @for (o of rows(); track o.id) {
            <tr [class.off]="!o.isActive">
              <td><strong>{{ o.configuration.modelName }}</strong><div class="muted small">{{ o.configuration.label }}</div></td>
              <td class="nowrap">{{ o.merchant.name }}<div class="muted small">{{ o.country }}</div></td>
              <td class="num nowrap">@if (o.price !== null) { {{ o.price }} {{ o.currency }}@if (o.listPrice) { <div class="muted small">list {{ o.listPrice }}</div> } } @else { <span class="badge badge--warn">no price</span> }
                @if (o.source === 'SAMPLE') { <div class="badge badge--warn">sample</div> }</td>
              <td><span class="badge" [class.badge--ok]="o.stock === 'IN_STOCK'" [class.badge--bad]="o.stock === 'OUT_OF_STOCK'">{{ o.stock.replace('_', ' ').toLowerCase() }}</span></td>
              <td class="nowrap">@if (o.priceVerifiedAt) { {{ o.priceVerifiedAt | date: 'mediumDate' }} } @else { – }
                @if (o.stale) { <div class="badge badge--warn">stale</div> }</td>
              <td class="small"><a [href]="o.plainLink" target="_blank" rel="noopener noreferrer">page</a>@if (o.productId) { · <code>{{ o.productId }}</code> }@if (o.hasAffiliateLink) { · <span class="badge badge--ok">affiliate</span> }</td>
              <td class="nowrap">
                <button type="button" class="link" (click)="edit(o)">Edit</button> ·
                <button type="button" class="link" (click)="verify(o)" [disabled]="o.price === null">Verify price</button> ·
                <button type="button" class="link" (click)="history(o)">History</button> ·
                @if (o.isActive) { <button type="button" class="link" (click)="deactivate(o)">Deactivate</button> } @else { <button type="button" class="link" (click)="reactivate(o)">Reactivate</button> }
              </td>
            </tr>
          } @empty { @if (loaded()) { <tr><td colspan="7" class="empty">No offers match these filters.</td></tr> } @else { <tr class="sr-only"><td colspan="7" role="status">Loading…</td></tr> @for (n of skeletonRows; track n) { <tr aria-hidden="true"><td colspan="7"><app-skeleton height="1.1rem" /></td></tr> } } }
        </tbody>
      </table>
    </div>
    <div class="pager"><span>{{ total() }} offers</span>
      <button type="button" class="btn btn--secondary btn--sm" [disabled]="page() <= 1" (click)="reload(page() - 1)">Previous</button>
      <span>Page {{ page() }} of {{ pages() }}</span>
      <button type="button" class="btn btn--secondary btn--sm" [disabled]="page() >= pages()" (click)="reload(page() + 1)">Next</button></div>

    @if (hist(); as h) {
      <div class="panel mt">
        <div class="spread"><h2>Price history</h2><button type="button" class="link" (click)="hist.set(null)">Close</button></div>
        <div class="table-wrap"><table class="grid"><thead><tr><th>When</th><th class="num">Price</th><th class="num">List</th><th>Stock</th></tr></thead>
          <tbody>@for (r of h; track r.id) { <tr><td>{{ r.recordedAt | date: 'medium' }}</td><td class="num">{{ r.price ?? '–' }} {{ r.currency }}</td><td class="num">{{ r.listPrice ?? '–' }}</td><td>{{ r.stock }}</td></tr> }</tbody></table></div>
      </div>
    }
  `,
})
export class AdminPricing implements OnInit {
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  private readonly api = inject(AdminApi);

  protected readonly rows = signal<Offer[]>([]);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);
  protected readonly total = signal(0);
  protected readonly merchants = signal<Merchant[]>([]);
  protected readonly activeMerchants = computed(() => this.merchants().filter((m) => m.isActive));
  protected readonly programs = signal<Program[]>([]);
  protected readonly models = signal<ModelRow[]>([]);
  protected readonly configs = signal<ConfigRow[]>([]);
  protected readonly cov = signal<Coverage | null>(null);
  protected readonly form = signal<Form | null>(null);
  protected readonly editing = signal<Offer | null>(null);
  protected readonly hist = signal<HistoryRow[] | null>(null);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly msg = signal('');
  protected readonly errors = signal<string[]>([]);

  protected fMerchant = '';
  protected fCountry = 'US';
  protected fActive = '';
  protected fStale = false;

  ngOnInit() {
    this.api.get<{ data: Merchant[] }>('/merchants', { includeInactive: true }).subscribe((r) => this.merchants.set(r.data));
    this.api.get<{ data: Program[] }>('/affiliate-programs').subscribe((r) => this.programs.set(r.data));
    this.reload(1);
    this.loadCoverage();
  }

  private seq = 0;

  protected reload(page: number) {
    const id = ++this.seq;
    this.api
      .get<Paged<Offer>>('/offers', { page, pageSize: 25, merchantId: this.fMerchant, country: this.fCountry, active: this.fActive, staleDays: this.fStale ? 7 : undefined })
      .subscribe({
        next: (r) => {
          if (id !== this.seq) return; // a newer request superseded this one
          this.rows.set(r.data);
          this.page.set(r.pagination.page);
          this.pages.set(r.pagination.totalPages);
          this.total.set(r.pagination.total);
          this.loaded.set(true);
        },
        error: (e) => { this.loaded.set(true); this.errors.set(errorLines(e)); },
      });
  }

  private loadCoverage() {
    this.api.get<Coverage>('/pricing/coverage', { country: this.fCountry || 'US' }).subscribe((c) => this.cov.set(c));
  }

  protected currencyFor(f: Form) {
    const m = this.merchants().find((x) => x.id === (f.id ? this.editing()?.merchant.id : f.merchantId));
    return m ? `(${m.country === 'IN' ? 'INR' : 'USD'})` : '';
  }
  protected programsFor(f: Form) {
    const mid = f.id ? this.editing()?.merchant.id : f.merchantId;
    return this.programs().filter((p) => p.merchant.id === mid);
  }

  protected startCreate() {
    this.clear();
    this.editing.set(null);
    this.form.set(emptyForm());
    if (!this.models().length) this.api.get<Paged<ModelRow>>('/models', { pageSize: 100 }).subscribe((r) => this.models.set(r.data));
  }
  protected loadConfigs(modelId: string) {
    this.configs.set([]);
    if (modelId) this.api.get<Paged<ConfigRow>>('/configurations', { modelId, pageSize: 100 }).subscribe((r) => this.configs.set(r.data));
  }
  protected edit(o: Offer) {
    this.clear();
    this.editing.set(o);
    this.form.set({ ...emptyForm(), id: o.id, programId: o.program?.id ?? '', price: o.price, listPrice: o.listPrice, stock: o.stock, regularUrl: o.regularUrl, productId: o.productId ?? '', affiliateUrl: o.affiliateUrl ?? '', source: o.source });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  protected cancel() {
    this.form.set(null);
    this.editing.set(null);
  }

  protected save() {
    const f = this.form();
    if (!f) return;
    this.clear();
    this.busy.set(true);
    const num = (v: number | null) => (v === null || (v as unknown) === '' ? null : Number(v));
    const done = () => {
      this.busy.set(false);
      this.form.set(null);
      this.editing.set(null);
      this.msg.set('Offer saved.');
      this.reload(this.page());
      this.loadCoverage();
    };
    const fail = (e: unknown) => {
      this.busy.set(false);
      this.errors.set(errorLines(e));
    };
    if (!f.id) {
      this.api
        .post('/offers', { configurationId: f.configurationId, merchantId: f.merchantId, ...(f.programId ? { programId: f.programId } : {}), price: num(f.price), listPrice: num(f.listPrice), stock: f.stock, ...(f.regularUrl.trim() ? { regularUrl: f.regularUrl.trim() } : {}), productId: f.productId.trim() || null, affiliateUrl: f.affiliateUrl.trim() || null, source: f.source })
        .subscribe({ next: done, error: fail });
    } else {
      this.api
        .patch(`/offers/${f.id}`, { programId: f.programId || null, price: num(f.price), listPrice: num(f.listPrice), stock: f.stock, ...this.regularChange(f), productId: f.productId.trim() || null, affiliateUrl: f.affiliateUrl.trim() || null, source: f.source })
        .subscribe({ next: done, error: fail });
    }
  }
  /** Only send the regular URL when it was edited, so a changed product ID can rebuild it on the server. */
  private regularChange(f: Form): { regularUrl?: string } {
    const url = f.regularUrl.trim();
    const current = this.rows().find((o) => o.id === f.id)?.regularUrl;
    return url && url !== current ? { regularUrl: url } : {};
  }

  protected verify(o: Offer) {
    this.clear();
    this.api.patch(`/offers/${o.id}`, { verifyPrice: true }).subscribe({ next: () => { this.msg.set('Price marked as verified today.'); this.reload(this.page()); this.loadCoverage(); }, error: (e) => this.errors.set(errorLines(e)) });
  }
  protected deactivate(o: Offer) {
    if (!confirm('Deactivate this offer? It disappears from the public site; history is kept.')) return;
    this.clear();
    this.api.delete(`/offers/${o.id}`).subscribe({ next: () => { this.msg.set('Offer deactivated.'); this.reload(this.page()); this.loadCoverage(); }, error: (e) => this.errors.set(errorLines(e)) });
  }
  protected reactivate(o: Offer) {
    this.clear();
    this.api.patch(`/offers/${o.id}`, { isActive: true }).subscribe({ next: () => { this.msg.set('Offer reactivated.'); this.reload(this.page()); this.loadCoverage(); }, error: (e) => this.errors.set(errorLines(e)) });
  }
  protected history(o: Offer) {
    this.api.get<{ data: HistoryRow[] }>(`/offers/${o.id}/price-history`).subscribe({ next: (r) => this.hist.set(r.data), error: (e) => this.errors.set(errorLines(e)) });
  }

  private clear() {
    this.msg.set('');
    this.errors.set([]);
  }
}
