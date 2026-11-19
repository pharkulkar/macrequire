import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { applications, useCases } from './data/applications';
import { defaultRules, defaultWeights } from '../src/engine/rules';
import { chips, models, SPEC_URLS, VERIFIED_AT, verificationFor } from './data/catalog';

const prisma = new PrismaClient();

async function seedChips() {
  const byName = new Map<string, string>();
  for (const c of chips) {
    const data = {
      family: c.family,
      tier: c.tier,
      cpuCores: c.cpuCores,
      superCores: c.superCores ?? null,
      performanceCores: c.performanceCores ?? null,
      efficiencyCores: c.efficiencyCores ?? null,
      gpuCores: c.gpuCores,
      neuralEngineCores: c.neuralEngineCores,
      neuralEngineNote: c.neuralEngineNote ?? null,
      memoryBandwidthGBs: c.memoryBandwidthGBs,
      maxMemoryGB: c.maxMemoryGB,
      cpuPerfIndex: c.cpuPerfIndex,
      gpuPerfIndex: c.gpuPerfIndex,
      perfIndexBasis: c.perfIndexBasis,
      source: 'OFFICIAL_APPLE' as const,
      sourceUrl: c.sourceUrl,
      verifiedAt: VERIFIED_AT,
    };
    const row = await prisma.chipSpecification.upsert({ where: { name: c.name }, update: data, create: { name: c.name, ...data } });
    byName.set(c.name, row.id);
  }
  return byName;
}

async function seedCatalog(chipIds: Map<string, string>) {
  let configCount = 0;
  for (const m of models) {
    const model = await prisma.productModel.upsert({
      where: { slug: m.slug },
      update: {},
      create: {
        slug: m.slug,
        name: m.name,
        category: m.category,
        generation: m.generation,
        releaseYear: m.releaseYear,
        modelIdentifier: m.modelIdentifier ?? null,
        screenSizeInch: m.screenSizeInch,
        officialSpecUrl: m.officialSpecUrl,
        source: 'OFFICIAL_APPLE',
        verifiedAt: VERIFIED_AT,
      },
    });
    // Keep official fields fresh without clobbering admin edits to isActive / imageUrl.
    await prisma.productModel.update({
      where: { id: model.id },
      data: { name: m.name, officialSpecUrl: m.officialSpecUrl, modelIdentifier: m.modelIdentifier ?? null, verifiedAt: VERIFIED_AT },
    });

    for (const c of m.configs) {
      const chipId = chipIds.get(c.chip);
      if (!chipId) throw new Error(`Unknown chip ${c.chip}`);
      const verification = verificationFor(m.slug, c);
      const key = { modelId: model.id, chipId, cpuCores: c.cpuCores, gpuCores: c.gpuCores, ramGB: c.ramGB, storageGB: c.storageGB };
      const spec = {
        displayTech: c.spec.displayTech,
        displayResolution: c.spec.displayResolution,
        refreshRateHz: c.spec.refreshRateHz ?? null,
        brightnessNits: c.spec.brightnessNits,
        batteryWh: c.spec.batteryWh,
        batteryLifeHours: c.spec.batteryLifeHours,
        weightKg: c.spec.weightKg,
        ports: c.spec.ports,
        wireless: c.spec.wireless,
        camera: c.spec.camera,
        audio: c.spec.audio,
        externalDisplays: c.spec.externalDisplays,
        extra: { brightnessNote: c.spec.brightnessNote, webBatteryHours: c.spec.webBatteryHours, batteryLifeNote: 'Apple-claimed video streaming hours' },
        source: 'OFFICIAL_APPLE' as const,
        sourceUrl: m.officialSpecUrl,
        verifiedAt: VERIFIED_AT,
      };
      await prisma.productConfiguration.upsert({
        where: { modelId_chipId_cpuCores_gpuCores_ramGB_storageGB: key },
        update: { verification, colors: m.colors, source: 'OFFICIAL_APPLE', verifiedAt: VERIFIED_AT, specification: { upsert: { create: spec, update: spec } } },
        create: { ...key, colors: m.colors, verification, source: 'OFFICIAL_APPLE', verifiedAt: VERIFIED_AT, specification: { create: spec } },
      });
      configCount++;
    }
  }
  return configCount;
}

/** Merchants only. No offers, prices or affiliate URLs are seeded. */
async function seedMerchants() {
  const list = [
    { slug: 'apple-store-us', name: 'Apple Store (US)', country: 'US', websiteUrl: 'https://www.apple.com/shop' },
    { slug: 'apple-store-in', name: 'Apple Store (India)', country: 'IN', websiteUrl: 'https://www.apple.com/in/shop' },
    // Amazon links are built from the ASIN; the Associates tag is added in the admin (Merchants), never in code.
    { slug: 'amazon-us', name: 'Amazon.com', country: 'US', websiteUrl: 'https://www.amazon.com', productUrlTemplate: 'https://www.amazon.com/dp/{id}', affiliateIdParam: 'tag' },
    { slug: 'amazon-in', name: 'Amazon.in', country: 'IN', websiteUrl: 'https://www.amazon.in', productUrlTemplate: 'https://www.amazon.in/dp/{id}', affiliateIdParam: 'tag' },
    // Best Buy affiliate links come from its network (Impact): set the link template in the admin once you are accepted.
    { slug: 'best-buy-us', name: 'Best Buy', country: 'US', websiteUrl: 'https://www.bestbuy.com', productUrlTemplate: 'https://www.bestbuy.com/site/-/{id}.p?skuId={id}' },
    { slug: 'flipkart-in', name: 'Flipkart', country: 'IN', websiteUrl: 'https://www.flipkart.com' },
  ];
  for (const m of list) {
    await prisma.merchant.upsert({ where: { slug: m.slug }, update: { name: m.name, websiteUrl: m.websiteUrl }, create: m });
    // Link settings are only filled in when empty, so values set in the admin are never overwritten.
    const { productUrlTemplate, affiliateIdParam } = m as { productUrlTemplate?: string; affiliateIdParam?: string };
    if (productUrlTemplate) await prisma.merchant.updateMany({ where: { slug: m.slug, productUrlTemplate: null }, data: { productUrlTemplate } });
    if (affiliateIdParam) await prisma.merchant.updateMany({ where: { slug: m.slug, affiliateIdParam: null }, data: { affiliateIdParam } });
  }
  return list.length;
}

/**
 * Applications and use cases are create-only by default so admin edits survive re-seeding.
 * Set SEED_RESET_APPLICATIONS=1 to overwrite existing rows with the seed values.
 */
const RESET = process.env.SEED_RESET_APPLICATIONS === '1';

async function seedApplications() {
  for (const a of applications) {
    const requirement = {
      minRamGB: a.minRamGB,
      preferredRamGB: a.preferredRamGB,
      cpuDemand: a.cpuDemand,
      gpuDemand: a.gpuDemand,
      storageGB: a.storageGB,
      intensity: a.intensity,
      concurrencyFactor: a.concurrencyFactor,
      needsAppleSilicon: a.needsAppleSilicon ?? false,
      extra: a.extra ?? undefined,
      basis: a.basis ?? 'ESTIMATE',
      basisNote: a.basisNote ?? 'MacRequire estimate; not a vendor-published figure.',
      sourceUrl: a.sourceUrl ?? null,
      verifiedAt: a.basis === 'VENDOR_PUBLISHED' ? VERIFIED_AT : null,
    };
    const app = {
      name: a.name,
      category: a.category,
      macSupported: a.macSupported,
      notes: a.notes ?? null,
      aliases: a.aliases ?? [],
    };
    await prisma.application.upsert({
      where: { slug: a.slug },
      update: RESET ? { ...app, requirements: { upsert: { create: requirement, update: requirement } } } : {},
      create: { slug: a.slug, ...app, requirements: { create: requirement } },
    });
  }
  return applications.length;
}

async function seedUseCases() {
  let order = 0;
  for (const u of useCases) {
    order += 1;
    const base = { name: u.name, description: u.description, appCategories: u.appCategories, starterApps: u.starterApps, sortOrder: order };
    const row = await prisma.useCase.upsert({
      where: { slug: u.slug },
      update: RESET ? base : {},
      create: { slug: u.slug, ...base },
    });
    // Fill the starter apps when empty, so values edited in the admin are kept.
    if (row.starterApps.length === 0) await prisma.useCase.update({ where: { id: row.id }, data: { starterApps: u.starterApps } });
    for (const [category, multiplier] of Object.entries(u.weights)) {
      await prisma.useCaseWeight.upsert({
        where: { useCaseId_category: { useCaseId: row.id, category } },
        update: RESET ? { multiplier } : {},
        create: { useCaseId: row.id, category, multiplier },
      });
    }
  }
  return useCases.length;
}

/** Creates the default scoring rule set once. Admin edits are never overwritten (use SEED_RESET_APPLICATIONS=1 to reset). */
async function seedRuleSet() {
  const existing = await prisma.scoringRuleSet.findFirst({ where: { name: 'Default' } });
  const data = { weights: defaultWeights as object, rules: defaultRules as object, isActive: true };
  if (!existing) await prisma.scoringRuleSet.create({ data: { name: 'Default', ...data } });
  else if (RESET) await prisma.scoringRuleSet.update({ where: { id: existing.id }, data });
  else {
    const stored = (existing.rules as { version?: string } | null)?.version;
    if (stored !== defaultRules.version) {
      console.log(`Note: rule set "Default" is on ${stored ?? 'an unversioned rules schema'}; code defaults are ${defaultRules.version}. Stored values win over defaults. Run with SEED_RESET_APPLICATIONS=1 to adopt the new defaults (this overwrites admin edits).`);
    }
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, skipping admin user.');
    return;
  }
  if (process.env.NODE_ENV === 'production' && (password.length < 12 || /change-me|password/i.test(password) || email.endsWith('.local'))) {
    throw new Error('Refusing to create the admin account in production with a placeholder email or a weak password. Set SEED_ADMIN_EMAIL and a strong SEED_ADMIN_PASSWORD (12+ characters).');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({ where: { email }, update: {}, create: { email, passwordHash } });
}

async function main() {
  const chipIds = await seedChips();
  const configs = await seedCatalog(chipIds);
  const merchants = await seedMerchants();
  const apps = await seedApplications();
  const ucs = await seedUseCases();
  await seedRuleSet();
  await seedAdmin();
  console.log(`Seeded ${chips.length} chips, ${models.length} models, ${configs} configurations, ${merchants} merchants, ${apps} applications, ${ucs} use cases.`);
  console.log(`Specs verified against Apple pages on ${VERIFIED_AT.toISOString().slice(0, 10)} (${SPEC_URLS.identifyPro}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
