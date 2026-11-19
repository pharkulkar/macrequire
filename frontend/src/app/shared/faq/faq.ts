import { Component, input } from '@angular/core';

export interface FaqItem { q: string; a: string }

/**
 * Visible FAQ. Pages build their FAQPage structured data from the same array so the markup always matches what
 * readers see. The answers are in the HTML (not collapsed away by script), so crawlers and AI engines read them.
 */
@Component({
  selector: 'app-faq',
  template: `
    <section class="faq" [attr.aria-label]="label()">
      @for (f of items(); track f.q) {
        <details>
          <summary>{{ f.q }}</summary>
          <p>{{ f.a }}</p>
        </details>
      }
    </section>
  `,
  styles: `
    .faq { margin: 1rem 0 2rem; }
    details { border: 1px solid var(--border); border-radius: 12px; padding: 0.9rem 1.1rem; margin-bottom: 0.75rem; }
    summary { cursor: pointer; font-weight: 600; }
    p { margin: 0.75rem 0 0; line-height: 1.7; }
  `,
})
export class Faq {
  readonly items = input.required<FaqItem[]>();
  readonly label = input('Frequently asked questions');
}
