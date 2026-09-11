'use server';
import { revalidatePath } from 'next/cache';
import { Prisma, type PrintProductionStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireModuleAccess } from '@/lib/module-access';
import { createProductionJob, transitionProductionJob } from '@/lib/production/production-service';
import { textInput } from '@/lib/production/production-policy';

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
