/** Pure browser/server shared navigation placement checks. */
export function isRestrictedHighwayOr1stClassRoad(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const forbidden = [
    'rudna', 'rudne', 'mistecka', 'mistecke', 'bohuminska', 'bohuminske',
    'marianskohorska', 'marianskohorske', 'plzenska', 'plzenske', 'opavska',
    'opavske', 'slovenska', 'dalnice', 'dalnici', 'dalnic', 'd1', 'd56', 'd48',
    'i/11', 'i/56', 'i/59', 'i/48', 'i/58', 'silnice 1', 'silnici 1',
    '1. trid', 'i. trid',
  ];
  return forbidden.some((keyword) => keyword.length <= 3
    ? new RegExp(`\\b${keyword}\\b`, 'i').test(normalized)
    : normalized.includes(keyword));
}

export function isOstravaRestrictedZone(lat: number, lng: number, addressText = ''): boolean {
  if (lat >= 49.8310 && lat <= 49.8420 && lng >= 18.2810 && lng <= 18.2980) return true;
  if (lat >= 49.8235 && lat <= 49.8355 && lng >= 18.1600 && lng <= 18.1760) return true;
  if (lat >= 49.8105 && lat <= 49.8185 && lng >= 18.2640 && lng <= 18.2760) return true;
  const normalized = addressText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['masarykovo namesti', 'jiraskovo namesti', 'pamatkova zona', 'hlavni trida poruba', 'mirove namesti vitkovice']
    .some((keyword) => normalized.includes(keyword));
}
