import { environment } from '../../environments/environment';

export type ReferralSource = 'recommendation' | 'catalog' | 'compare' | 'detail';

/**
 * Link to the API's outbound endpoint, which records the click and redirects to the merchant.
 * The merchant or affiliate URL is never built or changed in the browser.
 */
export function outboundUrl(offerId: string, source: ReferralSource, resultId?: string): string {
  const q = new URLSearchParams({ source });
  if (resultId) q.set('result', resultId);
  return `${environment.apiUrl}/outbound/${encodeURIComponent(offerId)}?${q.toString()}`;
}
