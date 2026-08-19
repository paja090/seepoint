import { CityGalleryProjectStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [projectsRaw, fleetConfig] = await Promise.all([
      prisma.cityGalleryProject
        .findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
        .catch(() => []),
      prisma.cityGalleryFleetConfig.findUnique({ where: { id: 'default' } }).catch(() => null),
    ]);

    const totalFleet = fleetConfig?.totalFrames ?? 24;
    const maintenanceCount = fleetConfig?.maintenanceCount ?? 0;

    const projects = projectsRaw.map((p) => ({
      ...p,
      frameCount: typeof p.frameCount === 'number' ? p.frameCount : 6,
    }));

    const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
    const occupiedFrames = activeProjects.reduce((acc, p) => acc + (p.frameCount || 6), 0);
    const availableFrames = Math.max(0, totalFleet - occupiedFrames - maintenanceCount);

    return NextResponse.json({
      fleet: {
        totalFleet,
        occupiedFrames,
        availableFrames,
        maintenanceCount,
      },
      projects,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při načítání projektů Galerie venku.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });

    const input = await request.json().catch(() => null);
    if (!input || !input.title) {
      return NextResponse.json({ error: 'Zadejte název výstavy / projektu.' }, { status: 400 });
    }

    const frameCount = Number(input.frameCount) || 6;

    const [fleetConfig, activeProjectsRaw] = await Promise.all([
      prisma.cityGalleryFleetConfig.findUnique({ where: { id: 'default' } }).catch(() => null),
      prisma.cityGalleryProject.findMany({ where: { status: 'ACTIVE' } }).catch(() => []),
    ]);

    const totalFleet = fleetConfig?.totalFrames ?? 24;
    const maintenanceCount = fleetConfig?.maintenanceCount ?? 0;
    const occupiedFrames = activeProjectsRaw.reduce((acc, p: any) => acc + (p.frameCount || 6), 0);
    const availableFrames = Math.max(0, totalFleet - occupiedFrames - maintenanceCount);

    const isStatusActive = input.status === 'ACTIVE';
    if (isStatusActive && frameCount > availableFrames) {
      return NextResponse.json(
        {
          error: `Nedostatek volných nosičů! Požadováno ${frameCount} ks, k dispozici je pouze ${availableFrames} ks nosičů City Gallery.`,
        },
        { status: 400 }
      );
    }

    const project = await prisma.cityGalleryProject.create({
      data: {
        title: input.title,
        status: (input.status as CityGalleryProjectStatus) || 'DRAFT',
        city: input.city || 'Ostrava',
        locality: input.locality || null,
        address: input.address || null,
        description: input.description || null,
        frameCount,
        permitStatus: input.permitStatus || 'SUBMITTED',
        permitNumber: input.permitNumber || null,
        permitValidFrom: input.permitValidFrom ? new Date(input.permitValidFrom) : null,
        permitValidTo: input.permitValidTo ? new Date(input.permitValidTo) : null,
        permitNote: input.permitNote || null,
        cityOfficialContact: input.cityOfficialContact || null,
        organizerName: input.organizerName || null,
        artistName: input.artistName || null,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : null,
        dateTo: input.dateTo ? new Date(input.dateTo) : null,
      },
    });

    return NextResponse.json({ ok: true, project });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při vytváření projektu.' }, { status: 500 });
  }
}
