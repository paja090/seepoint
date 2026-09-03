import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  const { id } = await params;
  return NextResponse.redirect(new URL(`/api/photos/${encodeURIComponent(id)}/file`, request.url), 307);
}
