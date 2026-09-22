/**
 * Backfill script: Creates OrganizationCarrierType records from legacy CarrierType enum
 * for each existing organization.
 * 
 * Usage: npx tsx scripts/backfill-carrier-types.ts
 */
import { prisma } from '../lib/db.ts';
import { runWithTenantContext } from '../lib/tenant-context.ts';

// Legacy CarrierType enum values → human-readable names + display metadata
const LEGACY_CARRIER_TYPES = [
  { code: 'BILLBOARD',       name: 'Billboard',        icon: '🟦', color: '#2563EB', sortOrder: 1 },
  { code: 'BIGBOARD',        name: 'Bigboard',         icon: '🟪', color: '#7C3AED', sortOrder: 2 },
  { code: 'CITYLIGHT',       name: 'Citylight',        icon: '💡', color: '#F59E0B', sortOrder: 3 },
  { code: 'BANNER',          name: 'Banner',           icon: '🏳️', color: '#10B981', sortOrder: 4 },
  { code: 'FACADE',          name: 'Fasádní plachta',   icon: '🏢', color: '#6366F1', sortOrder: 5 },
  { code: 'LED_SCREEN',      name: 'LED obrazovka',    icon: '📺', color: '#EF4444', sortOrder: 6 },
  { code: 'PROMO_BENCH',     name: 'Promo lavička',    icon: '🪑', color: '#8B5CF6', sortOrder: 7 },
  { code: 'PROMO_HORIZON',   name: 'Promo Horizon',    icon: '🌅', color: '#EC4899', sortOrder: 8 },
  { code: 'CITY_POSTER',     name: 'City Poster',      icon: '📋', color: '#14B8A6', sortOrder: 9 },
  { code: 'NAVIGATION',      name: 'Navigace',         icon: '🧭', color: '#F97316', sortOrder: 10 },
  { code: 'PROMO_TOWER',     name: 'Promo Tower',      icon: '🗼', color: '#0EA5E9', sortOrder: 11 },
  { code: 'PROMO_MINITOWER', name: 'Promo Minitower',  icon: '🔹', color: '#64748B', sortOrder: 12 },
  { code: 'OTHER',           name: 'Ostatní',          icon: '📦', color: '#9CA3AF', sortOrder: 99 },
];

async function main() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
    where: { isActive: true },
  });

  console.log(`Found ${organizations.length} active organization(s).`);

  for (const org of organizations) {
    console.log(`\n--- ${org.name} (${org.id}) ---`);

    await runWithTenantContext({ organizationId: org.id, source: 'script' }, async () => {

    for (const ct of LEGACY_CARRIER_TYPES) {
      const existing = await prisma.organizationCarrierType.findFirst({
        where: { organizationId: org.id, code: ct.code },
      });
      if (existing) {
        console.log(`  ✓ ${ct.code} already exists (${existing.id})`);
        continue;
      }
      const created = await prisma.organizationCarrierType.create({
        data: {
          organizationId: org.id,
          code: ct.code,
          name: ct.name,
          icon: ct.icon,
          color: ct.color,
          sortOrder: ct.sortOrder,
          legacyEnumValue: ct.code,
          active: true,
        },
      });
      console.log(`  + Created ${ct.code} → ${created.id}`);
    }

    // Now backfill carrierTypeId on AdvertisingCarrier
    const carriersToUpdate = await prisma.advertisingCarrier.findMany({
      where: { organizationId: org.id, carrierTypeId: null },
      select: { id: true, type: true },
    });
    console.log(`  Backfilling ${carriersToUpdate.length} carrier(s)...`);

    for (const carrier of carriersToUpdate) {
      const oct = await prisma.organizationCarrierType.findFirst({
        where: { organizationId: org.id, legacyEnumValue: carrier.type },
      });
      if (oct) {
        await prisma.advertisingCarrier.update({
          where: { id: carrier.id },
          data: { carrierTypeId: oct.id },
        });
      }
    }

    // Backfill carrierTypeId on AdvertisingSurface
    const surfacesToUpdate = await prisma.advertisingSurface.findMany({
      where: { organizationId: org.id, carrierTypeId: null },
      select: { id: true, mediaType: true },
    });
    console.log(`  Backfilling ${surfacesToUpdate.length} surface(s)...`);

    for (const surface of surfacesToUpdate) {
      // MediaType maps to the same codes (minus NAVIGATION_SIGN)
      const code = surface.mediaType === 'NAVIGATION_SIGN' ? 'NAVIGATION' : surface.mediaType;
      const oct = await prisma.organizationCarrierType.findFirst({
        where: { organizationId: org.id, legacyEnumValue: code },
      });
      if (oct) {
        await prisma.advertisingSurface.update({
          where: { id: surface.id },
          data: { carrierTypeId: oct.id },
        });
      }
    }

    // Backfill carrierTypeId on PriceListItem
    const priceItems = await prisma.priceListItem.findMany({
      where: { organizationId: org.id, carrierTypeId: null, carrierType: { not: null } },
      select: { id: true, carrierType: true },
    });
    console.log(`  Backfilling ${priceItems.length} price list item(s)...`);

    for (const item of priceItems) {
      if (!item.carrierType) continue;
      const oct = await prisma.organizationCarrierType.findFirst({
        where: { organizationId: org.id, legacyEnumValue: item.carrierType },
      });
      if (oct) {
        await prisma.priceListItem.update({
          where: { id: item.id },
          data: { carrierTypeId: oct.id },
        });
      }
    }

    console.log(`  ✓ Done.`);
    });
  }

  console.log('\n=== Backfill complete ===');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
