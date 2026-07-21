export type CarrierTypeValue = 'PROMO_BENCH' | 'PROMO_HORIZON' | 'CITY_POSTER' | 'PROMO_TOWER' | 'CITYLIGHT';
export type MediaTypeValue = CarrierTypeValue;
export type ImportScope = 'inventory' | 'pricing' | 'occupancy';
export type TemporalClassification = 'HISTORICAL_COMPLETED' | 'CURRENT_ACTIVE' | 'FUTURE_RESERVED';

export type ImportIssueCode =
  | 'INVALID_ROW'
  | 'MISSING_REQUIRED_DATA'
  | 'AMBIGUOUS_MATCH'
  | 'AMBIGUOUS_CAMPAIGN_DATA'
  | 'CAMPAIGN_WITHOUT_RESOLVED_CLIENT'
  | 'OCCUPANCY_CONFLICT'
  | 'MISSING_IN_NEW_SOURCE';

export type ImportIssue = {
  code: ImportIssueCode;
  message: string;
  sheetName?: string;
  sourceRow?: number;
  sourceColumn?: number;
  carrierCode?: string;
  carrierName?: string;
  surfaceLabel?: string;
  field?: string;
  rawValue?: unknown;
  candidates?: Array<{ id: string; code: string; name: string }>;
};

export type SourceCampaign = {
  year: number;
  month: number;
  campaignName: string;
  normalizedCampaignName: string;
  rawSourceText: string;
  clientName?: string;
  clientResolution: 'UNRESOLVED' | 'EXPLICIT_COLUMN' | 'ORDER_REFERENCE' | 'EXISTING_MAPPING';
  orderReference?: string;
  brandName?: string;
  status: 'RESERVED' | 'OCCUPIED';
  sourceColumn: number;
};

export type SourceSurface = {
  sourceKey: string;
  sourcePosition: string;
  name: string;
  mediaType: MediaTypeValue;
  orientation?: string;
  sourceRow?: number;
  campaigns: SourceCampaign[];
};

export type SourceCarrier = {
  sourceKey: string;
  code: string;
  codeAliases: string[];
  name: string;
  type: CarrierTypeValue;
  city: string;
  locality?: string;
  street?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rawMediaType?: string;
  photoUrl?: string;
  note?: string;
  sourceSheet: string;
  sourceRow: number;
  surfaces: SourceSurface[];
};

export type SourcePrice = {
  identityKey: string;
  name: string;
  carrierType?: CarrierTypeValue;
  mediaType?: MediaTypeValue;
  rentalMonths: number;
  minQuantity: number;
  rentalPrice: string;
  productionPrice: string;
  totalPrice: string;
  currency: 'CZK';
  sourceSheet: string;
  sourceRow: number;
};

export type ParsedWorkbook = {
  fileName: string;
  fileHash: string;
  sheetNames: string[];
  processedSheets: string[];
  auxiliarySheets: string[];
  processedRows: number;
  carriers: SourceCarrier[];
  prices: SourcePrice[];
  issues: ImportIssue[];
};

export type ExistingState = {
  photos?: Array<{ id: string; carrierId: string | null; surfaceId: string | null; type: string }>;
  carriers: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    city: string;
    locality: string | null;
    street: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    sourceKey: string | null;
    sourceSystem: string | null;
    sourceSheet: string | null;
    sourceRow: number | null;
    photoCount: number;
    photos?: Array<{ id: string; carrierId: string | null; surfaceId: string | null; type: string }>;
    surfaces: Array<{
      id: string;
      name: string;
      mediaType: string;
      sourcePosition: string | null;
      orientation: string | null;
      sourceKey: string | null;
      occupancies: Array<{
        id: string;
        clientId: string | null;
        clientName: string;
        campaignName: string;
        dateFrom: Date;
        dateTo: Date;
        status: string;
        sourceSystem?: string | null;
        sourceKey?: string | null;
        externalOrderReference?: string | null;
        note?: string | null;
        createdBy?: string | null;
        updatedBy?: string | null;
        createdAt?: Date;
        updatedAt?: Date;
      }>;
    }>;
  }>;
  clients: Array<{ id: string; name: string; normalizedName: string; companyId: string | null; externalCode: string | null }>;
  prices: Array<{
    id: string;
    identityKey: string;
    versionKey: string;
    rentalPrice: string;
    productionPrice: string;
    totalPrice: string;
    validFrom: Date;
    validTo: Date | null;
    isActive: boolean;
  }>;
};

export type FieldChange = { field: string; original: unknown; next: unknown; reason: string };
export type CarrierUpdateClass = 'MATERIAL_UPDATE' | 'NORMALIZATION_ONLY' | 'IMPORT_METADATA_ONLY' | 'UNCHANGED';
export type CarrierPlanItem = {
  action: 'NEW' | 'UPDATE' | 'UNCHANGED' | 'AMBIGUOUS_MATCH';
  source: SourceCarrier;
  existingId?: string;
  changes: FieldChange[];
  updateClass?: CarrierUpdateClass;
  normalizationChanges?: FieldChange[];
  metadataChanges?: FieldChange[];
  gpsDistanceMeters?: number;
  gpsReview?: 'LARGE_GPS_CHANGE';
  candidateIds?: string[];
};
export type SurfacePlanItem = {
  action: 'NEW' | 'UNCHANGED';
  carrierSourceKey: string;
  source: SourceSurface;
  existingId?: string;
  reason?: string;
  similarExisting?: Array<{ id: string; name: string; sourcePosition: string | null }>;
};
export type ConflictClassification = 'EXACT_DUPLICATE' | 'SAME_CAMPAIGN_EXTENSION' | 'SAME_PERIOD_DIFFERENT_CAMPAIGN' | 'SAME_PERIOD_DIFFERENT_CLIENT' | 'MANUAL_RECORD_CONFLICT' | 'PREVIOUS_IMPORT_UPDATE' | 'DIFFERENT_SURFACE_NOT_CONFLICT';
export type ConflictDetail = {
  classification: ConflictClassification;
  underlyingClassification?: Exclude<ConflictClassification, 'MANUAL_RECORD_CONFLICT'>;
  existingRecordOrigin: 'MANUAL' | 'CARRIERS_2026_IMPORT' | 'OTHER_IMPORT';
  existingRecordId: string;
  existingCampaignName: string;
  existingClientId: string | null;
  existingClientName: string;
  existingDateFrom: string;
  existingDateTo: string;
  existingStatus: string;
  existingNote?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  recordFingerprint: string;
  recommendedAction: ResolutionAction;
};
export type OccupancyPlanItem = {
  action: 'NEW_OCCUPANCY' | 'EXTEND_OCCUPANCY' | 'UNCHANGED' | 'OCCUPANCY_CONFLICT' | 'CAMPAIGN_WITHOUT_RESOLVED_CLIENT';
  carrierSourceKey: string;
  surfaceSourceKey: string;
  sourceKey: string;
  campaignName: string;
  clientId?: string;
  clientName?: string;
  dateFrom: string;
  dateTo: string;
  status: 'RESERVED' | 'OCCUPIED';
  rawSourceText: string;
  sourceSheet: string;
  sourceRow: number;
  orderReference?: string;
  conflictId?: string;
  existingId?: string;
  conflict?: ConflictDetail;
  resolutionIssueId?: string;
  sourceColumn?: number;
  temporalClassification?: TemporalClassification;
  clientResolutionStatus?: 'RESOLVED' | 'UNRESOLVED';
  statusDerivation?: 'EXCEL_PLANNING_CALENDAR';
  operationId?: string;
};
export type PricePlanItem = {
  action: 'NEW_PRICE' | 'CHANGED_PRICE' | 'UNCHANGED';
  source: SourcePrice;
  existingId?: string;
  versionKey: string;
  componentsMatchTotal?: boolean;
};

export type ResolutionAction = 'KEEP_EXISTING' | 'USE_IMPORT' | 'MERGE_OR_EXTEND' | 'CREATE_SEPARATE_SURFACE' | 'CREATE_SEPARATE_OCCUPANCY' | 'SKIP' | 'REQUIRES_MANUAL_REVIEW'
  | 'SET_MANUAL_DATE_RANGES' | 'USE_FIRST_SLOT_ONLY' | 'USE_SECOND_SLOT_ONLY' | 'SKIP_BOTH' | 'LEAVE_PENDING'
  | 'KEEP_EXISTING_AND_SKIP_IMPORT' | 'KEEP_EXISTING_AND_SAVE_PENDING' | 'IMPORT_NON_OVERLAPPING_PART' | 'MANUAL_REVIEW_REQUIRED';
export type ResolutionRow = {
  issueId: string; issueType: string; carrierCode: string; carrierName: string; sourceSheet: string;
  sourceRow: string; sourceColumn: string; surfaceLabel: string; importedCampaignName: string;
  importedClientName: string; importedDateFrom: string; importedDateTo: string; existingRecordId: string;
  existingCampaignName: string; existingClientName: string; existingDateFrom: string; existingDateTo: string;
  existingStatus: string; existingNote: string; createdBy: string; updatedBy: string; recommendedAction: ResolutionAction;
  selectedAction: ResolutionAction; decisionNote: string; sourceFileHash: string; databaseFingerprint: string; recordFingerprint: string;
  slot1Campaign?: string; slot1StartDate?: string; slot1EndDate?: string; slot2Campaign?: string; slot2StartDate?: string; slot2EndDate?: string;
  manualStartDate?: string; manualEndDate?: string;
};

export type HistoricalSkippedItem = {
  carrierCode: string; carrierName: string; surfaceLabel: string; campaignName: string;
  dateFrom: string; dateTo: string; sourceSheet: string; sourceRow: number; sourceColumn: number;
  reason: 'HISTORICAL_COMPLETED'; operationId: string;
};
export type PlanOperation = { operationId: string; scope: ImportScope; kind: string; recordKey: string; payload: unknown; recordFingerprint?: string };
export type ScopePlan = {
  planVersion: 1; kind: 'SAFE' | 'BLOCKED'; sourceFileHash: string; databaseFingerprint: string;
  asOfDate: string; scopes: ImportScope[]; generatedAt: string; operations: PlanOperation[];
  operationCount: number; planHash: string;
};
export type CampaignClientGroup = {
  campaignGroupId: string; normalizedCampaignName: string; originalCampaignExamples: string[]; orderReference: string;
  mediaTypes: string[]; firstDate: string; lastDate: string; occurrenceCount: number; carrierCount: number;
  suggestedClientId: string; suggestedClientName: string; suggestionConfidence: 'NONE' | 'EXACT_ORDER' | 'CONFIRMED_MAPPING' | 'EXACT_HISTORY';
  selectedClientId: string; selectedClientName: string; action: 'ASSIGN_CLIENT' | 'LEAVE_UNRESOLVED' | 'SPLIT_GROUP' | 'REQUIRES_REVIEW'; note: string;
};

export type ImportPlan = {
  fileHash: string;
  generatedAt: string;
  databaseEnvironment: 'local' | 'preview' | 'production' | 'unknown';
  databaseFingerprint: string;
  asOfDate: string;
  selectedScopes: ImportScope[];
  workbook: Omit<ParsedWorkbook, 'carriers' | 'prices'>;
  carriers: CarrierPlanItem[];
  surfaces: SurfacePlanItem[];
  occupancies: OccupancyPlanItem[];
  clients: { create: never[]; matched: Array<{ id: string; name: string }> };
  prices: PricePlanItem[];
  missingInNewSource: Array<{ id: string; code: string; name: string }>;
  issues: ImportIssue[];
  stats: Record<string, number>;
  resolution: { rows: ResolutionRow[]; supplied: boolean; invalid: string[]; stale: boolean };
  safetyGate: { blocked: boolean; reasons: string[] };
  safePlan: ScopePlan;
  blockedPlan: ScopePlan;
  historicalSkipped: HistoricalSkippedItem[];
  campaignClientGroups: CampaignClientGroup[];
  photoAudit: { beforeCount: number; afterPlannedCount: number; beforeIdsHash: string; beforeLinksHash: string; primaryPhotoCount: number; operations: 0 };
};
