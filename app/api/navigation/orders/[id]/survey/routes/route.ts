import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { id: navigationOrderId } = await params;
    const body = await request.json();

    const { name, description, originName, originLatitude, originLongitude } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Název příjezdové trasy je povinný.' }, { status: 400 });
    }

    const order = await prisma.navigationOrder.findUnique({
      where: { id: navigationOrderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Zakázka nebyla nalezena.' }, { status: 404 });
    }

    const routeCount = await prisma.surveyRoute.count({
      where: { navigationOrderId },
    });

    const route = await prisma.surveyRoute.create({
      data: {
        navigationOrderId,
        name: name.trim(),
        description: description?.trim() || null,
        originName: originName?.trim() || null,
        originLatitude: originLatitude ? parseFloat(originLatitude) : null,
        originLongitude: originLongitude ? parseFloat(originLongitude) : null,
        targetLatitude: order.targetLatitude,
        targetLongitude: order.targetLongitude,
        routeOrder: routeCount + 1,
        active: true,
      },
    });

    return NextResponse.json({ route });
  } catch (error: any) {
    console.error('Error creating survey route:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při zakládání trasy.' },
      { status: 500 }
    );
  }
}
