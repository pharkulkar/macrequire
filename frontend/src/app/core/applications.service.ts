import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Paged } from './catalog.models';
import { Intensity } from './profile.models';

export interface ApplicationDto {
  id: string;
  slug: string;
  name: string;
  category: string;
  macSupported: boolean;
  notes: string | null;
  requirements: {
    minRamGB: number;
    preferredRamGB: number;
    cpuDemand: number;
    gpuDemand: number;
    storageGB: number;
    intensity: Intensity;
    concurrencyFactor: number;
    needsAppleSilicon: boolean;
    provenance: { basis: 'VENDOR_PUBLISHED' | 'ESTIMATE'; note: string | null; sourceUrl: string | null; verifiedAt: string | null };
  } | null;
}

export interface UseCaseDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  appCategories: string[];
  /** Typical apps preselected when a visitor starts from this use case. */
  starterApplications: { id: string; slug: string; name: string; macSupported: boolean }[];
}

export interface AppLabel {
  name: string;
  macSupported: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly api = inject(ApiService);

  /** id -> display info, so selected apps can be shown without refetching. */
  readonly labels = signal<Record<string, AppLabel>>({});

  list(params: { q?: string; category?: string; categories?: string; macSupported?: boolean; page?: number; pageSize?: number } = {}): Observable<Paged<ApplicationDto>> {
    return this.api.get<Paged<ApplicationDto>>('/applications', params).pipe(tap((r) => this.remember(r.data)));
  }

  search(q: string, limit = 8): Observable<{ data: ApplicationDto[] }> {
    return this.api.get<{ data: ApplicationDto[] }>('/applications/search', { q, limit }).pipe(tap((r) => this.remember(r.data)));
  }

  categories(): Observable<{ data: { name: string; count: number }[] }> {
    return this.api.get('/applications/categories');
  }

  useCases(): Observable<{ data: UseCaseDto[] }> {
    return this.api.get('/use-cases');
  }

  remember(apps: ApplicationDto[]) {
    this.labels.update((cur) => {
      const next = { ...cur };
      for (const a of apps) next[a.id] = { name: a.name, macSupported: a.macSupported };
      return next;
    });
  }

  restoreLabels(saved: Record<string, AppLabel>) {
    this.labels.update((cur) => ({ ...saved, ...cur }));
  }
}
