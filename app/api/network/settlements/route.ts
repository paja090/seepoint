import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { NETWORK_BETA_MESSAGE } from '@/lib/network-capabilities';

export const dynamic = 'force-dynamic';

const emptyMetrics = { totalB2BRevenue: 0, totalNetMargin: 0, totalPayable: 0, totalReceivable: 0 };

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;
  return NextResponse.json({ success: true, configured: false, metrics: emptyMetrics, settlements: [] });
}

export async function POST() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;
  return NextResponse.json({ success: false, configured: false, error: NETWORK_BETA_MESSAGE }, { status: 501 });
}
