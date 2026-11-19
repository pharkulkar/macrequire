import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../core/admin-api.service';
import { errorLines } from '../core/admin-http';

interface Merchant { id: string; slug: string; name: string; country: string; isActive: boolean }
interface RowResult { imageUrl?: string; row: number; key: string; status: 'create' | 'update' | 'unchanged' | 'error'; message?: string }
interface ImportResult {
  kind: string; dryRun: boolean; applied: boolean; blocked: boolean; message: string;
  totals: { rows: number; create: number; update: number; unchanged: number; error: number };
  results: RowResult[];
}

@Component({
  selector: 'app-admin-imports',
  imports: [FormsModule],
  styleUrl: '../admin-common.scss',
  styles: `.thumb { width: 120px; height: 90px; object-fit: contain; background: #f5f5f7; border-radius: 8px; display: block; } .bad { color: #b3261e; }`,
  template: `
    <h1>CSV imports</h1>
    <p class="lead">Load prices, configurations or product images in bulk. Always <strong>preview first</strong>: a preview changes nothing and shows exactly what would happen to every row.</p>
    @if (errors().length) { <div class="alert alert--error" role="alert"><ul>@for (l of errors(); track l) { <li>{{ l }}</li> }</ul></div> }

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.on]="kind() === 'offers'" [attr.aria-selected]="kind() === 'offers'" (click)="setKind('offers')">Prices &amp; offers</button>
      <button type="button" role="tab" [class.on]="kind() === 'configurations'" [attr.aria-selected]="kind() === 'configurations'" (click)="setKind('configurations')">Configurations</button>
      <button type="button" role="tab" [class.on]="kind() === 'images'" [attr.aria-selected]="kind() === 'images'" (click)="setKind('images')">Product images</button>
    </div>

    <div class="panel">
      <h2>1. Get the template</h2>
      @if (kind() === 'offers') {
        <p class="muted small">The template lists every active configuration for the merchant you pick, with its current price filled in. Enter or edit prices in a spreadsheet and keep the other columns as they are. Blank cells mean “leave as it is”. New offers need a <code>productId</code> (the ASIN for Amazon) or a <code>regularUrl</code>. Leave <code>affiliateUrl</code> empty: links are built from the merchant's affiliate ID (Merchants → Link settings). Prices are in the merchant's currency, before tax.</p>
        <div class="toolbar">
          <div class="field"><label for="im">Merchant</label>
            <select id="im" [(ngModel)]="merchant"><option value="">Choose…</option>@for (m of merchants(); track m.id) { <option [value]="m.slug">{{ m.name }} ({{ m.country }})</option> }</select></div>
          <button type="button" class="btn btn--secondary btn--sm" (click)="downloadTemplate()" [disabled]="!merchant">Download template</button>
        </div>
      } @else if (kind() === 'images') {
        <p class="muted small">One row per model (columns <code>modelSlug</code>, <code>name</code>, <code>imageUrl</code>). Put a public https image link, or a path to a file on this site such as <code>/images/macbook-air-13.webp</code>, in <code>imageUrl</code>. Blank leaves the current image; write <code>CLEAR</code> to remove it. Images are per model, so every configuration of a model shares one photo. Only use images you have the right to show. The preview below displays each image so you can see whether the link works.</p>
        <button type="button" class="btn btn--secondary btn--sm" (click)="downloadTemplate()">Download model list</button>
      } @else {
        <p class="muted small">Exports all configurations. Add rows for new combinations (model slug and chip must already exist). New configurations copy their specifications from a sibling with the same model and chip when one exists.</p>
        <button type="button" class="btn btn--secondary btn--sm" (click)="downloadTemplate()">Download current configurations</button>
      }
    </div>

    <div class="panel">
      <h2>2. Add your file</h2>
      <div class="toolbar">
        <div class="field"><label for="file">CSV file</label><input id="file" type="file" accept=".csv,text/csv" (change)="onFile($event)" /></div>
        @if (fileName()) { <span class="muted small">{{ fileName() }} · {{ csvLength() }} characters</span> }
      </div>
      <div class="field"><label for="paste">…or paste CSV</label><textarea id="paste" rows="5" spellcheck="false" [(ngModel)]="csv" (ngModelChange)="onEdit()"></textarea></div>
    </div>

    <div class="panel">
      <h2>3. Preview, then import</h2>
      <div class="toolbar">
        <button type="button" class="btn btn--secondary btn--sm" (click)="run(true)" [disabled]="!csv.trim() || busy()">{{ busy() && lastDry() ? 'Checking…' : 'Preview (no changes)' }}</button>
        <button type="button" class="btn btn--primary btn--sm" (click)="run(false)" [disabled]="!canImport() || busy()">{{ busy() && !lastDry() ? 'Importing…' : 'Import' }}</button>
        <label class="checkline"><input type="checkbox" [(ngModel)]="skipInvalid" /> Skip invalid rows (otherwise any error cancels the whole import)</label>
      </div>
      @if (!previewed()) { <p class="muted small">Import unlocks after a preview of this exact file.</p> }

      @if (result(); as r) {
        <div class="alert" [class.alert--ok]="!r.blocked && r.totals.error === 0" [class.alert--warn]="r.totals.error > 0 && !r.blocked" [class.alert--error]="r.blocked" role="status">
          <strong>{{ r.message }}</strong>
          <div class="small">{{ r.totals.rows }} rows · {{ r.totals.create }} to create · {{ r.totals.update }} to update · {{ r.totals.unchanged }} unchanged · {{ r.totals.error }} with errors</div>
        </div>
        <div class="table-wrap">
          <table class="grid">
            <caption class="sr-only">Import results by row</caption>
            <thead><tr><th scope="col" class="num">Row</th><th scope="col">Item</th><th scope="col">Result</th><th scope="col">Details</th></tr></thead>
            <tbody>
              @for (x of shown(); track x.row) {
                <tr><td class="num">{{ x.row }}</td><td>{{ x.key }}</td>
                  <td><span class="badge" [class.badge--ok]="x.status === 'create' || x.status === 'update'" [class.badge--bad]="x.status === 'error'">{{ x.status }}</span></td>
                  <td class="small" [class.muted]="x.status !== 'error'">
                    @if (x.imageUrl) {
                      <img class="thumb" [src]="x.imageUrl" alt="" loading="lazy" referrerpolicy="no-referrer" (load)="mark(x.row, true)" (error)="mark(x.row, false)" />
                      @if (broken().has(x.row)) { <strong class="bad">This link did not load as an image.</strong> }
                    } @else { {{ x.message ?? '' }} }
                  </td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (r.results.length > shown().length || onlyIssues()) {
          <button type="button" class="link mt" (click)="onlyIssues.set(!onlyIssues())">{{ onlyIssues() ? 'Show all ' + r.results.length + ' rows' : 'Show only rows with errors or changes' }}</button>
        }
      }
    </div>
  `,
})
export class AdminImports implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly kind = signal<'offers' | 'configurations' | 'images'>('offers');
  protected readonly broken = signal<Set<number>>(new Set());
  protected readonly merchants = signal<Merchant[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly lastDry = signal(true);
  protected readonly result = signal<ImportResult | null>(null);
  protected readonly fileName = signal('');
  protected readonly onlyIssues = signal(true);
  /** The CSV text that was last previewed, so Import is only possible for exactly that content. */
  private readonly previewedCsv = signal<string | null>(null);

  protected merchant = '';
  protected csv = '';
  protected skipInvalid = false;

  protected readonly csvLength = computed(() => this.csv.length);
  protected readonly previewed = computed(() => this.previewedCsv() !== null && this.previewedCsv() === this.csv);
  protected readonly shown = computed(() => {
    const r = this.result();
    if (!r) return [];
    return this.onlyIssues() ? r.results.filter((x) => x.status !== 'unchanged') : r.results;
  });
  protected canImport() {
    const r = this.result();
    return this.previewed() && !!r && (r.totals.create + r.totals.update > 0) && (r.totals.error === 0 || this.skipInvalid);
  }

  ngOnInit() {
    this.api.get<{ data: Merchant[] }>('/merchants').subscribe((r) => this.merchants.set(r.data));
  }

  protected setKind(k: 'offers' | 'configurations' | 'images') {
    this.kind.set(k);
    this.reset();
  }
  protected mark(row: number, ok: boolean) {
    this.broken.update((s) => { const n = new Set(s); if (ok) n.delete(row); else n.add(row); return n; });
  }
  private reset() {
    this.broken.set(new Set());
    this.result.set(null);
    this.previewedCsv.set(null);
    this.errors.set([]);
    this.csv = '';
    this.fileName.set('');
  }
  protected onEdit() {
    this.result.set(null);
  }

  protected downloadTemplate() {
    const k = this.kind();
    const req = k === 'offers' ? this.api.text('/imports/offers/template', { merchant: this.merchant }) : this.api.text(`/imports/${k}/template`);
    req.subscribe({
      next: (text) => {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = this.kind() === 'offers' ? `offers-${this.merchant}.csv` : this.kind() === 'images' ? 'model-images.csv' : 'configurations.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => this.errors.set(errorLines(e)),
    });
  }

  protected async onFile(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) {
      this.errors.set(['That file is larger than 3 MB.']);
      return;
    }
    this.csv = await file.text();
    this.fileName.set(file.name);
    this.result.set(null);
    this.errors.set([]);
  }

  protected run(dryRun: boolean) {
    this.errors.set([]);
    this.busy.set(true);
    this.lastDry.set(dryRun);
    const path = `/imports/${this.kind()}`;
    const sent = this.csv;
    this.api.post<ImportResult>(path, { csv: sent, dryRun, skipInvalid: this.skipInvalid }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.broken.set(new Set());
        this.result.set(r);
        if (dryRun) this.previewedCsv.set(sent);
        else this.previewedCsv.set(null); // import done: preview again before importing more
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        if (e.status === 422 && e.error?.results) {
          this.result.set(e.error as ImportResult);
          return;
        }
        this.errors.set(errorLines(e));
      },
    });
  }
}
