import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashToken } from '@/lib/navigation-documentation';
import { downloadPhotoFromGoogleDrive } from '@/lib/google-drive';
import { enterPublicNavigationReportTenant } from '@/lib/public-tenant';
import { runWithTenantContext } from '@/lib/tenant-context';
import { isPublicNavigationReportStatus } from '@/lib/navigation-documentation-policy';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Neplatný přístupový odkaz.' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const owner = await enterPublicNavigationReportTenant(tokenHash);
    if (!owner) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    const report = await runWithTenantContext({ organizationId: owner.organizationId, source: 'public-token' }, () => prisma.navigationDocumentationReport.findUnique({
      where: { publicTokenHash: tokenHash },
      select: {
        status: true,
        tokenExpiresAt: true,
        client: {
          select: {
            logoDriveFileId: true,
            logoFileName: true,
            logoMimeType: true,
          },
        },
      },
    }));

    if (!report || !isPublicNavigationReportStatus(report.status)) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    if (!report.tokenExpiresAt || new Date() > report.tokenExpiresAt) {
      return NextResponse.json({ error: 'Platnost odkazu vypršela.' }, { status: 410 });
    }

    if (!report.client?.logoDriveFileId) {
      return NextResponse.json({ error: 'Logo klienta nebylo nalezeno.' }, { status: 404 });
    }

    const file = await downloadPhotoFromGoogleDrive(report.client.logoDriveFileId);
    if (!file.ok || !file.body) {
      return NextResponse.json({ error: 'Logo se nepodařilo načíst.' }, { status: 502 });
    }

    return new Response(file.body, {
      status: 200,
      headers: {
        'Content-Type': report.client.logoMimeType ?? file.headers.get('Content-Type') ?? 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Logo se nepodařilo načíst.' }, { status: 500 });
  }
}
