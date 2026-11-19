import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, Paged } from '../core/admin-api.service';
import { errorLines } from '../core/admin-http';

interface Req { minRamGB: number; preferredRamGB: number; cpuDemand: number; gpuDemand: number; storageGB: number; intensity: string; concurrencyFactor: number; needsAppleSilicon: boolean; basis: 'VENDOR_PUBLISHED' | 'ESTIMATE'; basisNote: string | null; sourceUrl: string | null }
interface App { id: string; slug: string; name: string; category: string; macSupported: boolean; aliases: string[]; notes: string | null; isActive: boolean; requirements: Req | null }
interface UseCase { id: string; slug: string; name: string; description: string | null; appCategories: string[]; starterApps: string[]; isActive: boolean; weights: Record<string, number> }

const CATEGORIES = ['cpu', 'gpu', 'ram', 'storage', 'compatibility', 'budget', 'portability', 'battery', 'future', 'display'];

interface AppForm {
  id: string | null; slug: string; name: string; category: string; macSupported: boolean; aliases: string; notes: string; isActive: boolean;
  minRamGB: number; preferredRamGB: number; cpuDemand: number; gpuDemand: number; storageGB: number; intensity: string; concurrencyFactor: number;
  needsAppleSilicon: boolean; basis: 'VENDOR_PUBLISHED' | 'ESTIMATE'; basisNote: string; sourceUrl: string;
}

const blank = (): AppForm => ({ id: null, slug: '', name: '', category: '', macSupported: true, aliases: '', notes: '', isActive: true, minRamGB: 4, preferredRamGB: 8, cpuDemand: 4, gpuDemand: 2, storageGB: 5, intensity: 'MODERATE', concurrencyFactor: 0.6, needsAppleSilicon: false, basis: 'ESTIMATE', basisNote: '', sourceUrl: '' });

@Component({
  selector: 'app-admin-applications',
  imports: [FormsModule],
  styleUrl: '../admin-common.scss',
  template: `
    <h1>Applications &amp; use cases</h1>
    <p class="lead">These numbers drive memory, CPU, GPU and storage requirements in every recommendation. Mark a figure “vendor published” only if it comes from the vendor's own page, and record the link.</p>
    @if (msg()) { <div class="alert alert--ok" role="status">{{ msg() }}</div> }
    @if (errors().length) { <div class="alert alert--error" role="alert"><ul>@for (l of errors(); track l) { <li>{{ l }}</li> }</ul></div> }

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.on]="tab() === 'apps'" [attr.aria-selected]="tab() === 'apps'" (click)="tab.set('apps')">Applications</button>
      <button type="button" role="tab" [class.on]="tab() === 'uc'" [attr.aria-selected]="tab() === 'uc'" (click)="tab.set('uc')">Use cases</button>
    </div>

    @if (tab() === 'apps') {
      <div class="toolbar">
        <div class="field grow"><label for="aq">Search</label><input id="aq" type="search" [(ngModel)]="q" (ngModelChange)="onSearch()" placeholder="Name or alias" /></div>
        <div class="field"><label for="ac">Category</label><select id="ac" [(ngModel)]="cat" (ngModelChange)="load(1)"><option value="">All</option>@for (c of categories(); track c) { <option>{{ c }}</option> }</select></div>
        <label class="checkline"><input type="checkbox" [(ngModel)]="inactive" (ngModelChange)="load(1)" /> Include deactivated</label>
        <button type="button" class="btn btn--primary btn--sm" (click)="startNew()">Add application</button>
      </div>

      @if (form(); as f) {
        <form class="panel" (ngSubmit)="save()">
          <h2>{{ f.id ? 'Edit ' + f.name : 'New application' }}</h2>
          <div class="form-grid">
            @if (!f.id) { <div class="field"><label for="a-slug">Slug</label><input id="a-slug" name="slug" type="text" [(ngModel)]="f.slug" placeholder="my-app" /></div> }
            <div class="field"><label for="a-name">Name</label><input id="a-name" name="name" type="text" [(ngModel)]="f.name" /></div>
            <div class="field"><label for="a-cat">Category</label><input id="a-cat" name="cat" type="text" list="catlist" [(ngModel)]="f.category" /><datalist id="catlist">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist></div>
            <div class="field wide"><label for="a-al">Search aliases (comma separated, lowercase)</label><input id="a-al" name="al" type="text" [(ngModel)]="f.aliases" /></div>
            <div class="field wide"><label for="a-nt">Notes shown to users</label><input id="a-nt" name="nt" type="text" [(ngModel)]="f.notes" /></div>
            <label class="checkline"><input type="checkbox" name="mac" [(ngModel)]="f.macSupported" /> Available on macOS</label>
            <label class="checkline"><input type="checkbox" name="as" [(ngModel)]="f.needsAppleSilicon" /> Needs Apple Silicon</label>
            @if (f.id) { <label class="checkline"><input type="checkbox" name="act" [(ngModel)]="f.isActive" /> Active</label> }
          </div>
          <h3>Hardware requirements</h3>
          <div class="form-grid">
            <div class="field"><label for="r-min">Minimum memory (GB)</label><input id="r-min" name="min" type="number" min="1" [(ngModel)]="f.minRamGB" /></div>
            <div class="field"><label for="r-pref">Preferred memory (GB)</label><input id="r-pref" name="pref" type="number" min="1" [(ngModel)]="f.preferredRamGB" /></div>
            <div class="field"><label for="r-cpu">CPU demand (1-10)</label><input id="r-cpu" name="cpu" type="number" min="1" max="10" [(ngModel)]="f.cpuDemand" /></div>
            <div class="field"><label for="r-gpu">GPU demand (1-10)</label><input id="r-gpu" name="gpu" type="number" min="1" max="10" [(ngModel)]="f.gpuDemand" /></div>
            <div class="field"><label for="r-sto">Storage footprint (GB)</label><input id="r-sto" name="sto" type="number" min="0" [(ngModel)]="f.storageGB" /></div>
            <div class="field"><label for="r-int">Typical workload</label><select id="r-int" name="int" [(ngModel)]="f.intensity"><option>BASIC</option><option>MODERATE</option><option>HEAVY</option><option>PROFESSIONAL</option></select></div>
            <div class="field"><label for="r-con">Concurrency (0-1)</label><input id="r-con" name="con" type="number" step="0.05" min="0" max="1" [(ngModel)]="f.concurrencyFactor" /></div>
            <div class="field"><label for="r-basis">Where do the memory figures come from?</label><select id="r-basis" name="basis" [(ngModel)]="f.basis"><option value="ESTIMATE">MacRequire estimate</option><option value="VENDOR_PUBLISHED">Vendor published</option></select></div>
            <div class="field wide"><label for="r-src">Source URL @if (f.basis === 'VENDOR_PUBLISHED') { (required) }</label><input id="r-src" name="src" type="url" [(ngModel)]="f.sourceUrl" /></div>
            <div class="field wide"><label for="r-note">Basis note</label><input id="r-note" name="note" type="text" [(ngModel)]="f.basisNote" /></div>
          </div>
          <button class="btn btn--primary btn--sm" type="submit" [disabled]="busy()">Save</button>
          <button class="btn btn--secondary btn--sm" type="button" (click)="form.set(null)">Cancel</button>
        </form>
      }

      <div class="table-wrap">
        <table class="grid">
          <caption class="sr-only">Applications</caption>
          <thead><tr><th scope="col">Application</th><th scope="col">Category</th><th scope="col" class="num">Memory min / pref</th><th scope="col" class="num">CPU / GPU</th><th scope="col">Basis</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            @for (a of apps(); track a.id) {
              <tr [class.off]="!a.isActive">
                <td><strong>{{ a.name }}</strong>@if (!a.macSupported) { <span class="badge badge--bad">not on macOS</span> }</td>
                <td>{{ a.category }}</td>
                <td class="num">{{ a.requirements?.minRamGB }} / {{ a.requirements?.preferredRamGB }} GB</td>
                <td class="num">{{ a.requirements?.cpuDemand }} / {{ a.requirements?.gpuDemand }}</td>
                <td><span class="badge" [class.badge--ok]="a.requirements?.basis === 'VENDOR_PUBLISHED'">{{ a.requirements?.basis === 'VENDOR_PUBLISHED' ? 'vendor' : 'estimate' }}</span></td>
                <td><span class="badge" [class.badge--ok]="a.isActive">{{ a.isActive ? 'active' : 'hidden' }}</span></td>
                <td class="nowrap"><button type="button" class="link" (click)="edit(a)">Edit</button> · <button type="button" class="link" (click)="toggle(a)">{{ a.isActive ? 'Hide' : 'Show' }}</button></td>
              </tr>
            } @empty { <tr><td colspan="7" class="empty">{{ aLoaded() ? 'No applications match.' : 'Loading…' }}</td></tr> }
          </tbody>
        </table>
      </div>
      <div class="pager"><span>{{ total() }} applications</span>
        <button type="button" class="btn btn--secondary btn--sm" [disabled]="page() <= 1" (click)="load(page() - 1)">Previous</button><span>Page {{ page() }} of {{ pages() }}</span>
        <button type="button" class="btn btn--secondary btn--sm" [disabled]="page() >= pages()" (click)="load(page() + 1)">Next</button></div>
    }

    @if (tab() === 'uc') {
      <p class="muted">Each value multiplies that category's weight for people who pick the use case (1 = no change; blank = 1). With several use cases chosen, their multipliers are averaged.</p>
      @for (u of useCases(); track u.id) {
        <details class="panel">
          <summary><strong>{{ u.name }}</strong> <span class="muted small">{{ u.description }}</span></summary>
          <div class="form-grid mt">
            @for (c of weightCats; track c) {
              <div class="field"><label [for]="'w-' + u.id + c">{{ c }}</label><input [id]="'w-' + u.id + c" type="number" step="0.1" min="0.1" max="3" [ngModel]="ucDraft(u)[c]" (ngModelChange)="ucDraft(u)[c] = $event" placeholder="1" /></div>
            }
            <div class="field wide"><label [for]="'cats-' + u.id">Suggested app categories (comma separated)</label><input [id]="'cats-' + u.id" type="text" [ngModel]="ucCats(u)" (ngModelChange)="ucCatDraft[u.id] = $event" /></div>
            <div class="field wide"><label [for]="'starter-' + u.id">Starter apps: preselected when a visitor starts from this use case (application slugs, comma separated)</label><input [id]="'starter-' + u.id" type="text" [ngModel]="ucStarter(u)" (ngModelChange)="ucStarterDraft[u.id] = $event" placeholder="vscode, docker-desktop" /></div>
          </div>
          <button type="button" class="btn btn--primary btn--sm" (click)="saveUc(u)">Save use case</button>
        </details>
      }
    }
  `,
})
export class AdminApplications implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly tab = signal<'apps' | 'uc'>('apps');
  protected readonly msg = signal('');
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly aLoaded = signal(false);
  protected readonly apps = signal<App[]>([]);
  protected readonly categories = signal<string[]>([]);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);
  protected readonly total = signal(0);
  protected readonly form = signal<AppForm | null>(null);
  protected readonly useCases = signal<UseCase[]>([]);
  protected readonly weightCats = CATEGORIES;
  protected q = '';
  protected cat = '';
  protected inactive = false;
  private readonly ucDrafts: Record<string, Record<string, number | null | ''>> = {};
  protected ucCatDraft: Record<string, string> = {};
  protected ucStarterDraft: Record<string, string> = {};

  ngOnInit() {
    this.api.get<{ data: { name: string }[] }>('/applications', { pageSize: 100, includeInactive: true }).subscribe({ next: (r) => this.categories.set([...new Set(r.data.map((a) => (a as unknown as App).category))].sort()) });
    this.load(1);
    this.api.get<{ data: UseCase[] }>('/use-cases').subscribe({ next: (r) => this.useCases.set(r.data), error: (e) => this.errors.set(errorLines(e)) });
  }

  private seq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  /** Waits for a pause in typing before querying. */
  protected onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(1), 250);
  }

  protected load(page: number) {
    const id = ++this.seq;
    this.api.get<Paged<App>>('/applications', { page, pageSize: 25, q: this.q, category: this.cat, includeInactive: this.inactive }).subscribe({
      next: (r) => { if (id !== this.seq) return; this.apps.set(r.data); this.page.set(r.pagination.page); this.pages.set(r.pagination.totalPages); this.total.set(r.pagination.total); this.aLoaded.set(true); },
      error: (e) => { this.aLoaded.set(true); this.errors.set(errorLines(e)); },
    });
  }

  protected startNew() { this.clear(); this.form.set(blank()); }
  protected edit(a: App) {
    this.clear();
    const r = a.requirements;
    this.form.set({ ...blank(), id: a.id, slug: a.slug, name: a.name, category: a.category, macSupported: a.macSupported, aliases: a.aliases.join(', '), notes: a.notes ?? '', isActive: a.isActive, ...(r ? { minRamGB: r.minRamGB, preferredRamGB: r.preferredRamGB, cpuDemand: r.cpuDemand, gpuDemand: r.gpuDemand, storageGB: r.storageGB, intensity: r.intensity, concurrencyFactor: r.concurrencyFactor, needsAppleSilicon: r.needsAppleSilicon, basis: r.basis, basisNote: r.basisNote ?? '', sourceUrl: r.sourceUrl ?? '' } : {}) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected save() {
    const f = this.form();
    if (!f) return;
    this.clear();
    this.busy.set(true);
    const requirements = { minRamGB: Number(f.minRamGB), preferredRamGB: Number(f.preferredRamGB), cpuDemand: Number(f.cpuDemand), gpuDemand: Number(f.gpuDemand), storageGB: Number(f.storageGB), intensity: f.intensity, concurrencyFactor: Number(f.concurrencyFactor), needsAppleSilicon: f.needsAppleSilicon, basis: f.basis, basisNote: f.basisNote.trim() || null, sourceUrl: f.sourceUrl.trim() || null };
    const aliases = f.aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    const done = (t: string) => { this.busy.set(false); this.form.set(null); this.msg.set(t); this.load(this.page()); };
    const fail = (e: unknown) => { this.busy.set(false); this.errors.set(errorLines(e)); };
    if (f.id) {
      this.api.patch(`/applications/${f.id}`, { name: f.name.trim(), category: f.category.trim(), macSupported: f.macSupported, aliases, notes: f.notes.trim() || null, isActive: f.isActive, requirements }).subscribe({ next: () => done('Application saved.'), error: fail });
    } else {
      this.api.post('/applications', { slug: f.slug.trim(), name: f.name.trim(), category: f.category.trim(), macSupported: f.macSupported, aliases, ...(f.notes.trim() ? { notes: f.notes.trim() } : {}), requirements: { ...requirements, basisNote: requirements.basisNote ?? undefined, sourceUrl: requirements.sourceUrl ?? undefined } }).subscribe({ next: () => done('Application created.'), error: fail });
    }
  }

  protected toggle(a: App) {
    this.clear();
    this.api.patch(`/applications/${a.id}`, { isActive: !a.isActive }).subscribe({ next: () => { this.msg.set(a.isActive ? 'Application hidden from the questionnaire.' : 'Application visible again.'); this.load(this.page()); }, error: (e) => this.errors.set(errorLines(e)) });
  }

  // ---- use cases
  protected ucDraft(u: UseCase) { return (this.ucDrafts[u.id] ??= { ...u.weights }); }
  protected ucStarter(u: UseCase) { return (this.ucStarterDraft[u.id] ??= u.starterApps.join(', ')); }
  protected ucCats(u: UseCase) { return (this.ucCatDraft[u.id] ??= u.appCategories.join(', ')); }
  protected saveUc(u: UseCase) {
    this.clear();
    const weights: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.ucDraft(u))) if (v !== '' && v !== null && v !== undefined && Number(v) !== 1) weights[k] = Number(v);
    const appCategories = this.ucCats(u).split(',').map((c) => c.trim()).filter(Boolean);
    const starterApps = this.ucStarter(u).split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
    this.api.patch<UseCase>(`/use-cases/${u.id}`, { weights, appCategories, starterApps }).subscribe({
      next: (r) => { this.msg.set(`${u.name} saved.`); this.useCases.update((list) => list.map((x) => (x.id === u.id ? r : x))); delete this.ucDrafts[u.id]; delete this.ucCatDraft[u.id]; delete this.ucStarterDraft[u.id]; },
      error: (e) => this.errors.set(errorLines(e)),
    });
  }

  private clear() { this.msg.set(''); this.errors.set([]); }
}
