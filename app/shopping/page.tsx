import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { ShoppingListModule } from '@/components/shopping/ShoppingListModule';
import { canEditShoppingList } from '@/lib/rbac';

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
        currentEmployeeId={user.employee?.id}
        currentUserName={user.name}
        canEdit={canEditShoppingList(user.role)}
        initialCategory={category}
      />
    </AppShell>
  );
}
