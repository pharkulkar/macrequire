import { Component, computed, input, signal } from '@angular/core';

/**
 * A product photo with a text fallback. If there is no URL, or the image fails to load (bad link, blocked, offline),
 * a neutral box with the screen size is shown instead, so the layout never breaks.
 */
@Component({
  selector: 'app-model-image',
  template: `
    @if (showImage()) {
      <img [src]="src()" [class.trim]="isRemote()" [alt]="alt()" [attr.loading]="eager() ? 'eager' : 'lazy'" decoding="async" referrerpolicy="no-referrer" (error)="failed.set(true)" />
    } @else {
      <span class="ph" [attr.role]="decorative() ? null : 'img'" [attr.aria-label]="decorative() ? null : alt()">{{ fallback() }}</span>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: var(--bg-soft); border-radius: inherit; overflow: hidden; }
    /* The photos are about 5:4, and the boxes that hold them use the same ratio, so cover fills the box without cropping. */
    img { width: 100%; height: 100%; object-fit: cover; }
    /* Apple's shots carry about 7% of padding on each side (the Pro ones on a lighter band). A small zoom trims it so
       every image fills its box. Images hosted on this site (paths starting with /) are shown as they are. */
    img.trim { transform: scale(1.16); }
    .ph { color: var(--text-muted); font-weight: 600; font-size: 1.4rem; }
  `,
})
export class ModelImage {
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly fallback = input('');
  readonly eager = input(false);
  readonly decorative = input(false);
  protected readonly isRemote = computed(() => /^https?:/.test(this.src() ?? ''));
  protected readonly failed = signal(false);
  protected readonly showImage = computed(() => !!this.src() && !this.failed());
}
