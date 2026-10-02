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
// ČÚZK RÚIAN WFS Provider (připraveno pro budoucí aktivaci)
// Vyžaduje CUZK_WFS_URL v prostředí
// ------------------------------------
export class CuzkRuianProvider implements ParcelLookupProvider {
  readonly name = 'RUIAN';
  private readonly wfsUrl: string;

  constructor(wfsUrl: string) {
    this.wfsUrl = wfsUrl;
  }

  async lookup(lat: number, lng: number): Promise<ParcelLookupResult> {
    try {
      // WFS GetFeature request na ČÚZK RÚIAN – parcely KN
      const buffer = 0.00005; // ~5 m
      const bbox = `${lng - buffer},${lat - buffer},${lng + buffer},${lat + buffer}`;
      const url = new URL(this.wfsUrl);
      url.searchParams.set('SERVICE', 'WFS');
      url.searchParams.set('VERSION', '2.0.0');
      url.searchParams.set('REQUEST', 'GetFeature');
      url.searchParams.set('TYPENAMES', 'KN:Parcela');
      url.searchParams.set('BBOX', `${bbox},EPSG:4326`);
      url.searchParams.set('SRSNAME', 'EPSG:4326');
      url.searchParams.set('outputFormat', 'application/json');
      url.searchParams.set('count', '1');

      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        return {
          found: false,
          source: 'RUIAN',
          confidence: 'UNVERIFIED',
          errorMessage: `ČÚZK WFS vrátil HTTP ${response.status}`,
        };
      }

      const data = await response.json() as { features?: Array<{ properties?: Record<string, unknown> }> };
      const feature = data.features?.[0];
      if (!feature?.properties) {
        return { found: false, source: 'RUIAN', confidence: 'UNVERIFIED' };
      }

      const props = feature.properties;
      return {
        found: true,
        parcelNumber: String(props['KmenoveCislo'] ?? props['KmenoveCisloParcely'] ?? ''),
        cadastralArea: String(props['NazevKatastralnihoUzemi'] ?? ''),
        municipality: String(props['NazevObce'] ?? ''),
        source: 'RUIAN',
        sourceUrl: `https://nahlizenidokn.cuzk.cz/ZobrazitMapu/Parcela`,
        confidence: 'VERIFIED',
        rawData: props,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      return {
        found: false,
        source: 'RUIAN',
        confidence: 'UNVERIFIED',
        errorMessage: `ČÚZK WFS selhal: ${message}`,
      };
    }
  }
}

// ------------------------------------
// Factory – vrátí aktivního providera dle env
// ------------------------------------
export function createParcelLookupProvider(): ParcelLookupProvider {
  const wfsUrl = process.env.CUZK_WFS_URL?.trim();
  if (wfsUrl) {
    return new CuzkRuianProvider(wfsUrl);
  }
  return new ManualParcelProvider();
}
