import { z } from 'zod';
import { PARAM_NAME, PRODUCT_ID } from '../affiliate/links';
import { isSafeMerchantUrl, merchantUrl } from '../affiliate/url';

export const COUNTRIES = ['IN', 'US'] as const;
export const CURRENCY_BY_COUNTRY: Record<(typeof COUNTRIES)[number], 'INR' | 'USD'> = { IN: 'INR', US: 'USD' };

const country = z.enum(COUNTRIES);
const id = z.string().trim().min(1).max(60);
/** A price in the currency's main unit with at most 2 decimals (899.99). */
const money = z
  .number()
  .min(0)
  .max(100_000_000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use at most 2 decimal places');
const stock = z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'LIMITED', 'UNKNOWN']);
const dataSource = z.enum(['OFFICIAL_APPLE', 'MERCHANT_FEED', 'ADMIN_VERIFIED', 'SAMPLE']);
const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };

export const idParam = z.object({ id });

// ---- link settings (how product links and affiliate links are built for a merchant)
const productIdField = z.string().trim().regex(PRODUCT_ID, 'Use the merchant\'s product ID: 3 to 40 letters, numbers, dots, dashes or underscores');
const productUrlTemplate = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v.includes('{id}'), 'The template must contain {id}, where the product ID goes')
  .refine((v) => isSafeMerchantUrl(v.split('{id}').join('B0TEST1234')), 'The template must make a public https:// URL, e.g. https://www.amazon.com/dp/{id}');
const affiliateIdParam = z.string().trim().regex(PARAM_NAME, 'Use a parameter name such as tag');
const affiliateId = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._~-]+$/, 'Use letters, numbers, dots, dashes, underscores only');
const affiliateLinkTemplate = z
  .string()
  .trim()
  .max(700)
  .refine((v) => v.includes('{url}'), 'The template must contain {url}, where the product link goes')
  .refine((v) => isSafeMerchantUrl(v.split('{url}').join('https%3A%2F%2Fexample.com').split('{id}').join('123')), 'The template must make a public https:// URL');
const linkSettings = {
  productUrlTemplate: productUrlTemplate.nullable(),
  affiliateIdParam: affiliateIdParam.nullable(),
  affiliateId: affiliateId.nullable(),
  affiliateLinkTemplate: affiliateLinkTemplate.nullable(),
};

// ---- merchants
export const merchantCreate = z
  .object({
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens').max(60),
    name: z.string().trim().min(1).max(100),
    country,
    websiteUrl: merchantUrl.optional(),
    isActive: z.boolean().default(true),
    ...Object.fromEntries(Object.entries(linkSettings).map(([k, v]) => [k, v.optional()])) as { [K in keyof typeof linkSettings]: z.ZodOptional<(typeof linkSettings)[K]> },
  })
  .strict();
export const merchantUpdate = z
  .object({ name: z.string().trim().min(1).max(100), websiteUrl: merchantUrl.nullable(), isActive: z.boolean(), ...linkSettings })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');
export const merchantListQuery = z.object({ country: country.optional(), includeInactive: z.enum(['true', 'false']).default('false').transform((v) => v === 'true') });

// ---- affiliate programs
export const programCreate = z
  .object({
    merchantId: id,
    name: z.string().trim().min(1).max(100),
    network: z.string().trim().max(100).optional(),
    country,
    affiliateId: z.string().trim().max(200).optional(),
    isActive: z.boolean().default(true),
  })
  .strict();
export const programUpdate = z
  .object({ name: z.string().trim().min(1).max(100), network: z.string().trim().max(100).nullable(), affiliateId: z.string().trim().max(200).nullable(), isActive: z.boolean() })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');
export const programListQuery = z.object({ merchantId: id.optional(), includeInactive: z.enum(['true', 'false']).default('false').transform((v) => v === 'true') });

// ---- offers
export const offerCreate = z
  .object({
    configurationId: id,
    merchantId: id,
    programId: id.optional(),
    price: money.nullable().default(null),
    listPrice: money.nullable().default(null),
    stock: stock.default('UNKNOWN'),
    /** Optional when the merchant has a product link template and a productId is given. */
    regularUrl: merchantUrl.optional(),
    productId: productIdField.nullable().default(null),
    affiliateUrl: merchantUrl.nullable().default(null),
    source: dataSource.default('ADMIN_VERIFIED'),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((o) => o.price === null || o.listPrice === null || o.listPrice >= o.price, { message: 'List price cannot be lower than the selling price', path: ['listPrice'] });

export const offerUpdate = z
  .object({
    programId: id.nullable(),
    price: money.nullable(),
    listPrice: money.nullable(),
    stock,
    regularUrl: merchantUrl,
    productId: productIdField.nullable(),
    affiliateUrl: merchantUrl.nullable(),
    source: dataSource,
    isActive: z.boolean(),
    /** Re-confirm the current price without changing it. */
    verifyPrice: z.boolean(),
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

export const offerListQuery = z.object({
  ...page,
  configurationId: id.optional(),
  merchantId: id.optional(),
  country: country.optional(),
  active: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  /** Only offers whose price is missing or was last verified more than this many days ago. */
  staleDays: z.coerce.number().int().min(1).max(365).optional(),
});

export type MerchantCreate = z.infer<typeof merchantCreate>;
export type MerchantUpdate = z.infer<typeof merchantUpdate>;
export type ProgramCreate = z.infer<typeof programCreate>;
export type ProgramUpdate = z.infer<typeof programUpdate>;
export type OfferCreate = z.infer<typeof offerCreate>;
export type OfferUpdate = z.infer<typeof offerUpdate>;
export type OfferListQuery = z.infer<typeof offerListQuery>;
