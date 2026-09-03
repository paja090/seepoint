import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { canAssignChatMessage, canResolveChatMessage, isChatChannel, validateChatImage } from '@/lib/chat-policy';
import { prisma } from '@/lib/db';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { roleLabel } from '@/lib/rbac';

export const runtime = 'nodejs';

const faultSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function finiteNumber(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export async function GET(request: Request) {
  const user = await requireApiAccess('team');
  if (isApiDenied(user)) return user;
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || 'general';
  const before = searchParams.get('before');
  if (!isChatChannel(channel)) return NextResponse.json({ error: 'Neplatný kanál chatu.' }, { status: 400 });
  if (before && (before.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(before))) return NextResponse.json({ error: 'Neplatný kurzor.' }, { status: 400 });

  const where: Prisma.ChatMessageWhereInput = { channel };
  if (before) {
    const reference = await prisma.chatMessage.findUnique({ where: { id: before }, select: { createdAt: true, channel: true } });
    if (!reference || reference.channel !== channel) return NextResponse.json([]);
    where.createdAt = { lt: reference.createdAt };
  }
  const messages = (await prisma.chatMessage.findMany({
    where,
    include: { reads: { select: { userId: true, readAt: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })).reverse();

  if (!before && messages.length) {
    await prisma.chatRead.createMany({
      data: messages.map((message) => ({ messageId: message.id, userId: user.id })),
      skipDuplicates: true,
    });
  }
  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  const user = await requireApiAccess('team');
  if (isApiDenied(user)) return user;
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.chatMessage);
  if (limited) return limited;

  const body = await request.json().catch(() => null) as {
    channel?: unknown;
    content?: unknown;
    imageUrl?: unknown;
    fuelExpense?: { vehicleId?: unknown; amount?: unknown; liters?: unknown; odometer?: unknown; fuelType?: unknown; note?: unknown };
    vehicleFault?: { vehicleId?: unknown; title?: unknown; description?: unknown; severity?: unknown };
  } | null;
  if (!body) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const channel = body.channel ?? 'general';
  if (!isChatChannel(channel)) return NextResponse.json({ error: 'Neplatný kanál chatu.' }, { status: 400 });
  if (body.fuelExpense && body.vehicleFault) return NextResponse.json({ error: 'Zpráva nemůže současně obsahovat účtenku i závadu.' }, { status: 400 });
  if (body.content !== undefined && typeof body.content !== 'string') return NextResponse.json({ error: 'Text zprávy má neplatný formát.' }, { status: 400 });
  let content = typeof body.content === 'string' ? body.content.trim() : '';
  if (content.length > 4000) return NextResponse.json({ error: 'Zpráva může mít nejvýše 4 000 znaků.' }, { status: 400 });
  const image = validateChatImage(body.imageUrl);
  if ('error' in image) return NextResponse.json({ error: image.error }, { status: 400 });

  const fuel = body.fuelExpense;
  if (fuel) {
    if (typeof fuel.vehicleId !== 'string' || !finiteNumber(fuel.amount, 0.01, 10_000_000)) return NextResponse.json({ error: 'Zadejte platné vozidlo a částku za palivo.' }, { status: 400 });
    if (fuel.liters !== undefined && !finiteNumber(fuel.liters, 0.01, 10_000)) return NextResponse.json({ error: 'Množství paliva není platné.' }, { status: 400 });
    if (fuel.odometer !== undefined && (!finiteNumber(fuel.odometer, 0, 10_000_000) || !Number.isInteger(fuel.odometer))) return NextResponse.json({ error: 'Stav tachometru musí být celé nezáporné číslo.' }, { status: 400 });
    if (fuel.note !== undefined && (typeof fuel.note !== 'string' || fuel.note.trim().length > 500)) return NextResponse.json({ error: 'Poznámka může mít nejvýše 500 znaků.' }, { status: 400 });
    if (fuel.fuelType !== undefined && (typeof fuel.fuelType !== 'string' || !['DIESEL', 'PETROL', 'ADBLUE', 'LPG', 'ELECTRIC', 'OTHER'].includes(fuel.fuelType))) return NextResponse.json({ error: 'Neplatný typ paliva.' }, { status: 400 });
    if (!content) content = `⛽ Účtenka za palivo: ${fuel.amount} Kč${fuel.liters ? ` (${fuel.liters} l)` : ''}`;
  }

  const fault = body.vehicleFault;
  if (fault) {
    if (typeof fault.vehicleId !== 'string' || typeof fault.title !== 'string' || !fault.title.trim()) return NextResponse.json({ error: 'Vyberte vozidlo a popište závadu.' }, { status: 400 });
    if (fault.title.trim().length > 200) return NextResponse.json({ error: 'Název závady může mít nejvýše 200 znaků.' }, { status: 400 });
    if (fault.description !== undefined && (typeof fault.description !== 'string' || fault.description.trim().length > 2000)) return NextResponse.json({ error: 'Popis závady může mít nejvýše 2 000 znaků.' }, { status: 400 });
    if (fault.severity !== undefined && !faultSeverities.includes(fault.severity as typeof faultSeverities[number])) return NextResponse.json({ error: 'Neplatná závažnost závady.' }, { status: 400 });
    if (!content) content = `🚨 NAHLÁŠENÍ ZÁVADY NA VOZIDLE: ${fault.title.trim()}\nPopis: ${typeof fault.description === 'string' && fault.description.trim() ? fault.description.trim() : 'Bez popisu'}\nZávažnost: ${fault.severity || 'MEDIUM'}`;
  }
  if (!content && !image.value) return NextResponse.json({ error: 'Zpráva nesmí být prázdná.' }, { status: 400 });

  const userName = user.employee ? `${user.employee.firstName} ${user.employee.lastName}`.trim() : user.name || user.email;
  try {
    const message = await prisma.$transaction(async (tx) => {
      let fuelExpenseId: string | null = null;
      if (fuel) {
        const vehicle = await tx.vehicle.findUnique({ where: { id: fuel.vehicleId as string }, select: { id: true } });
        if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
        const expense = await tx.vehicleFuelExpense.create({
          data: {
            vehicleId: vehicle.id,
            employeeId: user.employee?.id,
            userId: user.id,
            amount: fuel.amount as number,
            liters: fuel.liters as number | undefined,
            odometer: fuel.odometer as number | undefined,
            fuelType: typeof fuel.fuelType === 'string' ? fuel.fuelType : 'DIESEL',
            receiptUrl: image.value,
            note: typeof fuel.note === 'string' ? fuel.note.trim() || null : null,
          },
        });
        fuelExpenseId = expense.id;
      }
      if (fault) {
        const vehicle = await tx.vehicle.findUnique({ where: { id: fault.vehicleId as string }, select: { id: true } });
        if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
        const severity = faultSeverities.includes(fault.severity as typeof faultSeverities[number]) ? fault.severity as typeof faultSeverities[number] : 'MEDIUM';
        await tx.vehicleServiceRecord.create({
          data: {
            vehicleId: vehicle.id,
            date: new Date(),
            title: `⚠️ Hlášená závada: ${(fault.title as string).trim()}`,
            description: `Nahlásil: ${userName}. Popis: ${typeof fault.description === 'string' && fault.description.trim() ? fault.description.trim() : 'Bez podrobného popisu'}. Závažnost: ${severity}.`,
          },
        });
        if (severity === 'CRITICAL' || severity === 'HIGH') await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: 'SERVICE' } });
      }
      const created = await tx.chatMessage.create({
        data: { channel, userId: user.id, userName, userRole: roleLabel(user.role), content, imageUrl: image.value, fuelExpenseId },
      });
      await tx.chatRead.create({ data: { messageId: created.id, userId: user.id } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => null);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'VEHICLE_NOT_FOUND') return NextResponse.json({ error: 'Vozidlo nebylo nalezeno.' }, { status: 404 });
    throw error;
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiAccess('team');
  if (isApiDenied(user)) return user;
  const body = await request.json().catch(() => null) as { messageId?: unknown; assignedToUserId?: unknown; isResolved?: unknown } | null;
  if (!body || typeof body.messageId !== 'string' || !body.messageId) return NextResponse.json({ error: 'Chybí ID zprávy.' }, { status: 400 });
  const assignmentRequested = Object.prototype.hasOwnProperty.call(body, 'assignedToUserId');
  const resolutionRequested = Object.prototype.hasOwnProperty.call(body, 'isResolved');
  if (!assignmentRequested && !resolutionRequested) return NextResponse.json({ error: 'Chybí požadovaná změna.' }, { status: 400 });
  if (assignmentRequested && body.assignedToUserId !== null && typeof body.assignedToUserId !== 'string') return NextResponse.json({ error: 'Neplatný řešitel.' }, { status: 400 });
  if (resolutionRequested && typeof body.isResolved !== 'boolean') return NextResponse.json({ error: 'Neplatný stav řešení.' }, { status: 400 });

  const existing = await prisma.chatMessage.findUnique({ where: { id: body.messageId }, select: { id: true, userId: true, assignedToUserId: true } });
  if (!existing) return NextResponse.json({ error: 'Zpráva nebyla nalezena.' }, { status: 404 });
  if (assignmentRequested && !canAssignChatMessage(user, existing)) return NextResponse.json({ error: 'Řešitele může měnit autor zprávy nebo vedoucí.' }, { status: 403 });
  if (resolutionRequested && !canResolveChatMessage(user, existing)) return NextResponse.json({ error: 'Stav může měnit autor, řešitel nebo vedoucí.' }, { status: 403 });

  let assignedToUserId: string | null | undefined;
  let assignedToUserName: string | null | undefined;
  if (assignmentRequested) {
    assignedToUserId = body.assignedToUserId as string | null;
    assignedToUserName = null;
    if (assignedToUserId) {
      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId: user.organizationId!, userId: assignedToUserId, isActive: true, user: { status: 'ACTIVE' } },
        select: { user: { select: { name: true, employees: { where: { organizationId: user.organizationId! }, select: { firstName: true, lastName: true }, take: 1 } } } },
      });
      if (!membership) return NextResponse.json({ error: 'Řešitel není aktivním členem této organizace.' }, { status: 400 });
      const employee = membership.user.employees[0];
      assignedToUserName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : membership.user.name;
    }
  }
  const updated = await prisma.chatMessage.update({
    where: { id: existing.id },
    data: {
      assignedToUserId,
      assignedToUserName,
      isResolved: resolutionRequested ? body.isResolved as boolean : undefined,
      resolvedAt: resolutionRequested ? (body.isResolved ? new Date() : null) : undefined,
    },
  });
  return NextResponse.json(updated);
}
