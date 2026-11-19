import { Component, DestroyRef, computed, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ApplicationDto, ApplicationsService } from '../../core/applications.service';

/** Searchable multi-select of applications. Selection is held as application ids. */
@Component({
  selector: 'app-app-picker',
  imports: [FormsModule],
  templateUrl: './app-picker.html',
  styleUrl: './app-picker.scss',
})
export class AppPicker {
  private readonly apps = inject(ApplicationsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly selected = model<string[]>([]);
  readonly suggestedCategories = input<string[]>([]);
  readonly inputId = input('app-search');
  readonly label = input('Search applications');
  /** Ids to hide from results (for example apps already chosen in an earlier step). */
  readonly exclude = input<string[]>([]);

  protected readonly query = signal('');
  protected readonly results = signal<ApplicationDto[]>([]);
  protected readonly suggestions = signal<ApplicationDto[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);

  protected readonly labels = this.apps.labels;
  protected readonly selectedItems = computed(() =>
    this.selected().map((id) => ({ id, name: this.labels()[id]?.name ?? 'Unknown application', macSupported: this.labels()[id]?.macSupported ?? true })),
  );
  protected readonly visibleResults = computed(() => this.results().filter((a) => !this.exclude().includes(a.id)));
  protected readonly visibleSuggestions = computed(() => this.suggestions().filter((a) => !this.exclude().includes(a.id)));

  constructor() {
    toObservable(this.query)
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (!term) {
            this.searching.set(false);
            this.searched.set(false);
            return of({ data: [] as ApplicationDto[] });
          }
          this.searching.set(true);
          return this.apps.search(term, 8).pipe(catchError(() => of({ data: [] as ApplicationDto[] })));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        this.results.set(r.data);
        this.searching.set(false);
        this.searched.set(this.query().trim().length > 0);
      });

    toObservable(this.suggestedCategories)
      .pipe(
        distinctUntilChanged((a, b) => a.join('|') === b.join('|')),
        switchMap((cats) =>
          cats.length ? this.apps.list({ categories: cats.join(','), pageSize: 40 }).pipe(catchError(() => of({ data: [] as ApplicationDto[] }))) : of({ data: [] as ApplicationDto[] }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => this.suggestions.set(r.data));
  }

  protected isSelected(id: string) {
    return this.selected().includes(id);
  }

  protected toggle(id: string) {
    this.selected.update((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  protected remove(id: string) {
    this.selected.update((cur) => cur.filter((x) => x !== id));
  }
}
