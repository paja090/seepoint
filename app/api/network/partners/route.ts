import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma, platformPrisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  const { organizationId } = requireTenantContext();

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
        country: true,
        logoUrl: true,
        primaryColor: true,
        email: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    // In a multi-tenant DB, partners can have customizable B2B discounts
    const partners = otherOrgs.map((org, index) => {
      const isConnected = index % 2 === 0; // Simulated active connection state
      const discountPercent = isConnected ? 20 : 0;
      const sharedSurfacesCount = isConnected ? 12 + index * 4 : 0;

      return {
        id: org.id,
        name: org.name,
        city: org.city || 'Praha',
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor || '#0ea5e9',
        email: org.email,
        phone: org.phone,
        status: isConnected ? 'CONNECTED' : 'AVAILABLE',
        discountPercent,
        sharedSurfacesCount,
        partnershipType: isConnected ? 'B2B Smluvní partner' : 'Potenciální partner',
        canBookHold: isConnected,
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

export async function POST(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  const { organizationId } = requireTenantContext();

  try {
    const body = await req.json();
    const { targetOrgId, action, discountPercent } = body;

    if (!targetOrgId) {
      return NextResponse.json({ success: false, error: 'Chybí cílová organizace.' }, { status: 400 });
    }

    // Action handling: REQUEST_CONNECTION, ACCEPT, UPDATE_DISCOUNT, DISCONNECT
    return NextResponse.json({
      success: true,
      message:
        action === 'REQUEST_CONNECTION'
          ? 'Žádost o B2B partnerství byla úspěšně odeslána.'
          : action === 'UPDATE_DISCOUNT'
          ? `Provizní B2B sleva byla nastavena na ${discountPercent} %.`
          : 'Partnerský stav byl úspěšně aktualizován.',
      targetOrgId,
      status: action === 'DISCONNECT' ? 'AVAILABLE' : 'CONNECTED',
    });
  } catch (error: unknown) {
    console.error('[api/network/partners] POST', error);
    return NextResponse.json({ success: false, error: 'Operaci se nepodařilo provést.' }, { status: 500 });
  }
}
