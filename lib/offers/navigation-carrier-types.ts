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

/**
 * Formats a navigation point's primary title according to the standard:
 * P{index + 1} – {street} – {distance} {direction}
 * e.g. "P1 – Orlovská – 500 m rovně"
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
  index: number
): {
  code: string;
  street: string;
  distance: string;
  direction: string;
  fullTitle: string;
} {
  const code = `P${index + 1}`;

  // 1. Resolve Direction in Czech lowercase
  const rawDir = point.arrowDirectionEnum || point.arrowDirection || '';
  let direction = '';
  switch (rawDir) {
    case 'RIGHT':
    case 'Doprava':
    case 'vpravo':
    case 'doprava':
      direction = 'vpravo';
      break;
    case 'LEFT':
    case 'Doleva':
    case 'vlevo':
    case 'doleva':
      direction = 'vlevo';
      break;
    case 'SLANTED_RIGHT':
    case 'SLIGHT_RIGHT':
    case 'Šikmo vpravo':
      direction = 'šikmo vpravo';
      break;
    case 'SLANTED_LEFT':
    case 'SLIGHT_LEFT':
    case 'Šikmo vlevo':
      direction = 'šikmo vlevo';
      break;
    case 'U_TURN':
      direction = 'otočení';
      break;
    case 'ROUNDABOUT_1':
      direction = 'kruhový obj. (1. výjezd)';
      break;
    case 'ROUNDABOUT_2':
      direction = 'kruhový obj. (2. výjezd)';
      break;
    case 'ROUNDABOUT_3':
      direction = 'kruhový obj. (3. výjezd)';
      break;
    case 'ROUNDABOUT_4':
      direction = 'kruhový obj. (4. výjezd)';
      break;
    case 'ROUNDABOUT_5':
      direction = 'kruhový obj. (5. výjezd)';
      break;
    case 'ROUNDABOUT':
      direction = 'kruhový objezd';
      break;
    case 'TWO_WAY':
      direction = 'obousměrně';
      break;
    case 'STRAIGHT':
    case 'Rovně':
    case 'rovně':
      direction = 'rovně';
      break;
    default:
      if (rawDir && !['NONE', 'UNKNOWN'].includes(rawDir)) {
        direction = rawDir.toLowerCase();
      } else {
        direction = 'rovně';
      }
      break;
  }

  // 2. Resolve Distance
  let distance = '';
  const rawManual =
    point.manualDistanceValue !== undefined && point.manualDistanceValue !== null
      ? String(point.manualDistanceValue).trim().replace(',', '.')
      : '';
  if (
    (point.distanceSource === 'MANUAL' || rawManual !== '') &&
    rawManual !== '' &&
    Number(rawManual) > 0
  ) {
    const unit = point.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm';
    distance = `${point.manualDistanceValue} ${unit}`;
  } else if (
    typeof point.calculatedDistanceMeters === 'number' &&
    point.calculatedDistanceMeters > 0
  ) {
    const rounded = Math.max(50, Math.round(point.calculatedDistanceMeters / 50) * 50);
    if (rounded >= 1000) {
      distance = `${(rounded / 1000).toFixed(1).replace('.', ',')} km`;
    } else {
      distance = `${rounded} m`;
    }
  }

  // 3. Resolve Street / Location
  let street = '';
  if (point.label && /^P\d+\s*[-–]/i.test(point.label)) {
    return {
      code,
      street: point.address || '',
      distance,
      direction,
      fullTitle: point.label,
    };
  }

  if (point.address && typeof point.address === 'string' && point.address.trim().length > 0) {
    const firstPart = point.address.split(',')[0].trim();
    street = firstPart.replace(/^ul(\.|\s+)/i, '');
  } else if (
    point.label &&
    typeof point.label === 'string' &&
    !/^navigační bod/i.test(point.label) &&
    !/^bod \d+/i.test(point.label) &&
    !/^sloup vo/i.test(point.label)
  ) {
    street = point.label.trim();
  }

  if (!street) {
    street = point.pillarNumber ? `Sloup VO ${point.pillarNumber}` : `Pozice ${index + 1}`;
  }

  // 4. Assemble standard title: P1 – Orlovská – 500 m rovně
  const parts: string[] = [code];
  if (street) parts.push(street);
  const distDir = [distance, direction].filter(Boolean).join(' ');
  if (distDir) parts.push(distDir);

  return {
    code,
    street,
    distance,
    direction,
    fullTitle: parts.join(' – '),
  };
}

