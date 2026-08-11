import { getCurrentUser } from '@/lib/auth';
import { getSystemNotifications } from '@/lib/notifications-service';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ totalCount: 0, highCount: 0, notifications: [] });
    }

    const data = await getSystemNotifications(user.role, user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: 'Chyba při načítání notifikací' }, { status: 500 });
  }
}
