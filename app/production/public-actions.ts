'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getPublicRow } from '@/lib/offers/service';
import { runWithTenantContext } from '@/lib/tenant-context';
import { isModuleEnabled } from '@/lib/organization-modules';
import { safeArtworkUrl, textInput } from '@/lib/production/production-policy';
import { transitionProductionJob } from '@/lib/production/production-service';

export async function approvePrintJobByClient(token: string, approverName: string, note?: string, artworkUrl?: string, printJobId?: string) {
  const name = textInput(approverName, 'Jméno schvalovatele', 120, true)!;
  const approvalNote = textInput(note, 'Poznámka', 4000);
  const url = safeArtworkUrl(artworkUrl);
  const id = textInput(printJobId, 'Tisková zakázka', 128, true)!;
  const offer = await getPublicRow(token);
  const organization = await prisma.organization.findUnique({ where: { id: offer.organizationId } });
  if (!organization?.isActive || !isModuleEnabled(organization, 'printProduction')) throw new Error('Schvalování není dostupné.');
  const result = await runWithTenantContext({ organizationId: offer.organizationId, source: 'public-token' }, () => prisma.$transaction(async tx => {
    const current = await tx.offer.findUnique({ where: { id: offer.id, publicTokenRevokedAt: null } });
    if (!current) throw new Error('Odkaz není dostupný.');
    return transitionProductionJob(tx, id, 'IN_PRINT', { name }, { offerId: offer.id, name, note: approvalNote, artworkUrl: url });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  revalidatePath('/production');
  revalidatePath(`/offer/${token}`);
  revalidatePath(`/p/${token}`);
  return result;
}
