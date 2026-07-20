const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reports = await prisma.navigationDocumentationReport.findMany({
    include: {
      client: true,
      items: true,
    },
  });

  for (const report of reports) {
    if (report.items.length === 0) {
      console.log(`Auto-populating items for report ${report.id} (${report.client.name})...`);
      const carriers = await prisma.advertisingCarrier.findMany({
        where: {
          archivedAt: null,
          surfaces: {
            some: {
              OR: [
                { currentClientId: report.clientId },
                { occupancies: { some: { clientId: report.clientId } } },
                { occupancies: { some: { clientName: { contains: report.client.name, mode: 'insensitive' } } } },
              ],
            },
          },
        },
        include: {
          photos: {
            where: { isPrivate: false },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
          },
        },
        orderBy: { code: 'asc' },
      });

      const itemInputs = carriers.map((carrier, index) => ({
        reportId: report.id,
        carrierId: carrier.id,
        selectedPhotoId: carrier.photos[0]?.id ?? null,
        sortOrder: index,
        isVisible: true,
      }));

      if (itemInputs.length > 0) {
        await prisma.navigationDocumentationItem.createMany({ data: itemInputs });
        console.log(`Successfully inserted ${itemInputs.length} items for ${report.client.name}!`);
      }
    }
  }

  // Verify updated counts
  const updatedReports = await prisma.navigationDocumentationReport.findMany({
    include: {
      client: true,
      items: {
        include: {
          carrier: { include: { photos: true } },
          selectedPhoto: true,
        },
      },
    },
  });

  console.log('\n--- VERIFICATION AFTER POPULATING ---');
  for (const rep of updatedReports) {
    console.log(`Report ${rep.id} (${rep.client.name}) -> Items count: ${rep.items.length}`);
    for (const item of rep.items) {
      console.log(`  Item: carrier=${item.carrier?.name}, photo=${item.selectedPhotoId ? 'YES' : 'NO'}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
