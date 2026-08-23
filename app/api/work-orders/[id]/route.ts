import { WorkOrderStatus, WorkPriority, WorkType } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncWorkOrderTasks } from '@/lib/work-task-sync';
import { workRequesters } from '@/lib/work';

type UpdateInput = { status?: unknown; priority?: unknown; price?: unknown; ftdSent?: unknown; invoiced?: unknown };
type EditInput = Record<string, unknown>;

function text(input: EditInput, key: string) {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parsePrice(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) return false;
  return normalized;
}

function requiredDate(input: EditInput, key: string) {
  const value = text(input, key);
  if (!value) return false;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? false : date;
}

function nullableDate(input: EditInput, key: string) {
  const value = text(input, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? false : date;
}

function validDriveUrl(value?: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'drive.google.com';
  } catch {
    return false;
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('work'); if (isApiDenied(auth)) return auth;
  const input = await request.json().catch(() => null) as UpdateInput | null;
  if (!input) return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  if (typeof input.status !== 'string' || !Object.values(WorkOrderStatus).includes(input.status as WorkOrderStatus)) {
    return NextResponse.json({ error: 'Vybraný stav není platný.' }, { status: 400 });
  }
  if (input.priority !== undefined && (typeof input.priority !== 'string' || !Object.values(WorkPriority).includes(input.priority as WorkPriority))) {
    return NextResponse.json({ error: 'Vybraná priorita není platná.' }, { status: 400 });
  }
  const price = parsePrice(input.price);
  if (price === false) return NextResponse.json({ error: 'Cena musí být kladné číslo s nejvýše dvěma desetinnými místy.' }, { status: 400 });

  const { id } = await params;
  const existing = await prisma.workOrder.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Pracovní úkol nebyl nalezen.' }, { status: 404 });
  
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const updated = await tx.workOrder.update({
        where: { id },
        data: {
          status: input.status as WorkOrderStatus,
          priority: input.priority as WorkPriority | undefined,
          price,
          ftdSent: typeof input.ftdSent === 'boolean' ? input.ftdSent : undefined,
          invoiced: typeof input.invoiced === 'boolean' ? input.invoiced : undefined,
        },
        select: { id: true, status: true, priority: true, price: true, ftdSent: true, invoiced: true },
      });
      await syncWorkOrderTasks(id, tx);
      return updated;
    });
    return NextResponse.json({ ...saved, price: saved.price?.toString() ?? null });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NELZE_ODEBRAT_PRACOVNIKA:')) {
      return NextResponse.json({ error: err.message.replace('NELZE_ODEBRAT_PRACOVNIKA: ', '').replace('NELZE_ODEBRAT_PRACOVNIKA:', '') }, { status: 400 });
    }
    throw err;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('work'); if (isApiDenied(auth)) return auth;
  const input = await request.json().catch(() => null) as EditInput | null;
  if (!input) return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });

  const title = text(input, 'title');
  const description = text(input, 'description');
  const requestedBy = text(input, 'requestedBy');
  const scheduledAt = requiredDate(input, 'scheduledAt');
  const deadlineAt = nullableDate(input, 'deadlineAt');
  const campaignDateFrom = nullableDate(input, 'campaignDateFrom');
  const campaignDateTo = nullableDate(input, 'campaignDateTo');
  if (!title || !description || !requestedBy || scheduledAt === false) return NextResponse.json({ error: 'Vyplňte název, datum práce, zadavatele a zadání.' }, { status: 400 });
  if (deadlineAt === false || campaignDateFrom === false || campaignDateTo === false) return NextResponse.json({ error: 'Některé datum není platné.' }, { status: 400 });
  if (deadlineAt && deadlineAt < scheduledAt) return NextResponse.json({ error: 'Termín dokončení nemůže být před datem práce.' }, { status: 400 });
  if (campaignDateFrom && campaignDateTo && campaignDateTo < campaignDateFrom) return NextResponse.json({ error: 'Konec kampaně nemůže být před jejím začátkem.' }, { status: 400 });

  const workTypeValue = text(input, 'workType');
  const priorityValue = text(input, 'priority');
  if (!workTypeValue || !Object.values(WorkType).includes(workTypeValue as WorkType)) return NextResponse.json({ error: 'Vyberte platný typ práce.' }, { status: 400 });
  if (!priorityValue || !Object.values(WorkPriority).includes(priorityValue as WorkPriority)) return NextResponse.json({ error: 'Vyberte platnou prioritu.' }, { status: 400 });

  const price = parsePrice(input.price);
  if (price === false) return NextResponse.json({ error: 'Cena musí být kladné číslo s nejvýše dvěma desetinnými místy.' }, { status: 400 });
  const quantityValue = text(input, 'quantity');
  const quantity = quantityValue ? Number.parseInt(quantityValue, 10) : null;
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) return NextResponse.json({ error: 'Počet kusů musí být kladné celé číslo.' }, { status: 400 });

  const clientId = text(input, 'clientId');
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  if (clientId && !client) return NextResponse.json({ error: 'Vybraný klient už neexistuje.' }, { status: 400 });
  const clientName = text(input, 'clientName') || client?.name || 'Bez klienta';

  const carrierCode = text(input, 'carrierCode');
  const carrier = carrierCode ? await prisma.advertisingCarrier.findFirst({ where: { code: carrierCode }, select: { id: true } }) : null;
  if (carrierCode && !carrier) return NextResponse.json({ error: 'Vyberte existující nosič z nabídky.' }, { status: 400 });

  const ftdUrl = text(input, 'ftdUrl');
  if (!validDriveUrl(ftdUrl)) return NextResponse.json({ error: 'Odkaz na fotodokumentaci musí být platná adresa složky na Google Disku.' }, { status: 400 });
  const workerNames = (text(input, 'workerNames') || '').split(',').map((name) => name.trim()).filter(Boolean);
  const { id } = await params;
  const existing = await prisma.workOrder.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Pracovní úkol nebyl nalezen.' }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id },
        data: {
          title,
          description,
          scheduledAt,
          deadlineAt,
          campaignDateFrom,
          campaignDateTo,
          workType: workTypeValue as WorkType,
          priority: priorityValue as WorkPriority,
          price,
          clientId: client?.id ?? null,
          clientName,
          requestedBy,
          contactName: text(input, 'contactName') ?? null,
          contactPhone: text(input, 'contactPhone') ?? null,
          locationNote: text(input, 'locationNote') ?? null,
          estimatedHours: text(input, 'estimatedHours') ? Number.parseFloat(text(input, 'estimatedHours')!) : null,
          pdfUrl: text(input, 'pdfUrl') ?? null,
          mediaLabel: text(input, 'mediaLabel') ?? null,
          quantity,
          referenceUrl: text(input, 'referenceUrl') ?? null,
          ftdUrl: ftdUrl ?? null,
          assignments: {
            deleteMany: {},
            ...(workerNames.length ? { create: workerNames.map((workerName) => ({ workerName })) } : {}),
          },
          items: {
            deleteMany: {},
            ...(carrier ? { create: [{ carrierId: carrier.id, quantity: quantity || 1 }] } : {}),
          },
        },
      });
      await syncWorkOrderTasks(id, tx);
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NELZE_ODEBRAT_PRACOVNIKA:')) {
      return NextResponse.json({ error: err.message.replace('NELZE_ODEBRAT_PRACOVNIKA: ', '').replace('NELZE_ODEBRAT_PRACOVNIKA:', '') }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('work');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    include: { workEntries: { select: { id: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Pracovní zakázka nebyla nalezena.' }, { status: 404 });
  if (existing.workEntries.length > 0) {
    await prisma.workOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    return NextResponse.json({ ok: true, cancelled: true, message: 'Zakázka má již vykázanou práci a byla proto označena jako ZRUŠENÁ.' });
  }
  await prisma.workOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: true });
}
