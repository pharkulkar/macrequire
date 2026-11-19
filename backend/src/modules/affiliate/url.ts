import { z } from 'zod';

/**
 * Merchant and affiliate URLs are stored exactly as an administrator entered them and are redirected to
 * verbatim. They are never rewritten, because rewriting can break affiliate tracking parameters.
 * This only decides whether a URL is safe to store and redirect to.
 */

const MAX_LENGTH = 2048;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isSafeMerchantUrl(value: string): boolean {
  if (value.length > MAX_LENGTH) return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false; // blocks javascript:, data:, http:, etc.
  if (u.username || u.password) return false; // no embedded credentials
  const host = u.hostname.toLowerCase();
  if (!host.includes('.')) return false; // single-label hosts such as "localhost"
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return false;
  if (IPV4.test(host) || host.startsWith('[')) return false; // IP literals
  return true;
}

/** A product image: a public https link, or a file served by the website itself (frontend/public/images/...). */
const LOCAL_IMAGE = /^\/images\/[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.(webp|png|jpe?g|avif|svg)$/;
export const imageRef = z
  .string()
  .trim()
  .max(MAX_LENGTH, 'URL is too long')
  .refine((v) => LOCAL_IMAGE.test(v) || isSafeMerchantUrl(v), 'Must be a public https:// URL, or a site path like /images/macbook-air-13.webp');

/** Zod schema for a merchant/affiliate URL. */
export const merchantUrl = z
  .string()
  .trim()
  .max(MAX_LENGTH, 'URL is too long')
  .refine(isSafeMerchantUrl, 'Must be a public https:// URL without embedded credentials');
