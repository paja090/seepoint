'use server';
import { revalidatePath } from 'next/cache';
import { Prisma, PrintFormatType, PrintMaterialType, type PrintProductionStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireModuleAccess } from '@/lib/module-access';
import { auditProduction, createProductionJob, transitionProductionJob } from '@/lib/production/production-service';
import { safeArtworkUrl, textInput } from '@/lib/production/production-policy';

export async function getPrintJobs() {
  await requireModuleAccess('printProduction');
  return prisma.printProductionJob.findMany({ include: { offer: { select: { title: true } }, client: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
}
export async function createPrintJob(data: unknown) {
  const user = await requireModuleAccess('printProduction');
  if (!['ADMIN', 'MANAGER', 'SALES'].includes(user.role)) throw new Error('Nemáte oprávnění vytvářet tiskové zakázky.');
  const job = await createProductionJob(data, user);
  revalidatePath('/production');
  return { id: job.id, status: job.status };
}
export async function updatePrintJobStatus(id: string, status: PrintProductionStatus) {
  const user = await requireModuleAccess('printProduction');
  if (!['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN'].includes(user.role)) throw new Error('Nemáte oprávnění měnit stav výroby.');
  textInput(id, 'Zakázka', 128, true);
  const result = await prisma.$transaction(tx => transitionProductionJob(tx, id, status, user), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidatePath('/production');
  return result;
}
export async function updatePrintJob(id: string, raw: unknown) {
  const user = await requireModuleAccess('printProduction');
  if (!['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN'].includes(user.role)) throw new Error('Nemáte oprávnění upravovat tiskové zakázky.');
  const jobId = textInput(id, 'Zakázka', 128, true)!;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Neplatná data tiskové zakázky.');
  const data = raw as Record<string, unknown>;
  const title = textInput(data.title, 'Název', 250, true)!;
  const formatType = data.formatType as PrintFormatType;
  const materialType = data.materialType as PrintMaterialType;
  if (!Object.values(PrintFormatType).includes(formatType) || !Object.values(PrintMaterialType).includes(materialType)) {
    throw new Error('Neplatný formát nebo materiál.');
  }
  const quantity = Number(data.quantity);
  const sparesQuantity = Number(data.sparesQuantity ?? 0);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000 || !Number.isSafeInteger(sparesQuantity) || sparesQuantity < 0 || sparesQuantity > 1000000) {
    throw new Error('Neplatné množství.');
  }
  const deliveryDeadline = data.deliveryDeadline === undefined || data.deliveryDeadline === null || data.deliveryDeadline === ''
    ? null
    : data.deliveryDeadline instanceof Date ? data.deliveryDeadline : typeof data.deliveryDeadline === 'string' ? new Date(data.deliveryDeadline) : null;
  if (deliveryDeadline && !Number.isFinite(deliveryDeadline.getTime())) throw new Error('Neplatný termín.');
  const artworkUrl = safeArtworkUrl(data.artworkUrl) ?? null;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.printProductionJob.findUnique({ where: { id: jobId, organizationId: user.organizationId! } });
    if (!existing) throw new Error('Tisková zakázka nebyla nalezena.');
    await tx.printProductionJob.update({
      where: { id: jobId },
      data: {
        title,
        formatType,
        materialType,
        quantity,
        sparesQuantity,
        deliveryDeadline,
        artworkUrl,
      },
    });
    await auditProduction(tx, jobId, user, existing.status, existing.status, 'Úprava parametrů tiskové zakázky / grafických dat');
  });
  revalidatePath('/production');
  return { id: jobId };
}

