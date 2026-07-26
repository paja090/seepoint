import { ClientSource, ClientStatus, ClientType, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { getClientProfile } from '@/lib/crm/client-service';
import { normalizeClientName } from '@/lib/crm/domain';
import { prisma } from '@/lib/db';

const enumValue = <T extends Record<string, string>>(values: T, value: unknown): T[keyof T] | undefined =>
  typeof value === 'string' && Object.values(values).includes(value) ? value as T[keyof T] : undefined;
const optionalText = (value: unknown) => typeof value === 'string' ? value.trim() || null : undefined;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;

  const profile = await getClientProfile((await params).id);
  return profile
    ? NextResponse.json({ client: profile })
    : NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });

  const name = body.name === undefined ? undefined : optionalText(body.name);
  if (body.name !== undefined && !name) return NextResponse.json({ error: 'Název společnosti je povinný.' }, { status: 400 });
  const status = body.status === undefined ? undefined : enumValue(ClientStatus, body.status);
  const clientType = body.clientType === undefined ? undefined : enumValue(ClientType, body.clientType);
  const source = body.source === undefined ? undefined : enumValue(ClientSource, body.source);
  if ((body.status !== undefined && !status) || (body.clientType !== undefined && !clientType) || (body.source !== undefined && !source)) {
    return NextResponse.json({ error: 'Stav, typ nebo zdroj klienta není platný.' }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id },
        data: {
          name: name ?? undefined,
          normalizedName: name ? normalizeClientName(name) : undefined,
          tradingName: optionalText(body.tradingName),
          companyId: optionalText(body.companyId),
          dic: optionalText(body.dic),
          billingStreet: optionalText(body.billingStreet),
          billingCity: optionalText(body.billingCity),
          billingZip: optionalText(body.billingZip),
          billingCountry: body.billingCountry === undefined ? undefined : optionalText(body.billingCountry) || 'CZ',
          shippingStreet: optionalText(body.shippingStreet),
          shippingCity: optionalText(body.shippingCity),
          shippingZip: optionalText(body.shippingZip),
          shippingCountry: body.shippingCountry === undefined ? undefined : optionalText(body.shippingCountry) || 'CZ',
          website: optionalText(body.website),
          contactPerson: optionalText(body.contactPerson),
          email: optionalText(body.email),
          phone: optionalText(body.phone),
          status,
          clientType,
          source,
          assignedUserId: body.assignedUserId === undefined ? undefined : optionalText(body.assignedUserId),
          rating: optionalText(body.rating),
          note: optionalText(body.note),
          lastActivityAt: new Date(),
        },
      });
      await tx.crmAuditLog.create({
        data: {
          userId: auth.id,
          userEmail: auth.email,
          action: 'UPDATE_CLIENT',
          entityType: 'Client',
          entityId: id,
          detailsJson: JSON.stringify({ fields: Object.keys(body) }),
        },
      });
      return client;
    });
    return NextResponse.json({ success: true, client: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Klient se stejným názvem už existuje.' }, { status: 409 });
    }
    console.error('CRM client update failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo upravit.' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Deaktivovat klienta může pouze administrátor.' }, { status: 403 });
  const { id } = await params;

  try {
    await prisma.$transaction([
      prisma.client.update({ where: { id }, data: { active: false, status: 'INACTIVE' } }),
      prisma.crmAuditLog.create({ data: { userId: auth.id, userEmail: auth.email, action: 'DEACTIVATE_CLIENT', entityType: 'Client', entityId: id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }
    console.error('CRM client deactivation failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo deaktivovat.' }, { status: 500 });
  }
}
