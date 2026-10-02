import 'server-only';

// ==========================================
// PARCELNÍ INTEGRAČNÍ VRSTVA
// Vrstvy jsou oddělené – aplikace není svázaná s jediným zdrojem
// AI NESMÍ vymýšlet parcelní čísla – data musí pocházet z tohoto providera
// ==========================================

export interface ParcelLookupResult {
  found: boolean;
  parcelNumber?: string;
  cadastralArea?: string;
  municipality?: string;
  lv?: string;
  source: string;
  sourceUrl?: string;
  confidence: 'VERIFIED' | 'APPROXIMATE' | 'UNVERIFIED';
  rawData?: unknown;
  errorMessage?: string;
}

export interface ParcelLookupProvider {
  /** Identifikátor providera (pro audit log) */
  readonly name: string;
  /** Vyhledá parcelu dle souřadnic WGS-84 */
  lookup(lat: number, lng: number): Promise<ParcelLookupResult>;
}

// ------------------------------------
// ManualProvider – výchozí, vždy vrátí UNVERIFIED
// Slouží jako placeholder pro budoucí integraci ČÚZK / RÚIAN
// ------------------------------------
export class ManualParcelProvider implements ParcelLookupProvider {
  readonly name = 'MANUAL';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async lookup(_lat: number, _lng: number): Promise<ParcelLookupResult> {
    return {
      found: false,
      source: 'MANUAL',
      confidence: 'UNVERIFIED',
      errorMessage: 'Automatický lookup parcely není nakonfigurován. Doplňte parcelní číslo ručně.',
    };
  }
}

// ------------------------------------
// ČÚZK RÚIAN ArcGIS REST Provider – bezplatná veřejná služba ČÚZK
// Funguje kdekoliv v ČR dle WGS-84 souřadnic bez nutnosti API klíče
// ------------------------------------
export class CuzkRuianProvider implements ParcelLookupProvider {
  readonly name = 'RUIAN';
  private readonly baseUrl: string;

  constructor(customUrl?: string) {
    this.baseUrl = customUrl || 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/identify';
  }

  async lookup(lat: number, lng: number): Promise<ParcelLookupResult> {
    try {
      const delta = 0.005;
      const params = new URLSearchParams({
        f: 'json',
        geometryType: 'esriGeometryPoint',
        geometry: JSON.stringify({ x: lng, y: lat }),
        sr: '4326',
        layers: 'all:1,5,7,12', // 1=AdresniMisto, 5=Parcela, 7=KatastralniUzemi, 12=Obec
        tolerance: '5',
        mapExtent: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`,
        imageDisplay: '800,600,96',
        returnGeometry: 'false',
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return {
          found: false,
          source: 'RUIAN',
          confidence: 'UNVERIFIED',
          errorMessage: `ČÚZK RÚIAN služba vrátila HTTP ${response.status}`,
        };
      }

      const data = await response.json() as {
        results?: Array<{
          layerId: number;
          layerName: string;
          attributes?: Record<string, string>;
        }>;
      };

      const parcel = data.results?.find((r) => r.layerId === 5);
      const ku = data.results?.find((r) => r.layerId === 7);
      const obec = data.results?.find((r) => r.layerId === 12);

      const parcelNumber = parcel?.attributes?.['Číslo parcely'] || parcel?.attributes?.['Kmenové parcelní číslo'];
      const parcelId = parcel?.attributes?.['Jednoznačný identifikátor parcely'];
      const kuName = ku?.attributes?.['Název katastrálního území'];
      const obecName = obec?.attributes?.['Název obce'];

      if (!parcelNumber) {
        return {
          found: false,
          source: 'RUIAN',
          confidence: 'UNVERIFIED',
          errorMessage: 'Na zadaných souřadnicích nebyla nalezena parcela v katastru nemovitostí ČR.',
        };
      }

      // Odkaz na iKatastr.cz funguje bleskově a bez bot-ochrany / CAPTCHA (na rozdíl od Nahlížení do KN)
      const sourceUrl = `https://www.ikatastr.cz/#kde=${lat},${lng},18&info=${lat},${lng}&mapa=letecka&vrstvy=parcelybudovy`;

      return {
        found: true,
        parcelNumber: String(parcelNumber),
        cadastralArea: kuName ? String(kuName) : undefined,
        municipality: obecName ? String(obecName) : undefined,
        source: 'RUIAN',
        sourceUrl,
        confidence: 'VERIFIED',
        rawData: {
          parcelId,
          landType: parcel?.attributes?.['Kód druhu pozemku'],
          usage: parcel?.attributes?.['Způsob využití pozemku'],
          area: parcel?.attributes?.['Výměra parcely'],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      return {
        found: false,
        source: 'RUIAN',
        confidence: 'UNVERIFIED',
        errorMessage: `ČÚZK RÚIAN dotaz selhal: ${message}`,
      };
    }
  }
}

// ------------------------------------
// Factory – vrátí aktivního providera (RÚIAN ČÚZK REST defaultně)
// ------------------------------------
export function createParcelLookupProvider(): ParcelLookupProvider {
  if (process.env.MANUAL_PARCEL_ONLY === 'true') {
    return new ManualParcelProvider();
  }
  return new CuzkRuianProvider(process.env.CUZK_WFS_URL?.trim());
}
