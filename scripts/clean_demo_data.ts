import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { prisma } from '../lib/db';
import { enterTenantContext } from '../lib/tenant-context';

enterTenantContext({ organizationId: process.env.ORGANIZATION_ID ?? 'org_seepoint_default', source: 'script' });

async function main() {
  console.log('🧹 Zahajuji mazání demo / vzorových dat...\n');

  // 1. Delete seed occupancies
  const deletedOccupancies = await prisma.occupancy.deleteMany({
    where: {
      OR: [
        { id: { in: ['o1', 'o2'] } },
        { clientName: { in: ['Auto ESA', 'Kavárna Metro'] } },
        { surfaceId: { in: ['s1', 's2', 's3', 's4'] } },
      ],
    },
  });
  console.log(`✓ Smazáno ${deletedOccupancies.count} vzorových rezervací.`);

  // 2. Delete seed photos
  const deletedPhotos = await prisma.photo.deleteMany({
    where: {
      OR: [
        { id: 'p1' },
        { carrierId: { in: ['c1', 'c2', 'c3', 'cmr26xez40001l404vzaxnaso'] } },
        { url: '/placeholder.svg' },
      ],
    },
  });
  console.log(`✓ Smazáno ${deletedPhotos.count} vzorových fotografií.`);

  // 3. Delete seed surfaces
  const deletedSurfaces = await prisma.advertisingSurface.deleteMany({
    where: {
      OR: [
        { id: { in: ['s1', 's2', 's3', 's4'] } },
        { carrierId: { in: ['c1', 'c2', 'c3', 'cmr26xez40001l404vzaxnaso'] } },
      ],
    },
  });
  console.log(`✓ Smazáno ${deletedSurfaces.count} vzorových reklamních ploch.`);

  // 4. Delete seed carriers
  const deletedCarriers = await prisma.advertisingCarrier.deleteMany({
    where: {
      OR: [
        { id: { in: ['c1', 'c2', 'c3', 'cmr26xez40001l404vzaxnaso'] } },
        { code: { in: ['PHA-D1-001', 'PHA-CL-014', 'BRN-LED-007', 'asd'] } },
      ],
    },
  });
  console.log(`✓ Smazáno ${deletedCarriers.count} vzorových reklamních nosičů.`);

  // 5. Delete demo settlements & relations
  await prisma.settlementAdjustment.deleteMany({
    where: { settlementId: 'settlement-demo-novak' },
  });
  await prisma.settlementAuditLog.deleteMany({
    where: { settlementId: 'settlement-demo-novak' },
  });
  await prisma.settlementItem.deleteMany({
    where: { settlementId: 'settlement-demo-novak' },
  });

  const deletedSettlements = await prisma.settlement.deleteMany({
    where: { id: 'settlement-demo-novak' },
  });
  console.log(`✓ Smazáno ${deletedSettlements.count} demo vyúčtování (employee-demo-novak).`);

  const deletedDemoEmployeeRates = await prisma.employeeRate.deleteMany({
    where: { employeeId: 'employee-demo-novak' },
  });
  console.log(`✓ Smazáno ${deletedDemoEmployeeRates.count} demo sazeb zaměstnance.`);

  // Delete work expenses for demo employee entries
  await prisma.workExpense.deleteMany({
    where: { workEntry: { employeeId: 'employee-demo-novak' } },
  });

  const deletedDemoWorkEntries = await prisma.workEntry.deleteMany({
    where: { employeeId: 'employee-demo-novak' },
  });
  console.log(`✓ Smazáno ${deletedDemoWorkEntries.count} demo výkazů práce.`);

  const deletedDemoEmployee = await prisma.employee.deleteMany({
    where: { id: 'employee-demo-novak' },
  });
  console.log(`✓ Smazáno ${deletedDemoEmployee.count} demo profilů zaměstnanců.`);

  console.log('\n✅ Všechna demo data byla úspěšně smazána z databáze!');
  console.log('Reálné nosiče (Frýdek-Místek), klienti i ostatní účty byly v pořádku zachovány.');
}

main()
  .catch((err) => {
    console.error('❌ Chyba při mazání demo dat:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
