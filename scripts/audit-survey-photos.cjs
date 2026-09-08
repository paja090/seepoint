/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Read-only audit script for SURVEY photos.
 * Identifies unlinked / orphan photos in the database without performing any deletions.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runAudit() {
  console.log('================================================================');
  console.log('       SURVEY PHOTO AUDIT REPORT (READ-ONLY)');
  console.log('================================================================\n');

  try {
    const totalSurveyPhotos = await prisma.photo.count({
      where: { type: 'SURVEY' },
    });

    const candidateLinked = await prisma.photo.count({
      where: { type: 'SURVEY', surveyCandidatePointId: { not: null } },
    });

    const navigationPointLinked = await prisma.photo.count({
      where: { type: 'SURVEY', surveyNavigationPointId: { not: null } },
    });

    const carrierLinked = await prisma.photo.count({
      where: { type: 'SURVEY', carrierId: { not: null } },
    });

    // Find orphan photos (no candidate, no navigationPoint, no carrier)
    const potentialOrphans = await prisma.photo.findMany({
      where: {
        type: 'SURVEY',
        surveyCandidatePointId: null,
        surveyNavigationPointId: null,
        carrierId: null,
        surfaceId: null,
      },
      select: {
        id: true,
        organizationId: true,
        fileName: true,
        mimeType: true,
        size: true,
        storageProvider: true,
        createdAt: true,
        capturedByWorkerName: true,
        capturedLatitude: true,
        capturedLongitude: true,
        siteNavigationPoint: { select: { id: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Separate those that serve as siteNavigationPoint from true unlinked orphans
    const sitePhotoAssigned = potentialOrphans.filter((p) => p.siteNavigationPoint !== null);
    const unlinkedOrphans = potentialOrphans.filter((p) => p.siteNavigationPoint === null);

    console.log(`Celkem fotografií typu SURVEY:            ${totalSurveyPhotos}`);
    console.log(`- Navázáno na NavigationCandidatePoint:   ${candidateLinked}`);
    console.log(`- Navázáno na NavigationPoint:            ${navigationPointLinked}`);
    console.log(`- Navázáno na Nosič (Carrier):            ${carrierLinked}`);
    console.log(`- Slouží jako sitePhotoId navigačního bodu: ${sitePhotoAssigned.length}`);
    console.log(`- ZCELA OSIŘELÉ (bez jakékoliv vazby):    ${unlinkedOrphans.length}\n`);

    if (unlinkedOrphans.length === 0) {
      console.log('✓ V databázi nebyly nalezeny žádné nepropojené osiřelé fotografie typu SURVEY.\n');
    } else {
      console.log('Seznam osiřelých fotografií (k prověření):');
      console.log('----------------------------------------------------------------');
      for (const p of unlinkedOrphans) {
        const kb = p.size ? `${Math.round(p.size / 1024)} KB` : 'N/A';
        const date = p.createdAt ? p.createdAt.toISOString() : 'N/A';
        const worker = p.capturedByWorkerName || 'N/A';
        const org = p.organizationId || 'default';
        console.log(`- ID: ${p.id} | Org: ${org} | Vytvořeno: ${date} | Velikost: ${kb} | Autor: ${worker}`);
        if (p.capturedLatitude && p.capturedLongitude) {
          console.log(`  GPS: ${p.capturedLatitude}, ${p.capturedLongitude}`);
        }
      }
      console.log('----------------------------------------------------------------\n');
    }

    console.log('UPOZORNĚNÍ: Tento skript provádí pouze audit (READ-ONLY). Žádná data nebyla smazána ani upravena.');
  } catch (err) {
    console.error('Audit selhal:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runAudit();
