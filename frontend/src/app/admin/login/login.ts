import { errorReason } from '../../core/error-messages';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../core/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="wrap">
      <form class="card" (ngSubmit)="submit()" #f="ngForm" novalidate>
        <h1>Admin sign in</h1>
        @if (expired) { <p class="alert" role="status">Your session ended. Please sign in again.</p> }
        @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" [(ngModel)]="email" required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" [(ngModel)]="password" required />
        <button class="btn btn--primary" type="submit" [disabled]="busy() || !email || !password">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        <a routerLink="/" class="back">← Back to MacRequire</a>
      </form>
    </main>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; background: var(--bg-soft); padding: 1rem; }
    form { width: min(100%, 380px); display: grid; gap: 0.5rem; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-top: 0.4rem; }
    input { padding: 0.7rem 0.8rem; border: 1px solid var(--border); border-radius: 10px; font: inherit; &:focus { border-color: var(--accent); } }
    button { margin-top: 1rem; }
    .alert { background: #fff7e8; border: 1px solid #f0c98f; border-radius: 10px; padding: 0.6rem 0.8rem; font-size: 0.88rem; margin: 0; &--error { background: #fdf0ef; border-color: #e8b4b0; color: #7a1a14; } }
    .back { text-align: center; font-size: 0.85rem; margin-top: 0.5rem; }
  `,
})
export class AdminLogin {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  protected readonly expired = inject(ActivatedRoute).snapshot.queryParamMap.has('expired');

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (this.auth.isSignedIn()) this.router.navigate(['/admin']);
  }

  protected submit() {
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.password = '';
        this.error.set(e.status === 429 ? 'Too many sign-in attempts. Please wait a few minutes and try again.' : e.status === 401 ? 'That email or password is not correct.' : e.status === 0 ? errorReason(e) : "We couldn't sign you in. Please try again.");
      },
    });
  }
}
