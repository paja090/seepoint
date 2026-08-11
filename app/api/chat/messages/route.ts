import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || 'general';

  // Fetch channel messages
  const messages = await prisma.chatMessage.findMany({
    where: { channel },
    include: {
      reads: {
        select: { userId: true, readAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  // Mark latest message as read by current user
  if (messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    await prisma.chatRead.upsert({
      where: {
        messageId_userId: { messageId: lastMsg.id, userId: user.id },
      },
      update: { readAt: new Date() },
      create: { messageId: lastMsg.id, userId: user.id },
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

  const channel = body.channel || 'general';
  let content = body.content?.trim() || '';
  let fuelExpenseId: string | undefined = undefined;

  const userName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.name || user.email;

  // Handle fuel receipt expense creation if attached
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

  // Handle vehicle fault reporting if attached
  if (body.vehicleFault) {
    const vf = body.vehicleFault;
    if (!vf.vehicleId || !vf.title) {
      return NextResponse.json({ error: 'Vyberte vozidlo a popište závadu.' }, { status: 400 });
    }

    // Log a service record entry in the database
    await prisma.vehicleServiceRecord.create({
      data: {
        vehicleId: vf.vehicleId,
        date: new Date(),
        title: `⚠️ Hlášená závada: ${vf.title}`,
        description: `Nahlásil: ${userName}. Popis: ${vf.description || 'Bez podrobného popisu'}. Fotodokumentace: ${vf.photoUrl || body.imageUrl || 'Bez fotky'}.`,
      },
    });

    // If critical or high severity, change vehicle status to SERVICE
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
    },
  });

  // Automatically mark read for sender
  await prisma.chatRead.create({
    data: {
      messageId: msg.id,
      userId: user.id,
    },
  }).catch(() => null);

  // Update user last login / active timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  }).catch(() => null);

  return NextResponse.json(msg, { status: 201 });
}
