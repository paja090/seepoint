import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { uploadFieldPhoto } from '@/lib/election-removal/photo-upload';
export async function POST(req: Request) {
  const auth = await requireElectionRemovalAccess(); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  try { return NextResponse.json(await uploadFieldPhoto(await req.formData(), auth.user)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Nahrání selhalo.' }, { status: 409 }); }
}
