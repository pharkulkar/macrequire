import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminIdentity {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR';
}

interface LoginResponse {
  token: string;
  admin: AdminIdentity;
}

const TOKEN_KEY = 'macrequire.admin.token';
const ADMIN_KEY = 'macrequire.admin.identity';

/**
 * Admin session. The token lives in sessionStorage, so it ends with the browser tab and is never sent
 * anywhere except the admin API (see the interceptor). The server re-checks the account on every request,
 * so the role stored here is only used to decide which screens to show.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(this.read(TOKEN_KEY));
  readonly admin = signal<AdminIdentity | null>(this.readJson<AdminIdentity>(ADMIN_KEY));
  readonly isSignedIn = computed(() => Boolean(this.token()));
  readonly isAdmin = computed(() => this.admin()?.role === 'ADMIN');

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/admin/auth/login`, { email, password }).pipe(
      tap((r) => {
        this.token.set(r.token);
        this.admin.set(r.admin);
        this.write(TOKEN_KEY, r.token);
        this.write(ADMIN_KEY, JSON.stringify(r.admin));
      }),
    );
  }

  /** Keeps this session going with a fresh token (after changing the password, which ends all other sessions). */
  replaceToken(token: string) {
    this.token.set(token);
    this.write(TOKEN_KEY, token);
  }

  logout(redirect = true, expired = false) {
    this.token.set(null);
    this.admin.set(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_KEY);
    } catch {
      /* storage unavailable */
    }
    if (redirect) this.router.navigate(['/admin/login'], { queryParams: expired ? { expired: 1 } : {} });
  }

  private read(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  private readJson<T>(key: string): T | null {
    try {
      const raw = this.read(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  private write(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* storage unavailable: the session lasts until reload */
    }
  }
}
