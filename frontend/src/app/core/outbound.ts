import { environment } from '../../environments/environment';
import { readTestToken } from './test-session';

export type ReferralSource = 'recommendation' | 'catalog' | 'compare' | 'detail';

/**
 * Link to the API's outbound endpoint, which records the click and redirects to the merchant.
 * The merchant or affiliate URL is never built or changed in the browser.
 */
export function outboundUrl(offerId: string, source: ReferralSource, resultId?: string): string {
  const q = new URLSearchParams({ source });
  if (resultId) q.set('result', resultId);
  const test = readTestToken(); // during an administrator's test session the click is recorded as test data
  if (test) q.set('test', test);
  return `${environment.apiUrl}/outbound/${encodeURIComponent(offerId)}?${q.toString()}`;
}
