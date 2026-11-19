import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

type Params = Record<string, string | number | boolean | undefined | null>;

/** Thin typed wrapper over the admin API. Authentication is added by the interceptor. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

  get<T>(path: string, params?: Params): Observable<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return this.http.get<T>(this.base + path, { params: p });
  }
  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.base + path, body);
  }
  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.base + path, body);
  }
  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.base + path, body);
  }
  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.base + path);
  }
  /** Fetches a text file (for CSV templates). */
  text(path: string, params?: Params): Observable<string> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return this.http.get(this.base + path, { params: p, responseType: 'text' });
  }
}

export interface Paged<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
