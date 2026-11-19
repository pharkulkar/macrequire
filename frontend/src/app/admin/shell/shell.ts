import { Component, inject, OnInit, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthService } from '../core/admin-auth.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="side" [class.side--open]="open()">
        <a routerLink="/admin" class="brand">Mac<span>Require</span> <small>Admin</small></a>
        <nav aria-label="Admin">
          <a routerLink="/admin" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }" (click)="open.set(false)">Dashboard</a>
          <a routerLink="/admin/pricing" routerLinkActive="on" (click)="open.set(false)">Pricing &amp; offers</a>
          <a routerLink="/admin/merchants" routerLinkActive="on" (click)="open.set(false)">Merchants &amp; programs</a>
          <a routerLink="/admin/catalog" routerLinkActive="on" (click)="open.set(false)">Catalog</a>
          <a routerLink="/admin/applications" routerLinkActive="on" (click)="open.set(false)">Applications</a>
          <a routerLink="/admin/scoring" routerLinkActive="on" (click)="open.set(false)">Scoring engine</a>
          <a routerLink="/admin/imports" routerLinkActive="on" (click)="open.set(false)">CSV imports</a>
          <a routerLink="/admin/team" routerLinkActive="on" (click)="open.set(false)">Team &amp; audit</a>
        </nav>
        <div class="who">
          <span class="who__email">{{ auth.admin()?.email }}</span>
          <span class="who__role">{{ auth.admin()?.role }}</span>
          <button type="button" class="link" (click)="auth.logout()">Sign out</button>
          <a routerLink="/" class="link">View public site</a>
        </div>
      </aside>
      <div class="main">
        <header class="bar">
          <button type="button" class="menu" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-label="Toggle admin navigation">☰</button>
          <strong>MacRequire Admin</strong>
        </header>
        <main class="content" id="admin-main"><router-outlet /></main>
      </div>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; background: var(--bg-soft); }
    .side { background: var(--bg); border-right: 1px solid var(--border); padding: 1.25rem 1rem; display: flex; flex-direction: column; gap: 1.25rem; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    .brand { font-weight: 700; font-size: 1.15rem; color: var(--text); letter-spacing: -0.03em; span { color: var(--text-muted); font-weight: 500; } small { font-size: 0.7rem; background: var(--text); color: #fff; padding: 0.1rem 0.45rem; border-radius: 999px; margin-left: 0.3rem; vertical-align: middle; } }
    nav { display: grid; gap: 0.15rem; }
    nav a { padding: 0.55rem 0.7rem; border-radius: 9px; color: var(--text); font-size: 0.92rem; &:hover { background: var(--bg-soft); } &.on { background: rgba(0, 113, 227, 0.1); color: var(--accent); font-weight: 600; } }
    .who { margin-top: auto; display: grid; gap: 0.3rem; font-size: 0.82rem; }
    .who__email { overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .who__role { color: var(--text-muted); font-size: 0.72rem; letter-spacing: 0.05em; }
    .link { background: none; border: 0; padding: 0; font: inherit; color: var(--accent); cursor: pointer; text-align: left; text-decoration: underline; }
    /* Grid items default to min-width:auto, which lets a wide table stretch the whole page instead of scrolling inside its wrapper. */
    .main { min-width: 0; }
    .bar { display: none; align-items: center; gap: 0.8rem; padding: 0.7rem 1rem; background: var(--bg); border-bottom: 1px solid var(--border); }
    .menu { background: none; border: 1px solid var(--border); border-radius: 8px; font-size: 1.1rem; padding: 0.2rem 0.6rem; cursor: pointer; }
    .content { padding: 1.75rem; max-width: 1280px; width: 100%; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .bar { display: flex; }
      .side { position: fixed; z-index: 30; width: 260px; transform: translateX(-105%); visibility: hidden; transition: transform 0.2s, visibility 0s linear 0.2s; &--open { transform: none; visibility: visible; transition-delay: 0s; box-shadow: 0 0 40px rgba(0,0,0,0.2); } }
      .content { padding: 1rem; }
    }
  `,
})
export class AdminShell implements OnInit {
  protected readonly auth = inject(AdminAuthService);
  private readonly meta = inject(Meta);
  protected readonly open = signal(false);

  ngOnInit() {
    // Keep the admin area out of search results.
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }
}
