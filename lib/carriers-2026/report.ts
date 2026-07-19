import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ImportPlan } from './types.ts';

function csvCell(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export async function writeImportReports(plan: ImportPlan, jsonPath: string, csvPath: string) {
  await mkdir(dirname(jsonPath), { recursive: true });
  await mkdir(dirname(csvPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  const rows: unknown[][] = [['category', 'action', 'sheet', 'row', 'key', 'details']];
  plan.carriers.forEach((item) => rows.push(['carrier', item.action, item.source.sourceSheet, item.source.sourceRow, item.source.code, { updateClass: item.updateClass, materialChanges: item.changes, normalizationChanges: item.normalizationChanges, metadataChanges: item.metadataChanges }]));
  plan.surfaces.forEach((item) => rows.push(['surface', item.action, '', item.source.sourceRow, item.source.sourceKey, { carrierSourceKey: item.carrierSourceKey, sourcePosition: item.source.sourcePosition, name: item.source.name, reason: item.reason, similarExisting: item.similarExisting }]));
  plan.occupancies.forEach((item) => rows.push(['occupancy', item.action, item.sourceSheet, item.sourceRow, item.sourceKey, { campaignName: item.campaignName, clientName: item.clientName, dateFrom: item.dateFrom, dateTo: item.dateTo, rawSourceText: item.rawSourceText, conflictId: item.conflictId, conflict: item.conflict, resolutionIssueId: item.resolutionIssueId }]));
  plan.prices.forEach((item) => rows.push(['price', item.action, item.source.sourceSheet, item.source.sourceRow, item.source.identityKey, item.source]));
  plan.issues.forEach((item) => rows.push(['issue', item.code, item.sheetName, item.sourceRow, item.field, item]));
  await writeFile(csvPath, `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
}

export async function writePhase3Reports(plan: ImportPlan, paths: { safePlan: string; blockedPlan: string; campaignClients: string; inventoryChanges: string; historical: string }) {
  await mkdir(dirname(paths.safePlan), { recursive: true });
  await Promise.all([
    writeFile(paths.safePlan, `${JSON.stringify(plan.safePlan, null, 2)}\n`, 'utf8'),
    writeFile(paths.blockedPlan, `${JSON.stringify(plan.blockedPlan, null, 2)}\n`, 'utf8'),
    writeFile(paths.historical, `${JSON.stringify({ asOfDate: plan.asOfDate, sourceFileHash: plan.fileHash, historicalSkipped: plan.historicalSkipped }, null, 2)}\n`, 'utf8'),
  ]);
  const campaignHeaders = ['campaignGroupId', 'normalizedCampaignName', 'originalCampaignExamples', 'orderReference', 'mediaTypes', 'firstDate', 'lastDate', 'occurrenceCount', 'carrierCount', 'suggestedClientId', 'suggestedClientName', 'suggestionConfidence', 'selectedClientId', 'selectedClientName', 'action', 'note'];
  const campaignRows = plan.campaignClientGroups.map((group) => campaignHeaders.map((key) => (group as unknown as Record<string, unknown>)[key]));
  await writeFile(paths.campaignClients, `\uFEFF${[campaignHeaders, ...campaignRows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
  const inventoryHeaders = ['carrierCode', 'databaseId', 'mediaType', 'changedField', 'originalValue', 'newValue', 'sourceSheet', 'sourceRow', 'gpsDistanceMeters', 'reviewStatus'];
  const inventoryRows = plan.carriers.flatMap((item) => item.changes.map((change) => [item.source.code, item.existingId ?? '', item.source.type, change.field, change.original, change.next, item.source.sourceSheet, item.source.sourceRow, item.gpsDistanceMeters?.toFixed(1) ?? '', item.gpsReview ?? '']));
  await writeFile(paths.inventoryChanges, `\uFEFF${[inventoryHeaders, ...inventoryRows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
}
