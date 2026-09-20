export type WorkCategory = {
  key: string;
  label: string;
  scope: 'WORKSHOP' | 'FIELD';
  icon: string;
  defaultWorkType: 'INSTALLATION' | 'TRANSPORT' | 'REPAIR' | 'CHECK' | 'OTHER';
  defaultPriceType?: 'HOURLY' | 'FIXED' | 'PIECE_RATE';
  defaultRate?: number;
  description?: string;
};

export type WorkCategoryPreset = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  categories: WorkCategory[];
};

export const WORK_CATEGORY_PRESETS: Record<string, WorkCategoryPreset> = {
  AGENCY: {
    key: 'AGENCY',
    title: 'Reklamní agentura & Signmaking',
    subtitle: 'Kompletní výroba reklamy, velkoformát, polepy i montáže v terénu',
    icon: '🏢',
    categories: [
      { key: 'PRINT', label: 'Velkoformátový tisk & Laminace', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '🖨️', defaultPriceType: 'HOURLY' },
      { key: 'DTP', label: 'Grafika & DTP příprava dat', scope: 'WORKSHOP', defaultWorkType: 'OTHER', icon: '🎨', defaultPriceType: 'HOURLY' },
      { key: 'MANUFACTURE', label: 'Dílna & Kašírování desek / výroba', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '🔨', defaultPriceType: 'PIECE_RATE' },
      { key: 'PACKAGING', label: 'Expedice & Balení zakázek', scope: 'WORKSHOP', defaultWorkType: 'TRANSPORT', icon: '📦', defaultPriceType: 'HOURLY' },
      { key: 'FIELD_WRAPPING', label: 'Polep výlohy / polep vozidla', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '🚗', defaultPriceType: 'FIXED' },
      { key: 'FIELD_INSTALL', label: 'Montáž reklamy / banneru na fasádu', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '🪧', defaultPriceType: 'HOURLY' },
      { key: 'FIELD_SURVEY', label: 'Předvýrobní zaměření na místě', scope: 'FIELD', defaultWorkType: 'CHECK', icon: '📐', defaultPriceType: 'FIXED' },
      { key: 'FIELD_SERVICE', label: 'Servis / Demontáž reklamy', scope: 'FIELD', defaultWorkType: 'REPAIR', icon: '🔧', defaultPriceType: 'HOURLY' },
      { key: 'INTERNAL', label: 'Interní provoz & Údržba strojů', scope: 'WORKSHOP', defaultWorkType: 'OTHER', icon: '⚙️', defaultPriceType: 'HOURLY' },
    ],
  },
  WRAP_STUDIO: {
    key: 'WRAP_STUDIO',
    title: 'Polepové & Wrap studio',
    subtitle: 'Specializace na celopolepy aut, PPF ochranné fólie a tónování autoskel',
    icon: '🚗',
    categories: [
      { key: 'CAR_FULL_WRAP', label: 'Celopolep vozidla (Car Wrap)', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '🚗', defaultPriceType: 'FIXED' },
      { key: 'PPF_PROTECTION', label: 'Aplikace ochranné PPF fólie laku', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '🛡️', defaultPriceType: 'FIXED' },
      { key: 'WINDOW_TINTING', label: 'Tónování autoskel s atestem', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '🕶️', defaultPriceType: 'FIXED' },
      { key: 'PLOTTER_GRAPHICS', label: 'Řezaná firemní grafika & plotr', scope: 'WORKSHOP', defaultWorkType: 'OTHER', icon: '✂️', defaultPriceType: 'HOURLY' },
      { key: 'DECHROMING', label: 'Dechroming lišt & Detailing doplňky', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '✨', defaultPriceType: 'FIXED' },
      { key: 'SHOP_WRAPPING', label: 'Polep výlohy / provozovny u klienta', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '🏪', defaultPriceType: 'FIXED' },
      { key: 'VEHICLE_SURVEY', label: 'Zaměření vozu a příprava šablony', scope: 'FIELD', defaultWorkType: 'CHECK', icon: '📐', defaultPriceType: 'FIXED' },
      { key: 'DEWRAP', label: 'Odstranění starého polepu & lepidla', scope: 'WORKSHOP', defaultWorkType: 'REPAIR', icon: '🧼', defaultPriceType: 'HOURLY' },
    ],
  },
  OOH_MEDIA: {
    key: 'OOH_MEDIA',
    title: 'OOH & Billboardová společnost',
    subtitle: 'Výlepy kampaní, noční kontroly, osvětlení a technická správa ploch',
    icon: '🪧',
    categories: [
      { key: 'BILLBOARD_POSTING', label: 'Výlep papírového billboardu (Euroformát)', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '📋', defaultPriceType: 'PIECE_RATE' },
      { key: 'BIGBOARD_BANNER', label: 'Montáž bigboardového banneru', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '🪧', defaultPriceType: 'FIXED' },
      { key: 'NIGHT_CHECK', label: 'Noční kontrola osvětlení & fotoreport', scope: 'FIELD', defaultWorkType: 'CHECK', icon: '💡', defaultPriceType: 'HOURLY' },
      { key: 'FRAME_REPAIR', label: 'Oprava rámu, osvětlení & technická revize', scope: 'FIELD', defaultWorkType: 'REPAIR', icon: '🔧', defaultPriceType: 'HOURLY' },
      { key: 'STRUCTURE_DEMOUNT', label: 'Demontáž nosiče / uvedení do původního stavu', scope: 'FIELD', defaultWorkType: 'REPAIR', icon: '🏗️', defaultPriceType: 'FIXED' },
      { key: 'POSTER_SORTING', label: 'Třídění a vlhčení výlepových archů na dílně', scope: 'WORKSHOP', defaultWorkType: 'OTHER', icon: '📦', defaultPriceType: 'HOURLY' },
    ],
  },
  EXPO_EVENTS: {
    key: 'EXPO_EVENTS',
    title: 'Výstavnictví & Eventové montáže',
    subtitle: 'Stavba veletržních expozic, koberce, elektro a mobiliář',
    icon: '🎪',
    categories: [
      { key: 'EXPO_BUILD', label: 'Montáž veletržního stánku na výstavišti', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '🎪', defaultPriceType: 'HOURLY' },
      { key: 'CARPET_INSTALL', label: 'Pokládka koberců a pódiových podlah', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '🟧', defaultPriceType: 'FIXED' },
      { key: 'ELECTRO_SETUP', label: 'Elektroinstalace stánku & zapojení světel', scope: 'FIELD', defaultWorkType: 'INSTALLATION', icon: '🔌', defaultPriceType: 'HOURLY' },
      { key: 'CARPENTRY_WORK', label: 'Truhlářská výroba expo dílců na dílně', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '🪵', defaultPriceType: 'HOURLY' },
      { key: 'EXPO_GRAPHICS', label: 'Tisk a laminace panelů expozice', scope: 'WORKSHOP', defaultWorkType: 'OTHER', icon: '🎨', defaultPriceType: 'PIECE_RATE' },
      { key: 'EXPO_DEMOUNT', label: 'Demontáž expozice & balení do přepravních boxů', scope: 'FIELD', defaultWorkType: 'TRANSPORT', icon: '📦', defaultPriceType: 'HOURLY' },
      { key: 'EXPO_LOGISTICS', label: 'Transport dodávkou / kamionem na výstaviště', scope: 'FIELD', defaultWorkType: 'TRANSPORT', icon: '🚚', defaultPriceType: 'HOURLY' },
    ],
  },
  PRINT_SHOP: {
    key: 'PRINT_SHOP',
    title: 'Komerční tiskárna & Dokončování',
    subtitle: 'Čistá tisková a knihařská výroba s expedicí zásilek',
    icon: '🖨️',
    categories: [
      { key: 'UV_PRINT', label: 'Přímý UV tisk na deskové materiály', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '🖨️', defaultPriceType: 'PIECE_RATE' },
      { key: 'ROLL_PRINT', label: 'Role-to-roll tisk (Bannery, fólie, plátna)', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '📜', defaultPriceType: 'HOURLY' },
      { key: 'COLD_LAM', label: 'Laminace za studena / tekutá laminace', scope: 'WORKSHOP', defaultWorkType: 'OTHER', icon: '🛡️', defaultPriceType: 'HOURLY' },
      { key: 'CNC_MILLING', label: 'CNC frézování a tvarový ořez desek', scope: 'WORKSHOP', defaultWorkType: 'INSTALLATION', icon: '⚙️', defaultPriceType: 'HOURLY' },
      { key: 'BANNER_EYELETS', label: 'Sváření hran a očkování bannerů', scope: 'WORKSHOP', defaultWorkType: 'OTHER', icon: '🔘', defaultPriceType: 'PIECE_RATE' },
      { key: 'DIGITAL_SMALL', label: 'Maloformátový digitální tisk (letáky, brožury)', scope: 'WORKSHOP', defaultWorkType: 'OTHER', icon: '📄', defaultPriceType: 'PIECE_RATE' },
      { key: 'DISPATCH', label: 'Balení, štítkování a expedice dopravci', scope: 'WORKSHOP', defaultWorkType: 'TRANSPORT', icon: '📦', defaultPriceType: 'HOURLY' },
    ],
  },
};

export const DEFAULT_WORK_CATEGORIES = WORK_CATEGORY_PRESETS.AGENCY.categories;

function sanitizeKey(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 40);
  return cleaned || `CAT_${Date.now().toString(36).toUpperCase()}`;
}

export function sanitizeWorkCategories(raw: unknown): WorkCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_WORK_CATEGORIES;
  }

  const validTypes = new Set(['INSTALLATION', 'TRANSPORT', 'REPAIR', 'CHECK', 'OTHER']);
  const validScopes = new Set(['WORKSHOP', 'FIELD']);
  const validPriceTypes = new Set(['HOURLY', 'FIXED', 'PIECE_RATE']);

  const seenKeys = new Set<string>();
  const sanitized: WorkCategory[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    const rawLabel = typeof obj.label === 'string' ? obj.label.trim() : '';
    if (!rawLabel) continue;

    let key = typeof obj.key === 'string' ? sanitizeKey(obj.key) : sanitizeKey(rawLabel);
    if (seenKeys.has(key)) {
      key = `${key}_${sanitized.length + 1}`;
    }
    seenKeys.add(key);

    const scope = validScopes.has(String(obj.scope)) ? (obj.scope as 'WORKSHOP' | 'FIELD') : 'WORKSHOP';
    const defaultWorkType = validTypes.has(String(obj.defaultWorkType))
      ? (obj.defaultWorkType as WorkCategory['defaultWorkType'])
      : 'INSTALLATION';
    const icon = typeof obj.icon === 'string' && obj.icon.trim() ? obj.icon.trim().slice(0, 10) : '⚡';

    const defaultPriceType = validPriceTypes.has(String(obj.defaultPriceType))
      ? (obj.defaultPriceType as WorkCategory['defaultPriceType'])
      : undefined;

    const defaultRate = typeof obj.defaultRate === 'number' && Number.isFinite(obj.defaultRate) && obj.defaultRate >= 0
      ? obj.defaultRate
      : undefined;

    const description = typeof obj.description === 'string' ? obj.description.trim().slice(0, 300) : undefined;

    sanitized.push({
      key,
      label: rawLabel.slice(0, 120),
      scope,
      icon,
      defaultWorkType,
      defaultPriceType,
      defaultRate,
      description,
    });
  }

  return sanitized.length > 0 ? sanitized : DEFAULT_WORK_CATEGORIES;
}


