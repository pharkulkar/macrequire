import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="container">
        <div class="footer__grid">
          <div>
            <strong>MacRequire</strong>
            <p>Configuration-level MacBook recommendations based on what you actually do.</p>
          </div>
          <nav aria-label="Footer">
            <a routerLink="/catalog">MacBooks</a>
            <a routerLink="/applications">Applications</a>
            <a routerLink="/guides">Guides</a>
            <a routerLink="/methodology">How we score</a>
            <a routerLink="/about">About</a>
            <a routerLink="/affiliate-disclosure">Affiliate Disclosure</a>
            <a routerLink="/privacy">Privacy</a>
            <a routerLink="/terms">Terms</a>
          </nav>
        </div>
        <p class="footer__disclosure" id="affiliate-disclosure">
          <strong>Affiliate disclosure:</strong> MacRequire participates in affiliate programs. When you buy through
          some links on this site we may earn a commission at no extra cost to you. Commissions never change a
          recommendation score. Suitability scores are our own estimates; prices are reported by merchants and may
          change. MacRequire is not affiliated with Apple Inc.
          <a routerLink="/affiliate-disclosure">Read more</a>.
        </p>
        <p class="footer__legal">© {{ year }} MacRequire. Mac and MacBook are trademarks of Apple Inc.</p>
      </div>
    </footer>
  `,
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly year = new Date().getFullYear();
}
