import { hasModuleAccess } from '../module-policy';
import { canAccess } from '../rbac';
import type { AcademyActor } from './policy';

// Shared curated material; tenant-authored content keeps its separate feature flag.
export function canReviewAcademy(actor: AcademyActor | null) {
  return Boolean(actor && canAccess(actor.role, 'academy') && actor.organizationId
    && actor.organization?.isActive && actor.membership?.isActive
    && actor.organization.id === actor.organizationId
    && actor.membership.organizationId === actor.organizationId);
}
export function canReadSharedLesson(actor: AcademyActor | null, capability: string) {
  if (!canReviewAcademy(actor)) return false;
  if (capability === 'offers') return hasModuleAccess(actor, 'offers', 'offers');
  if (capability === 'crm') return hasModuleAccess(actor, 'crm', 'clients');
  return false;
}
export function canReadSharedMedia(actor: AcademyActor | null, file: string, lessons: readonly {
  capability: string; steps: readonly { blocks: readonly { file?: string }[] }[];
}[]) {
  return lessons.some(lesson => canReadSharedLesson(actor, lesson.capability)
    && lesson.steps.some(step => step.blocks.some(block => block.file === file)));
}
