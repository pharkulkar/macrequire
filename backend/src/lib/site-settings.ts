import { prisma } from './prisma';

/** Site-wide switches an administrator can change without a deploy. Defaults apply until a value is saved. */
export interface SiteSettings {
  /** Show configure-to-order (CTO_DERIVED) configurations on the public site. When off they are hidden everywhere. */
  showCtoConfigurations: boolean;
}
const DEFAULTS: SiteSettings = { showCtoConfigurations: true };
const TTL_MS = 5_000;

let current: SiteSettings = { ...DEFAULTS };
let loadedAt = 0;

/** Synchronous read of the last loaded settings. Call `refreshSettings()` first (the API router does, per request). */
export const siteSettings = (): SiteSettings => current;

/** Reloads from the database when the cached copy is older than a few seconds. A failure keeps the last known values. */
export async function refreshSettings(force = false): Promise<SiteSettings> {
  if (!force && Date.now() - loadedAt < TTL_MS) return current;
  try {
    const rows = await prisma.siteSetting.findMany();
    const next = { ...DEFAULTS };
    for (const r of rows) if (r.key === 'showCtoConfigurations' && typeof r.value === 'boolean') next.showCtoConfigurations = r.value;
    current = next;
    loadedAt = Date.now();
  } catch {
    /* keep the previous values */
  }
  return current;
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  for (const [key, value] of Object.entries(patch)) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  return refreshSettings(true);
}

/**
 * Prisma filter that keeps hidden configurations out of public queries. Spread it into a ProductConfiguration `where`
 * (or into a relation filter on one). Admin screens do not use it.
 */
export const publicConfigurationFilter = (): { verification?: { not: string } } => (siteSettings().showCtoConfigurations ? {} : { verification: { not: 'CTO_DERIVED' } });
