import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Offer } from '../../core/catalog.models';
import { formatMoney } from '../../core/format';

type Range = '30d' | '90d' | '1y' | 'all';
interface Point { at: string; price: number }
interface Series { offerId: string; merchant: { id: string; name: string }; currency: string; current: number | null; outOfStock: boolean; points: Point[] }
interface Extreme { amount: number; at: string; merchant: string }
interface HistoryResponse { data: { country: string; currency: string | null; range: Range; since: string | null; series: Series[]; lowest: Extreme | null; highest: Extreme | null } }

const W = 640, H = 260, M = { l: 62, r: 14, t: 14, b: 30 };
const COLORS = ['#0071e3', '#1a7f37', '#b45f06', '#8e44ad'];
const DASHES = ['', '7 4', '2 3', '10 3 2 3'];
const DAY = 86_400_000;
const RANGES: { key: Range; label: string }[] = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '1y', label: '1 year' },
  { key: 'all', label: 'All' },
];

/** A price at a moment: the last recorded price on or before that moment (prices hold until they change). */
const priceAt = (points: Point[], t: number): number | null => {
  let found: number | null = null;
  for (const p of points) {
    if (new Date(p.at).getTime() <= t) found = p.price;
    else break;
  }
  return found;
};

/** Rounds a price scale to friendly tick values. */
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.max(1, max * 0.05);
  const rough = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * Price history for one configuration. Shown only when there is a real history (at least two price changes over
 * at least a week), and loaded only when the visitor opens it. Prices are the ones MacRequire recorded, drawn as
 * steps because a price holds until the next recorded change. Nothing between records is estimated.
 */
@Component({
  selector: 'app-price-history',
  imports: [DatePipe],
  template: `
    @if (eligible()) {
      <details class="ph" (toggle)="onToggle($event)">
        <summary>
          <span class="ph__title">Price history</span>
          <span class="ph__sum">{{ summary() }}</span>
        </summary>

        <div class="ph__body">
          <div class="ph__ranges" role="group" aria-label="Time range">
            @for (r of ranges; track r.key) {
              <button type="button" class="chip" [class.chip--active]="range() === r.key" [attr.aria-pressed]="range() === r.key" (click)="setRange(r.key)">{{ r.label }}</button>
            }
          </div>

          @if (loading()) {
            <p class="ph__status" role="status">Loading price history…</p>
          } @else if (error()) {
            <p class="ph__status ph__status--error" role="alert">We could not load the price history. Please try again later.</p>
          } @else if (data(); as d) {
            @if (!enoughData()) {
              <p class="ph__status">Not enough recorded price changes in this range yet to draw a chart.</p>
            } @else {
              <ul class="ph__stats">
                @if (d.lowest; as lo) { <li><span>Lowest recorded</span><strong>{{ money(lo.amount) }}</strong><small>{{ lo.merchant }}, {{ lo.at | date: 'mediumDate' }}</small></li> }
                @if (d.highest; as hi) { <li><span>Highest recorded</span><strong>{{ money(hi.amount) }}</strong><small>{{ hi.merchant }}, {{ hi.at | date: 'mediumDate' }}</small></li> }
              </ul>

              <div class="ph__chart">
                <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="chartLabel()" (pointermove)="onMove($event)" (pointerdown)="onMove($event)" (pointerleave)="hoverT.set(null)">
                  @for (t of yTicks(); track t.v) {
                    <line [attr.x1]="M.l" [attr.x2]="W - M.r" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
                    <text [attr.x]="M.l - 8" [attr.y]="t.y + 4" text-anchor="end" class="axis">{{ axisMoney(t.v) }}</text>
                  }
                  @for (t of xTicks(); track t.t) {
                    <text [attr.x]="t.x" [attr.y]="H - 8" text-anchor="middle" class="axis">{{ t.label }}</text>
                  }
                  @for (s of drawn(); track s.offerId; let i = $index) {
                    <path [attr.d]="s.path" fill="none" [attr.stroke]="color(i)" stroke-width="2.25" stroke-linejoin="round" [attr.stroke-dasharray]="dash(i)" />
                  }
                  @if (hover(); as h) {
                    <line [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="M.t" [attr.y2]="H - M.b" class="cursor" />
                    @for (v of h.values; track v.i) {
                      @if (v.y !== null) { <circle [attr.cx]="h.x" [attr.cy]="v.y" r="4.5" [attr.fill]="color(v.i)" stroke="#fff" stroke-width="1.5" /> }
                    }
                  }
                </svg>
                @if (hover(); as h) {
                  <div class="ph__tip" [style.left.%]="(h.x / W) * 100" [class.ph__tip--right]="h.x > W * 0.4" role="status">
                    <strong>{{ h.date | date: 'mediumDate' }}</strong>
                    @for (v of h.values; track v.i) {
                      <span><i [style.background]="color(v.i)"></i>{{ v.merchant }}: {{ v.price === null ? 'no record yet' : money(v.price) }}</span>
                    }
                  </div>
                }
              </div>

              <ul class="ph__legend">
                @for (s of d.series; track s.offerId; let i = $index) {
                  <li><svg width="30" height="10" aria-hidden="true"><line x1="0" x2="30" y1="5" y2="5" [attr.stroke]="color(i)" stroke-width="2.25" [attr.stroke-dasharray]="dash(i)" /></svg>{{ s.merchant.name }}</li>
                }
              </ul>
              <p class="ph__note">
                Prices MacRequire has recorded{{ d.since ? ', since ' + shortDate(d.since) : '' }}. A line stays flat until the next recorded change, and sellers may have changed prices in between.
              </p>

              <details class="ph__table">
                <summary>Show as a table</summary>
                <div class="ph__scroll">
                  <table>
                    <caption class="sr-only">Recorded prices, newest first</caption>
                    <thead><tr><th scope="col">Date</th><th scope="col">Seller</th><th scope="col" class="num">Price</th></tr></thead>
                    <tbody>
                      @for (row of tableRows(); track row.key) {
                        <tr><td>{{ row.at | date: 'mediumDate' }}</td><td>{{ row.merchant }}</td><td class="num">{{ money(row.price) }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </details>
            }
          }
        </div>
      </details>
    }
  `,
  styles: `
    :host { display: block; }
    .ph { border: 1px solid var(--border); border-radius: 12px; background: #fff; margin-top: 1rem; }
    summary { cursor: pointer; padding: 0.8rem 1rem; display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; align-items: baseline; }
    .ph__title { font-weight: 600; }
    .ph__sum { color: var(--text-muted); font-size: 0.85rem; }
    .ph__body { padding: 0 1rem 1rem; }
    .ph__ranges { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .chip { font: inherit; font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 999px; border: 1px solid var(--border); background: #fff; cursor: pointer; color: var(--text); }
    .chip--active { background: var(--text); color: #fff; border-color: var(--text); }
    .ph__status { color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0; }
    .ph__status--error { color: #b3261e; }
    .ph__stats { list-style: none; margin: 0 0 0.5rem; padding: 0; display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .ph__stats li { display: grid; font-size: 0.85rem; }
    .ph__stats span { color: var(--text-muted); }
    .ph__stats strong { font-size: 1.15rem; }
    .ph__stats small { color: var(--text-muted); }
    .ph__chart { position: relative; touch-action: pan-y; }
    svg { width: 100%; height: auto; display: block; overflow: visible; }
    .grid { stroke: var(--border); stroke-width: 1; }
    .axis { fill: var(--text-muted); font-size: 11px; }
    .cursor { stroke: #999; stroke-width: 1; stroke-dasharray: 3 3; }
    .ph__tip { position: absolute; top: 0; transform: translateX(8px); background: #1d1d1f; color: #fff; border-radius: 8px; padding: 0.45rem 0.65rem; font-size: 0.78rem; display: grid; gap: 0.15rem; pointer-events: none; white-space: nowrap; }
    .ph__tip--right { transform: translateX(calc(-100% - 8px)); }
    .ph__tip i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 0.35rem; }
    .ph__legend { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.82rem; }
    .ph__legend li { display: flex; gap: 0.4rem; align-items: center; white-space: nowrap; }
    .ph__legend svg { flex: none; width: 30px; }
    .ph__note { color: var(--text-muted); font-size: 0.78rem; margin: 0.6rem 0 0; line-height: 1.5; }
    .ph__table { border: 0; margin-top: 0.5rem; }
    .ph__table summary { padding: 0.4rem 0; font-size: 0.85rem; color: var(--accent); }
    .ph__scroll { max-height: 240px; overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th, td { text-align: left; padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--border); }
    .num { text-align: right; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class PriceHistory {
  readonly configurationId = input.required<string>();
  readonly country = input.required<string>();
  /** The configuration's offers, used only to decide whether a history is worth showing. */
  readonly offers = input.required<Offer[]>();

  private readonly api = inject(ApiService);
  protected readonly W = W;
  protected readonly H = H;
  protected readonly M = M;
  protected readonly ranges = RANGES;

  protected readonly range = signal<Range>('90d');
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly data = signal<HistoryResponse['data'] | null>(null);
  protected readonly hoverT = signal<number | null>(null);
  private loadedFor = '';
  private opened = false;

  constructor() {
    // A different configuration or market means the loaded history no longer applies.
    effect(() => {
      this.configurationId();
      this.country();
      untracked(() => {
        this.data.set(null);
        this.loadedFor = '';
        if (this.opened) this.load();
      });
    });
  }

  /** At least two price changes over at least a week for some seller. */
  protected readonly eligible = computed(() =>
    this.offers().some((o) => !!o.priceStats && o.priceStats.priceChanges >= 2 && Date.now() - new Date(o.priceStats.since).getTime() >= 7 * DAY),
  );

  protected readonly summary = computed(() => {
    const stats = this.offers().flatMap((o) => (o.priceStats ? [{ o, s: o.priceStats }] : []));
    if (!stats.length) return '';
    const low = stats.reduce((a, b) => (b.s.lowest.amount < a.s.lowest.amount ? b : a));
    return `Lowest recorded ${formatMoney(low.s.lowest.amount, low.o.currency)}`;
  });

  protected readonly currency = computed(() => this.data()?.currency ?? this.offers()[0]?.currency ?? 'USD');
  protected readonly money = (n: number) => formatMoney(n, this.currency());
  protected readonly axisMoney = (n: number) => formatMoney(n, this.currency());
  protected readonly color = (i: number) => COLORS[i % COLORS.length];
  protected readonly dash = (i: number) => DASHES[i % DASHES.length];
  protected readonly shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /** Series that have at least one point; prices are extended flat to today at the seller's current price. */
  private readonly series = computed(() => (this.data()?.series ?? []).filter((s) => s.points.length > 0));
  protected readonly enoughData = computed(() => {
    const s = this.series();
    const total = s.reduce((n, x) => n + x.points.length, 0);
    return s.length > 0 && total >= 2;
  });

  private readonly domain = computed(() => {
    const now = Date.now();
    const times = this.series().flatMap((s) => s.points.map((p) => new Date(p.at).getTime()));
    const prices = this.series().flatMap((s) => [...s.points.map((p) => p.price), ...(s.current !== null ? [s.current] : [])]);
    if (!times.length) return { t0: now - 30 * DAY, t1: now, p0: 0, p1: 1, ticks: [0, 1] };
    const t0 = Math.min(...times);
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const pad = (hi - lo || hi * 0.05 || 1) * 0.12;
    const ticks = niceTicks(Math.max(0, lo - pad), hi + pad);
    return { t0, t1: Math.max(now, t0 + DAY), p0: ticks[0], p1: ticks[ticks.length - 1], ticks };
  });

  private readonly x = (t: number) => { const d = this.domain(); return M.l + ((t - d.t0) / (d.t1 - d.t0)) * (W - M.l - M.r); };
  private readonly y = (p: number) => { const d = this.domain(); return M.t + (1 - (p - d.p0) / (d.p1 - d.p0 || 1)) * (H - M.t - M.b); };

  protected readonly yTicks = computed(() => this.domain().ticks.map((v) => ({ v, y: this.y(v) })));
  protected readonly xTicks = computed(() => {
    const d = this.domain();
    const span = d.t1 - d.t0;
    return [0, 1 / 3, 2 / 3, 1].map((f) => {
      const t = d.t0 + span * f;
      const date = new Date(t);
      const label = span > 400 * DAY ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { t, x: this.x(t), label };
    });
  });

  protected readonly drawn = computed(() => {
    const now = this.domain().t1;
    return this.series().map((s) => {
      const pts = s.points.map((p) => ({ t: new Date(p.at).getTime(), price: p.price }));
      let path = '';
      pts.forEach((p, i) => {
        const x = this.x(p.t), y = this.y(p.price);
        path += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` H${x.toFixed(1)} V${y.toFixed(1)}`;
      });
      path += ` H${this.x(now).toFixed(1)}`; // the last price holds until today
      return { offerId: s.offerId, path };
    });
  });

  protected readonly hover = computed(() => {
    const t = this.hoverT();
    if (t === null) return null;
    const values = (this.data()?.series ?? []).map((s, i) => {
      const price = priceAt(s.points, t);
      return { i, merchant: s.merchant.name, price, y: price === null ? null : this.y(price) };
    }).filter((v, _i, all) => v.price !== null || all.length > 1);
    return { t, x: this.x(t), date: new Date(t).toISOString(), values };
  });

  protected readonly chartLabel = computed(() => {
    const d = this.data();
    if (!d) return 'Price history chart';
    const parts = d.series.filter((s) => s.points.length).map((s) => `${s.merchant.name}: ${s.points.length} recorded prices, currently ${s.current === null ? 'not available' : this.money(s.current)}`);
    return `Price history chart. ${parts.join('. ')}. A table of the recorded prices follows.`;
  });

  protected readonly tableRows = computed(() =>
    (this.data()?.series ?? [])
      .flatMap((s) => s.points.map((p) => ({ key: s.offerId + p.at, at: p.at, merchant: s.merchant.name, price: p.price })))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100),
  );

  protected onToggle(ev: Event) {
    this.opened = (ev.target as HTMLDetailsElement).open;
    if (this.opened) this.load();
  }

  protected setRange(r: Range) {
    if (this.range() === r) return;
    this.range.set(r);
    this.load();
  }

  protected onMove(ev: PointerEvent) {
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const d = this.domain();
    const f = Math.min(1, Math.max(0, (px - M.l) / (W - M.l - M.r)));
    this.hoverT.set(d.t0 + f * (d.t1 - d.t0));
  }

  private load() {
    const key = `${this.configurationId()}|${this.country()}|${this.range()}`;
    if (key === this.loadedFor) return;
    this.loading.set(true);
    this.error.set(false);
    this.api.get<HistoryResponse>(`/configurations/${encodeURIComponent(this.configurationId())}/price-history`, { country: this.country(), range: this.range() }).subscribe({
      next: (r) => { this.data.set(r.data); this.loadedFor = key; this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }
}
