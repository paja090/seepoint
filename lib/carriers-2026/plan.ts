import { addMonths, monthBounds, normalizeCode, normalizeText, stableHash } from './normalize.ts';
import type {
  CarrierPlanItem, ExistingState, FieldChange, ImportPlan, ParsedWorkbook, PricePlanItem,
  CampaignClientGroup, HistoricalSkippedItem, ImportScope, PlanOperation, ResolutionRow, ScopePlan, SourceCampaign, SourceCarrier, SourceSurface, TemporalClassification,
} from './types.ts';

export function databaseFingerprint(state: ExistingState) {
  return stableHash({
    carriers: [...state.carriers].sort((a, b) => a.id.localeCompare(b.id)).map((carrier) => ({
      id: carrier.id, code: carrier.code, name: carrier.name, type: carrier.type, city: carrier.city,
      locality: carrier.locality, street: carrier.street, address: carrier.address, latitude: carrier.latitude,
      longitude: carrier.longitude, sourceKey: carrier.sourceKey, sourceSystem: carrier.sourceSystem,
      surfaces: [...carrier.surfaces].sort((a, b) => a.id.localeCompare(b.id)).map((surface) => ({
        id: surface.id, name: surface.name, mediaType: surface.mediaType, sourcePosition: surface.sourcePosition,
        sourceKey: surface.sourceKey, occupancies: [...surface.occupancies].sort((a, b) => a.id.localeCompare(b.id)).map((o) => ({
          id: o.id, clientId: o.clientId, clientName: o.clientName, campaignName: o.campaignName,
          dateFrom: o.dateFrom.toISOString(), dateTo: o.dateTo.toISOString(), status: o.status,
          sourceSystem: o.sourceSystem, sourceKey: o.sourceKey, updatedAt: o.updatedAt?.toISOString(),
        })),
      })),
    })),
    clients: [...state.clients].sort((a, b) => a.id.localeCompare(b.id)),
    prices: [...state.prices].sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({ ...p, validFrom: p.validFrom.toISOString(), validTo: p.validTo?.toISOString() })),
    photos: [...(state.photos ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

function sameCoordinate(left: number | null, right: number | undefined) {
  if (right === undefined) return true;
  return left !== null && Math.abs(left - right) < 0.0000001;
}

function carrierChanges(source: SourceCarrier, existing: ExistingState['carriers'][number]) {
  const changes: FieldChange[] = [];
  const compare = (field: string, original: unknown, next: unknown) => {
    if (next === undefined || next === '') return;
    const normalizedOriginal = typeof original === 'string' ? normalizeText(original) : '';
    const normalizedNext = typeof next === 'string' ? normalizeText(next) : '';
    const equal = typeof original === 'string' && typeof next === 'string'
      ? normalizedOriginal === normalizedNext || (field === 'address' && normalizedOriginal.includes(normalizedNext))
      : original === next;
    if (!equal) changes.push({ field, original, next, reason: `Aktuální hodnota z ${source.sourceSheet}, řádek ${source.sourceRow}.` });
  };
  compare('name', existing.name, source.name);
  compare('type', existing.type, source.type);
  compare('city', existing.city, source.city);
  compare('locality', existing.locality, source.locality);
  compare('street', existing.street, source.street);
  compare('address', existing.address, source.address);
  if (!sameCoordinate(existing.latitude, source.latitude)) compare('latitude', existing.latitude, source.latitude);
  if (!sameCoordinate(existing.longitude, source.longitude)) compare('longitude', existing.longitude, source.longitude);
  return changes;
}

function carrierClassification(source: SourceCarrier, existing: ExistingState['carriers'][number], changes: FieldChange[]) {
  const normalizationChanges: FieldChange[] = [];
  const values: Array<[string, unknown, unknown]> = [['name', existing.name, source.name], ['city', existing.city, source.city], ['locality', existing.locality, source.locality], ['street', existing.street, source.street], ['address', existing.address, source.address]];
  for (const [field, original, next] of values) if (typeof original === 'string' && typeof next === 'string' && original !== next && normalizeText(original) === normalizeText(next)) {
    normalizationChanges.push({ field, original, next, reason: 'Only whitespace, punctuation, accents or company-suffix normalization differs.' });
  }
  const metadataChanges: FieldChange[] = [];
  const metadata: Array<[string, unknown, unknown]> = [['sourceSystem', existing.sourceSystem, 'CARRIERS_2026'], ['sourceSheet', existing.sourceSheet, source.sourceSheet], ['sourceRow', existing.sourceRow, source.sourceRow], ['sourceKey', existing.sourceKey, source.sourceKey]];
  for (const [field, original, next] of metadata) if (original !== next) metadataChanges.push({ field, original, next, reason: 'Import provenance metadata.' });
  const updateClass = changes.length ? 'MATERIAL_UPDATE' : normalizationChanges.length ? 'NORMALIZATION_ONLY' : metadataChanges.length ? 'IMPORT_METADATA_ONLY' : 'UNCHANGED';
  return { normalizationChanges, metadataChanges, updateClass } as const;
}

function exactCarrierCandidates(source: SourceCarrier, state: ExistingState) {
  const codes = new Set([source.code, ...source.codeAliases].map(normalizeCode));
  return state.carriers.filter((carrier) => codes.has(normalizeCode(carrier.code)) || carrier.sourceKey === source.sourceKey);
}

function fallbackCarrierCandidates(source: SourceCarrier, state: ExistingState) {
  return state.carriers.filter((carrier) => {
    if (carrier.type !== source.type || normalizeText(carrier.city) !== normalizeText(source.city)) return false;
    const addressMatches = [carrier.street, carrier.address, carrier.locality]
      .filter(Boolean).some((value) => [source.street, source.address, source.locality].filter(Boolean).some((candidate) => normalizeText(value) === normalizeText(candidate)));
    const gpsMatches = source.latitude !== undefined && source.longitude !== undefined && carrier.latitude !== null && carrier.longitude !== null
      && Math.abs(carrier.latitude - source.latitude) < 0.00003 && Math.abs(carrier.longitude - source.longitude) < 0.00003;
    return addressMatches || gpsMatches;
  });
}

function matchCarriers(workbook: ParsedWorkbook, state: ExistingState) {
  return workbook.carriers.map((source): CarrierPlanItem => {
    const exact = exactCarrierCandidates(source, state);
    const candidates = exact.length ? exact : fallbackCarrierCandidates(source, state);
    if (candidates.length > 1) return { action: 'AMBIGUOUS_MATCH', source, changes: [], candidateIds: candidates.map(({ id }) => id) };
    const existing = candidates[0];
    if (!existing) return { action: 'NEW', source, changes: [], updateClass: 'MATERIAL_UPDATE', normalizationChanges: [], metadataChanges: [] };
    const changes = carrierChanges(source, existing);
    const classification = carrierClassification(source, existing, changes);
    return { action: changes.length ? 'UPDATE' : 'UNCHANGED', source, existingId: existing.id, changes, ...classification };
  });
}

function matchSurface(source: SourceSurface, carrier: ExistingState['carriers'][number] | undefined) {
  if (!carrier) return undefined;
  const exact = carrier.surfaces.filter((surface) => surface.sourceKey === source.sourceKey);
  if (exact.length === 1) return exact[0];
  const byPosition = carrier.surfaces.filter((surface) => normalizeText(surface.sourcePosition) === normalizeText(source.sourcePosition));
  if (byPosition.length === 1) return byPosition[0];
  const byName = carrier.surfaces.filter((surface) => normalizeText(surface.name) === normalizeText(source.name));
  return byName.length === 1 ? byName[0] : undefined;
}

type CampaignPeriod = SourceCampaign & { dateFrom: string; dateTo: string; rawTexts: string[] };
export function mergeCampaignMonths(campaigns: SourceCampaign[]) {
  const sorted = [...campaigns].sort((left, right) => left.year - right.year || left.month - right.month);
  const periods: CampaignPeriod[] = [];
  for (const campaign of sorted) {
    const bounds = monthBounds(campaign.year, campaign.month);
    const previous = periods.at(-1);
    const same = previous
      && previous.normalizedCampaignName === campaign.normalizedCampaignName
      && previous.clientName === campaign.clientName
      && previous.orderReference === campaign.orderReference
      && previous.status === campaign.status
      && addMonths(previous.dateTo.slice(0, 7) + '-01', 1) === bounds.start;
    if (same && previous) {
      previous.dateTo = bounds.end;
      previous.rawTexts.push(campaign.rawSourceText);
    } else periods.push({ ...campaign, dateFrom: bounds.start, dateTo: bounds.end, rawTexts: [campaign.rawSourceText] });
  }
  return periods;
}

function resolveClient(campaign: SourceCampaign, state: ExistingState) {
  if (campaign.clientName) {
    const matches = state.clients.filter((client) => normalizeText(client.name) === normalizeText(campaign.clientName));
    if (matches.length === 1) return matches[0];
  }
  const occupancies = state.carriers.flatMap((carrier) => carrier.surfaces.flatMap((surface) => surface.occupancies));
  const matching = campaign.orderReference
    ? occupancies.filter((occupancy) => occupancy.externalOrderReference === campaign.orderReference)
    : occupancies.filter((occupancy) => normalizeText(occupancy.campaignName) === normalizeText(campaign.normalizedCampaignName));
  const existingClientIds = new Set(matching
    .filter((occupancy) => occupancy.clientId)
    .map((occupancy) => occupancy.clientId as string));
  if (existingClientIds.size !== 1) return undefined;
  return state.clients.find((client) => existingClientIds.has(client.id));
}

function overlaps(leftFrom: string, leftTo: string, rightFrom: Date, rightTo: Date) {
  const from = new Date(`${leftFrom}T00:00:00.000Z`);
  const to = new Date(`${leftTo}T23:59:59.999Z`);
  return rightFrom <= to && rightTo >= from;
}

function classifyConflict(period: CampaignPeriod, clientId: string | undefined, conflict: ExistingState['carriers'][number]['surfaces'][number]['occupancies'][number]) {
  const sameCampaign = normalizeText(conflict.campaignName) === period.normalizedCampaignName;
  const sameClient = (conflict.clientId ?? undefined) === clientId;
  const exactPeriod = conflict.dateFrom.toISOString().slice(0, 10) === period.dateFrom && conflict.dateTo.toISOString().slice(0, 10) === period.dateTo;
  const origin: 'MANUAL' | 'CARRIERS_2026_IMPORT' | 'OTHER_IMPORT' = conflict.sourceSystem === 'CARRIERS_2026' && conflict.sourceKey ? 'CARRIERS_2026_IMPORT' : conflict.sourceSystem ? 'OTHER_IMPORT' : 'MANUAL';
  const underlying = exactPeriod && sameCampaign && sameClient ? 'EXACT_DUPLICATE' as const
    : sameCampaign && sameClient ? 'SAME_CAMPAIGN_EXTENSION' as const
      : !sameCampaign ? 'SAME_PERIOD_DIFFERENT_CAMPAIGN' as const : 'SAME_PERIOD_DIFFERENT_CLIENT' as const;
  const classification = origin === 'MANUAL' && underlying !== 'EXACT_DUPLICATE' ? 'MANUAL_RECORD_CONFLICT' as const
    : origin === 'CARRIERS_2026_IMPORT' && underlying !== 'EXACT_DUPLICATE' ? 'PREVIOUS_IMPORT_UPDATE' as const : underlying;
  const recordFingerprint = stableHash({ id: conflict.id, campaignName: conflict.campaignName, clientId: conflict.clientId,
    dateFrom: conflict.dateFrom.toISOString(), dateTo: conflict.dateTo.toISOString(), status: conflict.status,
    sourceSystem: conflict.sourceSystem, sourceKey: conflict.sourceKey, updatedAt: conflict.updatedAt?.toISOString() });
  const recommendedAction = classification === 'EXACT_DUPLICATE' ? 'KEEP_EXISTING' as const
    : classification === 'PREVIOUS_IMPORT_UPDATE' && underlying === 'SAME_CAMPAIGN_EXTENSION' ? 'MERGE_OR_EXTEND' as const
      : 'REQUIRES_MANUAL_REVIEW' as const;
  return {
    classification, underlyingClassification: classification === underlying ? undefined : underlying, existingRecordOrigin: origin,
    existingRecordId: conflict.id, existingCampaignName: conflict.campaignName, existingClientId: conflict.clientId,
    existingClientName: conflict.clientName, existingDateFrom: conflict.dateFrom.toISOString().slice(0, 10),
    existingDateTo: conflict.dateTo.toISOString().slice(0, 10), existingStatus: conflict.status,
    existingNote: conflict.note, createdBy: conflict.createdBy, updatedBy: conflict.updatedBy, recordFingerprint, recommendedAction,
  };
}

function buildPrices(workbook: ParsedWorkbook, state: ExistingState, validFrom: string): PricePlanItem[] {
  return workbook.prices.map((source) => {
    const active = state.prices.filter((price) => price.identityKey === source.identityKey && price.isActive && !price.validTo)
      .sort((left, right) => right.validFrom.getTime() - left.validFrom.getTime())[0];
    const versionKey = stableHash([source.identityKey, validFrom, source.rentalPrice, source.productionPrice, source.totalPrice]);
    const componentsMatchTotal = Number(source.rentalPrice) + Number(source.productionPrice) === Number(source.totalPrice);
    if (!active) return { action: 'NEW_PRICE', source, versionKey, componentsMatchTotal };
    const unchanged = active.rentalPrice === source.rentalPrice && active.productionPrice === source.productionPrice && active.totalPrice === source.totalPrice;
    return { action: unchanged ? 'UNCHANGED' : 'CHANGED_PRICE', source, existingId: active.id, versionKey, componentsMatchTotal };
  });
}

export function classifyCampaignPeriod(dateFrom: string, dateTo: string, asOfDate: string): TemporalClassification {
  if (dateTo < asOfDate) return 'HISTORICAL_COMPLETED';
  if (dateFrom <= asOfDate) return 'CURRENT_ACTIVE';
  return 'FUTURE_RESERVED';
}

function gpsDistanceMeters(source: SourceCarrier, existing: ExistingState['carriers'][number] | undefined) {
  if (!existing || source.latitude === undefined || source.longitude === undefined || existing.latitude === null || existing.longitude === null) return undefined;
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(source.latitude - existing.latitude); const dLon = radians(source.longitude - existing.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(existing.latitude)) * Math.cos(radians(source.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createScopePlan(kind: ScopePlan['kind'], workbook: ParsedWorkbook, databaseFingerprint: string, asOfDate: string, scopes: ImportScope[], operations: PlanOperation[]): ScopePlan {
  const base = { planVersion: 1 as const, kind, sourceFileHash: workbook.fileHash, databaseFingerprint, asOfDate, scopes, generatedAt: new Date().toISOString(), operations, operationCount: operations.length };
  return { ...base, planHash: stableHash(base) };
}

export function validateScopePlan(saved: ScopePlan, current: Pick<ImportPlan, 'fileHash' | 'databaseFingerprint' | 'asOfDate'>, expectedScopes: ImportScope[]) {
  const base = { planVersion: saved.planVersion, kind: saved.kind, sourceFileHash: saved.sourceFileHash, databaseFingerprint: saved.databaseFingerprint,
    asOfDate: saved.asOfDate, scopes: saved.scopes, generatedAt: saved.generatedAt, operations: saved.operations, operationCount: saved.operationCount };
  if (saved.kind !== 'SAFE' || stableHash(base) !== saved.planHash) throw new Error('Plan was modified or is not a SAFE plan.');
  if (saved.sourceFileHash !== current.fileHash) throw new Error('XLSX hash does not match the verified plan.');
  if (saved.databaseFingerprint !== current.databaseFingerprint) throw new Error('Database snapshot changed after plan creation.');
  if (saved.asOfDate !== current.asOfDate) throw new Error('asOfDate does not match the verified plan.');
  if ([...saved.scopes].sort().join(',') !== [...expectedScopes].sort().join(',')) throw new Error('Scope does not match the verified plan.');
  if (saved.operations.some(({ kind }) => /CONFLICT|AMBIGUOUS|DEPENDENCY/.test(kind))) throw new Error('SAFE plan contains a blocked operation.');
  return saved;
}

export function buildImportPlan(
  workbook: ParsedWorkbook,
  state: ExistingState,
  databaseEnvironment: ImportPlan['databaseEnvironment'],
  validFrom = '2026-01-01',
  options: { asOfDate?: string; scopes?: ImportScope[] } = {},
): ImportPlan {
  const asOfDate = options.asOfDate ?? new Date().toISOString().slice(0, 10);
  const selectedScopes = options.scopes?.length ? [...new Set(options.scopes)] : ['inventory', 'pricing', 'occupancy'] as ImportScope[];
  const carriers = matchCarriers(workbook, state);
  const surfaces: ImportPlan['surfaces'] = [];
  const occupancies: ImportPlan['occupancies'] = [];
  const issues = [...workbook.issues];
  const matchedClients = new Map<string, { id: string; name: string }>();
  const historicalSkipped: HistoricalSkippedItem[] = [];
  let historicalConflictSkipped = 0;

  for (const carrierPlan of carriers) {
    if (carrierPlan.action === 'AMBIGUOUS_MATCH') {
      const candidates = state.carriers.filter((carrier) => carrierPlan.candidateIds?.includes(carrier.id));
      issues.push({ code: 'AMBIGUOUS_MATCH', sheetName: carrierPlan.source.sourceSheet, sourceRow: carrierPlan.source.sourceRow, message: 'Nosič má více možných databázových shod.', candidates: candidates.map(({ id, code, name }) => ({ id, code, name })) });
      continue;
    }
    const existingCarrier = state.carriers.find(({ id }) => id === carrierPlan.existingId);
    for (const sourceSurface of carrierPlan.source.surfaces) {
      const existingSurface = matchSurface(sourceSurface, existingCarrier);
      surfaces.push({ action: existingSurface ? 'UNCHANGED' : 'NEW', carrierSourceKey: carrierPlan.source.sourceKey, source: sourceSurface, existingId: existingSurface?.id,
        reason: existingSurface ? 'EXACT_SOURCE_KEY_POSITION_OR_NAME' : existingCarrier ? 'NO_MATCHING_SURFACE_ON_EXISTING_CARRIER' : 'NEW_CARRIER_REQUIRES_SURFACE',
        similarExisting: existingCarrier?.surfaces.map(({ id, name, sourcePosition }) => ({ id, name, sourcePosition })) ?? [] });
      for (const period of mergeCampaignMonths(sourceSurface.campaigns)) {
        const temporalClassification = classifyCampaignPeriod(period.dateFrom, period.dateTo, asOfDate);
        if (temporalClassification === 'HISTORICAL_COMPLETED') {
          if ((existingSurface?.occupancies ?? []).some((occupancy) => overlaps(period.dateFrom, period.dateTo, occupancy.dateFrom, occupancy.dateTo))) historicalConflictSkipped += 1;
          historicalSkipped.push({ carrierCode: carrierPlan.source.code, carrierName: carrierPlan.source.name, surfaceLabel: sourceSurface.name,
            campaignName: period.campaignName, dateFrom: period.dateFrom, dateTo: period.dateTo, sourceSheet: carrierPlan.source.sourceSheet,
            sourceRow: sourceSurface.sourceRow ?? carrierPlan.source.sourceRow, sourceColumn: period.sourceColumn, reason: 'HISTORICAL_COMPLETED',
            operationId: stableHash([workbook.fileHash, 'HISTORICAL_COMPLETED', sourceSurface.sourceKey, period.normalizedCampaignName, period.dateFrom, period.dateTo]).slice(0, 24) });
          continue;
        }
        period.status = temporalClassification === 'CURRENT_ACTIVE' ? 'OCCUPIED' : 'RESERVED';
        const client = resolveClient(period, state);
        if (client) matchedClients.set(client.id, { id: client.id, name: client.name });
        const sourceKey = `CARRIERS2026:OCCUPANCY:${stableHash([sourceSurface.sourceKey, period.normalizedCampaignName, client?.id ?? 'UNRESOLVED', period.orderReference ?? '', period.dateFrom, period.dateTo])}`;
        const existingOccupancies = existingSurface?.occupancies ?? [];
        const identical = existingOccupancies.find((occupancy) =>
          normalizeText(occupancy.campaignName) === normalizeText(period.normalizedCampaignName)
          && occupancy.dateFrom.toISOString().slice(0, 10) === period.dateFrom
          && occupancy.dateTo.toISOString().slice(0, 10) === period.dateTo
          && (occupancy.clientId ?? undefined) === client?.id);
        const conflict = existingOccupancies.find((occupancy) => overlaps(period.dateFrom, period.dateTo, occupancy.dateFrom, occupancy.dateTo));
        const action = identical ? 'UNCHANGED' : conflict ? 'OCCUPANCY_CONFLICT' : 'NEW_OCCUPANCY';
        const conflictDetail = conflict && !identical ? classifyConflict(period, client?.id, conflict) : undefined;
        const resolutionIssueId = conflictDetail ? stableHash([workbook.fileHash, 'OCCUPANCY_CONFLICT', sourceSurface.sourceKey, period.dateFrom, period.dateTo, conflictDetail.recordFingerprint]).slice(0, 24) : undefined;
        occupancies.push({
          action, carrierSourceKey: carrierPlan.source.sourceKey, surfaceSourceKey: sourceSurface.sourceKey, sourceKey,
          campaignName: period.campaignName, clientId: client?.id, clientName: client?.name,
          dateFrom: period.dateFrom, dateTo: period.dateTo, status: period.status,
          rawSourceText: [...new Set(period.rawTexts)].join(' | '), sourceSheet: carrierPlan.source.sourceSheet,
          sourceRow: carrierPlan.source.sourceRow, orderReference: period.orderReference,
          conflictId: conflict?.id, existingId: identical?.id,
          conflict: conflictDetail, resolutionIssueId,
          sourceColumn: period.sourceColumn, temporalClassification, clientResolutionStatus: client ? 'RESOLVED' : 'UNRESOLVED',
          statusDerivation: 'EXCEL_PLANNING_CALENDAR', operationId: stableHash([workbook.fileHash, 'occupancy', sourceKey]).slice(0, 24),
        });
        if (!client) issues.push({ code: 'CAMPAIGN_WITHOUT_RESOLVED_CLIENT', sheetName: carrierPlan.source.sourceSheet, sourceRow: carrierPlan.source.sourceRow, message: `Kampaň „${period.campaignName}“ nemá bezpečně určeného klienta.`, rawValue: period.rawSourceText });
        if (conflict && !identical) issues.push({ code: 'OCCUPANCY_CONFLICT', sheetName: carrierPlan.source.sourceSheet, sourceRow: carrierPlan.source.sourceRow, message: `Kampaň „${period.campaignName}“ se překrývá s existující obsazeností ${conflict.id}.` });
      }
    }
  }

  const importedTypes = new Set(workbook.carriers.map(({ type }) => type));
  const matchedIds = new Set(carriers.map(({ existingId }) => existingId).filter(Boolean));
  const missingInNewSource = state.carriers.filter((carrier) => importedTypes.has(carrier.type as SourceCarrier['type']) && !matchedIds.has(carrier.id))
    .map(({ id, code, name }) => ({ id, code, name }));
  missingInNewSource.forEach((carrier) => issues.push({ code: 'MISSING_IN_NEW_SOURCE', message: `Existující nosič ${carrier.code} není v novém zdroji.` }));
  const prices = buildPrices(workbook, state, validFrom);
  const dbFingerprint = databaseFingerprint(state);
  const resolutionRows: ResolutionRow[] = [];
  const ambiguousIssues = workbook.issues.filter(({ code }) => code === 'AMBIGUOUS_CAMPAIGN_DATA');
  const issueMonth = (issue: typeof ambiguousIssues[number]) => Number((issue.rawValue as { month?: unknown } | undefined)?.month);
  const monthEnd = (month: number) => monthBounds(2026, month).end;
  const historicalAmbiguous = ambiguousIssues.filter((issue) => Number.isInteger(issueMonth(issue)) && monthEnd(issueMonth(issue)) < asOfDate);
  for (const issue of ambiguousIssues.filter((issue) => !historicalAmbiguous.includes(issue))) {
    const issueId = stableHash([workbook.fileHash, issue.code, issue.sheetName, issue.sourceRow, issue.sourceColumn, issue.carrierCode, issue.surfaceLabel, issue.rawValue]).slice(0, 24);
    const raw = issue.rawValue as { values?: string[] } | undefined;
    resolutionRows.push({ issueId, issueType: issue.code, carrierCode: issue.carrierCode ?? '', carrierName: issue.carrierName ?? '', sourceSheet: issue.sheetName ?? '',
      sourceRow: String(issue.sourceRow ?? ''), sourceColumn: String(issue.sourceColumn ?? ''), surfaceLabel: issue.surfaceLabel ?? '',
      importedCampaignName: JSON.stringify(issue.rawValue ?? ''), importedClientName: '', importedDateFrom: '', importedDateTo: '',
      existingRecordId: '', existingCampaignName: '', existingClientName: '', existingDateFrom: '', existingDateTo: '', existingStatus: '', existingNote: '', createdBy: '', updatedBy: '',
      recommendedAction: 'LEAVE_PENDING', selectedAction: 'LEAVE_PENDING', decisionNote: '', sourceFileHash: workbook.fileHash,
      databaseFingerprint: dbFingerprint, recordFingerprint: stableHash(issue.rawValue ?? ''), slot1Campaign: raw?.values?.[0] ?? '', slot1StartDate: '', slot1EndDate: '',
      slot2Campaign: raw?.values?.[1] ?? '', slot2StartDate: '', slot2EndDate: '', manualStartDate: '', manualEndDate: '' });
  }
  for (const item of occupancies.filter(({ conflict }) => conflict)) {
    const carrier = workbook.carriers.find(({ sourceKey }) => sourceKey === item.carrierSourceKey);
    const conflict = item.conflict!;
    resolutionRows.push({ issueId: item.resolutionIssueId!, issueType: conflict.classification, carrierCode: carrier?.code ?? '', carrierName: carrier?.name ?? '',
      sourceSheet: item.sourceSheet, sourceRow: String(item.sourceRow), sourceColumn: '', surfaceLabel: item.surfaceSourceKey,
      importedCampaignName: item.campaignName, importedClientName: item.clientName ?? '', importedDateFrom: item.dateFrom, importedDateTo: item.dateTo,
      existingRecordId: conflict.existingRecordId, existingCampaignName: conflict.existingCampaignName, existingClientName: conflict.existingClientName,
      existingDateFrom: conflict.existingDateFrom, existingDateTo: conflict.existingDateTo, existingStatus: conflict.existingStatus,
      existingNote: conflict.existingNote ?? '', createdBy: conflict.createdBy ?? '', updatedBy: conflict.updatedBy ?? '', recommendedAction: conflict.recommendedAction,
      selectedAction: 'MANUAL_REVIEW_REQUIRED', decisionNote: '', sourceFileHash: workbook.fileHash, databaseFingerprint: dbFingerprint, recordFingerprint: conflict.recordFingerprint,
      manualStartDate: '', manualEndDate: '' });
  }
  const ambiguousCp = ambiguousIssues.filter(({ sheetName }) => sheetName === 'CP26').length;
  const historicalAmbiguousCp = historicalAmbiguous.filter(({ sheetName }) => sheetName === 'CP26').length;
  const unresolvedAmbiguousCp = ambiguousCp - historicalAmbiguousCp;
  const rawCampaignCells = workbook.carriers.flatMap(({ surfaces }) => surfaces).reduce((sum, surface) => sum + surface.campaigns.length, 0) + ambiguousCp * 2;
  const totalCandidatePeriods = occupancies.length + historicalSkipped.length;
  const largeGpsCarrierIds = new Set<string>();
  const gpsReview = carriers.flatMap((item) => {
    const existing = state.carriers.find(({ id }) => id === item.existingId); const distance = gpsDistanceMeters(item.source, existing);
    if (distance !== undefined) item.gpsDistanceMeters = distance;
    if (distance !== undefined && distance > 500) { largeGpsCarrierIds.add(item.source.sourceKey); item.gpsReview = 'LARGE_GPS_CHANGE'; }
    return distance !== undefined ? [{ item, distance, review: distance > 500 }] : [];
  });
  const safeOperations: PlanOperation[] = [];
  const blockedOperations: PlanOperation[] = [];
  const operation = (scope: ImportScope, kind: string, recordKey: string, payload: unknown, recordFingerprint?: string): PlanOperation => ({
    operationId: stableHash([workbook.fileHash, scope, kind, recordKey, payload]).slice(0, 24), scope, kind, recordKey, payload, recordFingerprint,
  });
  if (selectedScopes.includes('inventory')) {
    for (const item of carriers.filter(({ action }) => action === 'NEW' || action === 'UPDATE')) {
      const op = operation('inventory', item.action === 'NEW' ? 'CREATE_CARRIER' : 'UPDATE_CARRIER', item.source.sourceKey, item, item.existingId ? stableHash(state.carriers.find(({ id }) => id === item.existingId)) : undefined);
      (largeGpsCarrierIds.has(item.source.sourceKey) || item.action === 'AMBIGUOUS_MATCH' ? blockedOperations : safeOperations).push(op);
    }
    for (const item of surfaces.filter(({ action }) => action === 'NEW')) {
      const op = operation('inventory', 'CREATE_SURFACE', item.source.sourceKey, item);
      (largeGpsCarrierIds.has(item.carrierSourceKey) ? blockedOperations : safeOperations).push(op);
    }
  }
  if (selectedScopes.includes('pricing')) for (const item of prices.filter(({ action }) => action !== 'UNCHANGED')) {
    const op = operation('pricing', item.action, item.source.identityKey, item, item.existingId ? stableHash(state.prices.find(({ id }) => id === item.existingId)) : undefined);
    (item.componentsMatchTotal ? safeOperations : blockedOperations).push(op);
  }
  if (selectedScopes.includes('occupancy')) {
    for (const item of occupancies) {
      const surfaceReady = Boolean(surfaces.find(({ source }) => source.sourceKey === item.surfaceSourceKey)?.existingId);
      if (item.action === 'NEW_OCCUPANCY') (surfaceReady ? safeOperations : blockedOperations).push(operation('occupancy', surfaceReady ? (item.status === 'OCCUPIED' ? 'CREATE_ACTIVE_OCCUPANCY' : 'CREATE_FUTURE_RESERVATION') : 'INVENTORY_DEPENDENCY', item.sourceKey, item));
      else if (item.action === 'OCCUPANCY_CONFLICT') blockedOperations.push(operation('occupancy', 'MANUAL_OCCUPANCY_CONFLICT', item.sourceKey, item, item.conflict?.recordFingerprint));
    }
    for (const row of resolutionRows.filter(({ issueType }) => issueType === 'AMBIGUOUS_CAMPAIGN_DATA')) blockedOperations.push(operation('occupancy', 'AMBIGUOUS_CP26_SLOTS', row.issueId, row, row.recordFingerprint));
  }
  const groupMap = new Map<string, { items: typeof occupancies; carriers: Set<string>; mediaTypes: Set<string> }>();
  for (const item of occupancies.filter(({ action, clientId }) => action === 'NEW_OCCUPANCY' && !clientId)) {
    const sourceCarrier = workbook.carriers.find(({ sourceKey }) => sourceKey === item.carrierSourceKey);
    const sourceSurface = sourceCarrier?.surfaces.find(({ sourceKey }) => sourceKey === item.surfaceSourceKey);
    const groupKey = stableHash([normalizeText(item.campaignName), item.orderReference ?? '', item.sourceSheet, sourceSurface?.mediaType ?? '', item.dateFrom, item.dateTo]);
    const group = groupMap.get(groupKey) ?? { items: [], carriers: new Set<string>(), mediaTypes: new Set<string>() };
    group.items.push(item); group.carriers.add(item.carrierSourceKey); if (sourceSurface) group.mediaTypes.add(sourceSurface.mediaType); groupMap.set(groupKey, group);
  }
  const campaignClientGroups: CampaignClientGroup[] = [...groupMap.entries()].map(([campaignGroupId, group]) => ({
    campaignGroupId, normalizedCampaignName: normalizeText(group.items[0].campaignName), originalCampaignExamples: [...new Set(group.items.map(({ campaignName }) => campaignName))].slice(0, 5),
    orderReference: group.items[0].orderReference ?? '', mediaTypes: [...group.mediaTypes], firstDate: group.items.reduce((min, item) => item.dateFrom < min ? item.dateFrom : min, group.items[0].dateFrom),
    lastDate: group.items.reduce((max, item) => item.dateTo > max ? item.dateTo : max, group.items[0].dateTo), occurrenceCount: group.items.length,
    carrierCount: group.carriers.size, suggestedClientId: '', suggestedClientName: '', suggestionConfidence: 'NONE', selectedClientId: '', selectedClientName: '', action: 'REQUIRES_REVIEW', note: '',
  }));
  const photos = state.photos ?? [];
  const photoAudit = { beforeCount: photos.length, afterPlannedCount: photos.length, beforeIdsHash: stableHash(photos.map(({ id }) => id).sort()),
    beforeLinksHash: stableHash(photos.map(({ id, carrierId, surfaceId }) => ({ id, carrierId, surfaceId })).sort((a, b) => a.id.localeCompare(b.id))),
    primaryPhotoCount: photos.filter(({ type }) => type === 'CARRIER').length, operations: 0 as const };
  const safePlan = createScopePlan('SAFE', workbook, dbFingerprint, asOfDate, selectedScopes, safeOperations);
  const blockedPlan = createScopePlan('BLOCKED', workbook, dbFingerprint, asOfDate, selectedScopes, blockedOperations);
  const stats = {
    sheets: workbook.sheetNames.length, processedSheets: workbook.processedSheets.length, processedRows: workbook.processedRows,
    newCarriers: carriers.filter(({ action }) => action === 'NEW').length,
    updatedCarriers: carriers.filter(({ action }) => action === 'UPDATE').length,
    materialUpdates: carriers.filter((item) => item.updateClass === 'MATERIAL_UPDATE' && Boolean(item.existingId)).length,
    normalizationOnlyUpdates: carriers.filter(({ updateClass }) => updateClass === 'NORMALIZATION_ONLY').length,
    importMetadataOnlyUpdates: carriers.filter(({ updateClass }) => updateClass === 'IMPORT_METADATA_ONLY').length,
    unchangedCarriers: carriers.filter(({ action }) => action === 'UNCHANGED').length,
    ambiguousMatches: carriers.filter(({ action }) => action === 'AMBIGUOUS_MATCH').length,
    ambiguousCampaignData: issues.filter(({ code }) => code === 'AMBIGUOUS_CAMPAIGN_DATA').length,
    newSurfaces: surfaces.filter(({ action }) => action === 'NEW').length,
    safeNewCarriers: safeOperations.filter(({ kind }) => kind === 'CREATE_CARRIER').length,
    safeUpdatedCarriers: safeOperations.filter(({ kind }) => kind === 'UPDATE_CARRIER').length,
    gpsChangesRequiringReview: gpsReview.filter(({ review }) => review).length,
    safeNewSurfaces: safeOperations.filter(({ kind }) => kind === 'CREATE_SURFACE').length,
    rawCampaignCells,
    mergedCampaignCells: rawCampaignCells - totalCandidatePeriods - ambiguousCp * 2,
    cpOriginalAmbiguousPairs: ambiguousCp,
    cpRecognizedAsSeparateSurfaces: 0,
    cpHistoricalPairs: historicalAmbiguousCp,
    cpUnresolvedTemporalPairs: unresolvedAmbiguousCp,
    campaigns: totalCandidatePeriods,
    historicalCompleted: historicalSkipped.length,
    currentActive: occupancies.filter(({ temporalClassification }) => temporalClassification === 'CURRENT_ACTIVE').length,
    futureReserved: occupancies.filter(({ temporalClassification }) => temporalClassification === 'FUTURE_RESERVED').length,
    currentWithClient: occupancies.filter(({ temporalClassification, clientId }) => temporalClassification === 'CURRENT_ACTIVE' && clientId).length,
    currentWithoutClient: occupancies.filter(({ temporalClassification, clientId }) => temporalClassification === 'CURRENT_ACTIVE' && !clientId).length,
    futureWithClient: occupancies.filter(({ temporalClassification, clientId }) => temporalClassification === 'FUTURE_RESERVED' && clientId).length,
    futureWithoutClient: occupancies.filter(({ temporalClassification, clientId }) => temporalClassification === 'FUTURE_RESERVED' && !clientId).length,
    uniqueCampaignNames: new Set(occupancies.map(({ campaignName }) => normalizeText(campaignName))).size,
    campaignsWithClient: occupancies.filter(({ clientId }) => clientId).length,
    campaignsWithoutClient: occupancies.filter(({ clientId }) => !clientId).length,
    campaignsWithOrderReference: occupancies.filter(({ orderReference }) => orderReference).length,
    newOccupancies: occupancies.filter(({ action }) => action === 'NEW_OCCUPANCY' || action === 'CAMPAIGN_WITHOUT_RESOLVED_CLIENT').length,
    unchangedOccupancies: occupancies.filter(({ action }) => action === 'UNCHANGED').length,
    occupancyConflicts: occupancies.filter(({ action }) => action === 'OCCUPANCY_CONFLICT').length,
    exactDuplicates: occupancies.filter(({ action }) => action === 'UNCHANGED').length,
    manualRecordConflicts: occupancies.filter(({ conflict }) => conflict?.classification === 'MANUAL_RECORD_CONFLICT').length,
    previousImportUpdates: occupancies.filter(({ conflict }) => conflict?.classification === 'PREVIOUS_IMPORT_UPDATE').length,
    historicalConflictSkipped,
    safeOccupancyOperations: safeOperations.filter(({ scope }) => scope === 'occupancy').length,
    blockedOccupancyOperations: blockedOperations.filter(({ scope }) => scope === 'occupancy').length,
    unresolvedCampaignGroups: campaignClientGroups.length,
    createdClients: 0, matchedClients: matchedClients.size,
    newPrices: prices.filter(({ action }) => action === 'NEW_PRICE').length,
    changedPrices: prices.filter(({ action }) => action === 'CHANGED_PRICE').length,
    unchangedPrices: prices.filter(({ action }) => action === 'UNCHANGED').length,
    invalidPriceTotals: prices.filter(({ componentsMatchTotal }) => !componentsMatchTotal).length,
    safePrices: safeOperations.filter(({ scope }) => scope === 'pricing').length,
    photoOperations: 0,
    missingInNewSource: missingInNewSource.length, issues: issues.length,
  };
  const safetyReasons: string[] = [];
  if (safeOperations.some(({ kind }) => kind.includes('CONFLICT') || kind.includes('AMBIGUOUS'))) safetyReasons.push('Safe plan contains a blocked operation.');
  if (selectedScopes.includes('pricing') && safeOperations.some(({ scope, payload }) => scope === 'pricing' && (payload as PricePlanItem).componentsMatchTotal === false)) safetyReasons.push('Safe pricing plan contains an invalid total.');
  const workbookSummary = {
    fileName: workbook.fileName,
    fileHash: workbook.fileHash,
    sheetNames: workbook.sheetNames,
    processedSheets: workbook.processedSheets,
    auxiliarySheets: workbook.auxiliarySheets,
    processedRows: workbook.processedRows,
    issues: workbook.issues,
  };
  return {
    fileHash: workbook.fileHash, generatedAt: new Date().toISOString(), databaseEnvironment, databaseFingerprint: dbFingerprint, asOfDate, selectedScopes,
    workbook: workbookSummary,
    carriers, surfaces, occupancies, clients: { create: [], matched: [...matchedClients.values()] }, prices,
    missingInNewSource, issues, stats, resolution: { rows: resolutionRows, supplied: false, invalid: [], stale: false },
    safetyGate: { blocked: safetyReasons.length > 0, reasons: safetyReasons },
    safePlan, blockedPlan, historicalSkipped, campaignClientGroups, photoAudit,
  };
}
