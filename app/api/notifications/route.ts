import { NextResponse } from 'next/server';
import { getSystemNotifications } from '@/lib/notifications-service';

export async function GET() {
  try {
    const data = await getSystemNotifications();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: 'Chyba při načítání notifikací' }, { status: 500 });
  }
}
