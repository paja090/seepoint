import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { sendOfferEmail } from '@/lib/email';
import { prisma } from '@/lib/db';
import { offerErrorResponse } from '@/lib/offers/http';
import { prepareOfferDelivery, transitionOffer } from '@/lib/offers/service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;
  try {
    const id = (await params).id;
    const body = await request.json().catch(() => ({})) as { subject?: unknown; clientMessage?: unknown };
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const clientMessage = typeof body.clientMessage === 'string' ? body.clientMessage.trim() : '';
    if (subject && subject.length > 200) throw new Error('Předmět e-mailu může mít maximálně 200 znaků.');
    if (body.clientMessage !== undefined && (!clientMessage || clientMessage.length > 4000)) throw new Error('Text e-mailu musí mít 1 až 4000 znaků.');
    const delivery = await prepareOfferDelivery(auth, id, clientMessage ? { clientMessage } : undefined);
    const recipient = delivery.offer.contactEmail || delivery.offer.client.email;
    if (!recipient) throw new Error('Nabídka nemá kontaktní e-mail klienta.');
    const publicUrl = new URL(delivery.path, request.url).toString();
    const salesperson = await prisma.user.findUnique({
      where: { id: delivery.offer.createdBy.id || auth.id },
      select: {
        name: true,
        email: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            position: true,
            photos: {
              where: { type: 'EMPLOYEE_PROFILE', isPrivate: false },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    const salespersonName = salesperson?.employee
      ? `${salesperson.employee.firstName} ${salesperson.employee.lastName}`
      : salesperson?.name || auth.name;
    await sendOfferEmail({
      to: recipient,
      subject: subject || undefined,
      contactName: delivery.offer.contactPerson || delivery.offer.client.contactPerson || delivery.offer.client.name,
      campaignName: delivery.offer.campaignName,
      clientMessage: delivery.offer.clientMessage,
      validUntil: delivery.offer.validUntil,
      publicUrl,
      locationSelection: delivery.offer.offerType === 'NAVIGATION' && delivery.offer.navigation?.proposalMode === 'LOCATION_SELECTION',
      logoUrl: new URL('/seepoint-logo.svg', request.url).toString(),
      salespersonName,
      salespersonEmail: salesperson?.email || auth.email,
      salespersonPhone: salesperson?.employee?.phone,
      salespersonRole: 'Obchodní kontakt SeePOINT',
      salespersonPhotoUrl: salesperson?.employee?.photos[0]
        ? new URL(`/api/proposals/${encodeURIComponent(delivery.token)}/salesperson-photo`, request.url).toString()
        : null,
    });
    if (delivery.offer.status === 'DRAFT') {
      await transitionOffer(auth, id, 'SENT');
    } else {
      const now = new Date();
      await prisma.offer.update({
        where: { id },
        data: {
          sentAt: now,
          updatedByUserId: auth.id,
          events: {
            create: {
              type: 'SENT',
              fromStatus: 'SENT',
              toStatus: 'SENT',
              actorUserId: auth.id,
              actorName: auth.name,
              message: 'Aktualizovaná nabídka byla znovu odeslána klientovi e-mailem.',
              metadata: { repeatedDelivery: true, channel: 'email' },
            },
          },
        },
      });
    }
    return NextResponse.json({ path: delivery.path });
  } catch (error) {
    return offerErrorResponse(error);
  }
}
