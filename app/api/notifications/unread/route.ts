import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const userName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.name || user.email;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [myAssignments, myAssignedChatMsgs, unreadChatMessages, recentVehicleFaults] = await Promise.all([
    // Tasks assigned to user
    prisma.workAssignment.findMany({
      where: {
        OR: [
          { workerName: { contains: userName, mode: 'insensitive' } },
          { userId: user.id },
        ],
        workOrder: {
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
        },
      },
      include: {
        workOrder: {
          select: {
            id: true,
            title: true,
            priority: true,
            scheduledAt: true,
            clientName: true,
          },
        },
      },
      take: 10,
    }),
    // Chat messages assigned to user to solve
    prisma.chatMessage.findMany({
      where: {
        assignedToUserId: user.id,
        isResolved: { not: true },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    // New chat messages that the current user has not read yet.
    prisma.chatMessage.findMany({
      where: {
        userId: { not: user.id },
        createdAt: { gte: last24h },
        reads: { none: { userId: user.id } },
      },
      select: { id: true, channel: true, userName: true, content: true, imageUrl: true, createdAt: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    // Vehicle fault reports in last 24h
    prisma.vehicleServiceRecord.findMany({
      where: {
        title: { contains: 'Hlášená závada', mode: 'insensitive' },
        createdAt: { gte: last24h },
      },
      include: {
        vehicle: { select: { name: true, registrationNumber: true } },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const items = [
    ...myAssignments.map((a) => ({
      id: `task-${a.workOrder.id}`,
      type: 'TASK',
      title: `📋 Přiřazený úkol: ${a.workOrder.title}`,
      description: `Klient: ${a.workOrder.clientName}. Termín: ${new Date(a.workOrder.scheduledAt).toLocaleDateString('cs-CZ')}`,
      linkUrl: `/work/${a.workOrder.id}`,
      isUrgent: a.workOrder.priority === 'URGENT',
      createdAt: a.workOrder.scheduledAt.toISOString(),
    })),
    ...myAssignedChatMsgs.map((c) => ({
      id: `chat-${c.id}`,
      type: 'CHAT',
      title: `💬 Případ k řešení v chatu`,
      description: c.content.slice(0, 80),
      linkUrl: '/chat',
      isUrgent: false,
      createdAt: c.createdAt.toISOString(),
    })),
    ...unreadChatMessages.map((message) => ({
      id: `chat-message-${message.id}`,
      type: 'CHAT_MESSAGE',
      title: `💬 Nová zpráva od ${message.userName}`,
      description: message.content.slice(0, 100) || (message.imageUrl ? 'Přidána nová fotografie.' : 'Nová zpráva v týmovém chatu.'),
      linkUrl: `/chat?channel=${encodeURIComponent(message.channel)}`,
      isUrgent: message.channel === 'urgent',
      createdAt: message.createdAt.toISOString(),
    })),
    ...recentVehicleFaults.map((vf) => ({
      id: `fault-${vf.id}`,
      type: 'VEHICLE_FAULT',
      title: `🚨 Porucha na autě: ${vf.vehicle.name}`,
      description: vf.title,
      linkUrl: `/vehicles/${vf.vehicleId}`,
      isUrgent: true,
      createdAt: vf.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    unreadCount: items.length,
    items,
  });
}
