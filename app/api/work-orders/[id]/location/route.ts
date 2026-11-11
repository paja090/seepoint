import { enterTenantContext } from '@/lib/tenant-context';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess('work');
  if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    latitude?: unknown;
    longitude?: unknown;
    locationAddress?: unknown;
    locationNote?: unknown;
    clearGps?: boolean;
  } | null;

  if (!body) {
    return NextResponse.json(
      { error: 'Požadavek neobsahuje platná data.' },
      { status: 400 }
    );
  }

  const existing = await prisma.workOrder.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true,
      title: true,
      locationNote: true,
      planningConstraints: true,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Pracovní zakázka nebyla nalezena.' },
      { status: 404 }
    );
  }

  const currentConstraints = (existing.planningConstraints as Record<string, unknown> | null) || {};

  // Case 1: Clearing GPS coordinates
  if (body.clearGps === true) {
    const updatedConstraints = {
      ...currentConstraints,
      latitude: null,
      longitude: null,
      location: null,
      locationAddress: null,
    };

    await prisma.workOrder.update({
      where: { id, organizationId: user.organizationId },
      data: {
        planningConstraints: updatedConstraints,
      },
    });

    try {
      await prisma.crmAuditLog.create({
        data: {
          organizationId: user.organizationId!,
          entityType: 'WorkOrder',
          entityId: id,
          action: 'WORK_ORDER_GPS_CLEARED',
          userId: user.id,
          userEmail: user.email,
          detailsJson: JSON.stringify({ previousConstraints: currentConstraints }),
        },
      });
    } catch (auditErr) {
      console.warn('[work-order-location] audit log failed', auditErr);
    }

    return NextResponse.json({
      ok: true,
      cleared: true,
      latitude: null,
      longitude: null,
    });
  }

  // Case 2: Setting / Updating GPS coordinates
  const rawLat = body.latitude;
  const rawLng = body.longitude;
  const lat = typeof rawLat === 'number' ? rawLat : Number.parseFloat(String(rawLat));
  const lng = typeof rawLng === 'number' ? rawLng : Number.parseFloat(String(rawLng));

  if (!Number.isFinite(lat) || Math.abs(lat) > 90) {
    return NextResponse.json(
      { error: 'Zeměpisná šířka (latitude) musí být platné číslo v rozsahu -90 až 90.' },
      { status: 400 }
    );
  }

  if (!Number.isFinite(lng) || Math.abs(lng) > 180) {
    return NextResponse.json(
      { error: 'Zeměpisná délka (longitude) musí být platné číslo v rozsahu -180 až 180.' },
      { status: 400 }
    );
  }

  const locationAddress = typeof body.locationAddress === 'string' && body.locationAddress.trim()
    ? body.locationAddress.trim()
    : null;

  const locationNoteUpdate = typeof body.locationNote === 'string' && body.locationNote.trim()
    ? body.locationNote.trim()
    : undefined;

  const updatedConstraints = {
    ...currentConstraints,
    latitude: lat,
    longitude: lng,
    location: {
      latitude: lat,
      longitude: lng,
    },
    ...(locationAddress ? { locationAddress } : {}),
  };

  const updatedOrder = await prisma.workOrder.update({
    where: { id, organizationId: user.organizationId },
    data: {
      planningConstraints: updatedConstraints,
      ...(locationNoteUpdate ? { locationNote: locationNoteUpdate } : {}),
    },
    select: {
      id: true,
      locationNote: true,
      planningConstraints: true,
    },
  });

  try {
    await prisma.crmAuditLog.create({
      data: {
        organizationId: user.organizationId!,
        entityType: 'WorkOrder',
        entityId: id,
        action: 'WORK_ORDER_GPS_UPDATED',
        userId: user.id,
        userEmail: user.email,
        detailsJson: JSON.stringify({
          latitude: lat,
          longitude: lng,
          locationAddress,
        }),
      },
    });
  } catch (auditErr) {
    console.warn('[work-order-location] audit log failed', auditErr);
  }

  return NextResponse.json({
    ok: true,
    latitude: lat,
    longitude: lng,
    locationAddress,
    locationNote: updatedOrder.locationNote,
  });
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  return POST(req, props);
}
