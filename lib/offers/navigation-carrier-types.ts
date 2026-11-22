/**
 * Navigation Carrier Types and Color Classification System
 * Defines standard carrier categories (VO Navigation, Towers, A-boards, Citylights, Billboards, etc.)
 * and provides color mapping for interactive maps and offer editors.
 */

export type NavigationCarrierCategory =
  | 'NAVIGATION' // Směrová tabule (sloup VO)
  | 'TOWER' // Tower / Pylon / Reklamní věž
  | 'A_BOARD' // Áčko / Reklamní stojan
  | 'CITYLIGHT' // Citylight (CLV)
  | 'BILLBOARD' // Billboard / Bigboard
  | 'BANNER' // Plachta / Banner / Fasáda
  | 'OTHER'; // Jiný nosič

export interface CarrierTypeDefinition {
  id: NavigationCarrierCategory;
  label: string;
  shortLabel: string;
  defaultName: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: string;
  description: string;
}

export const NAVIGATION_CARRIER_TYPES: CarrierTypeDefinition[] = [
  {
    id: 'NAVIGATION',
    label: 'Směrová tabule (VO)',
    shortLabel: 'Směrovka',
    defaultName: 'Směrová tabule',
    color: '#0284c7', // Sky Blue
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-900',
    badgeBorder: 'border-sky-200',
    icon: '🧭',
    description: 'Směrová navigační tabule na sloupu VO',
  },
  {
    id: 'TOWER',
    label: 'Tower / Pylon / Věž',
    shortLabel: 'Tower',
    defaultName: 'Reklamní věž (Tower)',
    color: '#7c3aed', // Purple / Violet
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-900',
    badgeBorder: 'border-purple-200',
    icon: '🗼',
    description: 'Samostatně stojící reklamní věž nebo pylon',
  },
  {
    id: 'A_BOARD',
    label: 'Áčko / Reklamní stojan',
    shortLabel: 'Áčko',
    defaultName: 'Reklamní stojan (Áčko)',
    color: '#ea580c', // Orange
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-900',
    badgeBorder: 'border-orange-200',
    icon: '🪧',
    description: 'Přenosný reklamní stojan / A-stojan u provozovny',
  },
  {
    id: 'CITYLIGHT',
    label: 'Citylight (CLV)',
    shortLabel: 'Citylight',
    defaultName: 'Citylight vitrína',
    color: '#059669', // Emerald Green
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-200',
    icon: '💡',
    description: 'Prosvětlená městská vitrína (CLV)',
  },
  {
    id: 'BILLBOARD',
    label: 'Billboard / Bigboard',
    shortLabel: 'Billboard',
    defaultName: 'Billboard',
    color: '#e11d48', // Rose / Red
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-900',
    badgeBorder: 'border-rose-200',
    icon: '🖼️',
    description: 'Velkoplošný reklamní panel',
  },
  {
    id: 'BANNER',
    label: 'Plachta / Banner / Fasáda',
    shortLabel: 'Banner',
    defaultName: 'Reklamní plachta / Banner',
    color: '#0891b2', // Cyan / Teal
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-900',
    badgeBorder: 'border-cyan-200',
    icon: '🚩',
    description: 'Fasádní plachta, plotový banner nebo rám',
  },
  {
    id: 'OTHER',
    label: 'Jiný nosič / Vlastní',
    shortLabel: 'Jiný',
    defaultName: 'Doplňkový nosič',
    color: '#64748b', // Slate Gray
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-200',
    icon: '📍',
    description: 'Atypický nebo doplňkový reklamní nosič',
  },
];

// Palette of selectable pin colors in the editor
export const CARRIER_PIN_COLORS: Array<{ value: string; label: string }> = [
  { value: '#0284c7', label: 'Modrá (Navigace)' },
  { value: '#7c3aed', label: 'Fialová (Tower)' },
  { value: '#ea580c', label: 'Oranžová (Áčko)' },
  { value: '#059669', label: 'Zelená (Citylight)' },
  { value: '#e11d48', label: 'Červená (Billboard)' },
  { value: '#0891b2', label: 'Tyrkysová (Banner)' },
  { value: '#db2777', label: 'Růžová' },
  { value: '#d97706', label: 'Jantarová' },
  { value: '#4f46e5', label: 'Indigo' },
  { value: '#15803d', label: 'Tmavě zelená' },
  { value: '#475569', label: 'Břidlicová' },
];

/**
 * Detects carrier category from freeform text or carrier type string
 */
export function detectCarrierCategory(typeString?: string | null): CarrierTypeDefinition {
  if (!typeString) return NAVIGATION_CARRIER_TYPES[0]; // default NAVIGATION

  const s = typeString.toLowerCase().trim();

  // 1. Tower / Pylon / Věž
  if (
    s.includes('tower') ||
    s.includes('věž') ||
    s.includes('vez') ||
    s.includes('pylon') ||
    s === 'promo_tower' ||
    s === 'promo_minitower'
  ) {
    return NAVIGATION_CARRIER_TYPES[1]; // TOWER
  }

  // 2. Áčko / Stojan
  if (
    s.includes('áčko') ||
    s.includes('acko') ||
    s.includes('stojan') ||
    s.includes('a-stojan') ||
    s.includes('a-board') ||
    s.includes('poutač')
  ) {
    return NAVIGATION_CARRIER_TYPES[2]; // A_BOARD
  }

  // 3. Citylight
  if (
    s.includes('citylight') ||
    s.includes('clv') ||
    s.includes('city light') ||
    s.includes('vitrín') ||
    s.includes('vitrin') ||
    s === 'city_poster'
  ) {
    return NAVIGATION_CARRIER_TYPES[3]; // CITYLIGHT
  }

  // 4. Billboard
  if (
    s.includes('billboard') ||
    s.includes('bigboard') ||
    s.includes('megaboard') ||
    s === 'billboard' ||
    s === 'bigboard'
  ) {
    return NAVIGATION_CARRIER_TYPES[4]; // BILLBOARD
  }

  // 5. Banner / Plachta
  if (
    s.includes('banner') ||
    s.includes('placht') ||
    s.includes('fasád') ||
    s.includes('fasad') ||
    s === 'facade'
  ) {
    return NAVIGATION_CARRIER_TYPES[5]; // BANNER
  }

  // 6. Navigation / VO default
  if (
    s.includes('směrov') ||
    s.includes('smerov') ||
    s.includes('navigac') ||
    s.includes('sloup') ||
    s.includes('vo') ||
    s === 'navigation'
  ) {
    return NAVIGATION_CARRIER_TYPES[0]; // NAVIGATION
  }

  return NAVIGATION_CARRIER_TYPES[6]; // OTHER
}

/**
 * Resolves the pin color for a point.
 * Prioritizes explicit custom color, otherwise derives from carrier type / navigationType.
 */
export function getPointPinColor(point: {
  color?: string | null;
  navigationType?: string | null;
  carrierType?: string | null;
}): string {
  if (point.color && /^#[0-9a-fA-F]{3,8}$/.test(point.color)) {
    return point.color;
  }
  const category = detectCarrierCategory(point.navigationType || point.carrierType);
  return category.color;
}

/**
 * Returns complete visual metadata (color, icon, badge styling, label) for a point.
 */
export function getPointPinVisual(point: {
  color?: string | null;
  navigationType?: string | null;
  carrierType?: string | null;
}): {
  color: string;
  category: CarrierTypeDefinition;
  label: string;
  icon: string;
} {
  const category = detectCarrierCategory(point.navigationType || point.carrierType);
  const color = point.color && /^#[0-9a-fA-F]{3,8}$/.test(point.color) ? point.color : category.color;
  const label = point.navigationType || category.label;

  return {
    color,
    category,
    label,
    icon: category.icon,
  };
}

export type NavigationAudience = 'INTERNAL' | 'CLIENT';

export type NavigationSignTheme = 'dark' | 'blue' | 'green' | 'yellow' | 'red';

export type NavigationVisualizationConfig = {
  signX: number;
  signY: number;
  signXRatio?: number;
  signYRatio?: number;
  signScale: number;
  signRotation: number;
  mountType: 'pole' | 'ground_pole';
  mountSide: 'right' | 'left';
  mirrorGraphic: boolean;
  theme: NavigationSignTheme;
  signText?: string;
  subText?: string;
  canvasWidth?: number;
  canvasHeight?: number;
};

const VALID_THEMES = new Set<NavigationSignTheme>(['dark', 'blue', 'green', 'yellow', 'red']);

export function parseNavigationVisualizationConfig(raw: unknown): NavigationVisualizationConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const signX = Number(rec.signX);
  const signY = Number(rec.signY);
  const signScale = Number(rec.signScale);
  const signRotation = Number(rec.signRotation ?? 0);
  if (!Number.isFinite(signX) || !Number.isFinite(signY) || !Number.isFinite(signScale) || signScale <= 0) {
    return null;
  }

  const canvasWidth = Number(rec.canvasWidth);
  const canvasHeight = Number(rec.canvasHeight);
  const signXRatio = Number(rec.signXRatio);
  const signYRatio = Number(rec.signYRatio);

  const clampedScale = Math.max(0.2, Math.min(4, Math.round(signScale * 1000) / 1000));
  const clampedRotation = Math.max(-180, Math.min(180, Math.round((Number.isFinite(signRotation) ? signRotation : 0) * 10) / 10));
  const theme = typeof rec.theme === 'string' && VALID_THEMES.has(rec.theme as NavigationSignTheme)
    ? (rec.theme as NavigationSignTheme)
    : 'dark';

  const config: NavigationVisualizationConfig = {
    signX: Math.round(signX * 10) / 10,
    signY: Math.round(signY * 10) / 10,
    signScale: clampedScale,
    signRotation: clampedRotation,
    mountType: rec.mountType === 'ground_pole' ? 'ground_pole' : 'pole',
    mountSide: rec.mountSide === 'left' ? 'left' : 'right',
    mirrorGraphic: Boolean(rec.mirrorGraphic),
    theme,
  };

  if (Number.isFinite(signXRatio) && signXRatio >= 0 && signXRatio <= 1) {
    config.signXRatio = Math.round(signXRatio * 10000) / 10000;
  }
  if (Number.isFinite(signYRatio) && signYRatio >= 0 && signYRatio <= 1) {
    config.signYRatio = Math.round(signYRatio * 10000) / 10000;
  }
  if (Number.isFinite(canvasWidth) && canvasWidth > 0) {
    config.canvasWidth = Math.round(canvasWidth);
  }
  if (Number.isFinite(canvasHeight) && canvasHeight > 0) {
    config.canvasHeight = Math.round(canvasHeight);
  }
  if (typeof rec.signText === 'string' && rec.signText.trim()) {
    config.signText = rec.signText.trim().slice(0, 120);
  }
  if (typeof rec.subText === 'string') {
    config.subText = rec.subText.trim().slice(0, 120);
  }

  return config;
}

/**
 * Resolves any navigation arrow enum or legacy text into a unified Czech lowercase direction label.
 */
export function formatNavigationDirectionLabel(rawDir?: string | null): string {
  const value = (rawDir || '').trim();
  switch (value) {
    case 'RIGHT':
    case 'Doprava':
    case 'vpravo':
    case 'doprava':
      return 'vpravo';
    case 'LEFT':
    case 'Doleva':
    case 'vlevo':
    case 'doleva':
      return 'vlevo';
    case 'SLANTED_RIGHT':
    case 'SLIGHT_RIGHT':
    case 'Šikmo vpravo':
      return 'šikmo vpravo';
    case 'SLANTED_LEFT':
    case 'SLIGHT_LEFT':
    case 'Šikmo vlevo':
      return 'šikmo vlevo';
    case 'STRAIGHT_LEFT':
      return 'rovně a vlevo';
    case 'STRAIGHT_RIGHT':
      return 'rovně a vpravo';
    case 'LEFT_STRAIGHT':
      return 'vlevo a rovně';
    case 'RIGHT_STRAIGHT':
      return 'vpravo a rovně';
    case 'LEFT_RIGHT':
      return 'vlevo i vpravo';
    case 'U_TURN':
      return 'otočení';
    case 'ROUNDABOUT_1':
      return 'kruhový obj. (1. výjezd)';
    case 'ROUNDABOUT_2':
      return 'kruhový obj. (2. výjezd)';
    case 'ROUNDABOUT_3':
      return 'kruhový obj. (3. výjezd)';
    case 'ROUNDABOUT_4':
      return 'kruhový obj. (4. výjezd)';
    case 'ROUNDABOUT_5':
      return 'kruhový obj. (5. výjezd)';
    case 'ROUNDABOUT':
      return 'kruhový objezd';
    case 'TWO_WAY':
      return 'obousměrně';
    case 'STRAIGHT':
    case 'Rovně':
    case 'rovně':
      return 'rovně';
    default:
      if (value && !['NONE', 'UNKNOWN'].includes(value)) {
        return value.toLowerCase();
      }
      return 'rovně';
  }
}

export function arrowCharToDirectionEnum(arrowChar: string): string {
  switch (arrowChar.trim()) {
    case '⬅': return 'LEFT';
    case '➔': return 'RIGHT';
    case '↖': return 'SLANTED_LEFT';
    case '↗': return 'SLANTED_RIGHT';
    case '⬆⬅': return 'STRAIGHT_LEFT';
    case '⬆➔': return 'STRAIGHT_RIGHT';
    case '⬅⬆': return 'LEFT_STRAIGHT';
    case '➔⬆': return 'RIGHT_STRAIGHT';
    case '⬅➔': return 'LEFT_RIGHT';
    case '↩': return 'U_TURN';
    case '↔': return 'TWO_WAY';
    case '🔄 1.': return 'ROUNDABOUT_1';
    case '🔄 2.': return 'ROUNDABOUT_2';
    case '🔄 3.': return 'ROUNDABOUT_3';
    case '🔄 4.': return 'ROUNDABOUT_4';
    case '🔄 5.': return 'ROUNDABOUT_5';
    case '🔄': return 'ROUNDABOUT';
    case '⬆':
    default:
      return 'STRAIGHT';
  }
}

export function formatCalculatedDistanceForInput(calculatedMeters?: number | null): {
  value: string;
  unit: 'METERS' | 'KILOMETERS';
} | null {
  if (typeof calculatedMeters !== 'number' || !Number.isFinite(calculatedMeters) || calculatedMeters <= 0) {
    return null;
  }
  const rounded = Math.max(50, Math.round(calculatedMeters / 50) * 50);
  if (rounded >= 1000) {
    return {
      value: (rounded / 1000).toFixed(1).replace('.', ','),
      unit: 'KILOMETERS',
    };
  }
  return {
    value: String(rounded),
    unit: 'METERS',
  };
}

export function parseDistanceTextToManual(text?: string | null): {
  value: string;
  unit: 'METERS' | 'KILOMETERS';
} | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const match = trimmed.match(/([0-9]+(?:[.,][0-9]+)?)\s*(km|m)?/i);
  if (!match) return null;
  const numeric = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const unitToken = (match[2] || '').toLowerCase();
  const unit: 'METERS' | 'KILOMETERS' = unitToken === 'km' ? 'KILOMETERS' : 'METERS';
  return { value: match[1], unit };
}

export function resolveNavigationDistance(
  point: {
    distanceSource?: string | null;
    manualDistanceValue?: number | string | null;
    manualDistanceUnit?: string | null;
    calculatedDistanceMeters?: number | null;
  },
  options?: { audience?: NavigationAudience }
): {
  isConfirmed: boolean;
  confirmedDistance: string;
  calculatedDistance: string;
  distance: string;
} {
  const audience = options?.audience ?? 'INTERNAL';

  const rawManual =
    point.manualDistanceValue !== undefined && point.manualDistanceValue !== null
      ? String(point.manualDistanceValue).trim().replace(',', '.')
      : '';
  const hasPositiveManual = rawManual !== '' && Number.isFinite(Number(rawManual)) && Number(rawManual) > 0;
  const isConfirmed = hasPositiveManual && point.distanceSource !== 'CALCULATED';

  let confirmedDistance = '';
  if (isConfirmed) {
    const unit = point.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm';
    confirmedDistance = `${String(point.manualDistanceValue).trim()} ${unit}`;
  }

  let calculatedDistance = '';
  if (typeof point.calculatedDistanceMeters === 'number' && point.calculatedDistanceMeters > 0) {
    const rounded = Math.max(50, Math.round(point.calculatedDistanceMeters / 50) * 50);
    if (rounded >= 1000) {
      calculatedDistance = `${(rounded / 1000).toFixed(1).replace('.', ',')} km`;
    } else {
      calculatedDistance = `${rounded} m`;
    }
  }

  const distance = audience === 'CLIENT'
    ? confirmedDistance
    : (confirmedDistance || calculatedDistance);

  return {
    isConfirmed,
    confirmedDistance,
    calculatedDistance,
    distance,
  };
}

export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Formats a navigation point's unified title according to the standard:
 * P{index + 1} – {street} – {distance} {direction}
 * e.g. "P1 – Orlovská – 500 m rovně"
 *
 * When `options.audience === 'CLIENT'`, only a human-confirmed distance is included;
 * automatic map calculations stay internal.
 */
export function formatNavigationPointDesignation(
  point: {
    label?: string | null;
    address?: string | null;
    pillarNumber?: string | null;
    arrowDirectionEnum?: string | null;
    arrowDirection?: string | null;
    distanceSource?: string | null;
    manualDistanceValue?: number | string | null;
    manualDistanceUnit?: string | null;
    calculatedDistanceMeters?: number | null;
  },
  index: number,
  options?: { audience?: NavigationAudience }
): {
  code: string;
  street: string;
  distance: string;
  direction: string;
  fullTitle: string;
  isDistanceConfirmed: boolean;
  confirmedDistance: string;
  calculatedDistance: string;
} {
  const code = `P${index + 1}`;
  const direction = formatNavigationDirectionLabel(point.arrowDirectionEnum || point.arrowDirection);
  const resolvedDist = resolveNavigationDistance(point, options);

  // Resolve Street / Location cleanly (never freeze stale baked distance/direction from P1 – ... labels)
  let street = '';
  if (point.address && typeof point.address === 'string' && point.address.trim().length > 0) {
    let firstPart = point.address.split(',')[0].trim();
    firstPart = firstPart.replace(/^\[(?:Vnitřní|Vnější)\s+okruh\]\s*(?:Příjezdový\s+bod\s+na\s*)?/gi, '');
    street = firstPart.replace(/^ul(\.|\s+)/i, '').trim();
  } else if (point.label && typeof point.label === 'string') {
    const cleanedLabel = point.label
      .replace(/^\[(?:Vnitřní|Vnější)\s+okruh\]\s*(?:Příjezdový\s+bod\s+na\s*)?/gi, '')
      .trim();
    const bakedMatch = cleanedLabel.match(/^P\d+\s*[-–]\s*([^–-]+)(?:\s*[-–].*)?$/i);
    if (bakedMatch?.[1]) {
      street = bakedMatch[1].replace(/^ul(\.|\s+)/i, '').trim();
    } else if (
      !/^navigační bod/i.test(cleanedLabel) &&
      !/^bod \d+/i.test(cleanedLabel) &&
      !/^sloup vo/i.test(cleanedLabel)
    ) {
      street = cleanedLabel;
    }
  }

  if (!street) {
    street = point.pillarNumber ? `Sloup VO ${point.pillarNumber}` : `Pozice ${index + 1}`;
  }

  // Assemble standard unified title: P1 – Orlovská – 500 m rovně (or P1 – Orlovská – rovně if unconfirmed for client)
  const parts: string[] = [code];
  if (street) parts.push(street);
  const distDir = [resolvedDist.distance, direction].filter(Boolean).join(' ');
  if (distDir) parts.push(distDir);

  return {
    code,
    street,
    distance: resolvedDist.distance,
    direction,
    fullTitle: parts.join(' – '),
    isDistanceConfirmed: resolvedDist.isConfirmed,
    confirmedDistance: resolvedDist.confirmedDistance,
    calculatedDistance: resolvedDist.calculatedDistance,
  };
}

