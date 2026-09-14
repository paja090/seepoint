import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { getPipelineIntelligence } from '@/lib/ai-crm/crm-intelligence-service';
import { detectCrmDuplicates } from '@/lib/ai-crm/duplicate-detector';
import { CrmIntelligenceDashboardView } from '@/components/crm/CrmIntelligenceDashboardView';

export const dynamic = 'force-dynamic';

export default async function CrmIntelligencePage() {
  const user = await requirePageAccess('clients');

  const [pipeline, duplicates] = await Promise.all([
    getPipelineIntelligence(user.organizationId),
    detectCrmDuplicates(user.organizationId),
  ]);

  return (
    <AppShell>
      <CrmIntelligenceDashboardView
        initialAttentionItems={pipeline.attentionItems}
        duplicates={duplicates}
        totalAttentionValueCz={pipeline.totalAttentionValueCz}
      />
    </AppShell>
  );
}
