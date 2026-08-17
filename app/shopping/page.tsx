import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { ShoppingListModule } from '@/components/shopping/ShoppingListModule';

export const dynamic = 'force-dynamic';

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess('team');
  const params = await searchParams;
  const category = (Array.isArray(params.category) ? params.category[0] : params.category) || 'ALL';

  return (
    <AppShell>
      <ShoppingListModule
        currentUserId={user.id}
        currentUserName={user.name}
        initialCategory={category}
      />
    </AppShell>
  );
}
