import { getCurrentUser } from '@/lib/auth';
import { getSystemNotifications } from '@/lib/notifications-service';
import { NextResponse } from 'next/server';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
    }
    const includeAi = new URL(request.url).searchParams.get('includeAi') === '1';
    if (includeAi) {
      const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.notificationsAi);
      if (limited) return limited;
    }
    const data = await getSystemNotifications(user.role, user.id, { includeAi });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: 'Chyba při načítání notifikací' }, { status: 500 });
  }
}
