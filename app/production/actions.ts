'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { PrintProductionStatus, PrintFormatType, PrintMaterialType } from '@prisma/client';
import crypto from 'crypto';

export async function getPrintJobs() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    throw new Error('Not authenticated');
  }

  const jobs = await prisma.printProductionJob.findMany({
    where: {
      organizationId: user.organizationId,
    },
    include: {
      offer: {
        select: { title: true },
      },
      client: {
        select: { name: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return jobs;
}

export async function createPrintJob(data: {
  title: string;
  campaignName?: string;
  offerId?: string;
  clientId?: string;
  formatType: PrintFormatType;
  materialType: PrintMaterialType;
  quantity: number;
  sparesQuantity: number;
  deliveryDeadline?: Date;
  status: PrintProductionStatus;
  artworkUrl?: string;
}) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    throw new Error('Not authenticated');
  }

  // Generate a random token for client approval
  const clientApprovalToken = crypto.randomBytes(32).toString('hex');

  const job = await prisma.printProductionJob.create({
    data: {
      ...data,
      organizationId: user.organizationId,
      clientApprovalToken,
    },
  });

  revalidatePath('/production');
  return job;
}

export async function updatePrintJobStatus(id: string, status: PrintProductionStatus) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    throw new Error('Not authenticated');
  }

  const job = await prisma.printProductionJob.update({
    where: { id, organizationId: user.organizationId },
    data: { status },
  });

  // [Sync] Automatically update related CrmRealizations if delivered to warehouse
  if (status === 'DELIVERED_TO_WAREHOUSE' && job.offerId) {
    // 1. Find the CrmOrder for this Offer
    const crmOrder = await prisma.crmOrder.findFirst({
      where: { offerId: job.offerId, organizationId: user.organizationId },
      select: { id: true },
    });

    if (crmOrder) {
      // 2. Update all pending realizations to 'PRODUCED' so technicians can start installing them
      await prisma.crmRealization.updateMany({
        where: {
          crmOrderId: crmOrder.id,
          status: 'WAITING_FOR_PRODUCTION',
          organizationId: user.organizationId,
        },
        data: {
          status: 'PRODUCED',
        },
      });
    }
  }

  revalidatePath('/production');
  return job;
}

export async function getPrintJobByToken(token: string) {
  const job = await prisma.printProductionJob.findUnique({
    where: { clientApprovalToken: token },
  });

  if (!job) return null;

  const organization = await prisma.organization.findUnique({
    where: { id: job.organizationId },
    select: { name: true, logoUrl: true, primaryColor: true }
  });

  return { ...job, organization };
}

export async function approvePrintJobByClient(token: string, approverName: string, note?: string, artworkUrl?: string) {
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
