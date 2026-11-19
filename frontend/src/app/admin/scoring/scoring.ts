import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';
import { errorLines } from '../core/admin-http';

interface SetSummary { id: string; name: string; isActive: boolean; updatedAt: string; rulesVersion: string | null; codeVersion: string }
interface SetDetail extends SetSummary { weights: Record<string, number>; rules: Record<string, unknown> }
interface SampleProfile { key: string; name: string; description: string; profile: Record<string, unknown> }
interface Cat { key: string; score: number; weight: number; contribution: number; applicable: boolean }
interface Match { configurationId: string; label: string; finalScore: number; labels: string[]; categories: Cat[]; penalties: { code: string }[] }
interface Output { engineVersion: string; workload: { ram: { targetGB: number; minimumGB: number; futureGB: number } } | null; warnings: { code: string; message: string }[]; matches: Match[]; stretch: Match[] }
interface Preview { current: Output; candidate: Output; changes: { configurationId: string; label: string; currentRank: number | null; candidateRank: number | null; currentScore: number | null; candidateScore: number | null }[]; identical: boolean }

const WEIGHT_KEYS = [
  ['cpu', 'CPU performance'], ['gpu', 'GPU performance'], ['ram', 'Memory (RAM)'], ['storage', 'Storage'], ['compatibility', 'Application compatibility'],
  ['budget', 'Budget'], ['portability', 'Portability'], ['battery', 'Battery'], ['future', 'Future-proofing'], ['display', 'Display (only counts when the user states a preference)'],
] as const;

@Component({
  selector: 'app-admin-scoring',
  imports: [FormsModule],
  styleUrl: '../admin-common.scss',
  template: `
    <h1>Scoring engine</h1>
    <p class="lead">Weights and rules decide every recommendation. Edit them, <strong>preview</strong> the effect on test users, and only then save and activate. Invalid values are rejected before they can break anything.</p>
    @if (msg()) { <div class="alert alert--ok" role="status">{{ msg() }}</div> }
    @if (errors().length) { <div class="alert alert--error" role="alert"><ul>@for (l of errors(); track l) { <li>{{ l }}</li> }</ul></div> }
    @if (!auth.isAdmin()) { <div class="alert alert--warn">Only ADMINs can save or activate rule sets. You can still edit and preview.</div> }

    <div class="toolbar">
      <div class="field"><label for="rs">Rule set</label>
        <select id="rs" [ngModel]="selectedId()" (ngModelChange)="select($event)">
          @for (s of sets(); track s.id) { <option [value]="s.id">{{ s.name }}{{ s.isActive ? ' (live)' : '' }}</option> }
        </select></div>
      @if (detail(); as d) {
        @if (d.isActive) { <span class="badge badge--ok">live</span> } @else { <span class="badge badge--warn">not live</span> }
        @if (d.rulesVersion !== d.codeVersion) { <span class="badge badge--warn" title="This set was saved under an older rules schema; saving upgrades it, filling any new settings with defaults.">schema {{ d.rulesVersion ?? 'unknown' }} → {{ d.codeVersion }}</span> }
      }
      <span class="grow"></span>
      @if (auth.isAdmin()) {
        <div class="field"><label for="nn">New set name</label><input id="nn" type="text" [(ngModel)]="newName" placeholder="e.g. Stronger memory emphasis" /></div>
        <button type="button" class="btn btn--secondary btn--sm" (click)="clone()" [disabled]="!newName.trim()">Clone selected</button>
      }
    </div>

    @if (detail(); as d) {
      <div class="cols">
        <div class="panel">
          <h2>Category weights</h2>
          <p class="muted small">Relative importance. Only the proportions matter. Users' use cases and preferences scale these further.</p>
          <div class="form-grid">
            @for (k of weightKeys; track k[0]) {
              <div class="field"><label [for]="'w-' + k[0]">{{ k[1] }}</label><input [id]="'w-' + k[0]" type="number" min="0" max="100" step="1" [(ngModel)]="weights[k[0]]" /></div>
            }
          </div>
          <p class="small muted">Core total: <strong>{{ coreTotal() }}</strong> (the nine core categories).</p>
        </div>
        <div class="panel">
          <h2>Rules (advanced)</h2>
          <p class="muted small">JSON. Thresholds, penalties, curves and limits. Changes are validated by the server; “version” is managed automatically.</p>
          <label class="sr-only" for="rules-json">Rules JSON</label>
          <textarea id="rules-json" rows="22" spellcheck="false" [(ngModel)]="rulesText" aria-describedby="rules-help"></textarea>
          <p id="rules-help" class="small muted">Curves are lists of [x, y] points with increasing x and y between 0 and 100.</p>
          <button type="button" class="link" (click)="resetToDefaults()">Load built-in defaults into the editor</button>
        </div>
      </div>

      <div class="panel">
        <div class="spread">
          <div><h2>Preview on a test user</h2><p class="muted small">Runs the engine with your unsaved edits next to the live rules. Nothing is saved and nothing is counted in analytics.</p></div>
          <div class="toolbar">
            <div class="field"><label for="sp">Test user</label>
              <select id="sp" [(ngModel)]="sampleKey"><option value="">Choose…</option>@for (s of samples(); track s.key) { <option [value]="s.key">{{ s.name }}</option> }</select></div>
            <button type="button" class="btn btn--primary btn--sm" (click)="preview()" [disabled]="!sampleKey || previewing()">{{ previewing() ? 'Running…' : 'Preview' }}</button>
          </div>
        </div>
        @if (sampleDesc()) { <p class="muted small">{{ sampleDesc() }}</p> }

        @if (pv(); as p) {
          @if (p.identical) { <div class="alert alert--ok">Your edits do not change the result for this test user.</div> }
          @if (p.candidate.workload; as w) { <p class="small muted">Estimated memory need: ~{{ w.ram.targetGB }}GB comfortable, ~{{ w.ram.minimumGB }}GB to run, ~{{ w.ram.futureGB }}GB over the ownership period.</p> }
          @for (w of p.candidate.warnings; track w.code) { <div class="alert alert--warn">{{ w.message }}</div> }
          <div class="cols">
            <div><h3>Live rules</h3>@for (m of p.current.matches; track m.configurationId; let i = $index) { <div class="mrow"><span class="rk">#{{ i + 1 }}</span><div><strong>{{ m.finalScore }}</strong> {{ m.label }}<div>@for (l of m.labels; track l) { <span class="badge">{{ l }}</span>{{ ' ' }} }@for (pn of m.penalties; track pn.code) { <span class="badge badge--warn">{{ pn.code }}</span>{{ ' ' }} }</div></div></div> }</div>
            <div><h3>With your edits</h3>@for (m of p.candidate.matches; track m.configurationId; let i = $index) { <div class="mrow"><span class="rk">#{{ i + 1 }}</span><div><strong>{{ m.finalScore }}</strong> {{ m.label }}<div>@for (l of m.labels; track l) { <span class="badge">{{ l }}</span>{{ ' ' }} }@for (pn of m.penalties; track pn.code) { <span class="badge badge--warn">{{ pn.code }}</span>{{ ' ' }} }</div></div></div> }</div>
          </div>
          @if (p.changes.length) {
            <h3>What changed</h3>
            <div class="table-wrap"><table class="grid"><thead><tr><th>Configuration</th><th class="num">Rank before → after</th><th class="num">Score before → after</th></tr></thead>
              <tbody>@for (c of p.changes; track c.configurationId) { <tr><td>{{ c.label }}</td><td class="num nowrap">{{ c.currentRank ?? '–' }} → {{ c.candidateRank ?? '–' }}</td><td class="num nowrap">{{ c.currentScore ?? '–' }} → {{ c.candidateScore ?? '–' }}</td></tr> }</tbody></table></div>
          }
        }
      </div>

      <div class="spread">
        <div>
          @if (auth.isAdmin()) {
            <button type="button" class="btn btn--primary" (click)="save()" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save changes' }}</button>
            @if (!d.isActive) { <button type="button" class="btn btn--secondary" (click)="activate()" [disabled]="busy()">Make this set live</button> }
          }
        </div>
        <span class="muted small">Last saved {{ d.updatedAt.slice(0, 16).replace('T', ' ') }}. Saving a live set changes recommendations immediately.</span>
      </div>
    }
  `,
  styles: `
    .mrow { display: flex; gap: 0.6rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
    .rk { color: var(--text-muted); width: 2rem; flex: none; }
  `,
})
export class AdminScoring implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AdminAuthService);
  protected readonly weightKeys = WEIGHT_KEYS;
  protected readonly sets = signal<SetSummary[]>([]);
  protected readonly selectedId = signal('');
  protected readonly detail = signal<SetDetail | null>(null);
  protected readonly samples = signal<SampleProfile[]>([]);
  protected readonly pv = signal<Preview | null>(null);
  protected readonly msg = signal('');
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly previewing = signal(false);

  protected weights: Record<string, number> = {};
  protected rulesText = '';
  protected newName = '';
  protected sampleKey = '';
  private defaults: { weights: Record<string, number>; rules: Record<string, unknown> } | null = null;

  protected readonly sampleDesc = computed(() => this.samples().find((s) => s.key === this.sampleKey)?.description ?? '');
  protected coreTotal() {
    return WEIGHT_KEYS.filter(([k]) => k !== 'display').reduce((s, [k]) => s + (Number(this.weights[k]) || 0), 0);
  }

  ngOnInit() {
    this.api.get<{ data: SampleProfile[] }>('/scoring/sample-profiles').subscribe((r) => this.samples.set(r.data));
    this.api.get<{ weights: Record<string, number>; rules: Record<string, unknown> }>('/scoring/defaults').subscribe((d) => (this.defaults = d));
    this.loadSets();
  }

  private loadSets(selectId?: string) {
    this.api.get<{ data: SetSummary[] }>('/scoring/rule-sets').subscribe({
      next: (r) => {
        this.sets.set(r.data);
        const id = selectId ?? this.selectedId() ?? '';
        const target = r.data.find((s) => s.id === id) ?? r.data.find((s) => s.isActive) ?? r.data[0];
        if (target) this.select(target.id);
      },
      error: (e) => this.errors.set(errorLines(e)),
    });
  }

  protected select(id: string) {
    this.selectedId.set(id);
    this.pv.set(null);
    this.api.get<SetDetail>(`/scoring/rule-sets/${id}`).subscribe({ next: (d) => this.setDetail(d), error: (e) => this.errors.set(errorLines(e)) });
  }

  private setDetail(d: SetDetail) {
    this.detail.set(d);
    this.weights = { ...d.weights };
    this.rulesText = JSON.stringify(d.rules, null, 2);
  }

  protected resetToDefaults() {
    if (!this.defaults) return;
    this.weights = { ...this.defaults.weights };
    this.rulesText = JSON.stringify(this.defaults.rules, null, 2);
    this.msg.set('Defaults loaded into the editor. Preview, then save to keep them.');
  }

  /** Parses the editor; returns null (and shows why) if the JSON is unreadable. */
  private payload(): { weights: Record<string, number>; rules: Record<string, unknown> } | null {
    try {
      const rules = JSON.parse(this.rulesText) as Record<string, unknown>;
      if (!rules || typeof rules !== 'object' || Array.isArray(rules)) throw new Error('Rules must be a JSON object');
      const weights = Object.fromEntries(Object.entries(this.weights).map(([k, v]) => [k, Number(v)]));
      return { weights, rules };
    } catch (e) {
      this.msg.set('');
      this.errors.set([`The rules JSON could not be read: ${(e as Error).message}`]);
      return null;
    }
  }

  protected preview() {
    const p = this.payload();
    const sample = this.samples().find((s) => s.key === this.sampleKey);
    if (!p || !sample) return;
    this.clear();
    this.previewing.set(true);
    this.api.post<Preview>('/scoring/preview', { profile: sample.profile, ruleSetId: this.selectedId(), weights: p.weights, rules: p.rules }).subscribe({
      next: (r) => { this.pv.set(r); this.previewing.set(false); },
      error: (e) => { this.previewing.set(false); this.errors.set(errorLines(e)); },
    });
  }

  protected save() {
    const p = this.payload();
    const d = this.detail();
    if (!p || !d) return;
    if (d.isActive && !confirm('This rule set is live. Saving changes every new recommendation immediately. Continue?')) return;
    this.clear();
    this.busy.set(true);
    this.api.put<SetDetail>(`/scoring/rule-sets/${d.id}`, p).subscribe({
      next: (r) => { this.busy.set(false); this.setDetail(r); this.msg.set('Saved.'); this.loadSets(r.id); },
      error: (e) => { this.busy.set(false); this.errors.set(errorLines(e)); },
    });
  }

  protected activate() {
    const d = this.detail();
    if (!d || !confirm(`Make "${d.name}" the live rule set? New recommendations will use it immediately.`)) return;
    this.clear();
    this.busy.set(true);
    this.api.post(`/scoring/rule-sets/${d.id}/activate`, {}).subscribe({
      next: () => { this.busy.set(false); this.msg.set(`“${d.name}” is now live.`); this.loadSets(d.id); },
      error: (e) => { this.busy.set(false); this.errors.set(errorLines(e)); },
    });
  }

  protected clone() {
    this.clear();
    this.api.post<SetDetail>('/scoring/rule-sets', { name: this.newName.trim(), cloneFromId: this.selectedId() }).subscribe({
      next: (r) => { this.newName = ''; this.msg.set('Cloned. It is not live until you activate it.'); this.loadSets(r.id); },
      error: (e) => this.errors.set(errorLines(e)),
    });
  }

  private clear() { this.msg.set(''); this.errors.set([]); }
}
