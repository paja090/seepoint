import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CreateOrganizationForm } from '@/components/CreateOrganizationForm';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { getCurrentUser } from '@/lib/auth';
import { platformPrisma } from '@/lib/db';
import { deriveOnboardingProgress } from '@/lib/organization-onboarding';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) notFound();
  const organizationRoles = new Set([user.membership?.role, ...(user.membership?.roles ?? [])]);
  const canManageOrganization = organizationRoles.has('OWNER') || organizationRoles.has('ADMIN');
  const canCreateOrganization = user.platformRole === 'SUPER_ADMIN';
  if (!canManageOrganization && !canCreateOrganization) notFound();

  const organizationId = canManageOrganization ? user.organizationId : null;
  const onboardingData = organizationId ? await Promise.all([
    platformPrisma.organizationOnboarding.findUnique({ where: { organizationId } }),
    platformPrisma.organizationMember.count({ where: { organizationId, role: 'OWNER', isActive: true, user: { status: 'ACTIVE' } } }),
    platformPrisma.advertisingSurface.count({ where: { organizationId } }),
    platformPrisma.organizationMember.count({ where: { organizationId, isActive: true, user: { status: 'ACTIVE' } } }),
  ]) : null;

  let checklist = null;
  if (onboardingData && user.organization) {
    const [record, activeOwnerCount, surfaceCount, activeMemberCount] = onboardingData;
    const normalizedRecord = record ?? {
      companyCompletedAt: null,
      ownerCompletedAt: null,
      settingsCompletedAt: null,
      inventoryCompletedAt: null,
      teamCompletedAt: null,
    };
    const progress = deriveOnboardingProgress(normalizedRecord, {
      hasCompany: Boolean(user.organization.name && user.organization.slug),
      hasActiveOwner: activeOwnerCount > 0,
      surfaceCount,
      activeMemberCount,
    });
    checklist = <OnboardingChecklist activeMemberCount={activeMemberCount} organizationName={user.organization.name} progress={progress} surfaceCount={surfaceCount} />;
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Onboarding agentury</h1>
        <p className="mt-2 text-slate-600">Průběh se ukládá k aktivní organizaci a lze se k němu kdykoliv vrátit.</p>
      </div>
      {checklist}
      {canCreateOrganization ? (
        <section className={checklist ? 'mt-8' : undefined}>
          <div className="mb-4"><h2 className="text-2xl font-bold">Založit novou organizaci</h2><p className="mt-1 text-sm text-slate-600">Pouze platformní SUPER_ADMIN. OWNER obdrží bezpečnou aktivační pozvánku.</p></div>
          <CreateOrganizationForm />
        </section>
      ) : null}
    </AppShell>
  );
}
