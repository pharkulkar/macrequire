import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { readTestToken } from './test-session';

/** Thin wrapper over HttpClient; feature services build on this. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Observable<T> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined) httpParams = httpParams.set(key, String(value));
    }
    return this.http.get<T>(`${this.base}${path}`, { params: httpParams, headers: this.testHeaders() });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body, { headers: this.testHeaders() });
  }

  /** During an administrator's test session, requests carry the token that marks what they record as test data. */
  private testHeaders(): HttpHeaders | undefined {
    const token = readTestToken();
    return token ? new HttpHeaders({ 'X-Test-Session': token }) : undefined;
  }
}
