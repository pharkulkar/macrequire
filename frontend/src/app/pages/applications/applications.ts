import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import { ApplicationDto, ApplicationsService } from '../../core/applications.service';
import { formatStorage } from '../../core/format';
import { Seo } from '../../core/seo.service';

@Component({
  selector: 'app-applications',
  imports: [FormsModule, RouterLink],
  templateUrl: './applications.html',
  styleUrl: './applications.scss',
})
export class Applications {
  private readonly svc = inject(ApplicationsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly query = signal('');
  protected readonly category = signal('All');
  protected readonly categories = signal<{ name: string; count: number }[]>([]);
  protected readonly apps = signal<ApplicationDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly storage = formatStorage;

  constructor() {
    inject(Seo).set({
      title: 'Application Directory: MacBook hardware needs by app',
      description: 'The memory, CPU, GPU and storage profile MacRequire uses for each application, with vendor-published figures marked separately from our estimates.',
      path: '/applications',
    });
    // toObservable() needs an injection context, so this lives in the constructor.
    this.svc.categories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (r) => this.categories.set(r.data) });

    combineLatest([
      toObservable(this.query).pipe(debounceTime(250), distinctUntilChanged(), startWith('')),
      toObservable(this.category),
    ])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
        }),
        switchMap(([q, category]) =>
          this.svc.list({ q: q.trim() || undefined, category: category === 'All' ? undefined : category, pageSize: 100 }).pipe(
            map((r) => r.data),
            catchError(() => {
              this.error.set(true);
              return of([] as ApplicationDto[]);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        this.apps.set(data);
        this.loading.set(false);
      });
  }

  protected bar(n: number) {
    return Array.from({ length: 10 }, (_, i) => i < n);
  }
}
