import { isSafeMerchantUrl } from './url';

/** The merchant fields that decide how a link is built. */
export interface LinkMerchant {
  productUrlTemplate: string | null;
  affiliateIdParam: string | null;
  affiliateId: string | null;
  affiliateLinkTemplate: string | null;
}
export interface LinkOffer {
  productId: string | null;
  regularUrl: string;
  /** Manual override. When set it is used exactly as stored. */
  affiliateUrl: string | null;
}
export interface BuiltLink {
  url: string;
  linkType: 'AFFILIATE' | 'REGULAR';
}

/** A merchant's own product ID: an ASIN, a Best Buy SKU, and similar. Kept strict because it ends up inside a URL. */
export const PRODUCT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/;
/** Names a query parameter, such as "tag". */
export const PARAM_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,29}$/;

/** `{id}` is replaced by the URL-encoded product ID. The result must still be a safe https URL. */
export function productUrl(template: string | null, productId: string | null): string | null {
  if (!template || !productId || !PRODUCT_ID.test(productId)) return null;
  const url = template.split('{id}').join(encodeURIComponent(productId));
  return isSafeMerchantUrl(url) ? url : null;
}

/** The page the shopper lands on without any affiliate tracking. */
export function plainUrl(merchant: LinkMerchant, offer: LinkOffer): string {
  return productUrl(merchant.productUrlTemplate, offer.productId) ?? offer.regularUrl;
}

/**
 * Builds the link a shopper is sent to. It is computed when the click happens, so changing an affiliate ID in the
 * admin changes every link at once.
 *  1. A manual affiliate URL on the offer wins and is used verbatim.
 *  2. Otherwise, if the merchant has an affiliate ID, it is added: by wrapping the link in the network's template
 *     (`{url}` is the encoded product link, `{id}` the encoded affiliate ID), or as a query parameter such as `tag`.
 *  3. Otherwise the plain product link is used.
 */
export function buildLink(merchant: LinkMerchant, offer: LinkOffer): BuiltLink {
  if (offer.affiliateUrl) return { url: offer.affiliateUrl, linkType: 'AFFILIATE' };
  const base = plainUrl(merchant, offer);
  const id = merchant.affiliateId?.trim();
  if (id) {
    if (merchant.affiliateLinkTemplate) {
      const wrapped = merchant.affiliateLinkTemplate.split('{url}').join(encodeURIComponent(base)).split('{id}').join(encodeURIComponent(id));
      if (isSafeMerchantUrl(wrapped)) return { url: wrapped, linkType: 'AFFILIATE' };
    } else if (merchant.affiliateIdParam && PARAM_NAME.test(merchant.affiliateIdParam)) {
      try {
        const u = new URL(base);
        u.searchParams.set(merchant.affiliateIdParam, id);
        return { url: u.toString(), linkType: 'AFFILIATE' };
      } catch {
        /* fall through to the plain link */
      }
    }
  }
  return { url: base, linkType: 'REGULAR' };
}
