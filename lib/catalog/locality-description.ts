/**
 * Locality description & environment highlights for public & B2B catalogs.
 * Combines explicit carrier/surface metadata (city, district/locality, street,
 * direction, format) with recognized retail, transit, and arterial corridor patterns.
 */

export type CarrierLike = {
  name?: string | null;
  city?: string | null;
  street?: string | null;
  locality?: string | null;
  address?: string | null;
  type?: string | null;
  mediaType?: string | null;
  description?: string | null;
  placementDescription?: string | null;
  directionDescription?: string | null;
};

const POI_PATTERNS: Array<[RegExp, string]> = [
  [/kaufland/i, 'hypermarket Kaufland'],
  [/futurum/i, 'OC Futurum'],
  [/avion/i, 'OC Avion Shopping Park'],
  [/koksovna/i, 'OC Koksovna'],
  [/forum\s*nov[aá]\s*karolina|karolina/i, 'Forum Nová Karolina'],
  [/tesco/i, 'hypermarket Tesco'],
  [/lidl/i, 'prodejna Lidl'],
  [/penny/i, 'prodejna Penny Market'],
  [/albert/i, 'supermarket Albert'],
  [/billa/i, 'supermarket Billa'],
  [/globus/i, 'hypermarket Globus'],
  [/baumax|obi|hornbach/i, 'hobby market'],
  [/koupali[šs]t/i, 'městské koupaliště'],
  [/baz[eé]n|vodn[ií]\s*sv[ěe]t/i, 'plavecký areál'],
  [/stadion/i, 'sportovní stadion'],
  [/ostravar/i, 'Ostravar Aréna'],
  [/\bzoo\b/i, 'ZOO'],
  [/h[řr]bitov/i, 'centrální hřbitov'],
  [/n[aá]dra[žz]|[žz]el\.?\s*st/i, 'železniční / autobusové nádraží'],
  [/nemocnic|fakultn[ií]/i, 'areál nemocnice'],
  [/poliklinik/i, 'poliklinika'],
  [/[šs]kol|gymn[aá]zi|univerzit|v[šs]b/i, 'školský / univerzitní kampus'],
  [/[uú][řr]ad|magistr[aá]t|radnic/i, 'městský úřad / radnice'],
  [/po[šs]t[aáy]/i, 'pobočka pošty'],
  [/\bpark\b|sad\b/i, 'městský park'],
  [/\bmhd\b|zast[aá]vk|tramvaj|autobus/i, 'uzel a zastávka MHD'],
  [/kruh\.?\s*objezd|k[řr]i[žz]ovatk|rondel/i, 'frekventovaná křižovatka'],
];

const ARTERIAL_PATTERNS: Array<[RegExp, string]> = [
  [/rudn[aá]/i, 'páteřní průtah I/11 (ul. Rudná) s vysokou denní intenzitou tranzitní i městské dopravy'],
  [/m[ií]steck[aá]/i, 'rychlostní tah I/56 (ul. Místecká) spojující centrum s dálnicí D1 a Beskydami'],
  [/plze[ňn]sk[aá]/i, 'hlavní městský tah (ul. Plzeňská) propojující lidnaté městské části s centrem'],
  [/opavsk[aá]/i, 'hlavní dopravní tepna (ul. Opavská) v hustě osídlené části města'],
  [/28\.\s*[řr][ií]jna/i, 'centrální městská třída (ul. 28. října) s vysokým pohybem aut i MHD'],
  [/hlavn[ií]\s*t[řr][ií]da/i, 'reprezentativní městský bulvár (Hlavní třída) s vysokou pěší i automobilovou návštěvností'],
  [/v[yý][šs]kovick[aá]|horn[ií]|pavlovova|českobratrsk[aá]|n[aá]dra[žz]n[ií]|bohum[ií]nsk[aá]|t[ěe][šs][ií]nsk[aá]| ostravsk[aá]|fr[yý]deck[aá]/i, 'frekventovaná sběrná komunikace s celodenním provozem osobní dopravy a MHD'],
];

export function buildLocalityHighlights(carrier: CarrierLike): string[] {
  const text = `${carrier.name || ''} ${carrier.street || ''} ${carrier.locality || ''} ${carrier.address || ''} ${carrier.description || ''} ${carrier.placementDescription || ''} ${carrier.directionDescription || ''}`;
  const tags: string[] = [];

  if (ARTERIAL_PATTERNS.some(([re]) => re.test(text)) || /t[řr][ií]d|k[řr]i[žz]ovatk|most|okruh|tah/i.test(text)) {
    tags.push('🚗 Hlavní dopravní tah');
  }
  if (/kaufland|futurum|avion|karolina|tesco|lidl|penny|albert|billa|globus|baumax|obi|oc\b|obchodn/i.test(text)) {
    tags.push('🛒 Nákupní zóna & Retail');
  }
  if (/\bmhd\b|zast[aá]vk|tramvaj|autobus|n[aá]dra[žz]|stanice/i.test(text)) {
    tags.push('🚌 U zastávky MHD / Nádraží');
  }
  if (/centrum|n[aá]m[ěe]st|hlavn[ií]|radnic|p[ěe][šs][ií]/i.test(text)) {
    tags.push('🏙️ Spádové centrum města');
  }
  if (/sm[ěe]r\s+/i.test(text)) {
    const smerMatch = text.match(/sm[ěe]r\s+([^,().]+)/i);
    if (smerMatch?.[1]) {
      tags.push(`🧭 Směr ${smerMatch[1].trim()}`);
    }
  }

  const effectiveType = carrier.mediaType || carrier.type || '';
  if (tags.length === 0) {
    if (effectiveType === 'PROMO_BENCH' || effectiveType === 'CITYLIGHT' || effectiveType === 'CITY_POSTER') {
      tags.push('🚶 Pěší & lokální spádová zóna');
    } else {
      tags.push('📍 Viditelná uliční pozice');
    }
  }

  return tags.slice(0, 3);
}

export function buildLocalityDescription(carrier: CarrierLike): string {
  const customDesc = (
    carrier.directionDescription ||
    carrier.placementDescription ||
    carrier.description ||
    ''
  ).trim();
  if (customDesc.length >= 25) {
    return customDesc;
  }

  const rawName = (carrier.name || '').trim();
  const city = (carrier.city || '').trim();
  const street = (carrier.street || '').trim();
  const locality = (carrier.locality || '').trim().replace(/\.+$/, '');
  const text = `${rawName} ${street} ${locality} ${carrier.address || ''}`;

  const locLabel = [
    city,
    locality && locality.toLowerCase() !== city.toLowerCase() ? `část ${locality}` : '',
    street && !rawName.toLowerCase().includes(street.toLowerCase()) ? `ul. ${street}` : '',
  ]
    .filter(Boolean)
    .join(' – ');

  const smerMatch = rawName.match(/sm[ěe]r\s+([^,()]+)/i);
  const smerText = smerMatch ? ` (orientace na směr ${smerMatch[1].trim()})` : '';

  const effectiveType = carrier.mediaType || carrier.type || '';
  const formatByType: Record<string, string> = {
    PROMO_BENCH: 'Reklamní lavička v uličním parteru',
    CITY_POSTER: 'Plakátová vitrína City Poster (CLP) v pěší zóně',
    PROMO_HORIZON: 'Oboustranný reklamní horizont u komunikace',
    PROMO_TOWER: 'Dominantní reklamní věž se 4 reklamními stranami',
    PROMO_MINITOWER: 'Reklamní minitower s celodenní viditelností',
    CITYLIGHT: 'Prosvětlená vitrína Citylight (CLV) s 24/7 viditelností',
    BILLBOARD: 'Standardní Eurobillboard (5,1 × 2,4 m) u komunikace',
    BIGBOARD: 'Velkoformátový Bigboard (9,6 × 3,6 m) s dálkovou viditelností',
    LED_SCREEN: 'Digitální LED obrazovka s vysokým jasem',
    FACADE: 'Velkoplošná fasádní plachta na budově',
    BANNER: 'Reklamní plachta na frekventovaném místě',
  };
  const format = formatByType[effectiveType] || 'Reklamní plocha';

  const pois: string[] = [];
  for (const [re, label] of POI_PATTERNS) {
    if (re.test(text) && !pois.includes(label)) pois.push(label);
  }

  const arterial = ARTERIAL_PATTERNS.find(([re]) => re.test(text));

  const useCaseByType: Record<string, string> = {
    PROMO_BENCH: 'Vhodné pro lokální navigaci k pobočce, dlouhodobou image v dané čtvrti a oslovení chodců i řidičů.',
    CITYLIGHT: 'Vhodné pro imageové kampaně, akční nabídky a oslovení cestujících MHD i pěších 24 hodin denně.',
    CITY_POSTER: 'Vhodné pro kulturní akce, lokální služby a kampaně cílené na obyvatele přilehlé městské části.',
    PROMO_TOWER: 'Vhodné pro nepřehlédnutelnou navigaci k prodejně a budování značky ze všech směrů příjezdu.',
    PROMO_MINITOWER: 'Vhodné pro lokální navigaci a celoroční zviditelnění firmy v zájmové lokalitě.',
    BILLBOARD: 'Ideální pro silný zásah řidičů na hlavních tazích, navigační šipky k provozovně i plošné kampaně.',
    BIGBOARD: 'Ideální pro prémiové imageové kampaně s maximální viditelností na příjezdových tazích.',
  };

  const parts: string[] = [`${format} — ${locLabel || city}${smerText}.`];

  if (arterial) {
    parts.push(`Lokalita: ${arterial[1]}.`);
  }

  if (pois.length > 0) {
    parts.push(`V bezprostředním okolí: ${pois.slice(0, 3).join(', ')}.`);
  }

  if (customDesc && customDesc.length > 0 && customDesc.length < 25) {
    parts.push(`Poznámka k místu: ${customDesc}.`);
  } else if (useCaseByType[effectiveType]) {
    parts.push(useCaseByType[effectiveType]);
  }

  return parts.join(' ');
}
