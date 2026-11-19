import { Prisma } from '@prisma/client';
import { HttpError, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { buildLink, plainUrl, productUrl } from '../affiliate/links';
import {
  CURRENCY_BY_COUNTRY,
  MerchantCreate,
  MerchantUpdate,
  OfferCreate,
  OfferListQuery,
  OfferUpdate,
  ProgramCreate,
  ProgramUpdate,
} from './commerce.schemas';

/** Turns a unique-constraint violation into a clear 409 instead of a 500. */
async function guardUnique<T>(op: () => Promise<T>, message: string): Promise<T> {
  try {
    return await op();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError(409, message);
    throw e;
  }
}

const offerInclude = {
  merchant: { select: { id: true, slug: true, name: true, country: true, productUrlTemplate: true, affiliateIdParam: true, affiliateId: true, affiliateLinkTemplate: true } },
  program: { select: { id: true, name: true, network: true, affiliateId: true } },
  configuration: {
    select: {
      id: true,
      ramGB: true,
      storageGB: true,
      cpuCores: true,
      gpuCores: true,
      model: { select: { id: true, name: true } },
      chip: { select: { name: true } },
    },
  },
} satisfies Prisma.MerchantOfferInclude;
type OfferRecord = Prisma.MerchantOfferGetPayload<{ include: typeof offerInclude }>;

const storageLabel = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);
const DAY = 86_400_000;

function offerDto(o: OfferRecord, staleDays = 7) {
  const c = o.configuration;
  const verified = o.priceVerifiedAt?.getTime() ?? null;
  return {
    id: o.id,
    configuration: {
      id: c.id,
      modelName: c.model.name,
      label: `${c.chip.name} (${c.cpuCores}-core CPU, ${c.gpuCores}-core GPU) · ${c.ramGB}GB · ${storageLabel(c.storageGB)}`,
    },
    merchant: { id: o.merchant.id, slug: o.merchant.slug, name: o.merchant.name, country: o.merchant.country },
    program: o.program,
    productId: o.productId,
    /** What a shopper is sent to right now, and the same page without tracking. Computed, never stored. */
    finalLink: buildLink(o.merchant, o).url,
    plainLink: plainUrl(o.merchant, o),
    country: o.country,
    currency: o.currency,
    price: o.price,
    listPrice: o.listPrice,
    stock: o.stock,
    regularUrl: o.regularUrl,
    affiliateUrl: o.affiliateUrl,
    hasAffiliateLink: buildLink(o.merchant, o).linkType === 'AFFILIATE',
    source: o.source,
    priceVerifiedAt: o.priceVerifiedAt,
    stale: verified === null || Date.now() - verified > staleDays * DAY,
    isActive: o.isActive,
    updatedAt: o.updatedAt,
  };
}

export const commerceService = {
  // ------------------------------------------------------------ merchants
  async listMerchants(q: { country?: string; includeInactive: boolean }) {
    const rows = await prisma.merchant.findMany({
      where: { ...(q.country && { country: q.country }), ...(!q.includeInactive && { isActive: true }) },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { offers: true, programs: true } } },
    });
    return { data: rows.map((m) => ({ id: m.id, slug: m.slug, name: m.name, country: m.country, websiteUrl: m.websiteUrl, isActive: m.isActive, productUrlTemplate: m.productUrlTemplate, affiliateIdParam: m.affiliateIdParam, affiliateId: m.affiliateId, affiliateLinkTemplate: m.affiliateLinkTemplate, offerCount: m._count.offers, programCount: m._count.programs })) };
  },

  async createMerchant(input: MerchantCreate) {
    return guardUnique(() => prisma.merchant.create({ data: input }), `A merchant with slug "${input.slug}" already exists`);
  },

  async updateMerchant(id: string, input: MerchantUpdate) {
    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) throw notFound('Merchant');
    return prisma.merchant.update({ where: { id }, data: input });
  },

  // ------------------------------------------------------------ programs
  async listPrograms(q: { merchantId?: string; includeInactive: boolean }) {
    const rows = await prisma.affiliateProgram.findMany({
      where: { ...(q.merchantId && { merchantId: q.merchantId }), ...(!q.includeInactive && { isActive: true }) },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
      include: { merchant: { select: { id: true, name: true, slug: true } }, _count: { select: { offers: true } } },
    });
    return { data: rows.map((p) => ({ id: p.id, name: p.name, network: p.network, country: p.country, affiliateId: p.affiliateId, isActive: p.isActive, merchant: p.merchant, offerCount: p._count.offers })) };
  },

  async createProgram(input: ProgramCreate) {
    const merchant = await prisma.merchant.findUnique({ where: { id: input.merchantId } });
    if (!merchant) throw notFound('Merchant');
    if (merchant.country !== input.country) throw new HttpError(400, `Merchant ${merchant.name} operates in ${merchant.country}; a program for ${input.country} cannot be attached to it`);
    return guardUnique(() => prisma.affiliateProgram.create({ data: input }), 'This merchant already has a program with that name for this country');
  },

  async updateProgram(id: string, input: ProgramUpdate) {
    const existing = await prisma.affiliateProgram.findUnique({ where: { id } });
    if (!existing) throw notFound('Affiliate program');
    return guardUnique(() => prisma.affiliateProgram.update({ where: { id }, data: input }), 'This merchant already has a program with that name for this country');
  },

  // --------------------------------------------------------------- offers
  async listOffers(q: OfferListQuery) {
    const where: Prisma.MerchantOfferWhereInput = {
      ...(q.configurationId && { configurationId: q.configurationId }),
      ...(q.merchantId && { merchantId: q.merchantId }),
      ...(q.country && { country: q.country }),
      ...(q.active !== undefined && { isActive: q.active }),
      ...(q.staleDays && { OR: [{ priceVerifiedAt: null }, { priceVerifiedAt: { lt: new Date(Date.now() - q.staleDays * DAY) } }] }),
    };
    const [total, rows] = await prisma.$transaction([
      prisma.merchantOffer.count({ where }),
      prisma.merchantOffer.findMany({ where, include: offerInclude, orderBy: [{ updatedAt: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    ]);
    return { data: rows.map((o) => offerDto(o, q.staleDays ?? 7)), pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) } };
  },

  async getOffer(id: string) {
    const o = await prisma.merchantOffer.findUnique({ where: { id }, include: offerInclude });
    if (!o) throw notFound('Offer');
    return offerDto(o);
  },

  async createOffer(input: OfferCreate) {
    const [configuration, merchant] = await Promise.all([
      prisma.productConfiguration.findUnique({ where: { id: input.configurationId }, select: { id: true } }),
      prisma.merchant.findUnique({ where: { id: input.merchantId } }),
    ]);
    if (!configuration) throw notFound('Configuration');
    if (!merchant) throw notFound('Merchant');
    if (!merchant.isActive) throw new HttpError(400, 'This merchant is inactive');
    await this.assertProgramBelongsToMerchant(input.programId, merchant.id);

    // Country and currency follow the merchant, so an offer can never disagree with its merchant.
    const country = merchant.country as keyof typeof CURRENCY_BY_COUNTRY;
    const currency = CURRENCY_BY_COUNTRY[country];
    const { programId, regularUrl: givenUrl, ...rest } = input;
    const regularUrl = givenUrl ?? productUrl(merchant.productUrlTemplate, input.productId);
    if (!regularUrl) throw new HttpError(400, merchant.productUrlTemplate ? 'Give a product ID (for example the ASIN) or a regular product URL' : `Give a regular product URL. ${merchant.name} has no product link template, so a product ID alone cannot make a link`);

    const created = await guardUnique(
      () =>
        prisma.$transaction(async (tx) => {
          const offer = await tx.merchantOffer.create({
            data: { ...rest, regularUrl, programId: programId ?? null, country, currency, priceVerifiedAt: input.price !== null ? new Date() : null },
          });
          await tx.priceHistory.create({
            data: { offerId: offer.id, configurationId: offer.configurationId, price: offer.price, listPrice: offer.listPrice, currency, stock: offer.stock },
          });
          return offer;
        }),
      'An offer for this configuration, merchant and country already exists. Update the existing offer instead.',
    );
    return this.getOffer(created.id);
  },

  async updateOffer(id: string, input: OfferUpdate) {
    const existing = await prisma.merchantOffer.findUnique({ where: { id } });
    if (!existing) throw notFound('Offer');
    if (input.programId) await this.assertProgramBelongsToMerchant(input.programId, existing.merchantId);

    const { verifyPrice, ...fields } = input;
    if (fields.productId !== undefined && fields.regularUrl === undefined) {
      const merchant = await prisma.merchant.findUnique({ where: { id: existing.merchantId }, select: { productUrlTemplate: true } });
      const derived = productUrl(merchant?.productUrlTemplate ?? null, fields.productId);
      if (derived) fields.regularUrl = derived;
    }
    const nextPrice = fields.price !== undefined ? fields.price : existing.price;
    const nextList = fields.listPrice !== undefined ? fields.listPrice : existing.listPrice;
    if (nextPrice !== null && nextList !== null && nextList < nextPrice) throw new HttpError(400, 'List price cannot be lower than the selling price');

    const changed =
      (fields.price !== undefined && fields.price !== existing.price) ||
      (fields.listPrice !== undefined && fields.listPrice !== existing.listPrice) ||
      (fields.stock !== undefined && fields.stock !== existing.stock);
    // Supplying a price (or asking to verify) means the administrator has just checked it.
    const reverify = (fields.price !== undefined && fields.price !== null) || verifyPrice === true;

    await prisma.$transaction(async (tx) => {
      await tx.merchantOffer.update({ where: { id }, data: { ...fields, ...(reverify && nextPrice !== null ? { priceVerifiedAt: new Date() } : {}) } });
      if (changed) {
        await tx.priceHistory.create({
          data: { offerId: id, configurationId: existing.configurationId, price: nextPrice, listPrice: nextList, currency: existing.currency, stock: fields.stock ?? existing.stock },
        });
      }
    });
    return this.getOffer(id);
  },

  /** Offers are deactivated rather than deleted so click history and price history stay intact. */
  async deactivateOffer(id: string) {
    return this.updateOffer(id, { isActive: false });
  },

  async priceHistory(offerId: string) {
    const offer = await prisma.merchantOffer.findUnique({ where: { id: offerId }, select: { id: true, currency: true } });
    if (!offer) throw notFound('Offer');
    const rows = await prisma.priceHistory.findMany({ where: { offerId }, orderBy: { recordedAt: 'desc' }, take: 500 });
    return { data: rows.map((r) => ({ id: r.id, price: r.price, listPrice: r.listPrice, currency: r.currency, stock: r.stock, recordedAt: r.recordedAt })) };
  },

  async assertProgramBelongsToMerchant(programId: string | undefined | null, merchantId: string) {
    if (!programId) return;
    const program = await prisma.affiliateProgram.findUnique({ where: { id: programId } });
    if (!program) throw notFound('Affiliate program');
    if (program.merchantId !== merchantId) throw new HttpError(400, 'That affiliate program belongs to a different merchant');
  },
};
