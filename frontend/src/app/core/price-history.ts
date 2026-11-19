import { Offer } from './catalog.models';
import { formatMoney } from './format';

export interface PriceNote {
  kind: 'drop' | 'low' | 'above-low';
  text: string;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * A short, factual line about an offer's recorded price history, or null when there is nothing worth saying.
 * "Recorded" means prices MacRequire has saved when they changed; it is not a guarantee about the merchant's full history.
 */
export function priceNote(offer: Pick<Offer, 'price' | 'currency' | 'priceStats'> | null | undefined): PriceNote | null {
  const s = offer?.priceStats;
  const price = offer?.price;
  if (!offer || !s || price === null || price === undefined) return null;
  const money = (n: number) => formatMoney(n, offer.currency);
  if (s.previous && s.previous.amount > price) return { kind: 'drop', text: `Down from ${money(s.previous.amount)} (recorded ${shortDate(s.previous.recordedAt)})` };
  if (s.lowest.amount < price) return { kind: 'above-low', text: `Lowest we've recorded: ${money(s.lowest.amount)} (${shortDate(s.lowest.recordedAt)})` };
  if (s.observations > 1 && s.lowest.amount === price) return { kind: 'low', text: "Lowest price we've recorded" };
  return null;
}
