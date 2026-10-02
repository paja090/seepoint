import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurveyPoint } from '@/lib/field-survey/data';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

type AresEntity = {
  ico?: string;
  obchodniJmeno?: string;
  pravniForma?: string;
  sidlo?: {
    textovaAdresa?: string;
    nazevObce?: string;
    ulice?: string;
    cisloDomovni?: number | string;
    psc?: number | string;
  };
};

/**
 * POST /api/field-survey/[id]/points/[pointId]/owner-ares
 * Vyhledá ekonomický subjekt (firmu, město, státní instituci) ve státním registru ARES.
 * Pomáhá v terénu okamžitě dohledat IČO, sídlo a kontaktní základ vlastníka.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const { pointId } = await params;

  const auth = await requireApiAccess('fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const point = await getFieldSurveyPoint(pointId);
  if (!point) return jsonError('NOT_FOUND', 'Průzkumný bod nebyl nalezen.', 404);

  let body: { query?: string };
  try {
    body = (await req.json()) as { query?: string };
  } catch {
    return jsonError('INVALID_JSON', 'Neplatná data požadavku.', 400);
  }

  const query = body.query?.trim();
  if (!query) {
    return jsonError('QUERY_REQUIRED', 'Zadejte název subjektu nebo IČO pro vyhledání v ARES.', 400);
  }

  const cleanQuery = query.replace(/\s+/g, '');
  const isIco = /^\d{8}$/.test(cleanQuery);

  const candidates: Array<{
    ico: string;
    name: string;
    address: string;
    city?: string;
    zip?: string;
    legalForm?: string;
  }> = [];

  try {
    if (isIco) {
      // 1. Přímé vyhledání podle IČO
      const res = await fetch(
        `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${cleanQuery}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const item = (await res.json()) as AresEntity;
        if (item.ico && item.obchodniJmeno) {
          candidates.push({
            ico: item.ico,
            name: item.obchodniJmeno,
            address: item.sidlo?.textovaAdresa || `${item.sidlo?.ulice || ''} ${item.sidlo?.cisloDomovni || ''}, ${item.sidlo?.nazevObce || ''}`.trim(),
            city: item.sidlo?.nazevObce,
            zip: item.sidlo?.psc ? String(item.sidlo.psc) : undefined,
            legalForm: item.pravniForma,
          });
        }
      }
    } else {
      // 2. Fulltextové vyhledání podle obchodního jména
      const res = await fetch(
        'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ obchodniJmeno: query, pocet: 5 }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { ekonomickeSubjekty?: AresEntity[] };
        for (const item of data.ekonomickeSubjekty || []) {
          if (item.ico && item.obchodniJmeno) {
            candidates.push({
              ico: item.ico,
              name: item.obchodniJmeno,
              address: item.sidlo?.textovaAdresa || `${item.sidlo?.nazevObce || ''}`.trim(),
              city: item.sidlo?.nazevObce,
              zip: item.sidlo?.psc ? String(item.sidlo.psc) : undefined,
              legalForm: item.pravniForma,
            });
          }
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chyba ARES';
    console.warn('[field-survey/owner-ares] ARES dotaz selhal:', message);
    return jsonError('ARES_ERROR', `Státní registr ARES neodpověděl: ${message}`, 502);
  }

  return NextResponse.json({
    success: true,
    count: candidates.length,
    candidates,
    message: candidates.length > 0
      ? `V registru ARES nalezeno ${candidates.length} subjektů.`
      : 'V registru ARES nebyl nalezen žádný odpovídající subjekt.',
  });
}
