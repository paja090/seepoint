export const MOBILE_PHOTO_DAMAGE_TYPES = [
  { value: 'OVERGROWN', label: 'Zarostlá – nutný prořez' },
  { value: 'TURNED', label: 'Vytočená / posunutá konstrukce' },
  { value: 'BENT_FRAME', label: 'Křivý / ohnutý rám' },
  { value: 'BROKEN_CONCRETE', label: 'Rozbitý beton / patka' },
  { value: 'DAMAGED_BACKREST', label: 'Poškozené opěradlo' },
  { value: 'GRAFFITI', label: 'Poničená sprejem / graffiti' },
  { value: 'FADED', label: 'Vybledlý nebo poničený tisk' },
  { value: 'DAMAGED_STRUCTURE', label: 'Poškozená konstrukce' },
  { value: 'BROKEN_GLASS', label: 'Rozbité sklo / kryt' },
  { value: 'LOOSE_MOUNTING', label: 'Uvolněné uchycení' },
  { value: 'MISSING_SIGN', label: 'Chybějící cedule / plocha' },
  { value: 'LIGHTING_OFF', label: 'Nefunkční osvětlení' },
  { value: 'OTHER', label: 'Jiná závada' },
] as const;

export type MobilePhotoDamageType = typeof MOBILE_PHOTO_DAMAGE_TYPES[number]['value'];

export const MOBILE_PHOTO_DAMAGE_LABELS: Record<MobilePhotoDamageType, string> = Object.fromEntries(
  MOBILE_PHOTO_DAMAGE_TYPES.map((item) => [item.value, item.label]),
) as Record<MobilePhotoDamageType, string>;

export function isMobilePhotoDamageType(value: string): value is MobilePhotoDamageType {
  return Object.prototype.hasOwnProperty.call(MOBILE_PHOTO_DAMAGE_LABELS, value);
}
