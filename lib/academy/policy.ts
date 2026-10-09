import { canAccess, roles, type AppSection } from '../rbac';
import { hasModuleAccess } from '../module-policy';

export type AcademyActor = NonNullable<Parameters<typeof hasModuleAccess>[0]> & { id: string };
export const academyStatuses = ['PLANNED', 'VERIFIED', 'MEDIA_PENDING', 'READY', 'PUBLISHED', 'OUTDATED'] as const;
export type AcademyStatus = typeof academyStatuses[number];
export const statusLabels: Record<AcademyStatus, string> = {
  PLANNED: 'Připravujeme', VERIFIED: 'Ověřeno', MEDIA_PENDING: 'Čeká na vizuály', READY: 'Připraveno k publikaci', PUBLISHED: 'Publikováno', OUTDATED: 'Vyžaduje revizi',
};

// The keys are capabilities, not arbitrary routes or client supplied role names.
export const lessonCapabilities = {
  basics: { section: null, module: null, roles: [...roles], route: '/profile' },
  fieldPhoto: { section: 'navigationProjects', module: 'navigation', roles: ['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN', 'WORKER'], route: '/mobile-photos' },
  navigationSelection: { section: 'offers', module: 'offers', roles: ['ADMIN', 'MANAGER', 'SALES'], route: '/offers' },
  navigationHandoff: { section: 'offers', module: 'offers', roles: ['ADMIN', 'MANAGER'], route: '/offers' },
  fieldSurvey: { section: 'fieldSurvey', module: 'carriers', roles: ['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN', 'WORKER'], route: '/field-survey' },
} satisfies Record<string, { section: AppSection | null; module: string | null; roles: readonly string[]; route: string }>;
export type LessonCapability = keyof typeof lessonCapabilities;
export function isLessonCapability(value: string): value is LessonCapability { return Object.hasOwn(lessonCapabilities, value); }
export function canReadAcademy(actor: AcademyActor) { return hasModuleAccess(actor, 'academy', 'academy'); }
export function canManageAcademy(actor: AcademyActor) { return actor.role === 'ADMIN' && canReadAcademy(actor); }
export function canUseLesson(actor: AcademyActor, capability: string): boolean {
  if (!canReadAcademy(actor) || !isLessonCapability(capability)) return false;
  const rule = lessonCapabilities[capability];
  if (!(rule.roles as readonly string[]).includes(actor.role)) return false;
  if (capability === 'fieldPhoto') return hasModuleAccess(actor, 'navigation', 'navigationProjects') || hasModuleAccess(actor, 'carriers', 'carriers');
  return rule.section === null || (canAccess(actor.role, rule.section) && hasModuleAccess(actor, rule.module!, rule.section));
}
export function canReadRevision(actor: AcademyActor, revision: { organizationId: string; capability: string; status: string; verifiedAt: Date | null; publishedAt: Date | null; archivedAt: Date | null }, preview = false) {
  if (revision.organizationId !== actor.organizationId || revision.archivedAt || !canUseLesson(actor, revision.capability)) return false;
  if (preview && canManageAcademy(actor)) return true;
  return revision.status === 'PUBLISHED' && Boolean(revision.verifiedAt && revision.publishedAt);
}
export function normalizeAcademySearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs').trim().slice(0, 160); }
export function matchesAcademySearch(text: string, query: string) { const haystack = normalizeAcademySearch(text); return normalizeAcademySearch(query).split(/\s+/).filter(Boolean).every(word => haystack.includes(word)); }

export const feedbackCategories = ['UNCLEAR', 'WRONG_UI', 'BROKEN', 'ACCESS', 'OUTDATED'] as const;
export type FeedbackCategory = typeof feedbackCategories[number];
export function parseAcademyFeedback(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new Error('Vyplňte podnět.');
  const input = raw as Record<string, unknown>;
  if (typeof input.revisionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.revisionId)) throw new Error('Neplatná lekce.');
  if (!feedbackCategories.includes(input.category as FeedbackCategory)) throw new Error('Vyberte důvod hlášení.');
  if (typeof input.message !== 'string' || input.message.trim().length < 5 || input.message.trim().length > 2000) throw new Error('Popište problém v rozsahu 5 až 2000 znaků.');
  if (input.stepId != null && (typeof input.stepId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.stepId))) throw new Error('Neplatný krok.');
  return { revisionId: input.revisionId, category: input.category as FeedbackCategory, message: input.message.trim(), stepId: (input.stepId as string | undefined) || null };
}
