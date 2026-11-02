import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function mergeDuplicateClients(
  targetClientId: string,
  sourceClientId: string,
  actorUserId: string,
  actorEmail: string
) {
  if (targetClientId === sourceClientId) {
    throw new Error('Nelze sloučit klienta sám se sebou.');
  }

  return prisma.$transaction(async (tx) => {
    const [targetClient, sourceClient] = await Promise.all([
      tx.client.findFirst({ where: { id: targetClientId, active: true } }),
      tx.client.findFirst({ where: { id: sourceClientId, active: true } }),
    ]);
    if (!targetClient || !sourceClient) throw new Error('CLIENT_NOT_FOUND');

    // Auto-enrich target client with missing fields from source client
    const enrichData: Prisma.ClientUpdateInput = {};
    if (!targetClient.companyId && sourceClient.companyId) enrichData.companyId = sourceClient.companyId;
    if (!targetClient.dic && sourceClient.dic) enrichData.dic = sourceClient.dic;
    if (!targetClient.email && sourceClient.email) enrichData.email = sourceClient.email;
    if (!targetClient.phone && sourceClient.phone) enrichData.phone = sourceClient.phone;
    if (!targetClient.billingStreet && sourceClient.billingStreet) enrichData.billingStreet = sourceClient.billingStreet;
    if (!targetClient.billingCity && sourceClient.billingCity) enrichData.billingCity = sourceClient.billingCity;
    if (!targetClient.billingZip && sourceClient.billingZip) enrichData.billingZip = sourceClient.billingZip;
    if (!targetClient.shippingStreet && sourceClient.shippingStreet) enrichData.shippingStreet = sourceClient.shippingStreet;
    if (!targetClient.shippingCity && sourceClient.shippingCity) enrichData.shippingCity = sourceClient.shippingCity;
    if (!targetClient.shippingZip && sourceClient.shippingZip) enrichData.shippingZip = sourceClient.shippingZip;
    if (!targetClient.contactPerson && sourceClient.contactPerson) enrichData.contactPerson = sourceClient.contactPerson;
    if (!targetClient.website && sourceClient.website) enrichData.website = sourceClient.website;
    if (!targetClient.tradingName && sourceClient.tradingName) enrichData.tradingName = sourceClient.tradingName;

    if (Object.keys(enrichData).length > 0) {
      await tx.client.update({
        where: { id: targetClientId },
        data: enrichData,
      });
    }

    const [targetPrimary, sourcePrimaryContacts] = await Promise.all([
      tx.clientContact.findFirst({ where: { clientId: targetClientId, active: true, isPrimary: true }, select: { id: true } }),
      tx.clientContact.findMany({ where: { clientId: sourceClientId, active: true, isPrimary: true }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
    ]);
    if (targetPrimary) {
      await tx.clientContact.updateMany({ where: { clientId: sourceClientId, isPrimary: true }, data: { isPrimary: false } });
    } else if (sourcePrimaryContacts.length > 1) {
      await tx.clientContact.updateMany({
        where: { clientId: sourceClientId, isPrimary: true, id: { not: sourcePrimaryContacts[0].id } },
        data: { isPrimary: false },
      });
    }
    // Move all client relations concurrently to keep transaction super fast and avoid timeouts
    await Promise.all([
      tx.clientContact.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.clientBranch.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.offer.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.crmOrder.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.occupancy.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId, clientName: targetClient.name } }),
      tx.advertisingSurface.updateMany({ where: { currentClientId: sourceClientId }, data: { currentClientId: targetClientId } }),
      tx.workOrder.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId, clientName: targetClient.name } }),
      tx.workEntry.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.clientContract.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.clientInvoice.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.clientCommunication.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.crmTask.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.clientDocument.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.navigationDocumentationReport.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.navigationContract.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.navigationContactPerson.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.salesOpportunity.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.carrierHistoryLog.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId, clientName: targetClient.name } }),
      tx.printProductionJob.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.aiInboxMessage.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
      tx.occupancyInsight.updateMany({ where: { clientId: sourceClientId }, data: { clientId: targetClientId } }),
    ]);

    // 16. Create ClientMergeLog
    const mergeLog = await tx.clientMergeLog.create({
      data: {
        targetClientId,
        sourceClientId,
        sourceClientName: sourceClient.name,
        performedByUserId: actorUserId,
        detailsJson: JSON.stringify({
          sourceClientName: sourceClient.name,
          sourceCompanyId: sourceClient.companyId,
          targetClientName: targetClient.name,
          mergedAt: new Date().toISOString(),
        }),
      },
    });

    // 17. Audit Log
    await tx.crmAuditLog.create({
      data: {
        userId: actorUserId,
        userEmail: actorEmail,
        action: 'MERGE_CLIENTS',
        entityType: 'Client',
        entityId: targetClientId,
        detailsJson: JSON.stringify({
          sourceClientId,
          sourceClientName: sourceClient.name,
        }),
      },
    });

    // 18. Soft-deactivate/archive source client and make normalizedName unique to free unique index
    const uniqueMergedName = sourceClient.normalizedName.startsWith('[merged-')
      ? sourceClient.normalizedName
      : `[merged-${sourceClientId.slice(-8)}]-${sourceClient.normalizedName}`.slice(0, 180);

    await tx.client.update({
      where: { id: sourceClientId },
      data: {
        active: false,
        status: 'INACTIVE',
        normalizedName: uniqueMergedName,
        note: `[SLOUČENO DO KLIENTA ${targetClient.name} (${targetClient.id}) DNE ${new Date().toLocaleDateString('cs-CZ')}] ${sourceClient.note ?? ''}`,
      },
    });

    return {
      success: true,
      targetClientId,
      sourceClientId,
      mergeLogId: mergeLog.id,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000, maxWait: 10000 });
}
