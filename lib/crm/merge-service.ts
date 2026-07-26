import { prisma } from '@/lib/db';

export async function mergeDuplicateClients(
  targetClientId: string,
  sourceClientId: string,
  actorUserId: string,
  actorEmail: string
) {
  if (targetClientId === sourceClientId) {
    throw new Error('Nelze sloučit klienta sám se sebou.');
  }

  const [targetClient, sourceClient] = await Promise.all([
    prisma.client.findUnique({ where: { id: targetClientId } }),
    prisma.client.findUnique({ where: { id: sourceClientId } }),
  ]);

  if (!targetClient || !sourceClient) {
    throw new Error('Cílový nebo zdrojový klient nebyl nalezen.');
  }
  if (!targetClient.active) throw new Error('Cílový klient není aktivní.');
  if (!sourceClient.active) throw new Error('Zdrojový klient už byl archivován nebo sloučen.');

  return await prisma.$transaction(async (tx) => {
    // 1. Move ClientContact records
    await tx.clientContact.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 2. Move ClientBranch records
    await tx.clientBranch.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 3. Move Offers
    await tx.offer.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 4. Move CrmOrders
    await tx.crmOrder.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 5. Move Occupancy records
    await tx.occupancy.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId, clientName: targetClient.name },
    });

    // 6. Move AdvertisingSurface currentClientId
    await tx.advertisingSurface.updateMany({
      where: { currentClientId: sourceClientId },
      data: { currentClientId: targetClientId },
    });

    // 7. Move WorkOrders
    await tx.workOrder.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId, clientName: targetClient.name },
    });

    // 8. Move WorkEntries
    await tx.workEntry.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 9. Move ClientContract records
    await tx.clientContract.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 10. Move ClientInvoice records
    await tx.clientInvoice.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 11. Move ClientCommunication records
    await tx.clientCommunication.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 12. Move CrmTask records
    await tx.crmTask.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 13. Move ClientDocument records
    await tx.clientDocument.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 14. Move NavigationDocumentationReport records
    await tx.navigationDocumentationReport.updateMany({
      where: { clientId: sourceClientId },
      data: { clientId: targetClientId },
    });

    // 15. Create ClientMergeLog
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

    // 16. Audit Log
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

    // 17. Soft-deactivate/archive source client
    await tx.client.update({
      where: { id: sourceClientId },
      data: {
        active: false,
        status: 'INACTIVE',
        note: `[SLOUČENO DO KLIENTA ${targetClient.name} (${targetClient.id}) DNE ${new Date().toLocaleDateString('cs-CZ')}] ${sourceClient.note ?? ''}`,
      },
    });

    return {
      success: true,
      targetClientId,
      sourceClientId,
      mergeLogId: mergeLog.id,
    };
  });
}
