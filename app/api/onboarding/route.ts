import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { deriveOnboardingProgress, type OnboardingStep } from '@/lib/organization-onboarding';
import { requireOrganizationRole } from '@/lib/organization';

const manuallyCompletableSteps = new Set<OnboardingStep>(['SETTINGS', 'INVENTORY', 'TEAM']);

export async function PATCH(request: Request) {
  try {
    const { organizationId } = await requireOrganizationRole('ADMIN');
    const body = await request.json().catch(() => null) as { step?: unknown } | null;
    const step = typeof body?.step === 'string' ? body.step as OnboardingStep : null;
    if (!step || !manuallyCompletableSteps.has(step)) {
      return NextResponse.json({ error: 'Tento krok nelze ručně dokončit.' }, { status: 400 });
    }

    const [organization, existing, activeOwnerCount, surfaceCount, activeMemberCount] = await Promise.all([
      platformPrisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true } }),
      platformPrisma.organizationOnboarding.findUnique({ where: { organizationId } }),
      platformPrisma.organizationMember.count({ where: { organizationId, role: 'OWNER', isActive: true, user: { status: 'ACTIVE' } } }),
      platformPrisma.advertisingSurface.count({ where: { organizationId } }),
      platformPrisma.organizationMember.count({ where: { organizationId, isActive: true, user: { status: 'ACTIVE' } } }),
    ]);
    if (!organization) return NextResponse.json({ error: 'Organizace nebyla nalezena.' }, { status: 404 });

    const now = new Date();
    const record = {
      companyCompletedAt: existing?.companyCompletedAt ?? now,
      ownerCompletedAt: existing?.ownerCompletedAt ?? (activeOwnerCount > 0 ? now : null),
      settingsCompletedAt: existing?.settingsCompletedAt ?? (step === 'SETTINGS' ? now : null),
      inventoryCompletedAt: existing?.inventoryCompletedAt ?? (surfaceCount > 0 || step === 'INVENTORY' ? now : null),
      teamCompletedAt: existing?.teamCompletedAt ?? (activeMemberCount > 1 || step === 'TEAM' ? now : null),
    };
    const progress = deriveOnboardingProgress(record, {
      hasCompany: Boolean(organization.name && organization.slug),
      hasActiveOwner: activeOwnerCount > 0,
      surfaceCount,
      activeMemberCount,
    });
    await platformPrisma.organizationOnboarding.upsert({
      where: { organizationId },
      create: { organizationId, ...record, currentStep: progress.currentStep, completedAt: progress.isCompleted ? now : null },
      update: { ...record, currentStep: progress.currentStep, completedAt: progress.isCompleted ? existing?.completedAt ?? now : null },
    });
    return NextResponse.json({ ok: true, progress });
  } catch {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
}
