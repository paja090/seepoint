import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import {
  buildCompanyExecutiveReport,
  formatCompanyReportCsv,
  normalizeReportPeriod,
} from '@/lib/reports/company-report';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireApiAccess('clients', 'analytics');
  if (isApiDenied(auth)) return auth;

  try {
    const url = new URL(request.url);
    const period = normalizeReportPeriod(url.searchParams.get('period'));
    const format = (url.searchParams.get('format') || 'json').toLowerCase();

    const report = await buildCompanyExecutiveReport(auth.organizationId, { period });

    if (format === 'csv') {
      const csv = formatCompanyReportCsv(report);
      const fileName = `seepoint-firemni-report-${period}-${report.period.dateToIso}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('[api/reports/company] Failed to generate company report:', error);
    return NextResponse.json(
      { error: 'Firemní report se nepodařilo sestavit.' },
      { status: 500 }
    );
  }
}
