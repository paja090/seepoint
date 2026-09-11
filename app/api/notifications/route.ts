import { getCurrentUser } from '@/lib/auth';
import { getSystemNotifications } from '@/lib/notifications-service';
import { NextResponse } from 'next/server';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { enterTenantContext, runWithTenantContext, TenantContextError } from '@/lib/tenant-context';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: 'Aktivní organizace není vybraná.' }, { status: 403 });
    }

    const tenantContext = {
      organizationId: user.organizationId,
      userId: user.id,
      source: 'session' as const,
    };

    enterTenantContext(tenantContext);

    return await runWithTenantContext(tenantContext, async () => {
      const includeAi = new URL(request.url).searchParams.get('includeAi') === '1';
      if (includeAi) {
        const limited = await enforceRateLimit(
          request,
          hashRateLimitIdentity(`${user.organizationId}:${user.id}`),
          rateLimitPolicies.notificationsAi,
        );
        if (limited) return limited;
      }

      const data = await getSystemNotifications(user.role, user.id, {
        includeAi,
        organizationId: user.organizationId,
      });

      return NextResponse.json(data);
    });
  } catch (error) {
    if (error instanceof TenantContextError) {
      console.error(`[Notifications API] Critical TenantContextError in /api/notifications: ${error.message}`);
      return NextResponse.json({ error: 'Chyba tenant kontextu' }, { status: 500 });
    }
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: 'Chyba při načítání notifikací' }, { status: 500 });
  }
}

