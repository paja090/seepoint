import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { fetchClientLogoAsset } from '@/lib/client-logo';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  const client = await prisma.client.findUnique({
    where: { id: (await params).id },
    select: {
      id: true,
      organizationId: true,
      name: true,
      normalizedName: true,
      companyId: true,
      logoDriveFileId: true,
      logoFileName: true,
      logoMimeType: true,
      website: true,
      email: true,
    },
  });
  if (!client) return NextResponse.json({ error: 'Logo nebylo nalezeno.' }, { status: 404 });
  const asset = await fetchClientLogoAsset(client);
  if (!asset) return NextResponse.json({ error: 'Logo nebylo nalezeno.' }, { status: 404 });
  return new Response(new Uint8Array(asset.buffer), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
