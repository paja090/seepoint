import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { MobilePhotoFieldAppView } from '@/components/navigation/MobilePhotoFieldAppView';

export const dynamic = 'force-dynamic';

export default async function MobilePhotosPage() {
  await requirePageAccess('navigationProjects');

  return (
    <AppShell>
      <MobilePhotoFieldAppView />
    </AppShell>
  );
}
