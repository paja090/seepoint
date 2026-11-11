import { AppShell } from '@/components/AppShell';
import { DailyBriefingSettingsCard } from '@/components/settings/DailyBriefingSettingsCard';
import { WorkCategoriesSettings } from '@/components/settings/WorkCategoriesSettings';
import { requirePageAccess } from '@/lib/page-auth';
import Link from 'next/link';

export default async function WorkSettingsPage() {
  const user = await requirePageAccess('settings');

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/settings" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">
          ← Zpět do Nastavení
        </Link>
      </div>
      <div className="space-y-8">
        <DailyBriefingSettingsCard currentUserEmail={user.email ?? undefined} />
        <WorkCategoriesSettings />
      </div>
    </AppShell>
  );
}
