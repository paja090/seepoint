/**
 * ČÚZK / RÚIAN Cadastre Service
 * Resolves WGS84 coordinates into official Czech Cadastre parcel details.
 */

export interface CadastralParcelResult {
  parcelId: string;
  parcelNumber: string;
  kmenoveCislo: number;
  poddeleniCisla: number | null;
  isBuildingParcel: boolean;
  cadastralAreaCode: number;
  cadastralAreaName: string;
  municipalityCode?: number;
  municipalityName?: string;
  areaSqm: number;
  landTypeCode: number;
  landTypeName: string;
  landUseCode: number | null;
  landUseName: string | null;
  cuzkViewUrl: string;
  cuzkMapUrl: string;
}

const LAND_TYPE_NAMES: Record<number, string> = {
  2: 'Orná půda',
  3: 'Chmelnice',
  4: 'Vinice',
  5: 'Zahrada',
  6: 'Ovocný sad',
  7: 'Trvalý travní porost',
  10: 'Lesní pozemek',
  11: 'Vodní plocha',
  13: 'Zastavěná plocha a nádvoří',
  14: 'Ostatní plocha',
};

const LAND_USE_NAMES: Record<number, string> = {
  1: 'skleník, pařeniště',
  2: 'školka',
  3: 'plantáž dřevin',
  4: 'vinice',
  5: 'chmelnice',
  6: 'ovocný sad',
  9: 'rybník',
  10: 'vodní nádrž',
  11: 'koryto vodního toku',
  12: 'koryto vodního toku umělé',
  13: 'zamokřená plocha',
  14: 'společný dvůr',
  15: 'zbořeniště',
  16: 'dráha',
  17: 'dálnice',
  18: 'silnice',
  19: 'ostatní komunikace',
  20: 'ostatní dopravní plocha',
  21: 'zeleň',
  22: 'sportoviště a rekreační plocha',
  23: 'hřbitov, urnový háj',
  24: 'kulturní a osvětová plocha',
  25: 'manipulační plocha',
  26: 'dobývací prostor, lom',
  27: 'skládka',
  28: 'jiná plocha',
  29: 'neplodná půda',
};

/**
 * Queries the official ČÚZK RÚIAN MapServer for the parcel under given WGS-84 coordinates.
 */
export async function findCadastralParcelByCoords(
  latitude: number,
  longitude: number
): Promise<CadastralParcelResult | null> {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return null;
  }

  // Layer 5 = Parcela in CUZK RUIAN MapServer
  const parcelQueryUrl = new URL(
    'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer/5/query'
  );
  parcelQueryUrl.searchParams.set('f', 'json');
  parcelQueryUrl.searchParams.set('geometry', `${longitude},${latitude}`);
  parcelQueryUrl.searchParams.set('geometryType', 'esriGeometryPoint');
  parcelQueryUrl.searchParams.set('inSR', '4326');
  parcelQueryUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  parcelQueryUrl.searchParams.set('outFields', '*');
  parcelQueryUrl.searchParams.set('returnGeometry', 'false');

  try {
    const response = await fetch(parcelQueryUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SeePoint-Cadastre-Resolver/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.warn(`[CUZK] Request failed with status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      features?: Array<{
        attributes?: {
          id?: number;
          kmenovecislo?: number;
          poddelenicisla?: number | null;
          cisloparcely?: string;
          druhcislovanikod?: number;
          druhpozemkukod?: number;
          zpusobyvyuzitipozemku?: number | null;
          vymeraparcely?: number;
          katastralniuzemi?: number;
        };
      }>;
    };

    const feature = data.features?.[0];
    if (!feature?.attributes) {
      return null;
    }

    const attr = feature.attributes;
    const parcelId = String(attr.id || '');
    const kmenoveCislo = Number(attr.kmenovecislo || 0);
    const poddeleniCisla =
      attr.poddelenicisla !== undefined && attr.poddelenicisla !== null
        ? Number(attr.poddelenicisla)
        : null;

    const isBuildingParcel = attr.druhcislovanikod === 1; // 1 = stavební, 2 = pozemková
    const parcelNumberFormatted = isBuildingParcel
      ? `st. ${kmenoveCislo}${poddeleniCisla ? `/${poddeleniCisla}` : ''}`
      : `${kmenoveCislo}${poddeleniCisla ? `/${poddeleniCisla}` : ''}`;

    const kuCode = Number(attr.katastralniuzemi || 0);
    const landTypeCode = Number(attr.druhpozemkukod || 0);
    const landUseCode =
      attr.zpusobyvyuzitipozemku !== undefined && attr.zpusobyvyuzitipozemku !== null
        ? Number(attr.zpusobyvyuzitipozemku)
        : null;

    // Resolve Cadastral Area (KU) Name from Layer 7
    let cadastralAreaName = `k.ú. ${kuCode}`;
    let municipalityCode: number | undefined;

    if (kuCode > 0) {
      try {
        const kuQueryUrl = new URL(
          'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer/7/query'
        );
        kuQueryUrl.searchParams.set('f', 'json');
        kuQueryUrl.searchParams.set('where', `kod=${kuCode}`);
        kuQueryUrl.searchParams.set('outFields', 'nazev,obec');
        kuQueryUrl.searchParams.set('returnGeometry', 'false');

        const kuRes = await fetch(kuQueryUrl.toString(), {
          headers: { Accept: 'application/json' },
          next: { revalidate: 86400 },
        });

        if (kuRes.ok) {
          const kuData = (await kuRes.json()) as {
            features?: Array<{ attributes?: { nazev?: string; obec?: number } }>;
          };
          const kuAttr = kuData.features?.[0]?.attributes;
          if (kuAttr?.nazev) {
            cadastralAreaName = kuAttr.nazev;
          }
          if (kuAttr?.obec) {
            municipalityCode = Number(kuAttr.obec);
          }
        }
      } catch (err) {
        console.warn('[CUZK] Failed to fetch cadastral area name', err);
      }
    }

    const landTypeName = LAND_TYPE_NAMES[landTypeCode] || `Druh pozemku (${landTypeCode})`;
    const landUseName = landUseCode ? LAND_USE_NAMES[landUseCode] || `Využití (${landUseCode})` : null;

    return {
      parcelId,
      parcelNumber: parcelNumberFormatted,
      kmenoveCislo,
      poddeleniCisla,
      isBuildingParcel,
      cadastralAreaCode: kuCode,
      cadastralAreaName,
      municipalityCode,
      areaSqm: Number(attr.vymeraparcely || 0),
      landTypeCode,
      landTypeName,
      landUseCode,
      landUseName,
      cuzkViewUrl: `https://nahlizenidokn.cuzk.cz/ZobrazObjekt.aspx?typ=par&id=${parcelId}`,
      cuzkMapUrl: `https://nahlizenidokn.cuzk.cz/Mapa.aspx?typ=par&id=${parcelId}`,
    };
  } catch (error) {
    console.error('[CUZK] Error fetching parcel info:', error);
    return null;
  }
}
