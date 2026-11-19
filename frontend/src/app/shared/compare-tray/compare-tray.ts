import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { CompareService, MAX_COMPARE } from '../../core/compare.service';

/** Floating bar showing the comparison basket on every page except the comparison page itself. */
@Component({
  selector: 'app-compare-tray',
  imports: [RouterLink],
  template: `
    @if (visible()) {
      <aside class="tray" aria-label="Comparison basket">
        <ul class="tray__items">
          @for (i of compare.items(); track i.id) {
            <li>
              <span class="tray__label" [title]="i.label">{{ short(i.label) }}</span>
              <button type="button" (click)="compare.remove(i.id)" [attr.aria-label]="'Remove ' + i.label + ' from comparison'">✕</button>
            </li>
          }
        </ul>
        <div class="tray__cta">
          <span class="tray__count" aria-live="polite">{{ compare.count() }} of {{ max }}</span>
          @if (compare.count() >= 2) {
            <a routerLink="/compare" class="btn btn--primary btn--sm">Compare</a>
          } @else {
            <span class="tray__hint">Select 1 more</span>
          }
        </div>
      </aside>
    }
  `,
  styleUrl: './compare-tray.scss',
})
export class CompareTray {
  protected readonly compare = inject(CompareService);
  private readonly router = inject(Router);
  protected readonly max = MAX_COMPARE;

  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => (e as NavigationEnd).urlAfterRedirects)), {
    initialValue: this.router.url,
  });

  protected readonly visible = computed(() => this.compare.count() > 0 && !this.url().startsWith('/compare'));

  /** Keeps the chips compact: model family + chip + memory/storage. */
  protected short(label: string): string {
    const parts = label.split(' · ');
    return parts.length >= 3 ? `${parts[1].replace(/\s*\(.*\)/, '')} ${parts[2]} · ${parts[3] ?? ''}`.trim() : label;
  }
}
