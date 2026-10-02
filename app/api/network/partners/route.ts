import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { NETWORK_BETA_MESSAGE } from '@/lib/network-capabilities';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('offers', 'network');
  if (isApiDenied(auth)) return auth;

  const organizationId = auth.organizationId;
  if (!organizationId) return NextResponse.json({ success: false, error: 'Aktivní organizace není vybrána.' }, { status: 403 });

  // No persistent, mutually accepted partnerships exist yet. Do not expose
  // the platform organization directory to tenant users (including its logos).
  return NextResponse.json({
    success: true,
    configured: false,
    currentOrganizationId: organizationId,
    partners: [],
    message: 'Adresář bude dostupný po potvrzení partnerství oběma organizacemi.',
  });
}

export async function POST() {
  const auth = await requireApiAccess('offers', 'network');
  if (isApiDenied(auth)) return auth;

  return NextResponse.json({ success: false, configured: false, error: NETWORK_BETA_MESSAGE }, { status: 501 });
}
