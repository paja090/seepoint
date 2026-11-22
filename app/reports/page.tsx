import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import {
  buildCompanyExecutiveReport,
  normalizeReportPeriod,
} from '@/lib/reports/company-report';
import { CompanyReportClient } from '@/components/reports/CompanyReportClient';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CompanyReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageAccess('clients', 'analytics');
  const params = await searchParams;
  const rawPeriod = Array.isArray(params.period) ? params.period[0] : params.period;
  const period = normalizeReportPeriod(rawPeriod);

  const report = await buildCompanyExecutiveReport(user.organizationId, { period });

  return (
    <AppShell>
      <CompanyReportClient report={report} />
    </AppShell>
  );
}
