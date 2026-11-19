import { Injectable, computed, signal } from '@angular/core';

export const MAX_COMPARE = 4;

export interface CompareItem {
  id: string;
  label: string;
}

const KEY = 'macrequire.compare.v1';

/** The user's comparison basket (up to four configurations), kept for the browser tab. */
@Injectable({ providedIn: 'root' })
export class CompareService {
  readonly items = signal<CompareItem[]>(this.load());
  readonly count = computed(() => this.items().length);
  readonly full = computed(() => this.items().length >= MAX_COMPARE);
  readonly ids = computed(() => this.items().map((i) => i.id));

  has(id: string): boolean {
    return this.items().some((i) => i.id === id);
  }

  /** Returns false when the basket is already full. */
  add(item: CompareItem): boolean {
    if (this.has(item.id)) return true;
    if (this.full()) return false;
    this.set([...this.items(), item]);
    return true;
  }

  remove(id: string) {
    this.set(this.items().filter((i) => i.id !== id));
  }

  toggle(item: CompareItem): boolean {
    if (this.has(item.id)) {
      this.remove(item.id);
      return true;
    }
    return this.add(item);
  }

  clear() {
    this.set([]);
  }

  private set(items: CompareItem[]) {
    this.items.set(items);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable: the basket still works for this page view */
    }
  }

  private load(): CompareItem[] {
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as CompareItem[];
      return Array.isArray(raw) ? raw.filter((i) => i && typeof i.id === 'string').slice(0, MAX_COMPARE) : [];
    } catch {
      return [];
    }
  }
}
