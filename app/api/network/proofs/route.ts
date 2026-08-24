import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { requireTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

let sampleProofs = [
  {
    id: 'proof-001',
    direction: 'INCOMING', // Partner pro nás vylepil plochu v Brně
    partnerName: 'Outdoor Media Brno s.r.o.',
    campaignName: 'Jarní Kampaň 2026',
    carrierCode: 'BRN-BB-04',
    surfaceName: 'Strana A (Eurobillboard)',
    city: 'Brno',
    location: 'Hradecká / Sportovní (u OC Královo Pole)',
    latitude: 49.2289,
    longitude: 16.5982,
    installedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    installerName: 'Montážní tým Brno #2',
    photoUrl: '/offer/media-city-poster.png',
    status: 'APPROVED',
    gpsVerified: true,
    clientReportReady: true,
  },
  {
    id: 'proof-002',
    direction: 'INCOMING',
    partnerName: 'Ostrava Outdoor s.r.o.',
    campaignName: 'Retail Promo Morava',
    carrierCode: 'OST-CLV-18',
    surfaceName: 'CLV Vitrína (Centrum)',
    city: 'Ostrava',
    location: 'Nádražní 42 (pěší zóna)',
    latitude: 49.8356,
    longitude: 18.2923,
    installedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    installerName: 'Montážník Petr Novák',
    photoUrl: '/offer/media-clv.png',
    status: 'PENDING_REVIEW',
    gpsVerified: true,
    clientReportReady: false,
  },
  {
    id: 'proof-003',
    direction: 'OUTGOING', // My jsme vylepili plochu v Praze pro partnera
    partnerName: 'Plzeň Billboard Group s.r.o.',
    campaignName: 'Automotive Roadshow',
    carrierCode: 'PHA-PB-12',
    surfaceName: 'Promo lavička #12',
    city: 'Praha',
    location: 'Vinohradská 88',
    latitude: 50.0768,
    longitude: 14.4521,
    installedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    installerName: 'Náš technik Martin Dvořák',
    photoUrl: '/offer/media-promo-bench.png',
    status: 'APPROVED',
    gpsVerified: true,
    clientReportReady: true,
  },
];

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  return NextResponse.json({
    success: true,
    proofs: sampleProofs,
  });
}

export async function POST(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const body = await req.json();
    const { proofId, action } = body;

    if (action === 'APPROVE') {
      sampleProofs = sampleProofs.map((p) =>
        p.id === proofId ? { ...p, status: 'APPROVED', clientReportReady: true } : p
      );
      return NextResponse.json({
        success: true,
        message: 'Fotodokumentace byla schválena a zařazena do klientského fotoreportu.',
        status: 'APPROVED',
      });
    }

    if (action === 'REJECT') {
      sampleProofs = sampleProofs.map((p) =>
        p.id === proofId ? { ...p, status: 'REJECTED' } : p
      );
      return NextResponse.json({
        success: true,
        message: 'Požadavek na přefocení / kontrolu montáže byl odeslán partnerovi.',
        status: 'REJECTED',
      });
    }

    return NextResponse.json({ success: false, error: 'Neznámá akce.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[api/network/proofs]', error);
    return NextResponse.json({ success: false, error: 'Operaci se nepodařilo provést.' }, { status: 500 });
  }
}
