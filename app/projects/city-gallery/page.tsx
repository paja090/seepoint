import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { CityGalleryModuleClient } from '@/components/city-gallery/CityGalleryModuleClient';

export const dynamic = 'force-dynamic';

export default async function CityGalleryProjectsPage() {
  await requirePageAccess('cityGallery');

  let projectsRaw: any[] = [];
  let fleetConfig: any = null;

  try {
    const results = await Promise.all([
      prisma.cityGalleryProject
        .findMany({
          include: { _count: { select: { offers: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
        .catch((err) => {
          console.error('Error fetching CityGalleryProject:', err);
          return [];
        }),
      prisma.cityGalleryFleetConfig
        .findUnique({ where: { id: 'default' } })
        .catch((err) => {
          console.error('Error fetching CityGalleryFleetConfig:', err);
          return null;
        }),
    ]);
    projectsRaw = results[0] || [];
    fleetConfig = results[1] || null;
  } catch (err) {
    console.error('Error in CityGalleryPage queries:', err);
  }

  const totalFleet = fleetConfig?.totalFrames ?? 24;
  const maintenanceCount = fleetConfig?.maintenanceCount ?? 0;

  const projects = projectsRaw.map((p) => ({
    id: p.id,
    title: p.title || 'Výstava Galerie VENKU',
    status: p.status || 'DRAFT',
    city: p.city || 'Ostrava',
    locality: p.locality || null,
    address: p.address || null,
    description: p.description || null,
    frameCount: typeof p.frameCount === 'number' ? p.frameCount : 6,
    permitStatus: p.permitStatus || 'SUBMITTED',
    permitNumber: p.permitNumber || null,
    permitValidFrom: p.permitValidFrom ? new Date(p.permitValidFrom).toISOString() : null,
    permitValidTo: p.permitValidTo ? new Date(p.permitValidTo).toISOString() : null,
    permitNote: p.permitNote || null,
    cityOfficialContact: p.cityOfficialContact || null,
    organizerName: p.organizerName || null,
    artistName: p.artistName || null,
    dateFrom: p.dateFrom ? new Date(p.dateFrom).toISOString() : null,
    dateTo: p.dateTo ? new Date(p.dateTo).toISOString() : null,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
    _count: p._count || { offers: 0 },
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
