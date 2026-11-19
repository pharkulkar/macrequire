import { createHash } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { siteSettings } from '../../lib/site-settings';
import { buildLink } from './links';
import { isSafeMerchantUrl } from './url';

/** Where the click came from. Anything else is stored as "other" so arbitrary strings cannot pollute analytics. */
export const REFERRAL_SOURCES = ['recommendation', 'catalog', 'compare', 'detail', 'other'] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor|curl|wget|python-requests|go-http-client|httpclient/i;
const DEDUPE_SECONDS = 5;

export interface ClickContext {
  source?: string;
  resultId?: string;
  userAgent?: string;
  ip?: string;
  method: string;
  /** Click made during an administrator's test session. */
  isTest?: boolean;
}

export type OutboundResult =
  | { ok: true; url: string; linkType: 'AFFILIATE' | 'REGULAR'; recorded: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'INACTIVE' | 'UNSAFE_URL' };

const hashIp = (ip?: string) => (ip ? createHash('sha256').update(`${env.IP_HASH_SALT}:${ip}`).digest('hex').slice(0, 32) : null);
const toSource = (s?: string): ReferralSource => ((REFERRAL_SOURCES as readonly string[]).includes(s ?? '') ? (s as ReferralSource) : 'other');

export const outboundService = {
  /**
   * Resolves the redirect target for an offer and records the click.
   * The link is built from the merchant's settings and the offer's product ID (see links.ts).
   */
  async resolve(offerId: string, ctx: ClickContext): Promise<OutboundResult> {
    const offer = await prisma.merchantOffer.findUnique({
      where: { id: offerId },
      include: { merchant: { select: { id: true, isActive: true, productUrlTemplate: true, affiliateIdParam: true, affiliateId: true, affiliateLinkTemplate: true } }, configuration: { select: { id: true, modelId: true, isActive: true, verification: true, model: { select: { isActive: true } } } } },
    });
    if (!offer) return { ok: false, reason: 'NOT_FOUND' };
    if (offer.configuration.verification === 'CTO_DERIVED' && !siteSettings().showCtoConfigurations) return { ok: false, reason: 'INACTIVE' };
    if (!offer.isActive || !offer.merchant.isActive || !offer.configuration.isActive || !offer.configuration.model.isActive) {
      return { ok: false, reason: 'INACTIVE' };
    }

    const { url, linkType } = buildLink(offer.merchant, offer);
    // Defence in depth: stored URLs were validated on write, but never redirect to one that is not safe.
    if (!isSafeMerchantUrl(url)) {
      logger.error({ offerId }, 'Refusing to redirect to an unsafe stored URL');
      return { ok: false, reason: 'UNSAFE_URL' };
    }

    const isBot = !ctx.userAgent || BOT_PATTERN.test(ctx.userAgent);
    if (ctx.method === 'HEAD' || isBot) return { ok: true, url, linkType, recorded: false };

    let recorded = false;
    try {
      recorded = await this.record({ offerId, ctx, offer: { configurationId: offer.configurationId, modelId: offer.configuration.modelId, merchantId: offer.merchantId, country: offer.country }, linkType });
    } catch (err) {
      // Tracking must never stop a user reaching the merchant.
      logger.error({ err, offerId }, 'Failed to record outbound click');
    }
    return { ok: true, url, linkType, recorded };
  },

  async record(args: {
    offerId: string;
    ctx: ClickContext;
    offer: { configurationId: string; modelId: string; merchantId: string; country: string };
    linkType: 'AFFILIATE' | 'REGULAR';
  }): Promise<boolean> {
    const { offerId, ctx, offer, linkType } = args;
    const ipHash = hashIp(ctx.ip);

    // Ignore rapid repeats (double clicks, refreshes) from the same visitor on the same offer.
    if (ipHash) {
      const since = new Date(Date.now() - DEDUPE_SECONDS * 1000);
      const recent = await prisma.affiliateClickEvent.findFirst({ where: { offerId, ipHash, createdAt: { gte: since } }, select: { id: true } });
      if (recent) return false;
    }

    // Only attribute to a recommendation result if it really is a result for this configuration.
    let resultId: string | null = null;
    if (ctx.resultId) {
      const r = await prisma.recommendationResult.findUnique({ where: { id: ctx.resultId }, select: { id: true, configurationId: true } });
      if (r && r.configurationId === offer.configurationId) resultId = r.id;
    }

    await prisma.affiliateClickEvent.create({
      data: {
        offerId,
        configurationId: offer.configurationId,
        productModelId: offer.modelId,
        merchantId: offer.merchantId,
        country: offer.country,
        referralSource: toSource(ctx.source),
        linkType,
        resultId,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
        ipHash,
        isTest: ctx.isTest ?? false,
      },
    });
    return true;
  },
};
