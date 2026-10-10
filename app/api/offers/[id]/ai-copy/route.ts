import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { applyAiCopy } from '@/lib/offers/ai-copywriter';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('offers');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const result = await applyAiCopy(user, id);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return offerErrorResponse(error, 'Generování AI textů nabídky selhalo');
  }
}
