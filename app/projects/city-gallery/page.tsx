import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { CityGalleryModuleClient } from '@/components/city-gallery/CityGalleryModuleClient';

export const dynamic = 'force-dynamic';

export default async function CityGalleryProjectsPage() {
  await requirePageAccess('cityGallery');

  const [projectsRaw, fleetConfig, offerCount] = await Promise.all([
    prisma.cityGalleryProject.findMany({
      include: { _count: { select: { offers: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.cityGalleryFleetConfig.findUnique({ where: { id: 'default' } }),
    prisma.offer.count({ where: { offerType: 'CITY_GALLERY', archivedAt: null } }),
  ]);

  const totalFleet = fleetConfig?.totalFrames ?? 24;
  const maintenanceCount = fleetConfig?.maintenanceCount ?? 0;

  const projects = projectsRaw.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    city: p.city,
    locality: p.locality,
    address: p.address,
    description: p.description,
    frameCount: p.frameCount,
    permitStatus: p.permitStatus,
    permitNumber: p.permitNumber,
    permitValidFrom: p.permitValidFrom ? p.permitValidFrom.toISOString() : null,
    permitValidTo: p.permitValidTo ? p.permitValidTo.toISOString() : null,
    permitNote: p.permitNote,
    cityOfficialContact: p.cityOfficialContact,
    organizerName: p.organizerName,
    artistName: p.artistName,
    dateFrom: p.dateFrom ? p.dateFrom.toISOString() : null,
    dateTo: p.dateTo ? p.dateTo.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    _count: p._count,
  }));

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const occupiedFrames = activeProjects.reduce((acc, p) => acc + (p.frameCount || 6), 0);
  const availableFrames = Math.max(0, totalFleet - occupiedFrames - maintenanceCount);

  const fleet = {
    totalFleet,
    occupiedFrames,
    availableFrames,
    maintenanceCount,
  };

  return (
    <AppShell>
      <CityGalleryModuleClient initialProjects={projects} initialFleet={fleet} />
    </AppShell>
  );
}
