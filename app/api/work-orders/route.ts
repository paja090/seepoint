import { WorkPriority, WorkType, WorkOrderStatus } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncWorkOrderTasks } from '@/lib/work-task-sync';
import { workRequesters } from '@/lib/work';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';

type WorkOrderInput = Record<string, unknown>;

function text(input: WorkOrderInput, key: string) {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalDate(input: WorkOrderInput, key: string) {
  const value = text(input, key);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalPrice(input: WorkOrderInput) {
  const value = text(input, 'price');
  if (!value) return undefined;
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) return null;
  return normalized;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const hasWorkAccess = canAccess(user.role, 'work');
  const hasMyAccess = canAccess(user.role, 'myWorkEntries') || canAccess(user.role, 'myTasks');

  if (!hasWorkAccess && !hasMyAccess) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  // Fetch only active/new work orders if they only have myWorkEntries/myTasks (workers)
  const where = !hasWorkAccess ? { status: { in: ['NEW', 'IN_PROGRESS'] as WorkOrderStatus[] } } : {};

  if (!hasWorkAccess) {
    const orders = await prisma.workOrder.findMany({
      where,
      select: {
        id: true,
        title: true,
        clientName: true,
        workType: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    });
    return NextResponse.json(orders);
  }

  const orders = await prisma.workOrder.findMany({
    include: { assignments: true, items: { include: { carrier: true, surface: true } }, client: true, workTasks: { include: { assignedTo: true } } },
    orderBy: { scheduledAt: 'asc' },
    take: 200,
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('work'); if (isApiDenied(auth)) return auth;
  const input = await request.json().catch(() => null) as WorkOrderInput | null;
  if (!input) return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  const title = text(input, 'title');
  const description = text(input, 'description');
  const scheduledAt = optionalDate(input, 'scheduledAt');
  const requestedBy = text(input, 'requestedBy');
  if (!title || !description || !scheduledAt || !requestedBy) return NextResponse.json({ error: 'Vyplňte název, datum práce, zadavatele a zadání.' }, { status: 400 });
  if (!workRequesters.includes(requestedBy as (typeof workRequesters)[number])) return NextResponse.json({ error: 'Vyberte platného zadavatele úkolu.' }, { status: 400 });

  const deadlineAt = optionalDate(input, 'deadlineAt');
  const campaignDateFrom = optionalDate(input, 'campaignDateFrom');
  const campaignDateTo = optionalDate(input, 'campaignDateTo');
  if (deadlineAt === null || campaignDateFrom === null || campaignDateTo === null) return NextResponse.json({ error: 'Některé datum není platné.' }, { status: 400 });
  if (deadlineAt && deadlineAt < scheduledAt) return NextResponse.json({ error: 'Termín dokončení nemůže být před datem práce.' }, { status: 400 });
  if (campaignDateFrom && campaignDateTo && campaignDateTo < campaignDateFrom) return NextResponse.json({ error: 'Konec kampaně nemůže být před jejím začátkem.' }, { status: 400 });

  const requestedWorkType = text(input, 'workType');
  const workType = requestedWorkType && Object.values(WorkType).includes(requestedWorkType as WorkType) ? requestedWorkType as WorkType : WorkType.OTHER;
  const requestedPriority = text(input, 'priority');
  const priority = requestedPriority && Object.values(WorkPriority).includes(requestedPriority as WorkPriority) ? requestedPriority as WorkPriority : WorkPriority.NORMAL;
  const price = optionalPrice(input);
  if (price === null) return NextResponse.json({ error: 'Cena musí být kladné číslo s nejvýše dvěma desetinnými místy.' }, { status: 400 });

  const clientId = text(input, 'clientId');
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  if (clientId && !client) return NextResponse.json({ error: 'Vybraný klient už neexistuje.' }, { status: 400 });
  const clientName = text(input, 'clientName') || client?.name || 'Bez klienta';
  const carrierCode = text(input, 'carrierCode');
  const carrier = carrierCode ? await prisma.advertisingCarrier.findUnique({ where: { code: carrierCode }, select: { id: true } }) : null;
  if (carrierCode && !carrier) return NextResponse.json({ error: 'Vyberte existující nosič z nabídky.' }, { status: 400 });

  const quantityText = text(input, 'quantity');
  const quantity = quantityText ? Number.parseInt(quantityText, 10) : undefined;
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) return NextResponse.json({ error: 'Počet kusů musí být kladné celé číslo.' }, { status: 400 });
  const workerNames = (text(input, 'workerNames') || '').split(',').map((name) => name.trim()).filter(Boolean);
  const ftdUrl = text(input, 'ftdUrl');
  if (ftdUrl) {
    try {
      const url = new URL(ftdUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') throw new Error('invalid');
    } catch {
      return NextResponse.json({ error: 'Odkaz na fotodokumentaci musí být platná adresa složky na Google Disku.' }, { status: 400 });
    }
  }

  const order = await prisma.workOrder.create({
    data: {
      title,
      description,
      scheduledAt,
      deadlineAt,
      campaignDateFrom,
      campaignDateTo,
      workType,
      priority,
      price,
      status: 'PLANNED',
      clientId: client?.id,
      clientName,
      requestedBy,
      contactName: text(input, 'contactName'),
      contactPhone: text(input, 'contactPhone'),
      locationNote: text(input, 'locationNote'),
      mediaLabel: text(input, 'mediaLabel'),
      quantity,
      referenceUrl: text(input, 'referenceUrl'),
      ftdUrl,
      assignments: workerNames.length ? { create: workerNames.map((workerName) => ({ workerName })) } : undefined,
      items: carrier ? { create: { carrierId: carrier.id, quantity: quantity || 1 } } : undefined,
    },
    select: { id: true },
  });
  await syncWorkOrderTasks(order.id);
  return NextResponse.json(order, { status: 201 });
}
