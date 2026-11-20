import { Component, input } from '@angular/core';

/**
 * A grey placeholder block that pulses while content loads. Give it the size of the thing it stands in for, so the
 * page keeps its shape and nothing jumps when the real content arrives. It is decorative: screen readers hear the
 * label of the surrounding `app-skeleton-region` instead. The pulse stops when the visitor prefers reduced motion.
 */
@Component({
  selector: 'app-skeleton',
  template: '',
  host: { 'aria-hidden': 'true', '[style.width]': 'width()', '[style.height]': 'height()', '[style.border-radius]': 'radius()' },
  styles: `
    :host { display: block; background: linear-gradient(90deg, var(--bg-soft) 25%, #e8e8ed 37%, var(--bg-soft) 63%); background-size: 400% 100%; animation: skeleton-pulse 1.4s ease infinite; }
    @keyframes skeleton-pulse { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
  `,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly radius = input('8px');
}

/**
 * Wraps a group of skeleton blocks. It announces one short "loading" message to screen readers and marks the area as
 * busy. It fades in only after a quarter of a second, so a fast response never flashes a skeleton at the visitor.
 */
@Component({
  selector: 'app-skeleton-region',
  template: `<div class="region" role="status" aria-busy="true"><span class="sr-only">{{ label() }}</span><ng-content /></div>`,
  styles: `
    .region { opacity: 0; animation: skeleton-in 0.2s ease 250ms forwards; }
    @keyframes skeleton-in { to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .region { animation-duration: 0.01s; } }
  `,
})
export class SkeletonRegion {
  readonly label = input('Loading');
}
