import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId } = await params;

  const logs = await prisma.crmAuditLog.findMany({
    where: { entityType: 'Client', entityId: clientId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ logs });
}
