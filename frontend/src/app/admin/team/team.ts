import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, Paged } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';
import { errorLines } from '../core/admin-http';

interface User { id: string; email: string; role: 'ADMIN' | 'EDITOR'; isActive: boolean; lastLoginAt: string | null; createdAt: string }
interface Log { id: string; adminEmail: string; method: string; path: string; status: number; summary: unknown; createdAt: string }

@Component({
  selector: 'app-admin-team',
  imports: [FormsModule, DatePipe],
  styleUrl: '../admin-common.scss',
  template: `
    <h1>Team &amp; audit</h1>
    <p class="lead">Who can sign in, and a record of every change made through the admin.</p>
    @if (msg()) { <div class="alert alert--ok" role="status">{{ msg() }}</div> }
    @if (errors().length) { <div class="alert alert--error" role="alert"><ul>@for (l of errors(); track l) { <li>{{ l }}</li> }</ul></div> }

    <form class="panel" (ngSubmit)="changePassword()">
      <h2>Change my password</h2>
      <div class="form-grid">
        <div class="field"><label for="cp">Current password</label><input id="cp" name="cp" type="password" autocomplete="current-password" [(ngModel)]="pw.current" /></div>
        <div class="field"><label for="np">New password (12+ characters)</label><input id="np" name="np" type="password" autocomplete="new-password" [(ngModel)]="pw.next" /></div>
      </div>
      <button class="btn btn--secondary btn--sm" type="submit" [disabled]="!pw.current || pw.next.length < 12">Change password</button>
    </form>

    @if (auth.isAdmin()) {
      <h2>Admin users</h2>
      <div class="table-wrap"><table class="grid"><caption class="sr-only">Admin users</caption>
        <thead><tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Last sign-in</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
        <tbody>@for (u of users(); track u.id) {
          <tr [class.off]="!u.isActive"><td><strong>{{ u.email }}</strong>@if (u.id === auth.admin()?.id) { <span class="badge">you</span> }</td>
            <td>{{ u.role }}</td><td>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'medium') : 'never' }}</td>
            <td><span class="badge" [class.badge--ok]="u.isActive">{{ u.isActive ? 'active' : 'disabled' }}</span></td>
            <td class="nowrap">@if (u.id !== auth.admin()?.id) {
              <button type="button" class="link" (click)="toggle(u)">{{ u.isActive ? 'Disable' : 'Enable' }}</button> ·
              <button type="button" class="link" (click)="setRole(u)">Make {{ u.role === 'ADMIN' ? 'editor' : 'admin' }}</button> ·
              <button type="button" class="link" (click)="resetPw(u)">Set new password</button>
            }</td></tr>
        }</tbody></table></div>

      <form class="panel mt" (ngSubmit)="create()">
        <h2>Add a team member</h2>
        <div class="form-grid">
          <div class="field"><label for="ue">Email</label><input id="ue" name="ue" type="email" [(ngModel)]="nu.email" /></div>
          <div class="field"><label for="up">Temporary password (12+ characters)</label><input id="up" name="up" type="password" autocomplete="new-password" [(ngModel)]="nu.password" /></div>
          <div class="field"><label for="ur">Role</label><select id="ur" name="ur" [(ngModel)]="nu.role"><option value="EDITOR">Editor: prices, offers, catalog, applications</option><option value="ADMIN">Admin: everything, including scoring and team</option></select></div>
        </div>
        <button class="btn btn--primary btn--sm" type="submit" [disabled]="!nu.email || nu.password.length < 12">Add</button>
      </form>

      <h2 class="mt">Audit log</h2>
      <p class="muted small">Every successful change. Passwords and CSV contents are never recorded.</p>
      <div class="table-wrap"><table class="grid"><caption class="sr-only">Audit log</caption>
        <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Details</th></tr></thead>
        <tbody>@for (l of logs(); track l.id) {
          <tr><td class="nowrap">{{ l.createdAt | date: 'MMM d, HH:mm:ss' }}</td><td>{{ l.adminEmail }}</td><td class="nowrap"><span class="badge">{{ l.method }}</span> <code class="small">{{ l.path.replace('/api/admin', '') }}</code></td>
            <td class="small muted">{{ brief(l.summary) }}</td></tr>
        } @empty { <tr><td colspan="4" class="empty">No changes recorded yet.</td></tr> }</tbody></table></div>
      <div class="pager"><button type="button" class="btn btn--secondary btn--sm" [disabled]="page() <= 1" (click)="loadLogs(page() - 1)">Newer</button><span>Page {{ page() }} of {{ pages() }}</span>
        <button type="button" class="btn btn--secondary btn--sm" [disabled]="page() >= pages()" (click)="loadLogs(page() + 1)">Older</button></div>
    } @else {
      <div class="alert alert--warn">User management and the audit log are available to ADMINs only.</div>
    }
  `,
})
export class AdminTeam implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AdminAuthService);
  protected readonly users = signal<User[]>([]);
  protected readonly logs = signal<Log[]>([]);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);
  protected readonly msg = signal('');
  protected readonly errors = signal<string[]>([]);
  protected pw = { current: '', next: '' };
  protected nu = { email: '', password: '', role: 'EDITOR' };

  ngOnInit() {
    if (this.auth.isAdmin()) {
      this.loadUsers();
      this.loadLogs(1);
    }
  }
  private loadUsers() { this.api.get<{ data: User[] }>('/users').subscribe({ next: (r) => this.users.set(r.data), error: (e) => this.errors.set(errorLines(e)) }); }
  protected loadLogs(page: number) {
    this.api.get<Paged<Log>>('/audit', { page, pageSize: 25 }).subscribe({ next: (r) => { this.logs.set(r.data); this.page.set(r.pagination.page); this.pages.set(r.pagination.totalPages); }, error: (e) => this.errors.set(errorLines(e)) });
  }
  protected brief(s: unknown): string {
    if (!s) return '';
    const t = JSON.stringify(s);
    return t.length > 140 ? t.slice(0, 140) + '…' : t;
  }

  private ok(t: string) { this.errors.set([]); this.msg.set(t); this.loadUsers(); this.loadLogs(1); }
  private bad(e: unknown) { this.msg.set(''); this.errors.set(errorLines(e)); }

  protected changePassword() {
    this.api.post<{ token?: string }>('/users/me/password', { currentPassword: this.pw.current, newPassword: this.pw.next }).subscribe({ next: (r) => { if (r.token) this.auth.replaceToken(r.token); this.pw = { current: '', next: '' }; this.ok('Password changed. Your other sessions were signed out.'); }, error: (e) => this.bad(e) });
  }
  protected create() {
    this.api.post('/users', { email: this.nu.email.trim(), password: this.nu.password, role: this.nu.role }).subscribe({ next: () => { this.nu = { email: '', password: '', role: 'EDITOR' }; this.ok('Team member added. Share the temporary password securely and ask them to change it.'); }, error: (e) => this.bad(e) });
  }
  protected toggle(u: User) {
    this.api.patch(`/users/${u.id}`, { isActive: !u.isActive }).subscribe({ next: () => this.ok(u.isActive ? 'Access disabled immediately.' : 'Access restored.'), error: (e) => this.bad(e) });
  }
  protected setRole(u: User) {
    this.api.patch(`/users/${u.id}`, { role: u.role === 'ADMIN' ? 'EDITOR' : 'ADMIN' }).subscribe({ next: () => this.ok('Role updated.'), error: (e) => this.bad(e) });
  }
  protected resetPw(u: User) {
    const password = prompt(`New password for ${u.email} (12+ characters):`);
    if (!password) return;
    this.api.patch(`/users/${u.id}`, { password }).subscribe({ next: () => this.ok('Password updated.'), error: (e) => this.bad(e) });
  }
}
