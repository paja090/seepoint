'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';

/**
 * Public server action — does NOT require authentication.
 * Called from the client-facing portal when a client approves print data.
 */
export async function approvePrintJobByClient(
  token: string,
  approverName: string,
  note?: string,
  artworkUrl?: string,
) {
  if (!token || typeof token !== 'string' || token.length < 10) {
    throw new Error('Neplatný schvalovací token. Kontaktujte obchodníka.');
  }
  if (!approverName || typeof approverName !== 'string' || !approverName.trim()) {
    throw new Error('Jméno schvalovatele je povinné.');
  }

  const dataToUpdate: Record<string, unknown> = {
    status: 'IN_PRINT',
    clientApprovedAt: new Date(),
    clientApprovedBy: approverName.trim(),
    clientApprovalNote: note?.trim() || null,
  };

  if (artworkUrl && artworkUrl.trim()) {
    dataToUpdate.artworkUrl = artworkUrl.trim();
  }

  const job = await prisma.printProductionJob.update({
    where: { clientApprovalToken: token },
    data: dataToUpdate,
  });

  revalidatePath('/production');
  return job;
}
