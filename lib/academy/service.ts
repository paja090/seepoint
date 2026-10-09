import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { runWithTenantContext } from '../tenant-context';
import { academyPilots, parseAcademyContent } from './content';
import { canManageAcademy, canReadAcademy, canReadRevision, isLessonCapability, lessonCapabilities, matchesAcademySearch, parseAcademyFeedback, type AcademyActor } from './policy';

function scope<T>(actor: AcademyActor, work: () => Promise<T>) {
  if (!canReadAcademy(actor) || !actor.organizationId) throw new Error('ACADEMY_FORBIDDEN');
  return runWithTenantContext({ organizationId: actor.organizationId, userId: actor.id, source: 'session' }, work);
}
export function isAcademySchemaMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2021' || error.code === 'P2022');
}

export async function getAcademyCatalog(actor: AcademyActor, options: { preview?: boolean; query?: string } = {}) {
  return scope(actor, async () => {
    const preview = Boolean(options.preview && canManageAcademy(actor));
    const lessons = await prisma.academyLesson.findMany({
      where: { organizationId: actor.organizationId!, archivedAt: null },
      include: { category: true, revisions: { where: { archivedAt: null, ...(preview ? {} : { status: 'PUBLISHED', verifiedAt: { not: null }, publishedAt: { not: null } }) }, orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { slug: 'asc' },
    });
    // Filter before serializing/searching: no unauthorized titles, counts or snippets.
    return lessons.flatMap(lesson => {
      const revision = lesson.revisions[0];
      if (!revision || !canReadRevision(actor, revision, preview)) return [];
      if (!matchesAcademySearch(`${revision.title} ${revision.summary} ${lesson.category.title}`, options.query || '')) return [];
      return [{ slug: lesson.slug, title: revision.title, summary: revision.summary, category: lesson.category.title, durationMinutes: revision.durationMinutes, status: revision.status, version: revision.version }];
    });
  });
}

export async function getAcademyLesson(actor: AcademyActor, slug: string, preview = false) {
  return scope(actor, async () => {
    const lesson = await prisma.academyLesson.findFirst({
      where: { organizationId: actor.organizationId!, slug, archivedAt: null },
      include: { category: true, revisions: { where: { archivedAt: null, ...(preview && canManageAcademy(actor) ? {} : { status: 'PUBLISHED', verifiedAt: { not: null }, publishedAt: { not: null } }) }, orderBy: { version: 'desc' }, take: 1 } },
    });
    const revision = lesson?.revisions[0];
    if (!lesson || !revision || !canReadRevision(actor, revision, preview) || !isLessonCapability(revision.capability)) return null;
    return { id: revision.id, title: revision.title, summary: revision.summary, category: lesson.category.title, status: revision.status, version: revision.version, durationMinutes: revision.durationMinutes, verifiedAt: revision.verifiedAt?.toISOString() ?? null, moduleRoute: lessonCapabilities[revision.capability].route, content: parseAcademyContent(revision.content) };
  });
}

export async function bootstrapAcademyPilots(actor: AcademyActor) {
  if (!canManageAcademy(actor)) throw new Error('ACADEMY_FORBIDDEN');
  return scope(actor, () => prisma.$transaction(async tx => {
    for (const pilot of academyPilots) {
      const organizationId = actor.organizationId!;
      const category = await tx.academyCategory.upsert({ where: { organizationId_slug: { organizationId, slug: pilot.category.slug } }, create: { organizationId, ...pilot.category }, update: {} });
      const lesson = await tx.academyLesson.upsert({ where: { organizationId_slug: { organizationId, slug: pilot.slug } }, create: { organizationId, categoryId: category.id, slug: pilot.slug }, update: {} });
      const content = JSON.parse(JSON.stringify(pilot.content)) as Prisma.InputJsonValue;
      await tx.academyLessonRevision.upsert({
        where: { organizationId_lessonId_version: { organizationId, lessonId: lesson.id, version: 1 } }, update: {},
        create: { organizationId, lessonId: lesson.id, version: 1, title: pilot.title, summary: pilot.summary, capability: pilot.capability, durationMinutes: pilot.durationMinutes, status: 'MEDIA_PENDING', content, contentHash: createHash('sha256').update(JSON.stringify(content)).digest('hex'), sourceCommit: 'fd4aa3092d64aea7717946f85e80ee1c40180771' },
      });
    }
    return { count: academyPilots.length };
  }));
}

export async function createAcademyFeedback(actor: AcademyActor, raw: unknown) {
  const input = parseAcademyFeedback(raw);
  return scope(actor, () => prisma.$transaction(async tx => {
    const revision = await tx.academyLessonRevision.findFirst({ where: { id: input.revisionId, organizationId: actor.organizationId!, lesson: { archivedAt: null } } });
    // Editors can report a draft; ordinary users can only reference a published revision.
    if (!revision || !canReadRevision(actor, revision, canManageAcademy(actor))) return null;
    const content = parseAcademyContent(revision.content);
    if (input.stepId && !content.steps.some(step => step.id === input.stepId)) throw new Error('Krok v této revizi neexistuje.');
    return tx.academyFeedback.create({ data: { ...input, organizationId: actor.organizationId!, reporterUserId: actor.id }, select: { id: true } });
  }));
}

export async function getAcademyFeedback(actor: AcademyActor) {
  if (!canManageAcademy(actor)) throw new Error('ACADEMY_FORBIDDEN');
  return scope(actor, () => prisma.academyFeedback.findMany({ where: { organizationId: actor.organizationId! }, select: { id: true, category: true, message: true, stepId: true, createdAt: true, resolvedAt: true, revision: { select: { title: true, version: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }));
}
