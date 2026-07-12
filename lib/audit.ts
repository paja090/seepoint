import type { AuditAction, Prisma } from '@prisma/client';
import { prisma } from './db';
export async function audit(action: AuditAction, targetUserId: string, actorUserId?: string | null, metadata?: Prisma.InputJsonValue) {
  await prisma.userAuditLog.create({ data: { action, targetUserId, actorUserId, metadata } });
}
