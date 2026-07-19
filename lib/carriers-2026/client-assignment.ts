import type { PrismaClient } from '@prisma/client';
import { stableHash } from './normalize.ts';

export type CampaignClientAssignment = { campaignGroupId: string; occupancySourceKeys: string[]; selectedClientId: string; actor: string; expectedFingerprint: string };

export function assignmentFingerprint(rows: Array<{ sourceKey: string | null; clientId: string | null; updatedAt: Date }>) {
  return stableHash(rows.map((row) => ({ sourceKey: row.sourceKey, clientId: row.clientId, updatedAt: row.updatedAt.toISOString() })).sort((a, b) => String(a.sourceKey).localeCompare(String(b.sourceKey))));
}

export async function assignClientToCampaignGroup(prisma: PrismaClient, input: CampaignClientAssignment) {
  if (!input.occupancySourceKeys.length || new Set(input.occupancySourceKeys).size !== input.occupancySourceKeys.length) throw new Error('Campaign group contains no records or duplicate source keys.');
  const [client, occupancies] = await Promise.all([
    prisma.client.findUnique({ where: { id: input.selectedClientId }, select: { id: true, name: true } }),
    prisma.occupancy.findMany({ where: { sourceKey: { in: input.occupancySourceKeys }, sourceSystem: 'CARRIERS_2026' }, select: { id: true, sourceKey: true, clientId: true, updatedAt: true } }),
  ]);
  if (!client) throw new Error('Selected existing client does not exist.');
  if (occupancies.length !== input.occupancySourceKeys.length) throw new Error('Campaign group changed or contains a non-imported occupancy.');
  if (assignmentFingerprint(occupancies) !== input.expectedFingerprint) throw new Error('Campaign group changed after review.');
  if (occupancies.some(({ clientId }) => clientId && clientId !== client.id)) throw new Error('Campaign group already contains another assigned client.');
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.occupancy.updateMany({ where: { id: { in: occupancies.map(({ id }) => id) } }, data: {
      clientId: client.id, clientName: client.name, clientResolutionStatus: 'RESOLVED', updatedBy: input.actor,
    } });
    return { campaignGroupId: input.campaignGroupId, clientId: client.id, clientName: client.name, updatedOccupancies: result.count, auditHash: stableHash(input) };
  });
}
