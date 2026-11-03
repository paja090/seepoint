import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { enterTenantContext } from '@/lib/tenant-context';
import { isModuleAvailable } from '@/lib/organization-modules';
import { loadMobilePhotoCampaigns } from '@/lib/mobile-photo-campaigns';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireApiAccess(
    ['photoDocumentation', 'myTasks', 'work', 'carriers', 'offers', 'navigationProjects'],
    null
  );
  if (isApiDenied(user)) return user;
  const organizationId = user.organizationId || user.membership?.organizationId;
  if (!organizationId || !user.organization?.isActive || !user.membership?.isActive) {
    return NextResponse.json({ error: 'Přihlášení do aktivní organizace je vyžadováno.' }, { status: 403 });
  }
  enterTenantContext({ organizationId, userId: user.id, source: 'session' });

  try {
    const navigationEnabled = isModuleAvailable(user.organization, 'navigation');
    const fieldEnabled = isModuleAvailable(user.organization, 'electionRemoval');
    const campaigns = await loadMobilePhotoCampaigns(organizationId, {
      navigationEnabled,
      fieldEnabled,
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('[api/mobile-photos/campaigns] Error:', error);
    return NextResponse.json({ error: 'Chyba při načítání kampaní.' }, { status: 500 });
  }
}
