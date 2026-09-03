import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { platformPrisma } from '@/lib/db';
import { NETWORK_BETA_MESSAGE } from '@/lib/network-capabilities';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  const organizationId = auth.organizationId;
  if (!organizationId) return NextResponse.json({ success: false, error: 'Aktivní organizace není vybrána.' }, { status: 403 });

  try {
    // Fetch all active organizations on the platform (excluding self)
    const otherOrgs = await platformPrisma.organization.findMany({
      where: {
        id: { not: organizationId },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        city: true,
        logoUrl: true,
        primaryColor: true,
      },
      orderBy: { name: 'asc' },
    });

    const partners = otherOrgs.map((org) => {
      return {
        id: org.id,
        name: org.name,
        city: org.city || 'Praha',
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor || '#0ea5e9',
        status: 'AVAILABLE',
        discountPercent: 0,
        sharedSurfacesCount: 0,
        partnershipType: 'Dostupná organizace',
        canBookHold: false,
      };
    });

    return NextResponse.json({
      success: true,
      currentOrganizationId: organizationId,
      partners,
    });
  } catch (error: unknown) {
    console.error('[api/network/partners]', error);
    return NextResponse.json({ success: false, error: 'Nepodařilo se načíst B2B partnery.' }, { status: 500 });
  }
}

export async function POST() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  return NextResponse.json({ success: false, configured: false, error: NETWORK_BETA_MESSAGE }, { status: 501 });
}
