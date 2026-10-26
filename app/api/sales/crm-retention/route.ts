import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export type CrmRetentionTip = {
  id: string;
  kind: 'EXPIRING_OCCUPANCY' | 'DORMANT_CLIENT';
  clientId: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  headline: string;
  reason: string;
  daysRemainingOrInactive: number;
  emailSubject: string;
  emailBody: string;
};

export async function GET() {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;

  try {
    const organizationId = user.organizationId;
    enterTenantContext({ organizationId, userId: user.id });

    const now = new Date();
    const in45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const dormantCutoff = new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000);

    const [org, expiringOccupancies, dormantClients] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, phone: true },
      }),
      prisma.occupancy.findMany({
        where: {
          organizationId,
          dateTo: { gte: now, lte: in45Days },
          status: { in: ['OCCUPIED', 'RESERVED'] },
        },
        include: {
          client: {
            include: {
              contacts: { take: 2 },
            },
          },
          surface: {
            include: {
              carrier: {
                select: { code: true, name: true, city: true },
              },
            },
          },
        },
        orderBy: { dateTo: 'asc' },
        take: 6,
      }),
      prisma.client.findMany({
        where: {
          organizationId,
          active: true,
          status: 'ACTIVE',
          lastActivityAt: { lte: dormantCutoff },
        },
        include: {
          contacts: { take: 2 },
        },
        orderBy: { lastActivityAt: 'asc' },
        take: 6,
      }),
    ]);

    const senderName = user.name || org?.name || 'Obchodní tým SeePOINT';
    const senderCompany = org?.name || 'SeePOINT';
    const senderPhone = org?.phone ? `, tel.: ${org.phone}` : '';

    const tips: CrmRetentionTip[] = [];
    const seenClients = new Set<string>();

    for (const occ of expiringOccupancies) {
      const cId = occ.clientId || occ.id;
      if (seenClients.has(cId)) continue;
      seenClients.add(cId);

      const daysLeft = Math.max(
        1,
        Math.ceil((occ.dateTo.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      );
      const carrierCode = occ.surface?.carrier?.code || 'reklamní ploše';
      const carrierCity = occ.surface?.carrier?.city || '';
      const primaryContact = occ.client?.contacts?.[0];
      const contactName =
        occ.client?.contactPerson ||
        (primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim() : '');
      const contactEmail = occ.client?.email || primaryContact?.email || '';
      const contactPhone = occ.client?.phone || primaryContact?.phone || '';
      const endDateStr = occ.dateTo.toLocaleDateString('cs-CZ');

      tips.push({
        id: `exp-${occ.id}`,
        kind: 'EXPIRING_OCCUPANCY',
        clientId: occ.clientId || '',
        clientName: occ.client?.name || occ.clientName,
        contactName,
        contactEmail,
        contactPhone,
        city: carrierCity,
        headline: `Končí pronájem plochy ${carrierCode}${carrierCity ? ` (${carrierCity})` : ''} za ${daysLeft} dní`,
        reason: `Kampaň „${occ.campaignName}“ končí dne ${endDateStr}. Ideální chvíle nabídnout prodloužení pronájmu nebo tisk a přelep novým motivem.`,
        daysRemainingOrInactive: daysLeft,
        emailSubject: `Prodloužení pronájmu plochy ${carrierCode}${carrierCity ? ` v lokalitě ${carrierCity}` : ''} / obměna motivu`,
        emailBody: `Dobrý den${contactName ? `, ${contactName}` : ''},\n\nrádi bychom Vás s předstihem upozornili, že dne ${endDateStr} končí pronájem Vaší reklamní plochy ${carrierCode}${carrierCity ? ` (${carrierCity})` : ''} v rámci kampaně „${occ.campaignName}“.\n\nMáte zájem o prodloužení pronájmu na další období, případně o tisk a přelep novým sezónním motivem? Plochu pro Vás zatím držíme přednostně.\n\nDejte mi prosím krátce vědět, jak se Vám to hodí.\n\nS pozdravem,\n${senderName}\n${senderCompany}${senderPhone}`,
      });
    }

    for (const cl of dormantClients) {
      if (seenClients.has(cl.id) || tips.length >= 8) continue;
      seenClients.add(cl.id);

      const daysInactive = Math.max(
        75,
        Math.floor((now.getTime() - cl.lastActivityAt.getTime()) / (24 * 60 * 60 * 1000))
      );
      const primaryContact = cl.contacts?.[0];
      const contactName =
        cl.contactPerson ||
        (primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim() : '');
      const contactEmail = cl.email || primaryContact?.email || '';
      const contactPhone = cl.phone || primaryContact?.phone || '';
      const city = cl.billingCity || cl.shippingCity || '';

      tips.push({
        id: `dorm-${cl.id}`,
        kind: 'DORMANT_CLIENT',
        clientId: cl.id,
        clientName: cl.name,
        contactName,
        contactEmail,
        contactPhone,
        city,
        headline: `Stávající klient bez aktivity ${daysInactive} dní`,
        reason: `Klient ${cl.name} u nás už delší dobu neobjednal. Připomeňte se s nabídkou volných ploch v okolí, polepů provozoven nebo tisku plachet.`,
        daysRemainingOrInactive: daysInactive,
        emailSubject: `Volné reklamní plochy a výroba reklamy pro ${cl.name}`,
        emailBody: `Dobrý den${contactName ? `, ${contactName}` : ''},\n\ndlouho jsme spolu nebyli v kontaktu, tak se chci krátce připomenout. Aktuálně máme v regionu${city ? ` (${city} a okolí)` : ''} několik nově uvolněných reklamních ploch a volnou kapacitu ve výrobě (velkoformátový tisk plachet, polepy výloh a firemních aut, 3D reklama).\n\nChystáte v nejbližších týdnech kampaň nebo úpravu označení provozovny? Rád Vám pošlu přehled volných míst nebo nezávaznou kalkulaci.\n\nS pozdravem,\n${senderName}\n${senderCompany}${senderPhone}`,
      });
    }

    return NextResponse.json({ ok: true, tips });
  } catch (error) {
    console.error('[api/sales/crm-retention] GET failed:', error);
    return NextResponse.json({ ok: false, tips: [] }, { status: 500 });
  }
}
