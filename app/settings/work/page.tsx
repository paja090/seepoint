import { AppShell } from '@/components/AppShell';
import { WorkCategoriesSettings } from '@/components/settings/WorkCategoriesSettings';
import { requirePageAccess } from '@/lib/page-auth';
import Link from 'next/link';

export default async function WorkSettingsPage() {
  await requirePageAccess('settings');

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/settings" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">
          ← Zpět do Nastavení
        </Link>
      </div>
      <WorkCategoriesSettings />
    </AppShell>
  );
}
