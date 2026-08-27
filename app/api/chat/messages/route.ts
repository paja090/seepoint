import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const isInlineImage = (value?: string | null) => Boolean(value?.startsWith('data:'));

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || 'general';
  const before = searchParams.get('before');

  let whereClause: any = { channel };

  if (before) {
    const refMsg = await prisma.chatMessage.findUnique({
      where: { id: before },
      select: { createdAt: true },
    });

    if (refMsg) {
      whereClause.createdAt = { lt: refMsg.createdAt };
    }
  }

  const messagesDesc = await prisma.chatMessage.findMany({
    where: whereClause,
    include: {
      reads: {
        select: { userId: true, readAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Legacy inline images can be >1 MB each. Never send them during channel polling.
  const messages = messagesDesc.reverse().map((message) => ({
    ...message,
    imageUrl: isInlineImage(message.imageUrl) ? null : message.imageUrl,
  }));

  if (!before && messages.length > 0) {
    await prisma.chatRead.createMany({
      data: messages.map((message) => ({ messageId: message.id, userId: user.id })),
      skipDuplicates: true,
    }).catch(() => null);
  }

  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    channel?: string;
    content?: string;
    imageUrl?: string;
    assignedToUserId?: string;
    assignedToUserName?: string;
    fuelExpense?: {
      vehicleId: string;
      amount: number;
      liters?: number;
      odometer?: number;
      fuelType?: string;
      receiptUrl?: string;
      note?: string;
    };
    vehicleFault?: {
      vehicleId: string;
      title: string;
      description?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      photoUrl?: string;
    };
  } | null;

  if (!body) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }

  if (isInlineImage(body.imageUrl) || isInlineImage(body.fuelExpense?.receiptUrl) || isInlineImage(body.vehicleFault?.photoUrl)) {
    return NextResponse.json(
      { error: 'Obrázek je nutné nejdříve nahrát do úložiště. Base64 obrázky nelze ukládat do chatu.' },
      { status: 400 }
    );
  }

  const channel = body.channel || 'general';
  let content = body.content?.trim() || '';
  let fuelExpenseId: string | undefined = undefined;

  const userName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.name || user.email;

  if (body.fuelExpense) {
    const fe = body.fuelExpense;
    if (!fe.vehicleId || !fe.amount || fe.amount <= 0) {
      return NextResponse.json({ error: 'Zadejte platné vozidlo a částku za palivo.' }, { status: 400 });
    }

    const vehicleExpense = await prisma.vehicleFuelExpense.create({
      data: {
        vehicleId: fe.vehicleId,
        employeeId: user.employee?.id,
        userId: user.id,
        amount: fe.amount,
        liters: fe.liters ? fe.liters : null,
        odometer: fe.odometer ? fe.odometer : null,
        fuelType: fe.fuelType || 'DIESEL',
        receiptUrl: fe.receiptUrl || body.imageUrl || null,
        note: fe.note || null,
      },
    });

    fuelExpenseId = vehicleExpense.id;
    if (!content) {
      content = `⛽ Účtenka za palivo: ${fe.amount} Kč (${fe.liters ? fe.liters + ' l' : ''})`;
    }
  }

  if (body.vehicleFault) {
    const vf = body.vehicleFault;
    if (!vf.vehicleId || !vf.title) {
      return NextResponse.json({ error: 'Vyberte vozidlo a popište závadu.' }, { status: 400 });
    }

    await prisma.vehicleServiceRecord.create({
      data: {
        vehicleId: vf.vehicleId,
        date: new Date(),
        title: `⚠️ Hlášená závada: ${vf.title}`,
        description: `Nahlásil: ${userName}. Popis: ${vf.description || 'Bez podrobného popisu'}. Fotodokumentace: ${vf.photoUrl || body.imageUrl || 'Bez fotky'}.`,
      },
    });

    if (vf.severity === 'CRITICAL' || vf.severity === 'HIGH') {
      await prisma.vehicle.update({
        where: { id: vf.vehicleId },
        data: { status: 'SERVICE' },
      }).catch(() => null);
    }

    if (!content) {
      content = `🚨 NAHLÁŠENÍ ZÁVADY NA VOZIDLE: ${vf.title}\nPopis: ${vf.description || 'Bez popisu'}\nZávažnost: ${vf.severity || 'MEDIUM'}`;
    }
  }

  if (!content && !body.imageUrl) {
    return NextResponse.json({ error: 'Zpráva nesmí být prázdná.' }, { status: 400 });
  }

  const msg = await prisma.chatMessage.create({
    data: {
      channel,
      userId: user.id,
      userName,
      userRole: roleLabel(user.role),
      content,
      imageUrl: body.imageUrl || null,
      fuelExpenseId: fuelExpenseId || null,
      assignedToUserId: body.assignedToUserId || null,
      assignedToUserName: body.assignedToUserName || null,
    },
  });

  await prisma.chatRead.create({
    data: {
      messageId: msg.id,
      userId: user.id,
    },
  }).catch(() => null);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  }).catch(() => null);

  return NextResponse.json(msg, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    messageId: string;
    assignedToUserId?: string | null;
    assignedToUserName?: string | null;
    isResolved?: boolean;
  } | null;

  if (!body || !body.messageId) {
    return NextResponse.json({ error: 'Chybí ID zprávy.' }, { status: 400 });
  }

  const updatedMsg = await prisma.chatMessage.update({
    where: { id: body.messageId },
    data: {
      assignedToUserId: body.assignedToUserId !== undefined ? body.assignedToUserId : undefined,
      assignedToUserName: body.assignedToUserName !== undefined ? body.assignedToUserName : undefined,
      isResolved: body.isResolved !== undefined ? body.isResolved : undefined,
      resolvedAt: body.isResolved ? new Date() : null,
    },
  });

  return NextResponse.json(updatedMsg);
}
