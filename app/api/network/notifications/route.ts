import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { requireTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

let b2bNotifications = [
  {
    id: 'notif-b2b-01',
    type: 'B2B_HOLD_EXPIRING',
    title: '⚠️ B2B Hold brzy vyprší (zbývá 24 hod)',
    message: 'Partner Ostrava Outdoor s.r.o. si drží vaši plochu PHA-PB-12 (Vinohradská). Hold zítra vyprší.',
    severity: 'HIGH',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    holdId: 'hold-102',
    isRead: false,
  },
  {
    id: 'notif-b2b-02',
    type: 'B2B_PARTNER_HOLD_CREATED',
    title: '📥 Nový B2B Hold na vaši plochu',
    message: 'Agentura Outdoor Media Brno s.r.o. zařadila váš billboard do své nabídky pro klienta.',
    severity: 'MEDIUM',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    holdId: 'hold-101',
    isRead: false,
  },
  {
    id: 'notif-b2b-03',
    type: 'B2B_PARTNERSHIP_REQUEST',
    title: '🤝 Nové B2B partnerství navázáno',
    message: 'Byli jste úspěšně propojeni s agenturou Plzeň Billboard Group s.r.o. s B2B slevou 20 %.',
    severity: 'LOW',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isRead: true,
  },
];

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  const unreadCount = b2bNotifications.filter((n) => !n.isRead).length;

  return NextResponse.json({
    success: true,
    unreadCount,
    notifications: b2bNotifications,
  });
}

export async function POST(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const body = await req.json();
    const { action, notificationId } = body;

    if (action === 'MARK_ALL_READ') {
      b2bNotifications = b2bNotifications.map((n) => ({ ...n, isRead: true }));
      return NextResponse.json({ success: true, unreadCount: 0 });
    }

    if (action === 'MARK_READ' && notificationId) {
      b2bNotifications = b2bNotifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      );
      const unreadCount = b2bNotifications.filter((n) => !n.isRead).length;
      return NextResponse.json({ success: true, unreadCount });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[api/network/notifications]', error);
    return NextResponse.json({ success: false, error: 'Nepodařilo se aktualizovat notifikace.' }, { status: 500 });
  }
}
