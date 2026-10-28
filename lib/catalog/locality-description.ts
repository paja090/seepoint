/**
 * Conservative locality description for the public catalog.
 * Only states facts that can be read from the carrier data itself
 * (format, address, direction and points of interest literally named in the carrier name).
 */

type CarrierLike = {
  name?: string | null;
  city?: string | null;
  street?: string | null;
  locality?: string | null;
  address?: string | null;
  type?: string | null;
};

const POI_PATTERNS: Array<[RegExp, string]> = [
  [/kaufland/i, 'Kaufland'],
  [/futurum/i, 'OC Futurum'],
  [/avion/i, 'OC Avion'],
  [/koksovna/i, 'OC Koksovna'],
  [/tesco/i, 'Tesco'],
  [/lidl/i, 'Lidl'],
  [/penny/i, 'Penny'],
  [/albert/i, 'Albert'],
  [/billa/i, 'Billa'],
  [/globus/i, 'Globus'],
  [/baumax/i, 'Baumax'],
  [/koupali[šs]t/i, 'koupaliště'],
  [/baz[eé]n/i, 'bazén'],
  [/stadion/i, 'stadion'],
  [/ostravar/i, 'Ostravar Aréna'],
  [/\bzoo\b/i, 'ZOO'],
  [/h[řr]bitov/i, 'hřbitov'],
  [/n[aá]dra[žz]|[žz]el\.?\s*st/i, 'nádraží / železniční stanice'],
  [/nemocnic/i, 'nemocnice'],
  [/poliklinik/i, 'poliklinika'],
  [/[šs]kol/i, 'škola'],
  [/[uú][řr]ad/i, 'úřad'],
  [/po[šs]t[aáy]/i, 'pošta'],
  [/\bpark\b/i, 'park'],
  [/\bmhd\b|zast[aá]vk/i, 'zastávka MHD'],
];

export function buildLocalityDescription(carrier: CarrierLike): string {
  const rawName = (carrier.name || '').trim();
  const city = (carrier.city || '').trim();
  const street = (carrier.street || '').trim();
  const locality = (carrier.locality || '').trim().replace(/\.+$/, '');
  const text = `${rawName} ${street} ${locality} ${carrier.address || ''}`;

  const locLabel = [
    city,
    locality && locality.toLowerCase() !== city.toLowerCase() ? locality : '',
    street && !rawName.toLowerCase().includes(street.toLowerCase()) ? `ul. ${street}` : '',
  ]
    .filter(Boolean)
    .join(' – ');

  const smerMatch = rawName.match(/sm[ěe]r\s+([^,()]+)/i);
  const smerText = smerMatch ? `, směr ${smerMatch[1].trim()}` : '';

  const formatByType: Record<string, string> = {
    PROMO_BENCH: 'Reklamní lavička',
    CITY_POSTER: 'Plakátová vitrína City Poster (CLP)',
    PROMO_HORIZON: 'Reklamní horizont',
    PROMO_TOWER: 'Reklamní věž se 4 reklamními stranami',
    PROMO_MINITOWER: 'Reklamní minitower',
    CITYLIGHT: 'Prosvětlená vitrína Citylight (CLV)',
    BILLBOARD: 'Billboard',
    BIGBOARD: 'Bigboard',
    LED_SCREEN: 'LED obrazovka',
    FACADE: 'Fasádní plachta',
    BANNER: 'Reklamní plachta',
  };
  const format = formatByType[carrier.type || ''] || 'Reklamní plocha';

  const pois: string[] = [];
  for (const [re, label] of POI_PATTERNS) {
    if (re.test(text) && !pois.includes(label)) pois.push(label);
  }

  const base = `${format} — ${locLabel || city}${smerText}.`;
  return pois.length > 0 ? `${base} V blízkosti: ${pois.slice(0, 3).join(', ')}.` : base;
}
