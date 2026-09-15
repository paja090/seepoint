import type { Prisma } from '@prisma/client';
import { requireTenantContext } from '../tenant-context';

export const navigationIssueTypes = [
  'Sloup nebyl nalezen', 'Sloup neodpovídá dokumentaci', 'Místo je obsazené jiným nájemcem',
  'Montáž není technicky možná', 'Poškozená konstrukce nebo nosič', 'Chybí cedule z tisku',
  'Nesprávný motiv grafiky', 'Překážka nebo vegetace v místě', 'Jiný provozní problém',
] as const;

export async function reportNavigationPointIssue(tx: Prisma.TransactionClient, orderId: string, pointId: string,
  issueType: string, issueNote: string | null, photoId?: string) {
  const { organizationId } = requireTenantContext();
  if (!navigationIssueTypes.includes(issueType as typeof navigationIssueTypes[number])) throw new Error('Neplatný typ problému.');
  const point = await tx.navigationPoint.findFirst({ where: { id: pointId, organizationId, navigationOrderId: orderId,
    navigationOrder: { organizationId } } });
  if (!point) throw new Error('Cross-tenant NavigationPoint rejected.');
  if (photoId && !await tx.photo.count({ where: { id: photoId, organizationId } })) throw new Error('Cross-tenant Photo rejected.');
  return tx.navigationPoint.update({ where: { id: pointId, organizationId }, data: { issueReported: true, issueType,
    issueNote: issueNote?.trim().slice(0, 1000) || null, ...(photoId ? { installedPhotoId: photoId } : {}) } });
}
