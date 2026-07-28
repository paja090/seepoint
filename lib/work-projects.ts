export const CG_PROJECT = {
  code: 'CG',
  name: 'Galerie venku',
  requester: 'ZUZANA',
  baseName: 'SeePOINT Ostrava',
  baseAddress: 'Fráni Šrámka 5, Ostrava',
} as const;

const cgPlaces = [
  'NOVÉ MĚSTO N.METUJÍ',
  'NOVÉ MĚSTO NAD METUJÍ',
  'TEPLICE NAD METUJÍ',
  'HRADEC NAD MOR.',
  'HRADEC NAD MORAVICÍ',
  'MORAVSKÝ KRUMLOV',
  'FRÝDEK-MÍSTEK',
  'KARVINÁ DARKOV',
  'ČESKÉ BUDĚJOVICE',
  'HRADEC KRÁLOVÉ',
  'MLADÁ BOLESLAV',
  'UHERSKÉ HRADIŠTĚ',
  'KARLOVY VARY',
  'JABLONEC NAD NISOU',
  'ŽĎÁR NAD SÁZAVOU',
  'ÚSTÍ NAD LABEM',
  'CIESZYN',
  'OSTRAVA',
  'OLOMOUC',
  'BRNO',
  'OPAVA',
  'NITRA',
  'ZLÍN',
  'BLANSKO',
  'LEDNICE',
  'VALTICE',
  'LUHAČOVICE',
  'KOPŘIVNICE',
  'TŘEBÍČ',
  'KROMĚŘÍŽ',
  'PRAHA',
  'PLZEŇ',
  'LIBEREC',
  'PARDUBICE',
  'JIHLAVA',
  'ZNOJMO',
  'ŠUMPERK',
  'PŘEROV',
  'PROSTĚJOV',
  'NOVÝ JIČÍN',
  'VSETÍN',
  'HAVÍŘOV',
  'BOHUMÍN',
  'KARVINÁ',
];

function cleanPlace(value: string) {
  return value
    .replace(/\s*\((?:viz|SK,|rozmístění)[^)]*\).*$/i, '')
    .replace(/\s*\/\/.*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,.;:+-]+$/, '')
    .trim();
}

function uniqueAdjacent(values: string[]) {
  return values.filter((value, index) => value && value !== values[index - 1]);
}

/** Extracts ordered CG venues from the first line of an imported work description. */
export function extractCgStops(description: string) {
  const line = description.split(/\r?\n/)[0]?.trim() ?? '';
  const upper = line.toLocaleUpperCase('cs-CZ');
  const matches = cgPlaces
    .flatMap((place) => {
      const matchesForPlace: Array<{ index: number; place: string }> = [];
      let from = 0;
      while (from < upper.length) {
        const index = upper.indexOf(place, from);
        if (index < 0) break;
        matchesForPlace.push({ index, place });
        from = index + place.length;
      }
      return matchesForPlace;
    })
    .sort((left, right) => left.index - right.index || right.place.length - left.place.length)
    .filter((match, index, all) => index === 0 || match.index !== all[index - 1].index);

  if (matches.length) {
    return uniqueAdjacent(matches.map((match, index) => {
      const nextIndex = matches[index + 1]?.index ?? line.length;
      const separatorIndex = line.indexOf(' - ', match.index);
      const end = separatorIndex >= 0 && separatorIndex < nextIndex ? separatorIndex : nextIndex;
      return cleanPlace(line.slice(match.index, end));
    }));
  }

  const localTransfer = line.match(/\bz\s+(.+?)\s+(?:do|ke|k)\s+(.+?)(?:\s+-\s+|$)/i);
  if (localTransfer) {
    return uniqueAdjacent([
      `${cleanPlace(localTransfer[1])}, Ostrava`,
      `${cleanPlace(localTransfer[2])}, Ostrava`,
    ]);
  }

  return [];
}
