import { readFile, writeFile } from 'node:fs/promises';
import type { ImportPlan, ResolutionAction, ResolutionRow } from './types.ts';

export const RESOLUTION_COLUMNS: Array<keyof ResolutionRow> = [
  'issueId', 'issueType', 'carrierCode', 'carrierName', 'sourceSheet', 'sourceRow', 'sourceColumn', 'surfaceLabel',
  'importedCampaignName', 'importedClientName', 'importedDateFrom', 'importedDateTo', 'existingRecordId',
  'existingCampaignName', 'existingClientName', 'existingDateFrom', 'existingDateTo', 'existingStatus', 'existingNote',
  'createdBy', 'updatedBy', 'recommendedAction', 'selectedAction', 'decisionNote', 'sourceFileHash', 'databaseFingerprint', 'recordFingerprint',
  'slot1Campaign', 'slot1StartDate', 'slot1EndDate', 'slot2Campaign', 'slot2StartDate', 'slot2EndDate', 'manualStartDate', 'manualEndDate',
];
const ACTIONS = new Set<ResolutionAction>(['KEEP_EXISTING', 'USE_IMPORT', 'MERGE_OR_EXTEND', 'CREATE_SEPARATE_SURFACE', 'CREATE_SEPARATE_OCCUPANCY', 'SKIP', 'REQUIRES_MANUAL_REVIEW',
  'SET_MANUAL_DATE_RANGES', 'USE_FIRST_SLOT_ONLY', 'USE_SECOND_SLOT_ONLY', 'SKIP_BOTH', 'LEAVE_PENDING', 'KEEP_EXISTING_AND_SKIP_IMPORT',
  'KEEP_EXISTING_AND_SAVE_PENDING', 'IMPORT_NON_OVERLAPPING_PART', 'MANUAL_REVIEW_REQUIRED']);

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()); }
function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string) { return aFrom <= bTo && bFrom <= aTo; }

function cell(value: string) { return `"${value.replace(/"/g, '""')}"`; }

export async function writeResolutionCsv(rows: ResolutionRow[], path: string) {
  const lines = [RESOLUTION_COLUMNS.join(','), ...rows.map((row) => RESOLUTION_COLUMNS.map((key) => cell(String(row[key] ?? ''))).join(','))];
  await writeFile(path, `\uFEFF${lines.join('\n')}\n`, 'utf8');
}

function parseCsv(input: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let i = input.charCodeAt(0) === 0xfeff ? 1 : 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted && char === '"' && input[i + 1] === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(value); value = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(value); value = ''; if (row.some(Boolean)) rows.push(row); row = [];
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

export async function applyResolutionCsv(plan: ImportPlan, path: string) {
  const parsed = parseCsv(await readFile(path, 'utf8'));
  const headers = parsed.shift() ?? [];
  const invalid: string[] = [];
  for (const required of RESOLUTION_COLUMNS) if (!headers.includes(required)) invalid.push(`Missing column ${required}.`);
  const rows = parsed.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])) as ResolutionRow);
  const expected = new Map(plan.resolution.rows.map((row) => [row.issueId, row]));
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.issueId)) invalid.push(`Duplicate issueId ${row.issueId}.`); seen.add(row.issueId);
    const current = expected.get(row.issueId);
    if (!current) { invalid.push(`Unknown or stale issueId ${row.issueId}.`); continue; }
    if (row.sourceFileHash !== plan.fileHash) invalid.push(`Source file hash mismatch for ${row.issueId}.`);
    if (row.databaseFingerprint !== plan.databaseFingerprint) invalid.push(`Database fingerprint mismatch for ${row.issueId}.`);
    if (row.recordFingerprint !== current.recordFingerprint) invalid.push(`Record fingerprint mismatch for ${row.issueId}.`);
    if (!ACTIONS.has(row.selectedAction)) invalid.push(`Invalid selectedAction for ${row.issueId}.`);
    if (['REQUIRES_MANUAL_REVIEW', 'LEAVE_PENDING', 'MANUAL_REVIEW_REQUIRED'].includes(row.selectedAction) || !row.selectedAction) invalid.push(`Missing decision for ${row.issueId}.`);
    if (row.issueType === 'AMBIGUOUS_CAMPAIGN_DATA') {
      if (!['SET_MANUAL_DATE_RANGES', 'USE_FIRST_SLOT_ONLY', 'USE_SECOND_SLOT_ONLY', 'SKIP_BOTH', 'LEAVE_PENDING'].includes(row.selectedAction)) invalid.push(`Unsafe CP26 action ${row.selectedAction} for ${row.issueId}.`);
      const month = Number(/"month":(\d+)/.exec(row.importedCampaignName)?.[1]);
      const ranges = row.selectedAction === 'SET_MANUAL_DATE_RANGES' ? [[row.slot1StartDate ?? '', row.slot1EndDate ?? ''], [row.slot2StartDate ?? '', row.slot2EndDate ?? '']]
        : row.selectedAction === 'USE_FIRST_SLOT_ONLY' ? [[row.slot1StartDate ?? '', row.slot1EndDate ?? '']]
          : row.selectedAction === 'USE_SECOND_SLOT_ONLY' ? [[row.slot2StartDate ?? '', row.slot2EndDate ?? '']] : [];
      for (const [from, to] of ranges) {
        if (!validDate(from) || !validDate(to) || from > to) invalid.push(`Invalid manual slot date range for ${row.issueId}.`);
        if (Number(from.slice(5, 7)) !== month || Number(to.slice(5, 7)) !== month || !from.startsWith('2026-') || !to.startsWith('2026-')) invalid.push(`Slot dates are outside the source month for ${row.issueId}.`);
      }
      if (ranges.length === 2 && rangesOverlap(ranges[0][0], ranges[0][1], ranges[1][0], ranges[1][1])) invalid.push(`Manual slot ranges overlap for ${row.issueId}.`);
    }
    if (row.issueType === 'MANUAL_RECORD_CONFLICT' && !['KEEP_EXISTING_AND_SKIP_IMPORT', 'KEEP_EXISTING_AND_SAVE_PENDING', 'IMPORT_NON_OVERLAPPING_PART', 'MANUAL_REVIEW_REQUIRED'].includes(row.selectedAction)) invalid.push(`Manual record ${row.issueId} only allows non-destructive actions.`);
    if (row.issueType === 'MANUAL_RECORD_CONFLICT' && row.selectedAction === 'IMPORT_NON_OVERLAPPING_PART') {
      if (!validDate(row.manualStartDate ?? '') || !validDate(row.manualEndDate ?? '') || (row.manualStartDate ?? '') > (row.manualEndDate ?? '')) invalid.push(`Invalid non-overlapping date range for ${row.issueId}.`);
      if (rangesOverlap(row.manualStartDate ?? '', row.manualEndDate ?? '', row.existingDateFrom, row.existingDateTo)) invalid.push(`Manual conflict range still overlaps for ${row.issueId}.`);
    }
    if (row.issueType !== 'PREVIOUS_IMPORT_UPDATE' && ['USE_IMPORT', 'MERGE_OR_EXTEND'].includes(row.selectedAction)) invalid.push(`Only a previous CARRIERS_2026 import may be updated for ${row.issueId}.`);
  }
  for (const issueId of expected.keys()) if (!seen.has(issueId)) invalid.push(`Missing resolution row ${issueId}.`);

  if (!invalid.length) for (const row of rows) {
    const occupancy = plan.occupancies.find((item) => item.resolutionIssueId === row.issueId);
    if (occupancy && ['KEEP_EXISTING', 'SKIP', 'KEEP_EXISTING_AND_SKIP_IMPORT', 'KEEP_EXISTING_AND_SAVE_PENDING'].includes(row.selectedAction)) occupancy.action = 'UNCHANGED';
    if (occupancy && ['MERGE_OR_EXTEND', 'USE_IMPORT'].includes(row.selectedAction)) occupancy.action = 'EXTEND_OCCUPANCY';
  }
  plan.resolution = { rows, supplied: true, invalid, stale: invalid.some((message) => /stale|fingerprint|hash mismatch/i.test(message)) };
  const unresolvedCp = rows.filter((row) => row.issueType === 'AMBIGUOUS_CAMPAIGN_DATA' && !['KEEP_EXISTING', 'SKIP'].includes(row.selectedAction)).length;
  const unresolvedConflicts = plan.occupancies.filter(({ action }) => action === 'OCCUPANCY_CONFLICT').length;
  plan.stats.cpUnresolvedTemporalPairs = unresolvedCp;
  plan.stats.occupancyConflicts = unresolvedConflicts;
  const reasons = plan.safetyGate.reasons.filter((reason) => !reason.startsWith('CP26 temporal') && !reason.startsWith('Occupancy conflicts'));
  if (unresolvedCp) reasons.push('CP26 temporal-slot pairs require explicit manual decisions.');
  if (unresolvedConflicts) reasons.push('Occupancy conflicts remain unresolved.');
  if (invalid.length) reasons.push(...invalid.map((message) => `Resolution validation: ${message}`));
  plan.safetyGate = { blocked: reasons.length > 0, reasons };
  return plan;
}
