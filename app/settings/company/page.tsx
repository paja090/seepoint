import { AppShell } from '@/components/AppShell';
import { CompanySettingsForm } from '@/components/CompanySettingsForm';
import { platformPrisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';
import { notFound } from 'next/navigation';

export default async function CompanySettingsPage() {
  const { organizationId } = await requireOrganizationRole('ADMIN');
  const organization = await platformPrisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) notFound();
  return <AppShell><div className="mb-6"><h1 className="text-3xl font-bold">Nastavení firmy</h1><p className="mt-2 text-slate-600">Fakturační údaje a základ budoucího brandingu veřejných dokumentů.</p></div><CompanySettingsForm organization={Object.fromEntries(Object.entries(organization).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])) as Record<string, string | null>} /></AppShell>;
}
