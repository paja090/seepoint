import { hasModuleAccess } from '../module-policy';
import { canAccess } from '../rbac';
import type { AcademyActor } from './policy';
type SharedActor = AcademyActor & { platformRole?: string | null; membership?: (NonNullable<AcademyActor['membership']> & { role?: string; roles?: string[] }) | null };

// Shared curated material; tenant-authored content keeps its separate feature flag.
export function canReviewAcademy(actor: AcademyActor | null) {
  return Boolean(actor && canAccess(actor.role, 'academy') && actor.organizationId
    && actor.organization?.isActive && actor.membership?.isActive
    && actor.organization.id === actor.organizationId
    && actor.membership.organizationId === actor.organizationId);
}
export function canReadSharedLesson(actor: SharedActor | null, capability: string) {
  if (!canReviewAcademy(actor)) return false;
  if (capability === 'platformAdmin') return actor?.platformRole === 'SUPER_ADMIN';
  if (capability === 'organizationAdmin') return actor?.membership?.role === 'OWNER' || actor?.membership?.role === 'ADMIN' || Boolean(actor?.membership?.roles?.includes('ADMIN'));
  if (capability === 'employees') return (actor?.role === 'ADMIN' || actor?.role === 'MANAGER') && hasModuleAccess(actor, 'employees', 'employees');
  if (capability === 'offers') return hasModuleAccess(actor, 'offers', 'offers');
  if (capability === 'crm') return hasModuleAccess(actor, 'crm', 'clients');
  return false;
}
export function canReadSharedMedia(actor: SharedActor | null, file: string, lessons: readonly {
  capability: string; steps: readonly { blocks: readonly { file?: string }[] }[];
}[]) {
  return lessons.some(lesson => canReadSharedLesson(actor, lesson.capability)
    && lesson.steps.some(step => step.blocks.some(block => block.file === file)));
}
