import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';
import { errorLines } from '../core/admin-http';

interface Merchant { id: string; slug: string; name: string; country: string; websiteUrl: string | null; isActive: boolean; offerCount: number; programCount: number; productUrlTemplate: string | null; affiliateIdParam: string | null; affiliateId: string | null; affiliateLinkTemplate: string | null }
interface Program { id: string; name: string; network: string | null; country: string; affiliateId: string | null; isActive: boolean; merchant: { id: string; name: string }; offerCount: number }

@Component({
  selector: 'app-admin-merchants',
  imports: [FormsModule],
  styleUrl: '../admin-common.scss',
  template: `
    <h1>Merchants &amp; affiliate programs</h1>
    <p class="lead">Merchants belong to one country, and so do their offers. For each merchant, <strong>Link settings</strong> hold the affiliate ID (for Amazon, your Associates tag). Offers only need a product ID (the ASIN for Amazon, the SKU for Best Buy). The shopper's link is built from both when they click, so changing an ID here changes every link at once.</p>

    @if (msg()) { <div class="alert alert--ok" role="status">{{ msg() }}</div> }
    @if (errors().length) { <div class="alert alert--error" role="alert"><ul>@for (l of errors(); track l) { <li>{{ l }}</li> }</ul></div> }
    @if (!auth.isAdmin()) { <div class="alert alert--warn">Only ADMINs can change merchants and programs. You can view them.</div> }

    <section class="panel" aria-labelledby="buy-links-h">
      <h2 id="buy-links-h">Configure-to-order configurations</h2>
      <p class="muted small">Configure-to-order (CTO) configurations are built to order, and few merchants stock them. Switch this off to hide them everywhere on the site: the catalog, product pages, recommendations, comparison and Buy links. Nothing is deleted, and you still see them here in the admin.</p>
      <label class="checkline">
        <input type="checkbox" [checked]="showCto()" [disabled]="!auth.isAdmin() || savingCto()" (change)="setShowCto($any($event.target).checked)" />
        Show configure-to-order configurations on the site
      </label>
      <p class="small"><strong>Currently:</strong> {{ showCto() ? 'shown' : 'hidden' }}. Changes reach the site within a few seconds. Recommendations people already received lose the hidden configurations.</p>
    </section>

    <h2>Merchants</h2>
    <div class="table-wrap">
      <table class="grid">
        <caption class="sr-only">Merchants</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Slug</th><th scope="col">Country</th><th scope="col">Website</th><th scope="col" class="num">Offers</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
        <tbody>
          @for (m of merchants(); track m.id) {
            <tr [class.off]="!m.isActive">
              <td><strong>{{ m.name }}</strong></td><td class="muted">{{ m.slug }}</td><td>{{ m.country }}</td>
              <td class="small">@if (m.websiteUrl) { <a [href]="m.websiteUrl" target="_blank" rel="noopener noreferrer">{{ m.websiteUrl }}</a> }</td>
              <td class="num">{{ m.offerCount }}</td>
              <td><span class="badge" [class.badge--ok]="m.isActive">{{ m.isActive ? 'active' : 'inactive' }}</span></td>
              <td class="nowrap">
                <button type="button" class="link" (click)="openLinks(m)">Link settings</button>
                @if (auth.isAdmin()) { · <button type="button" class="link" (click)="toggleMerchant(m)">{{ m.isActive ? 'Deactivate' : 'Activate' }}</button> }
              </td>
            </tr>
            @if (linksFor()?.id === m.id) {
              <tr><td colspan="7">
                <form class="panel" (ngSubmit)="saveLinks(m)">
                  <h3>Link settings for {{ m.name }}</h3>
                  <div class="form-grid">
                    <div class="field"><label for="ls-id">Affiliate ID{{ m.slug.startsWith('amazon') ? ' (your Associates tag, e.g. macrequire-20)' : '' }}</label><input id="ls-id" name="lsid" type="text" [(ngModel)]="ls.affiliateId" [disabled]="!auth.isAdmin()" autocomplete="off" /></div>
                    <div class="field"><label for="ls-param">Parameter that carries the ID</label><input id="ls-param" name="lsparam" type="text" [(ngModel)]="ls.affiliateIdParam" placeholder="tag" [disabled]="!auth.isAdmin()" /></div>
                    <div class="field wide"><label for="ls-tpl">Product link template ({{ '{' }}id{{ '}' }} is replaced by the offer's product ID)</label><input id="ls-tpl" name="lstpl" type="text" [(ngModel)]="ls.productUrlTemplate" placeholder="https://www.amazon.com/dp/{{ '{' }}id{{ '}' }}" [disabled]="!auth.isAdmin()" /></div>
                    <div class="field wide"><label for="ls-net">Network link template (advanced, optional)</label><input id="ls-net" name="lsnet" type="text" [(ngModel)]="ls.affiliateLinkTemplate" placeholder="https://partner.example/c/123?u={{ '{' }}url{{ '}' }}" [disabled]="!auth.isAdmin()" /></div>
                  </div>
                  <p class="muted small">Amazon: set the ID and leave the network template empty; the ID is added as <code>?tag=…</code>. Networks that wrap links (for example Impact for Best Buy): paste the network's tracking link and put {{ '{' }}url{{ '}' }} where the product link goes. If a network template is set, it is used instead of the parameter. An affiliate URL typed on a single offer always wins.</p>
                  @if (preview(m); as pv) { <p class="small"><strong>Example link:</strong> <code>{{ pv }}</code></p> }
                  @if (auth.isAdmin()) { <button class="btn btn--primary btn--sm" type="submit">Save link settings</button> }
                  <button class="btn btn--secondary btn--sm" type="button" (click)="linksFor.set(null)">Close</button>
                </form>
              </td></tr>
            }
          }
        </tbody>
      </table>
    </div>

    @if (auth.isAdmin()) {
      <form class="panel mt" (ngSubmit)="addMerchant()">
        <h2>Add merchant</h2>
        <div class="form-grid">
          <div class="field"><label for="mn">Name</label><input id="mn" name="mn" type="text" [(ngModel)]="mForm.name" required /></div>
          <div class="field"><label for="ms">Slug (lowercase, hyphens)</label><input id="ms" name="ms" type="text" [(ngModel)]="mForm.slug" placeholder="best-buy-us" required /></div>
          <div class="field"><label for="mc">Country</label><select id="mc" name="mc" [(ngModel)]="mForm.country"><option value="US">United States</option><option value="IN">India</option></select></div>
          <div class="field"><label for="mw">Website (https)</label><input id="mw" name="mw" type="url" [(ngModel)]="mForm.websiteUrl" placeholder="https://www.bestbuy.com" /></div>
        </div>
        <button class="btn btn--primary btn--sm" type="submit">Add merchant</button>
      </form>
    }

    <h2 class="mt">Affiliate programs</h2>
    <div class="table-wrap">
      <table class="grid">
        <caption class="sr-only">Affiliate programs</caption>
        <thead><tr><th scope="col">Program</th><th scope="col">Merchant</th><th scope="col">Network</th><th scope="col">Country</th><th scope="col">Affiliate ID</th><th scope="col" class="num">Offers</th><th scope="col">Actions</th></tr></thead>
        <tbody>
          @for (p of programs(); track p.id) {
            <tr [class.off]="!p.isActive">
              <td><strong>{{ p.name }}</strong></td><td>{{ p.merchant.name }}</td><td>{{ p.network ?? '–' }}</td><td>{{ p.country }}</td>
              <td>
                @if (editingId() === p.id) {
                  <input type="text" [(ngModel)]="editId" aria-label="Affiliate ID" /> <button type="button" class="link" (click)="saveId(p)">Save</button> <button type="button" class="link" (click)="editingId.set(null)">Cancel</button>
                } @else { <code>{{ p.affiliateId ?? '–' }}</code> }
              </td>
              <td class="num">{{ p.offerCount }}</td>
              <td class="nowrap">@if (auth.isAdmin()) { <button type="button" class="link" (click)="startEditId(p)">Edit ID</button> · <button type="button" class="link" (click)="toggleProgram(p)">{{ p.isActive ? 'Deactivate' : 'Activate' }}</button> }</td>
            </tr>
          } @empty { <tr><td colspan="7" class="empty">No affiliate programs yet. Add one after you are accepted into a program.</td></tr> }
        </tbody>
      </table>
    </div>

    @if (auth.isAdmin()) {
      <form class="panel mt" (ngSubmit)="addProgram()">
        <h2>Add affiliate program</h2>
        <div class="form-grid">
          <div class="field"><label for="pm">Merchant</label><select id="pm" name="pm" [(ngModel)]="pForm.merchantId"><option value="">Choose…</option>@for (m of merchants(); track m.id) { <option [value]="m.id">{{ m.name }} ({{ m.country }})</option> }</select></div>
          <div class="field"><label for="pn">Program name</label><input id="pn" name="pn" type="text" [(ngModel)]="pForm.name" placeholder="Amazon Associates US" required /></div>
          <div class="field"><label for="pk">Network</label><input id="pk" name="pk" type="text" [(ngModel)]="pForm.network" placeholder="Impact, Amazon Associates…" /></div>
          <div class="field"><label for="pi">Affiliate ID / tag</label><input id="pi" name="pi" type="text" [(ngModel)]="pForm.affiliateId" /></div>
        </div>
        <p class="muted small">The program's country is taken from the merchant.</p>
        <button class="btn btn--primary btn--sm" type="submit">Add program</button>
      </form>
    }
  `,
})
export class AdminMerchants implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AdminAuthService);
  protected readonly merchants = signal<Merchant[]>([]);
  protected readonly programs = signal<Program[]>([]);
  protected readonly msg = signal('');
  protected readonly errors = signal<string[]>([]);
  protected readonly editingId = signal<string | null>(null);
  protected editId = '';
  protected readonly linksFor = signal<Merchant | null>(null);
  protected ls = { affiliateId: '', affiliateIdParam: '', productUrlTemplate: '', affiliateLinkTemplate: '' };
  protected mForm = { name: '', slug: '', country: 'US', websiteUrl: '' };
  protected pForm = { merchantId: '', name: '', network: '', affiliateId: '' };

  protected readonly showCto = signal(true);
  protected readonly savingCto = signal(false);
  ngOnInit() {
    this.load();
    this.api.get<{ showCtoConfigurations: boolean }>('/settings').subscribe({ next: (s) => this.showCto.set(s.showCtoConfigurations), error: (e) => this.errors.set(errorLines(e)) });
  }
  protected setShowCto(on: boolean) {
    this.savingCto.set(true);
    this.api.patch<{ showCtoConfigurations: boolean }>('/settings', { showCtoConfigurations: on }).subscribe({
      next: (s) => { this.showCto.set(s.showCtoConfigurations); this.savingCto.set(false); this.errors.set([]); this.msg.set(`Configure-to-order configurations are now ${s.showCtoConfigurations ? 'shown' : 'hidden'} on the site.`); },
      error: (e) => { this.savingCto.set(false); this.showCto.set(!on); this.msg.set(''); this.errors.set(errorLines(e)); },
    });
  }

  private load() {
    this.api.get<{ data: Merchant[] }>('/merchants', { includeInactive: true }).subscribe({ next: (r) => this.merchants.set(r.data), error: (e) => this.errors.set(errorLines(e)) });
    this.api.get<{ data: Program[] }>('/affiliate-programs', { includeInactive: true }).subscribe({ next: (r) => this.programs.set(r.data), error: (e) => this.errors.set(errorLines(e)) });
  }
  private ok(text: string) { this.errors.set([]); this.msg.set(text); this.load(); }
  private bad(e: unknown) { this.msg.set(''); this.errors.set(errorLines(e)); }

  protected addMerchant() {
    const f = this.mForm;
    this.api.post('/merchants', { name: f.name.trim(), slug: f.slug.trim(), country: f.country, ...(f.websiteUrl.trim() ? { websiteUrl: f.websiteUrl.trim() } : {}) }).subscribe({ next: () => { this.mForm = { name: '', slug: '', country: 'US', websiteUrl: '' }; this.ok('Merchant added.'); }, error: (e) => this.bad(e) });
  }
  protected toggleMerchant(m: Merchant) {
    this.api.patch(`/merchants/${m.id}`, { isActive: !m.isActive }).subscribe({ next: () => this.ok(m.isActive ? 'Merchant deactivated. Its offers can no longer be offered or redirected.' : 'Merchant activated.'), error: (e) => this.bad(e) });
  }
  protected addProgram() {
    const m = this.merchants().find((x) => x.id === this.pForm.merchantId);
    if (!m) return this.bad(new Error());
    const f = this.pForm;
    this.api.post('/affiliate-programs', { merchantId: m.id, country: m.country, name: f.name.trim(), ...(f.network.trim() ? { network: f.network.trim() } : {}), ...(f.affiliateId.trim() ? { affiliateId: f.affiliateId.trim() } : {}) }).subscribe({ next: () => { this.pForm = { merchantId: '', name: '', network: '', affiliateId: '' }; this.ok('Program added.'); }, error: (e) => this.bad(e) });
  }
  protected openLinks(m: Merchant) {
    this.msg.set('');
    this.ls = { affiliateId: m.affiliateId ?? '', affiliateIdParam: m.affiliateIdParam ?? '', productUrlTemplate: m.productUrlTemplate ?? '', affiliateLinkTemplate: m.affiliateLinkTemplate ?? '' };
    this.linksFor.set(this.linksFor()?.id === m.id ? null : m);
  }
  /** Shows what a link will look like, using a made-up product ID. Mirrors the server's rule, which does the real work. */
  protected preview(_m: Merchant): string {
    const l = this.ls;
    if (!l.productUrlTemplate.includes('{id}')) return '';
    const base = l.productUrlTemplate.split('{id}').join('EXAMPLE123');
    const id = l.affiliateId.trim();
    if (id && l.affiliateLinkTemplate.includes('{url}')) return l.affiliateLinkTemplate.split('{url}').join(encodeURIComponent(base)).split('{id}').join(encodeURIComponent(id));
    if (id && l.affiliateIdParam.trim()) { try { const u = new URL(base); u.searchParams.set(l.affiliateIdParam.trim(), id); return u.toString(); } catch { return base; } }
    return base;
  }
  protected saveLinks(m: Merchant) {
    const v = (s: string) => s.trim() || null;
    const l = this.ls;
    this.api.patch(`/merchants/${m.id}`, { affiliateId: v(l.affiliateId), affiliateIdParam: v(l.affiliateIdParam), productUrlTemplate: v(l.productUrlTemplate), affiliateLinkTemplate: v(l.affiliateLinkTemplate) }).subscribe({ next: () => { this.linksFor.set(null); this.ok('Link settings saved. Links on the site use them immediately.'); }, error: (e) => this.bad(e) });
  }
  protected startEditId(p: Program) { this.editId = p.affiliateId ?? ''; this.editingId.set(p.id); }
  protected saveId(p: Program) {
    this.api.patch(`/affiliate-programs/${p.id}`, { affiliateId: this.editId.trim() || null }).subscribe({ next: () => { this.editingId.set(null); this.ok('Affiliate ID updated.'); }, error: (e) => this.bad(e) });
  }
  protected toggleProgram(p: Program) {
    this.api.patch(`/affiliate-programs/${p.id}`, { isActive: !p.isActive }).subscribe({ next: () => this.ok('Program updated.'), error: (e) => this.bad(e) });
  }
}
