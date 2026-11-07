import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';

const SUBSCRIPTION_STATUSES = ['INTERNAL', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'] as const;
type SubscriptionStatusValue = typeof SUBSCRIPTION_STATUSES[number];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null) as { isActive?: unknown; subscriptionStatus?: unknown; trialEndsAt?: unknown } | null;
    if (!body) return NextResponse.json({ error: 'Chybí data.' }, { status: 400 });

    const data: { isActive?: boolean; subscriptionStatus?: SubscriptionStatusValue; trialEndsAt?: Date | null } = {};
    if ('isActive' in body) {
      if (typeof body.isActive !== 'boolean') return NextResponse.json({ error: 'Stav není platný.' }, { status: 400 });
      data.isActive = body.isActive;
    }
    if ('subscriptionStatus' in body) {
      if (typeof body.subscriptionStatus !== 'string' || !SUBSCRIPTION_STATUSES.includes(body.subscriptionStatus as SubscriptionStatusValue)) {
        return NextResponse.json({ error: 'Neplatný stav předplatného.' }, { status: 400 });
      }
      data.subscriptionStatus = body.subscriptionStatus as SubscriptionStatusValue;
    }
    if ('trialEndsAt' in body) {
      if (body.trialEndsAt === null || body.trialEndsAt === '') data.trialEndsAt = null;
      else if (typeof body.trialEndsAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.trialEndsAt)) {
        const date = new Date(`${body.trialEndsAt}T23:59:59Z`);
        if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Neplatné datum konce zkoušky.' }, { status: 400 });
        data.trialEndsAt = date;
      } else return NextResponse.json({ error: 'Neplatné datum konce zkoušky.' }, { status: 400 });
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Není co uložit.' }, { status: 400 });

    const organization = await platformPrisma.organization.update({ where: { id }, data });
    if (data.isActive === false) await platformPrisma.userSession.deleteMany({ where: { activeOrganizationId: id } });
    return NextResponse.json({ ok: true, organization });
  } catch { return NextResponse.json({ error: 'Organizace nebyla nalezena.' }, { status: 404 }); }
}

