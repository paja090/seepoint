import { CrmTaskPriority, CrmTaskStatus, CrmTaskType, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

function validDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.clientId !== 'string' || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'Klient, název úkolu a termín jsou povinné.' }, { status: 400 });
  }
  const dueDate = validDate(body.dueDate);
  if (!dueDate) return NextResponse.json({ error: 'Termín úkolu není platný.' }, { status: 400 });
  if (body.type && !Object.values(CrmTaskType).includes(body.type as CrmTaskType)) return NextResponse.json({ error: 'Neplatný typ úkolu.' }, { status: 400 });
  if (body.priority && !Object.values(CrmTaskPriority).includes(body.priority as CrmTaskPriority)) return NextResponse.json({ error: 'Neplatná priorita úkolu.' }, { status: 400 });
  if (body.status && !Object.values(CrmTaskStatus).includes(body.status as CrmTaskStatus)) return NextResponse.json({ error: 'Neplatný stav úkolu.' }, { status: 400 });

  const clientId = body.clientId;
  const title = body.title.trim();
  const assignedUserId = typeof body.assignedUserId === 'string' && body.assignedUserId ? body.assignedUserId : auth.id;
  try {
    const task = await prisma.$transaction(async (tx) => {
      if (!await tx.client.count({ where: { id: clientId, active: true } })) throw new Error('CLIENT_NOT_FOUND');
      if (!await tx.user.count({ where: { id: assignedUserId } })) throw new Error('INVALID_ASSIGNEE');
      const contactId = typeof body.contactId === 'string' && body.contactId ? body.contactId : null;
      const crmOrderId = typeof body.crmOrderId === 'string' && body.crmOrderId ? body.crmOrderId : null;
      const contractId = typeof body.contractId === 'string' && body.contractId ? body.contractId : null;
      const invoiceId = typeof body.invoiceId === 'string' && body.invoiceId ? body.invoiceId : null;
      const relationsValid =
        (!contactId || await tx.clientContact.count({ where: { id: contactId, clientId } })) &&
        (!crmOrderId || await tx.crmOrder.count({ where: { id: crmOrderId, clientId } })) &&
        (!contractId || await tx.clientContract.count({ where: { id: contractId, clientId } })) &&
        (!invoiceId || await tx.clientInvoice.count({ where: { id: invoiceId, clientId } }));
      if (!relationsValid) throw new Error('INVALID_RELATION');

      const created = await tx.crmTask.create({ data: {
        clientId,
        contactId,
        crmOrderId,
        contractId,
        invoiceId,
        assignedUserId,
        createdUserId: auth.id,
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        type: body.type as CrmTaskType || 'OTHER',
        priority: body.priority as CrmTaskPriority || 'NORMAL',
        status: body.status as CrmTaskStatus || 'TODO',
        dueDate: dueDate ?? undefined,
      } });
      await tx.client.update({ where: { id: clientId }, data: { lastActivityAt: new Date() } });
      return created;
    });
    return NextResponse.json({ success: true, task });
  } catch (error) {
    if (error instanceof Error && error.message === 'CLIENT_NOT_FOUND') return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    if (error instanceof Error && error.message === 'INVALID_ASSIGNEE') return NextResponse.json({ error: 'Přiřazený uživatel neexistuje.' }, { status: 400 });
    if (error instanceof Error && error.message === 'INVALID_RELATION') return NextResponse.json({ error: 'Některá vazba úkolu nepatří vybranému klientovi.' }, { status: 400 });
    console.error('CRM task creation failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Úkol se nepodařilo vytvořit.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'ID úkolu je povinné.' }, { status: 400 });
  if (body.type && !Object.values(CrmTaskType).includes(body.type as CrmTaskType)) return NextResponse.json({ error: 'Neplatný typ úkolu.' }, { status: 400 });
  if (body.priority && !Object.values(CrmTaskPriority).includes(body.priority as CrmTaskPriority)) return NextResponse.json({ error: 'Neplatná priorita úkolu.' }, { status: 400 });
  if (body.status && !Object.values(CrmTaskStatus).includes(body.status as CrmTaskStatus)) return NextResponse.json({ error: 'Neplatný stav úkolu.' }, { status: 400 });
  const dueDate = body.dueDate === undefined ? undefined : validDate(body.dueDate);
  if (body.dueDate !== undefined && !dueDate) return NextResponse.json({ error: 'Termín úkolu není platný.' }, { status: 400 });

  try {
    if (body.assignedUserId && !await prisma.user.count({ where: { id: String(body.assignedUserId) } })) {
      return NextResponse.json({ error: 'Přiřazený uživatel neexistuje.' }, { status: 400 });
    }
    const status = body.status as CrmTaskStatus | undefined;
    const updated = await prisma.crmTask.update({
      where: { id: body.id },
      data: {
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined,
        description: body.description === undefined ? undefined : typeof body.description === 'string' ? body.description.trim() || null : null,
        status,
        priority: body.priority as CrmTaskPriority | undefined,
        type: body.type as CrmTaskType | undefined,
        assignedUserId: body.assignedUserId ? String(body.assignedUserId) : undefined,
        dueDate: dueDate ?? undefined,
        completedAt: status === 'DONE' ? new Date() : status ? null : undefined,
        resultNote: body.resultNote === undefined ? undefined : typeof body.resultNote === 'string' ? body.resultNote.trim() || null : null,
      },
    });
    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return NextResponse.json({ error: 'Úkol nebyl nalezen.' }, { status: 404 });
    console.error('CRM task update failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Úkol se nepodařilo upravit.' }, { status: 500 });
  }
}
