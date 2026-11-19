import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiService } from './api.service';
import { ApplicationDto } from './applications.service';
import { Configuration, Paged, ProductSummary } from './catalog.models';

export interface Methodology {
  scoring: { categories: { key: string; percent: number }[]; note: string; rulesVersion: string };
  assumptions: {
    osOverheadGB: number;
    baselineMemoryGB: Record<'BASIC' | 'MODERATE' | 'HEAVY' | 'PROFESSIONAL', number>;
    osStorageReserveGB: number;
    usableStorageFraction: number;
    defaultOwnershipYears: number;
    yearlyDemandGrowth: number;
  };
  data: {
    configurations: { total: number; storeConfirmed: number; configureToOrderDerived: number; adminVerified: number };
    applications: { total: number; vendorPublishedMemory: number; estimated: number };
    specificationsLastVerified: string | null;
    cpuGpuIndexBasis: string;
  };
}

/** Read-only data for content pages. Each call degrades to an empty value so a page still renders if the API is down. */
@Injectable({ providedIn: 'root' })
export class SiteData {
  private readonly api = inject(ApiService);

  methodology(): Observable<Methodology | null> {
    return this.api.get<Methodology>('/methodology').pipe(catchError(() => of(null)));
  }
  products(): Observable<ProductSummary[]> {
    return this.api.get<Paged<ProductSummary>>('/products', { pageSize: 100 }).pipe(map((r) => r.data), catchError(() => of([] as ProductSummary[])));
  }
  configurations(): Observable<Configuration[]> {
    return this.api.get<Paged<Configuration>>('/configurations', { pageSize: 100, sort: 'newest' }).pipe(map((r) => r.data), catchError(() => of([] as Configuration[])));
  }
  applications(): Observable<ApplicationDto[]> {
    return this.api.get<Paged<ApplicationDto>>('/applications', { pageSize: 100 }).pipe(map((r) => r.data), catchError(() => of([] as ApplicationDto[])));
  }
}

export const CATEGORY_DESCRIPTIONS: Record<string, { name: string; what: string }> = {
  cpu: { name: 'CPU performance', what: 'Does the processor have enough capability for the most demanding apps you selected, with room for growth?' },
  gpu: { name: 'GPU performance', what: 'The same question for graphics, which matters for video, 3D, design and local AI.' },
  ram: { name: 'Memory (RAM)', what: 'Does the unified memory cover the memory your combined workload needs, not just each app on its own?' },
  storage: { name: 'Storage', what: 'Will the usable capacity hold macOS, your apps and typical project files with some free space?' },
  compatibility: { name: 'Application compatibility', what: 'Does each selected app run on macOS, and within its memory and performance needs on this exact configuration?' },
  budget: { name: 'Budget fit', what: 'How the verified price compares with your maximum. Configurations over budget are excluded.' },
  portability: { name: 'Portability', what: 'Weight, adjusted if you prefer a particular screen size.' },
  battery: { name: 'Battery life', what: 'Apple’s claimed video-playback hours. Real use varies.' },
  future: { name: 'Future-proofing', what: 'Headroom for the memory, storage and performance you are likely to need over your ownership period. Being newer earns no points.' },
};
