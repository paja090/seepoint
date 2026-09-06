export type SheetClassificationType =
  | 'CARRIERS'
  | 'SURFACES'
  | 'CLIENTS'
  | 'OCCUPANCY'
  | 'CAMPAIGNS'
  | 'PRICES'
  | 'NAVIGATION'
  | 'UNKNOWN';

export type TransformRule =
  | 'NONE'
  | 'TRIM'
  | 'UPPERCASE'
  | 'LOWERCASE'
  | 'COORDINATES_SPLIT'
  | 'BOOLEAN_CZECH'
  | 'CURRENCY_CZK'
  | 'DATE_ISO';

export type ColumnMappingProposal = {
  sourceColumn: string;
  targetField: string;
  confidence: number; // 0.0 to 1.0
  sampleValues: string[];
  transformation?: TransformRule;
  reasoning?: string;
  isCustom?: boolean;
};

export type SheetAnalysisSummary = {
  sheetIndex: number;
  name: string;
  classification: SheetClassificationType;
  confidence: number;
  totalRows: number;
  totalColumns: number;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  columnMappings: ColumnMappingProposal[];
  status: 'PENDING' | 'MAPPED' | 'SKIPPED' | 'PROCESSED';
};

export type RowAction =
  | 'CREATE'
  | 'UPDATE'
  | 'UNCHANGED'
  | 'SKIP'
  | 'CONFLICT'
  | 'NEEDS_REVIEW'
  | 'ERROR';

export type ConflictResolutionChoice = 'KEEP_DATABASE' | 'USE_IMPORT' | 'SKIP';

export type FieldDiff = {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  isCritical?: boolean;
};

export type RowIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
};

export type DryRunRowResult = {
  rowNumber: number;
  sheetName: string;
  action: RowAction;
  targetEntity: 'CARRIER' | 'SURFACE' | 'CLIENT' | 'OCCUPANCY' | 'PRICE';
  targetEntityId?: string;
  targetIdentifier?: string; // e.g. "PL-123" or "McDonald's ČR"
  diff?: FieldDiff[];
  conflictDetails?: {
    field: string;
    message: string;
    dbValue: unknown;
    importValue: unknown;
  };
  resolution?: ConflictResolutionChoice;
  issues: RowIssue[];
  rawData: Record<string, string>;
  mappedData?: Record<string, unknown>;
};

export type DryRunStats = {
  totalRows: number;
  createCount: number;
  updateCount: number;
  unchangedCount: number;
  skipCount: number;
  conflictCount: number;
  needsReviewCount: number;
  errorCount: number;
  entityStats: {
    carriers: { create: number; update: number; unchanged: number };
    surfaces: { create: number; update: number; unchanged: number };
    clients: { create: number; update: number; unchanged: number };
    occupancies: { create: number; update: number; unchanged: number };
    prices: { create: number; update: number; unchanged: number };
  };
};

export type ImportBatchDetail = {
  id: string;
  fileName: string;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  fileHash?: string | null;
  status: string;
  totalRows: number;
  validRows: number;
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  createdAt: string;
  updatedAt: string;
  sheets: SheetAnalysisSummary[];
  dryRunStats?: DryRunStats | null;
  profileId?: string | null;
  profileName?: string | null;
};

export const TARGET_FIELDS_BY_ENTITY: Record<
  string,
  Array<{ field: string; label: string; description: string; required?: boolean }>
> = {
  CARRIERS: [
    { field: 'carrierCode', label: 'Kód nosiče', description: 'Unikátní označení nosiče (např. BB-01, OC-123)', required: true },
    { field: 'name', label: 'Název / Umístění', description: 'Popisný název nosiče' },
    { field: 'type', label: 'Typ nosiče', description: 'Billboard, Bigboard, Citylight, Promo lavička, LED...' },
    { field: 'city', label: 'Město / Obec', description: 'Název města', required: true },
    { field: 'street', label: 'Ulice', description: 'Název ulice' },
    { field: 'address', label: 'Celá adresa', description: 'Ulice a číslo popisné' },
    { field: 'locality', label: 'Lokalita / Čtvrť', description: 'Městská část nebo katastr' },
    { field: 'latitude', label: 'Zeměpisná šířka (Latitude)', description: 'GPS šířka (např. 49.8355)' },
    { field: 'longitude', label: 'Zeměpisná délka (Longitude)', description: 'GPS délka (např. 18.2923)' },
    { field: 'gpsCoordinates', label: 'Kombinované GPS', description: 'Společná buňka se souřadnicemi např. "49.83, 18.29"' },
    { field: 'mountingType', label: 'Konstrukce / Sloup', description: 'Typ uchycení (sloup VO, samostatná konstrukce...)' },
    { field: 'photoUrl', label: 'Odkaz na fotografii', description: 'URL nebo název souboru fotodokumentace' },
    { field: 'status', label: 'Stav nosiče', description: 'Aktivní, Neaktivní, Servis' },
    { field: 'note', label: 'Poznámka', description: 'Interní poznámka k nosiči' },
  ],
  SURFACES: [
    { field: 'carrierCode', label: 'Kód nosiče', description: 'Vazba na nadřazený nosič', required: true },
    { field: 'surfaceName', label: 'Název plochy / Strana', description: 'Např. Strana A, Směr centrum, Celý nosič', required: true },
    { field: 'mediaType', label: 'Typ média / Formát', description: 'Typ reklamní plochy' },
    { field: 'sidePosition', label: 'Pozice / Strana', description: 'A, B, 1, 2' },
    { field: 'size', label: 'Rozměry', description: 'Šířka × výška (např. 5,1 × 2,4 m)' },
    { field: 'price', label: 'Cena nájmu', description: 'Měsíční cena za plochu' },
    { field: 'status', label: 'Dostupnost plochy', description: 'Volná, Obsazená, Rezervovaná' },
    { field: 'note', label: 'Poznámka k ploše', description: 'Doplňující informace' },
  ],
  CLIENTS: [
    { field: 'name', label: 'Název firmy / Klient', description: 'Obchodní jméno klienta', required: true },
    { field: 'companyId', label: 'IČO', description: 'Identifikační číslo (8 číslic)' },
    { field: 'dic', label: 'DIČ', description: 'Daňové identifikační číslo' },
    { field: 'billingCity', label: 'Sídlo / Město', description: 'Fakturační město' },
    { field: 'billingStreet', label: 'Fakturační ulice', description: 'Fakturační ulice a číslo' },
    { field: 'contactPerson', label: 'Kontaktní osoba', description: 'Jméno a příjmení kontaktu' },
    { field: 'email', label: 'E-mail', description: 'Kontaktní e-mail' },
    { field: 'phone', label: 'Telefon', description: 'Telefonní číslo' },
  ],
  OCCUPANCY: [
    { field: 'carrierCode', label: 'Kód nosiče / Plochy', description: 'Identifikátor obsazené plochy', required: true },
    { field: 'clientName', label: 'Název klienta', description: 'Inzerující firma' },
    { field: 'campaignName', label: 'Název kampaně / Motiv', description: 'Obsah či téma kampaně' },
    { field: 'dateFrom', label: 'Platnost od', description: 'Datum začátku kampaně', required: true },
    { field: 'dateTo', label: 'Platnost do', description: 'Datum konce kampaně', required: true },
    { field: 'monthSlot', label: 'Měsíc obsazenosti', description: 'Měsíční sloupec např. Leden, Únor...' },
    { field: 'price', label: 'Cena kampaně', description: 'Dohodnutá cena' },
    { field: 'status', label: 'Stav rezervace', description: 'Potvrzeno, Rezervace, Opce' },
    { field: 'note', label: 'Poznámka', description: 'Poznámka k objednávce' },
  ],
  PRICES: [
    { field: 'name', label: 'Název položky ceníku', description: 'Označení reklamního balíčku nebo formátu', required: true },
    { field: 'carrierType', label: 'Typ nosiče', description: 'Kategorie nosiče' },
    { field: 'mediaType', label: 'Typ média', description: 'Kategorie plochy' },
    { field: 'rentalPrice', label: 'Cena nájmu', description: 'Měsíční nájemné bez DPH', required: true },
    { field: 'productionPrice', label: 'Cena výroby / instalace', description: 'Jednorázový poplatek za instalaci či tisk' },
    { field: 'validFrom', label: 'Platnost od', description: 'Začátek platnosti ceny' },
    { field: 'validTo', label: 'Platnost do', description: 'Konec platnosti ceny' },
  ],
  NAVIGATION: [
    { field: 'carrierCode', label: 'Číslo nosiče / Pozice', description: 'Identifikátor navigačního bodu', required: true },
    { field: 'structureCode', label: 'Číslo stožáru / sloupu', description: 'Evidenční číslo sloupu VO' },
    { field: 'street', label: 'Ulice', description: 'Ulice umístění' },
    { field: 'directionDescription', label: 'Směr / Popis navigace', description: 'Směr jízdy nebo cíl šipky' },
    { field: 'clientName', label: 'Konečný zákazník', description: 'Inzerent na šipce' },
    { field: 'dateFrom', label: 'Podnájem od', description: 'Začátek platnosti' },
    { field: 'dateTo', label: 'Podnájem do', description: 'Konec platnosti' },
    { field: 'latitude', label: 'Zeměpisná šířka', description: 'GPS šířka' },
    { field: 'longitude', label: 'Zeměpisná délka', description: 'GPS délka' },
    { field: 'photoUrl', label: 'Fotografie', description: 'Odkaz na fotodokumentaci' },
  ],
};
