import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { approveWorkEntry } from '@/lib/work-entry-actions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  // 1. Authorization: Only MANAGER or ADMIN can confirm work entries
  const isAuthorized = user.role === 'ADMIN' || user.role === 'MANAGER';
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Nemáte oprávnění potvrdit záznam práce.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const confirmed = await approveWorkEntry(id, user.id);

    return NextResponse.json({
      id: confirmed.id,
      status: confirmed.status,
      quantity: confirmed.quantity.toString(),
      appliedUnitRate: confirmed.appliedUnitRate?.toString() ?? null,
      calculatedAmount: confirmed.calculatedAmount.toString(),
    });

  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    if (err.message.includes('nebyl nalezen')) {
      return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
    }
    if (err.message.includes('Neplatný přechod')) {
      return NextResponse.json({ error: 'Tento záznam práce nelze schválit v jeho aktuálním stavu.' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při schvalování záznamu.' }, { status: 500 });
  }
}
