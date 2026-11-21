import { classifyError, errorReason } from '../../core/error-messages';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminAuthService } from './admin-auth.service';

const ADMIN_BASE = `${environment.apiUrl}/admin`;
const LOGIN_URL = `${ADMIN_BASE}/auth/login`;

/** Adds the admin token to admin API calls only, and signs out when the server says the session is no longer valid. */
export const adminInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(ADMIN_BASE)) return next(req);
  const auth = inject(AdminAuthService);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && req.url !== LOGIN_URL && auth.isSignedIn()) auth.logout(true, true);
      return throwError(() => e);
    }),
  );
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  return auth.isSignedIn() ? true : inject(Router).createUrlTree(['/admin/login']);
};

/** Screens that only ADMINs may use (the server enforces this too). */
export const adminOnlyGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  return auth.isAdmin() ? true : inject(Router).createUrlTree(['/admin']);
};

/** Turns an API error into short lines for display, including field-level details. */
export function errorLines(e: unknown): string[] {
  if (!(e instanceof HttpErrorResponse)) return [errorReason(e)];
  const kind = classifyError(e);
  if (kind === 'offline' || kind === 'unreachable' || kind === 'rate-limited' || kind === 'timeout') return [errorReason(e)];
  const err = e.error?.error as { message?: string; details?: Record<string, unknown> } | undefined;
  if (!err) return [errorReason(e)];
  const lines = [err.message ?? errorReason(e)];
  const d = err.details as { issues?: { path: string; message: string }[]; fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
  d?.issues?.forEach((i) => lines.push(`${i.path || 'value'}: ${i.message}`));
  if (d?.fieldErrors) Object.entries(d.fieldErrors).forEach(([k, v]) => lines.push(`${k}: ${v.join(', ')}`));
  d?.formErrors?.forEach((m) => lines.push(m));
  return lines;
}
