import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, Paged } from '../core/admin-api.service';
import { errorLines } from '../core/admin-http';

interface Chip { id: string; name: string; family: string; tier: string; cpuCores: number; superCores: number | null; performanceCores: number | null; efficiencyCores: number | null; gpuCores: number; neuralEngineCores: number | null; memoryBandwidthGBs: number | null; maxMemoryGB: number | null; cpuPerfIndex: number; gpuPerfIndex: number; perfIndexBasis: string | null; source: string; sourceUrl: string | null; configurationCount: number }
interface Model { id: string; slug: string; name: string; category: string; generation: string; releaseYear: number; modelIdentifier: string | null; screenSizeInch: number; imageUrl: string | null; officialSpecUrl: string | null; isActive: boolean; configurationCount: number }
interface Spec { displayTech?: string | null; displayResolution?: string | null; refreshRateHz?: number | null; brightnessNits?: number | null; batteryWh?: number | null; batteryLifeHours?: number | null; weightKg?: number | null; wireless?: string | null; camera?: string | null; audio?: string | null; externalDisplays?: string | null; ports?: string[] }
interface Config { id: string; label: string; sku: string | null; isActive: boolean; verification: string; source: string; colors: string[]; offerCount: number; model: { id: string; name: string }; chip: { id: string; name: string }; cpuCores: number; gpuCores: number; ramGB: number; storageGB: number; specification: Spec | null }

interface ConfigForm { id: string | null; label: string; modelId: string; chipId: string; cpuCores: number | null; gpuCores: number | null; ramGB: number | null; storageGB: number | null; sku: string; colors: string; verification: string; isActive: boolean; ports: string; spec: Spec }
interface ModelForm { id: string | null; slug: string; name: string; category: string; generation: string; releaseYear: number; screenSizeInch: number; modelIdentifier: string; officialSpecUrl: string; imageUrl: string; isActive: boolean }
interface ChipForm { id: string | null; name: string; family: string; tier: string; cpuCores: number | null; superCores: number | null; performanceCores: number | null; efficiencyCores: number | null; gpuCores: number | null; neuralEngineCores: number | null; memoryBandwidthGBs: number | null; maxMemoryGB: number | null; cpuPerfIndex: number | null; gpuPerfIndex: number | null; perfIndexBasis: string; sourceUrl: string }

const orNull = <T,>(v: T | '' | undefined | null): T | null => (v === '' || v === undefined || v === null ? null : v);
const numOrNull = (v: unknown): number | null => (v === '' || v === undefined || v === null ? null : Number(v));

@Component({
  selector: 'app-admin-catalog',
  imports: [FormsModule],
  styleUrl: '../admin-common.scss',
  template: `
    <h1>Catalog</h1>
    <p class="lead">Models, exact hardware configurations and chips. Deactivating hides an item from the public site without deleting it.</p>
    @if (msg()) { <div class="alert alert--ok" role="status">{{ msg() }}</div> }
    @if (errors().length) { <div class="alert alert--error" role="alert"><ul>@for (l of errors(); track l) { <li>{{ l }}</li> }</ul></div> }

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.on]="tab() === 'configs'" [attr.aria-selected]="tab() === 'configs'" (click)="setTab('configs')">Configurations</button>
      <button type="button" role="tab" [class.on]="tab() === 'models'" [attr.aria-selected]="tab() === 'models'" (click)="setTab('models')">Models</button>
      <button type="button" role="tab" [class.on]="tab() === 'chips'" [attr.aria-selected]="tab() === 'chips'" (click)="setTab('chips')">Chips</button>
    </div>

    <!-- ===================== CONFIGURATIONS ===================== -->
    @if (tab() === 'configs') {
      <div class="toolbar">
        <div class="field"><label for="cm">Model</label><select id="cm" [(ngModel)]="cfModel" (ngModelChange)="loadConfigs(1)"><option value="">All models</option>@for (m of allModels(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }</select></div>
        <div class="field"><label for="cv">Verification</label><select id="cv" [(ngModel)]="cfVer" (ngModelChange)="loadConfigs(1)"><option value="">All</option><option value="STORE_CONFIRMED">Store confirmed</option><option value="CTO_DERIVED">Configure-to-order</option><option value="ADMIN_VERIFIED">Admin verified</option></select></div>
        <label class="checkline"><input type="checkbox" [(ngModel)]="cfInactive" (ngModelChange)="loadConfigs(1)" /> Include deactivated</label>
        <span class="grow"></span>
        <button type="button" class="btn btn--primary btn--sm" (click)="newConfig()">Add configuration</button>
      </div>

      @if (cform(); as f) {
        <form class="panel" (ngSubmit)="saveConfig()">
          <h2>{{ f.id ? 'Edit configuration' : 'New configuration' }}</h2>
          <div class="form-grid">
            @if (!f.id) {
              <div class="field"><label for="f-model">Model</label><select id="f-model" name="model" [(ngModel)]="f.modelId"><option value="">Choose…</option>@for (m of allModels(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }</select></div>
              <div class="field"><label for="f-chip">Chip</label><select id="f-chip" name="chip" [(ngModel)]="f.chipId"><option value="">Choose…</option>@for (c of chips(); track c.id) { <option [value]="c.id">{{ c.name }} (max {{ c.cpuCores }}c/{{ c.gpuCores }}g)</option> }</select></div>
              <div class="field"><label for="f-cpu">CPU cores</label><input id="f-cpu" name="cpu" type="number" min="1" [(ngModel)]="f.cpuCores" /></div>
              <div class="field"><label for="f-gpu">GPU cores</label><input id="f-gpu" name="gpu" type="number" min="1" [(ngModel)]="f.gpuCores" /></div>
              <div class="field"><label for="f-ram">Memory (GB)</label><input id="f-ram" name="ram" type="number" min="1" [(ngModel)]="f.ramGB" /></div>
              <div class="field"><label for="f-sto">Storage (GB, 1TB = 1024)</label><input id="f-sto" name="sto" type="number" min="1" [(ngModel)]="f.storageGB" /></div>
            } @else { <div class="field wide"><span class="lbl">Hardware (fixed)</span><div>{{ f.label }}</div></div> }
            <div class="field"><label for="f-sku">Apple part number / SKU</label><input id="f-sku" name="sku" type="text" [(ngModel)]="f.sku" /></div>
            <div class="field"><label for="f-col">Finishes (comma separated)</label><input id="f-col" name="col" type="text" [(ngModel)]="f.colors" /></div>
            <div class="field"><label for="f-ver">Verification</label><select id="f-ver" name="ver" [(ngModel)]="f.verification"><option value="STORE_CONFIRMED">Store confirmed</option><option value="CTO_DERIVED">Configure-to-order (derived)</option><option value="ADMIN_VERIFIED">Admin verified</option></select></div>
            <label class="checkline"><input type="checkbox" name="act" [(ngModel)]="f.isActive" /> Active (visible publicly)</label>
          </div>
          <h3>Specifications for this configuration</h3>
          <div class="form-grid">
            <div class="field"><label for="s-dt">Display technology</label><input id="s-dt" name="dt" type="text" [(ngModel)]="f.spec.displayTech" /></div>
            <div class="field"><label for="s-dr">Resolution</label><input id="s-dr" name="dr" type="text" [(ngModel)]="f.spec.displayResolution" /></div>
            <div class="field"><label for="s-rr">Refresh rate (Hz)</label><input id="s-rr" name="rr" type="number" [(ngModel)]="f.spec.refreshRateHz" /></div>
            <div class="field"><label for="s-br">Brightness (nits)</label><input id="s-br" name="br" type="number" [(ngModel)]="f.spec.brightnessNits" /></div>
            <div class="field"><label for="s-wh">Battery (Wh)</label><input id="s-wh" name="wh" type="number" step="0.1" [(ngModel)]="f.spec.batteryWh" /></div>
            <div class="field"><label for="s-bh">Battery video hours (Apple claim)</label><input id="s-bh" name="bh" type="number" step="0.5" [(ngModel)]="f.spec.batteryLifeHours" /></div>
            <div class="field"><label for="s-kg">Weight (kg)</label><input id="s-kg" name="kg" type="number" step="0.01" [(ngModel)]="f.spec.weightKg" /></div>
            <div class="field"><label for="s-wl">Wireless</label><input id="s-wl" name="wl" type="text" [(ngModel)]="f.spec.wireless" /></div>
            <div class="field wide"><label for="s-pt">Ports (comma separated)</label><input id="s-pt" name="pt" type="text" [(ngModel)]="f.ports" /></div>
          </div>
          <button class="btn btn--primary btn--sm" type="submit" [disabled]="busy()">Save</button>
          <button class="btn btn--secondary btn--sm" type="button" (click)="cform.set(null)">Cancel</button>
        </form>
      }

      <div class="table-wrap">
        <table class="grid">
          <caption class="sr-only">Configurations</caption>
          <thead><tr><th scope="col">Configuration</th><th scope="col">SKU</th><th scope="col">Verification</th><th scope="col" class="num">Offers</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            @for (c of configs(); track c.id) {
              <tr [class.off]="!c.isActive">
                <td><strong>{{ c.model.name }}</strong><div class="muted small">{{ c.label }}</div></td>
                <td class="muted nowrap">{{ c.sku ?? '–' }}</td>
                <td><span class="badge" [class.badge--ok]="c.verification !== 'CTO_DERIVED'">{{ c.verification.replace('_', ' ').toLowerCase() }}</span></td>
                <td class="num">{{ c.offerCount }}</td>
                <td><span class="badge" [class.badge--ok]="c.isActive">{{ c.isActive ? 'active' : 'hidden' }}</span></td>
                <td class="nowrap"><button type="button" class="link" (click)="editConfig(c)">Edit</button> · <button type="button" class="link" (click)="toggleConfig(c)">{{ c.isActive ? 'Hide' : 'Show' }}</button></td>
              </tr>
            } @empty { <tr><td colspan="6" class="empty">{{ cLoaded() ? 'No configurations match.' : 'Loading…' }}</td></tr> }
          </tbody>
        </table>
      </div>
      <div class="pager"><span>{{ cTotal() }} configurations</span>
        <button type="button" class="btn btn--secondary btn--sm" [disabled]="cPage() <= 1" (click)="loadConfigs(cPage() - 1)">Previous</button><span>Page {{ cPage() }} of {{ cPages() }}</span>
        <button type="button" class="btn btn--secondary btn--sm" [disabled]="cPage() >= cPages()" (click)="loadConfigs(cPage() + 1)">Next</button></div>
    }

    <!-- ===================== MODELS ===================== -->
    @if (tab() === 'models') {
      <div class="toolbar"><span class="grow"></span><button type="button" class="btn btn--primary btn--sm" (click)="newModel()">Add model</button></div>
      @if (mform(); as f) {
        <form class="panel" (ngSubmit)="saveModel()">
          <h2>{{ f.id ? 'Edit model' : 'New model' }}</h2>
          <div class="form-grid">
            @if (!f.id) { <div class="field"><label for="m-slug">Slug</label><input id="m-slug" name="slug" type="text" [(ngModel)]="f.slug" placeholder="macbook-air-13-m6-2027" /></div> }
            <div class="field wide"><label for="m-name">Name</label><input id="m-name" name="name" type="text" [(ngModel)]="f.name" /></div>
            <div class="field"><label for="m-cat">Category</label><select id="m-cat" name="cat" [(ngModel)]="f.category"><option>MacBook Air</option><option>MacBook Pro</option></select></div>
            <div class="field"><label for="m-gen">Generation</label><input id="m-gen" name="gen" type="text" [(ngModel)]="f.generation" placeholder="M6" /></div>
            <div class="field"><label for="m-yr">Release year</label><input id="m-yr" name="yr" type="number" [(ngModel)]="f.releaseYear" /></div>
            <div class="field"><label for="m-sz">Screen size (inch)</label><input id="m-sz" name="sz" type="number" step="0.1" [(ngModel)]="f.screenSizeInch" /></div>
            <div class="field"><label for="m-id">Model identifier</label><input id="m-id" name="mid" type="text" [(ngModel)]="f.modelIdentifier" placeholder="Mac18,1" /></div>
            <div class="field wide"><label for="m-spec">Official specification URL (https)</label><input id="m-spec" name="spec" type="url" [(ngModel)]="f.officialSpecUrl" /></div>
            <div class="field wide"><label for="m-img">Image (https link, or a site path like /images/macbook-air-13.webp; only if you have the right to use it)</label><input id="m-img" name="img" type="text" [(ngModel)]="f.imageUrl" /></div>
            <label class="checkline"><input type="checkbox" name="act" [(ngModel)]="f.isActive" /> Active</label>
          </div>
          <button class="btn btn--primary btn--sm" type="submit" [disabled]="busy()">Save</button>
          <button class="btn btn--secondary btn--sm" type="button" (click)="mform.set(null)">Cancel</button>
        </form>
      }
      <div class="table-wrap"><table class="grid"><caption class="sr-only">Models</caption>
        <thead><tr><th scope="col">Model</th><th scope="col">Generation</th><th scope="col">Year</th><th scope="col">Screen</th><th scope="col" class="num">Configs</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
        <tbody>@for (m of models(); track m.id) {
          <tr [class.off]="!m.isActive"><td><strong>{{ m.name }}</strong><div class="muted small">{{ m.slug }}</div></td><td>{{ m.generation }}</td><td>{{ m.releaseYear }}</td><td>{{ m.screenSizeInch }}"</td><td class="num">{{ m.configurationCount }}</td>
            <td><span class="badge" [class.badge--ok]="m.isActive">{{ m.isActive ? 'active' : 'hidden' }}</span></td>
            <td class="nowrap"><button type="button" class="link" (click)="editModel(m)">Edit</button> · <button type="button" class="link" (click)="toggleModel(m)">{{ m.isActive ? 'Hide' : 'Show' }}</button></td></tr>
        }</tbody></table></div>
    }

    <!-- ===================== CHIPS ===================== -->
    @if (tab() === 'chips') {
      <div class="alert alert--warn">CPU/GPU “performance index” values currently come from a core-count proxy, not benchmarks. Replacing them with benchmark-based values (and recording the basis) directly improves the CPU and GPU scores.</div>
      <div class="toolbar"><span class="grow"></span><button type="button" class="btn btn--primary btn--sm" (click)="newChip()">Add chip</button></div>
      @if (kform(); as f) {
        <form class="panel" (ngSubmit)="saveChip()">
          <h2>{{ f.id ? 'Edit chip' : 'New chip' }}</h2>
          <div class="form-grid">
            <div class="field"><label for="k-n">Name</label><input id="k-n" name="n" type="text" [(ngModel)]="f.name" placeholder="M6 Pro" /></div>
            <div class="field"><label for="k-f">Family</label><input id="k-f" name="f" type="text" [(ngModel)]="f.family" placeholder="M6" /></div>
            <div class="field"><label for="k-t">Tier</label><select id="k-t" name="t" [(ngModel)]="f.tier"><option>BASE</option><option>PRO</option><option>MAX</option><option>ULTRA</option></select></div>
            <div class="field"><label for="k-c">Max CPU cores</label><input id="k-c" name="c" type="number" [(ngModel)]="f.cpuCores" /></div>
            <div class="field"><label for="k-sc">Super cores</label><input id="k-sc" name="sc" type="number" [(ngModel)]="f.superCores" /></div>
            <div class="field"><label for="k-pc">Performance cores</label><input id="k-pc" name="pc" type="number" [(ngModel)]="f.performanceCores" /></div>
            <div class="field"><label for="k-ec">Efficiency cores</label><input id="k-ec" name="ec" type="number" [(ngModel)]="f.efficiencyCores" /></div>
            <div class="field"><label for="k-g">Max GPU cores</label><input id="k-g" name="g" type="number" [(ngModel)]="f.gpuCores" /></div>
            <div class="field"><label for="k-ne">Neural Engine cores</label><input id="k-ne" name="ne" type="number" [(ngModel)]="f.neuralEngineCores" /></div>
            <div class="field"><label for="k-bw">Memory bandwidth (GB/s)</label><input id="k-bw" name="bw" type="number" [(ngModel)]="f.memoryBandwidthGBs" /></div>
            <div class="field"><label for="k-mm">Max memory (GB)</label><input id="k-mm" name="mm" type="number" [(ngModel)]="f.maxMemoryGB" /></div>
            <div class="field"><label for="k-ci">CPU performance index (0-100)</label><input id="k-ci" name="ci" type="number" step="0.1" [(ngModel)]="f.cpuPerfIndex" /></div>
            <div class="field"><label for="k-gi">GPU performance index (0-100)</label><input id="k-gi" name="gi" type="number" step="0.1" [(ngModel)]="f.gpuPerfIndex" /></div>
            <div class="field wide"><label for="k-b">How the indices were derived</label><input id="k-b" name="b" type="text" [(ngModel)]="f.perfIndexBasis" placeholder="e.g. Geekbench 7 multi-core median, retrieved 2026-11-01" /></div>
            <div class="field wide"><label for="k-u">Specification source URL (https)</label><input id="k-u" name="u" type="url" [(ngModel)]="f.sourceUrl" /></div>
          </div>
          <button class="btn btn--primary btn--sm" type="submit" [disabled]="busy()">Save</button>
          <button class="btn btn--secondary btn--sm" type="button" (click)="kform.set(null)">Cancel</button>
        </form>
      }
      <div class="table-wrap"><table class="grid"><caption class="sr-only">Chips</caption>
        <thead><tr><th scope="col">Chip</th><th scope="col">Tier</th><th scope="col" class="num">CPU / GPU</th><th scope="col" class="num">CPU idx</th><th scope="col" class="num">GPU idx</th><th scope="col">Index basis</th><th scope="col" class="num">Configs</th><th scope="col">Actions</th></tr></thead>
        <tbody>@for (c of chips(); track c.id) {
          <tr><td><strong>{{ c.name }}</strong></td><td>{{ c.tier }}</td><td class="num">{{ c.cpuCores }} / {{ c.gpuCores }}</td><td class="num">{{ c.cpuPerfIndex }}</td><td class="num">{{ c.gpuPerfIndex }}</td>
            <td class="small muted">{{ c.perfIndexBasis ? c.perfIndexBasis.slice(0, 70) + (c.perfIndexBasis.length > 70 ? '…' : '') : '–' }}</td><td class="num">{{ c.configurationCount }}</td>
            <td><button type="button" class="link" (click)="editChip(c)">Edit</button></td></tr>
        }</tbody></table></div>
    }
  `,
})
export class AdminCatalog implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly tab = signal<'configs' | 'models' | 'chips'>('configs');
  protected readonly msg = signal('');
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly cLoaded = signal(false);

  protected readonly chips = signal<Chip[]>([]);
  protected readonly models = signal<Model[]>([]);
  protected readonly allModels = signal<Model[]>([]);
  protected readonly configs = signal<Config[]>([]);
  protected readonly cPage = signal(1);
  protected readonly cPages = signal(1);
  protected readonly cTotal = signal(0);
  protected cfModel = '';
  protected cfVer = '';
  protected cfInactive = false;

  protected readonly cform = signal<ConfigForm | null>(null);
  protected readonly mform = signal<ModelForm | null>(null);
  protected readonly kform = signal<ChipForm | null>(null);

  ngOnInit() {
    this.loadChips();
    this.loadModels();
    this.loadConfigs(1);
  }

  protected setTab(t: 'configs' | 'models' | 'chips') {
    this.tab.set(t);
    this.clear();
  }

  // ------------------------------------------------------------ loading
  private loadChips() {
    this.api.get<{ data: Chip[] }>('/chips').subscribe({ next: (r) => this.chips.set(r.data), error: (e) => this.errors.set(errorLines(e)) });
  }
  private loadModels() {
    this.api.get<Paged<Model>>('/models', { pageSize: 100, includeInactive: true }).subscribe({ next: (r) => { this.models.set(r.data); this.allModels.set(r.data); }, error: (e) => this.errors.set(errorLines(e)) });
  }
  private seq = 0;

  protected loadConfigs(page: number) {
    const id = ++this.seq;
    this.api.get<Paged<Config>>('/configurations', { page, pageSize: 25, modelId: this.cfModel, verification: this.cfVer, includeInactive: this.cfInactive }).subscribe({
      next: (r) => { if (id !== this.seq) return; this.configs.set(r.data); this.cPage.set(r.pagination.page); this.cPages.set(r.pagination.totalPages); this.cTotal.set(r.pagination.total); this.cLoaded.set(true); },
      error: (e) => { this.cLoaded.set(true); this.errors.set(errorLines(e)); },
    });
  }

  // ------------------------------------------------------ configurations
  protected newConfig() {
    this.clear();
    this.cform.set({ id: null, label: '', modelId: '', chipId: '', cpuCores: null, gpuCores: null, ramGB: null, storageGB: null, sku: '', colors: '', verification: 'ADMIN_VERIFIED', isActive: true, ports: '', spec: {} });
  }
  protected editConfig(c: Config) {
    this.clear();
    const s = c.specification ?? {};
    this.cform.set({ id: c.id, modelId: c.model.id, chipId: c.chip.id, cpuCores: c.cpuCores, gpuCores: c.gpuCores, ramGB: c.ramGB, storageGB: c.storageGB, label: `${c.chip.name} (${c.cpuCores}-core CPU, ${c.gpuCores}-core GPU) · ${c.ramGB}GB · ${c.storageGB >= 1024 ? c.storageGB / 1024 + 'TB' : c.storageGB + 'GB'}`, sku: c.sku ?? '', colors: c.colors.join(', '), verification: c.verification, isActive: c.isActive, ports: (s.ports ?? []).join(', '), spec: { ...s } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  protected saveConfig() {
    const f = this.cform();
    if (!f) return;
    this.clear();
    const s = f.spec;
    const spec = {
      displayTech: orNull(s.displayTech) ?? undefined, displayResolution: orNull(s.displayResolution) ?? undefined, wireless: orNull(s.wireless) ?? undefined,
      refreshRateHz: numOrNull(s.refreshRateHz) ?? undefined, brightnessNits: numOrNull(s.brightnessNits) ?? undefined, batteryWh: numOrNull(s.batteryWh) ?? undefined,
      batteryLifeHours: numOrNull(s.batteryLifeHours) ?? undefined, weightKg: numOrNull(s.weightKg) ?? undefined,
      ...(f.ports.trim() ? { ports: f.ports.split(',').map((p: string) => p.trim()).filter(Boolean) } : {}),
    };
    const colors = f.colors.split(',').map((c: string) => c.trim()).filter(Boolean);
    this.busy.set(true);
    const done = (text: string) => { this.busy.set(false); this.cform.set(null); this.msg.set(text); this.loadConfigs(this.cPage()); };
    const fail = (e: unknown) => { this.busy.set(false); this.errors.set(errorLines(e)); };
    if (f.id) {
      this.api.patch(`/configurations/${f.id}`, { sku: f.sku.trim() || null, colors, verification: f.verification, isActive: f.isActive, spec }).subscribe({ next: () => done('Configuration saved.'), error: fail });
    } else {
      this.api.post('/configurations', { modelId: f.modelId, chipId: f.chipId, cpuCores: Number(f.cpuCores), gpuCores: Number(f.gpuCores), ramGB: Number(f.ramGB), storageGB: Number(f.storageGB), ...(f.sku.trim() ? { sku: f.sku.trim() } : {}), colors, verification: f.verification, isActive: f.isActive, spec }).subscribe({ next: () => done('Configuration created.'), error: fail });
    }
  }
  protected toggleConfig(c: Config) {
    this.clear();
    this.api.patch(`/configurations/${c.id}`, { isActive: !c.isActive }).subscribe({ next: () => { this.msg.set(c.isActive ? 'Configuration hidden from the public site.' : 'Configuration is visible again.'); this.loadConfigs(this.cPage()); }, error: (e) => this.errors.set(errorLines(e)) });
  }

  // --------------------------------------------------------------- models
  protected newModel() { this.clear(); this.mform.set({ id: null, slug: '', name: '', category: 'MacBook Air', generation: '', releaseYear: new Date().getFullYear(), screenSizeInch: 13.6, modelIdentifier: '', officialSpecUrl: '', imageUrl: '', isActive: true }); }
  protected editModel(m: Model) { this.clear(); this.mform.set({ id: m.id, slug: m.slug, name: m.name, category: m.category, generation: m.generation, releaseYear: m.releaseYear, screenSizeInch: m.screenSizeInch, modelIdentifier: m.modelIdentifier ?? '', officialSpecUrl: m.officialSpecUrl ?? '', imageUrl: m.imageUrl ?? '', isActive: m.isActive }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  protected saveModel() {
    const f = this.mform();
    if (!f) return;
    this.clear();
    const body = { name: f.name.trim(), category: f.category, generation: f.generation.trim(), releaseYear: Number(f.releaseYear), screenSizeInch: Number(f.screenSizeInch), modelIdentifier: f.modelIdentifier.trim() || null, officialSpecUrl: f.officialSpecUrl.trim() || null, imageUrl: f.imageUrl.trim() || null, isActive: f.isActive };
    this.busy.set(true);
    const done = () => { this.busy.set(false); this.mform.set(null); this.msg.set('Model saved.'); this.loadModels(); };
    const fail = (e: unknown) => { this.busy.set(false); this.errors.set(errorLines(e)); };
    if (f.id) this.api.patch(`/models/${f.id}`, body).subscribe({ next: done, error: fail });
    else this.api.post('/models', { slug: f.slug.trim(), ...body, modelIdentifier: body.modelIdentifier ?? undefined, officialSpecUrl: body.officialSpecUrl ?? undefined, imageUrl: body.imageUrl ?? undefined }).subscribe({ next: done, error: fail });
  }
  protected toggleModel(m: Model) {
    this.clear();
    this.api.patch(`/models/${m.id}`, { isActive: !m.isActive }).subscribe({ next: () => { this.msg.set(m.isActive ? 'Model hidden.' : 'Model visible.'); this.loadModels(); }, error: (e) => this.errors.set(errorLines(e)) });
  }

  // ---------------------------------------------------------------- chips
  protected newChip() { this.clear(); this.kform.set({ id: null, name: '', family: '', tier: 'BASE', cpuCores: null, superCores: null, performanceCores: null, efficiencyCores: null, gpuCores: null, neuralEngineCores: null, memoryBandwidthGBs: null, maxMemoryGB: null, cpuPerfIndex: null, gpuPerfIndex: null, perfIndexBasis: '', sourceUrl: '' }); }
  protected editChip(c: Chip) { this.clear(); this.kform.set({ id: c.id, name: c.name, family: c.family, tier: c.tier, cpuCores: c.cpuCores, superCores: c.superCores, performanceCores: c.performanceCores, efficiencyCores: c.efficiencyCores, gpuCores: c.gpuCores, neuralEngineCores: c.neuralEngineCores, memoryBandwidthGBs: c.memoryBandwidthGBs, maxMemoryGB: c.maxMemoryGB, cpuPerfIndex: c.cpuPerfIndex, gpuPerfIndex: c.gpuPerfIndex, perfIndexBasis: c.perfIndexBasis ?? '', sourceUrl: c.sourceUrl ?? '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  protected saveChip() {
    const f = this.kform();
    if (!f) return;
    this.clear();
    const body = {
      name: f.name.trim(), family: f.family.trim(), tier: f.tier, cpuCores: Number(f.cpuCores), gpuCores: Number(f.gpuCores),
      superCores: numOrNull(f.superCores), performanceCores: numOrNull(f.performanceCores), efficiencyCores: numOrNull(f.efficiencyCores),
      neuralEngineCores: numOrNull(f.neuralEngineCores), memoryBandwidthGBs: numOrNull(f.memoryBandwidthGBs), maxMemoryGB: numOrNull(f.maxMemoryGB),
      cpuPerfIndex: Number(f.cpuPerfIndex), gpuPerfIndex: Number(f.gpuPerfIndex), perfIndexBasis: f.perfIndexBasis.trim() || null, sourceUrl: f.sourceUrl.trim() || null,
    };
    this.busy.set(true);
    const done = () => { this.busy.set(false); this.kform.set(null); this.msg.set('Chip saved.'); this.loadChips(); };
    const fail = (e: unknown) => { this.busy.set(false); this.errors.set(errorLines(e)); };
    if (f.id) this.api.patch(`/chips/${f.id}`, { ...body, source: 'ADMIN_VERIFIED' }).subscribe({ next: done, error: fail });
    else this.api.post('/chips', { ...body, source: 'ADMIN_VERIFIED' }).subscribe({ next: done, error: fail });
  }

  private clear() { this.msg.set(''); this.errors.set([]); }
}
