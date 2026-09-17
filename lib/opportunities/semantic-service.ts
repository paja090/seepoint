import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import type { Prisma, SalesOpportunity } from '@prisma/client';
import type { CreateOpportunityInput } from './types';
import { persistOpportunity } from './service';
import { OpportunityValidationError } from './policy';
import { candidateScore, combineSources, factsFromInput, semanticConfig, semanticKeys, signals, type Facts, type Resolution } from './semantic-core';
import { resolveOpportunity } from './semantic-resolver';

type DB = Prisma.TransactionClient;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const opportunityFacts = (o: SalesOpportunity) => factsFromInput({ ...o, semanticData: o.semanticData });

// Per-tenant serialization protects same-URL AND simultaneous different-URL discovery.
// No external work is performed until a duplicate URL has been ruled out.
export async function withRadarTransaction<T>(organizationId: string, fn: (db: DB) => Promise<T>) {
  return prisma.$transaction(async db => {
    // PostgreSQL keeps the profile row's write lock until commit. All ingest/review
    // paths take the same tenant-unique row lock before reading sources/candidates.
    await db.organizationRadarProfile.upsert({ where: { organizationId }, create: { organizationId }, update: { updatedAt: new Date() } });
    return fn(db);
  }, { timeout: 25000, maxWait: 5000 });
}

export async function findCandidates(db: DB, organizationId: string, facts: Facts, excludeIds: string[] = []) {
  const keys = semanticKeys(facts);
  // Each branch has a tenant-prefixed B-tree index and a bounded result set.
  const branches: Prisma.SalesOpportunityWhereInput[] = [];
  if (keys.tenderIdentifier) branches.push({ tenderIdentifier: keys.tenderIdentifier });
  if (keys.projectIdentifier) branches.push({ projectIdentifier: keys.projectIdentifier });
  if (keys.normalizedProject) branches.push({ normalizedProject: keys.normalizedProject });
  if (keys.normalizedCompany) branches.push({ normalizedCompany: keys.normalizedCompany, ...(keys.normalizedCity ? { OR: [{ normalizedCity: keys.normalizedCity }, { normalizedCity: null }] } : {}) });
  if (keys.normalizedCity) branches.push({ normalizedCity: keys.normalizedCity });
  const pool = new Map<string, SalesOpportunity>();
  for (const branch of branches) {
    const rows = await db.salesOpportunity.findMany({ where: { organizationId, mergedIntoId: null, id: { notIn: excludeIds }, ...branch }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 20 });
    rows.forEach(row => pool.set(row.id, row));
  }
  return [...pool.values()].map(row => ({ id: row.id, facts: opportunityFacts(row) }))
    .filter(c => signals(facts, c.facts).matched.some(k => !k.startsWith('source') && !['country', 'region', 'opportunityType', 'category'].includes(k)))
    .sort((a, b) => candidateScore(facts, b.facts) - candidateScore(facts, a.facts) || a.id.localeCompare(b.id)).slice(0, semanticConfig().candidateLimit);
}

async function auditResolution(db: DB, organizationId: string, sourceId: string, candidates: unknown, resolution: Resolution | Record<string, unknown>, actorUserId?: string, action = 'RESOLVE') {
  const decision = resolution.decision;
  await db.radarRun.create({ data: { organizationId, triggerType: actorUserId ? 'SEMANTIC_MANUAL' : 'SEMANTIC', status: 'COMPLETED', finishedAt: new Date(), signalsProcessed: action === 'RESOLVE' ? 1 : 0,
    opportunitiesCreated: decision === 'NEW_OPPORTUNITY' ? 1 : 0, duplicatesCount: decision === 'SAME_OPPORTUNITY' || action === 'STAGE1' ? 1 : 0,
    summaryLog: json({ action, sourceId, candidates, ...resolution, actorUserId: actorUserId || null, automatic: !actorUserId, date: new Date().toISOString(), metrics: {
      analyzedSources: action === 'RESOLVE' ? 1 : 0, stage1Duplicate: action === 'STAGE1' ? 1 : 0, automaticMerge: action === 'RESOLVE' && !actorUserId && decision === 'SAME_OPPORTUNITY' ? 1 : 0,
      possibleDuplicate: decision === 'POSSIBLE_DUPLICATE' ? 1 : 0, newOpportunity: decision === 'NEW_OPPORTUNITY' ? 1 : 0, manualOverrides: actorUserId && ['MERGE', 'KEEP_SEPARATE', 'DETACH'].includes(action) ? 1 : 0,
      confidenceSum: typeof resolution.confidence === 'number' ? resolution.confidence : 0, confidenceCount: typeof resolution.confidence === 'number' ? 1 : 0,
    } }),
  } });
}

export async function rebuildOpportunity(db: DB, organizationId: string, id: string) {
  const sources = await db.radarSignal.findMany({ where: { organizationId, canonicalOpportunityId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  if (!sources.length) return;
  const combined = combineSources(sources.map(s => ({ id: s.id, facts: factsFromInput(asObject(s.parsedData)) })));
  // Existing non-empty source facts win; contradictions remain visible with provenance.
  await db.salesOpportunity.update({ where: { id, organizationId }, data: {
    semanticData: json(combined.facts), fieldProvenance: json(combined.provenance), dataConflicts: json(combined.conflicts), ...semanticKeys(combined.facts),
    city: combined.facts.city || null, region: combined.facts.region || null, address: combined.facts.address || null,
    sourceUrl: sources[0].sourceUrl, sourceTitle: sources[0].sourceTitle, sourcePublishedAt: sources[0].sourcePublishedAt, radarSignalId: sources[0].id,
  } });
}

export async function ingestOpportunity(input: CreateOpportunityInput, organizationId: string, deadline: number) {
  return withRadarTransaction(organizationId, async db => {
    // Internal manual entries have no article identity; each submission receives its own source URI.
    const internal = !input.sourceUrl || /^https?:\/\/radar\.internal\/?$/.test(input.sourceUrl) || /^https?:\/\/seepoint\.cz\/?$/.test(input.sourceUrl);
    const sourceUrl = internal ? `https://radar.internal/manual/${randomUUID()}` : input.sourceUrl.trim();
    const hinted = input.radarSignalId ? await db.radarSignal.findFirst({ where: { organizationId, id: input.radarSignalId } }) : null;
    if (input.radarSignalId && !hinted) throw new OpportunityValidationError('Signál nebyl nalezen.', 404);
    const existing = hinted || await db.radarSignal.findUnique({ where: { organizationId_sourceUrl: { organizationId, sourceUrl } } });
    if (existing?.canonicalOpportunityId) {
      await auditResolution(db, organizationId, existing.id, [], { decision: 'STAGE1_DUPLICATE', canonicalOpportunityId: existing.canonicalOpportunityId }, undefined, 'STAGE1');
      return { created: false, stage: 'STAGE1', duplicateId: existing.canonicalOpportunityId, opportunity: await db.salesOpportunity.findFirst({ where: { organizationId, id: existing.canonicalOpportunityId } }) };
    }
    const actualUrl = existing?.sourceUrl || sourceUrl;
    const normalizedInput = { ...input, sourceUrl: actualUrl };
    const facts = factsFromInput(normalizedInput);
    const source = existing || await db.radarSignal.create({ data: { organizationId, sourceUrl: actualUrl, sourceTitle: input.sourceTitle, sourcePublishedAt: input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : null, rawText: input.summary } });
    await db.radarSignal.update({ where: { id: source.id, organizationId }, data: { parsedData: json({ ...normalizedInput, semanticData: facts }), sourceDomain: facts.sourceDomain } });
    const legacy = await db.salesOpportunity.findFirst({ where: { organizationId, sourceUrl: actualUrl, mergedIntoId: null }, orderBy: { createdAt: 'asc' } });
    const candidates = legacy ? [] : await findCandidates(db, organizationId, facts, source.keptSeparateIds);
    // Keep-separate decisions on another source of a strongly identified project apply to new articles too.
    const strongIds = candidates.filter(c => signals(facts, c.facts).anchor && !signals(facts, c.facts).conflicts.length).map(c => c.id);
    const exclusions = strongIds.length ? await db.radarSignal.findMany({ where: { organizationId, canonicalOpportunityId: { in: strongIds }, NOT: { keptSeparateIds: { isEmpty: true } } }, select: { keptSeparateIds: true }, take: 100 }) : [];
    const blocked = new Set(exclusions.flatMap(s => s.keptSeparateIds));
    const allowedCandidates = candidates.filter(c => !blocked.has(c.id));
    let resolution: Resolution;
    try {
      resolution = legacy ? { decision: 'SAME_OPPORTUNITY', canonicalOpportunityId: legacy.id, confidence: 1, reason: 'Stage 1: existující přesná URL.', matchedSignals: ['sourceUrl'], conflictingSignals: [] }
        : candidates.length && !allowedCandidates.length ? { decision: 'POSSIBLE_DUPLICATE', canonicalOpportunityId: candidates[0].id, confidence: 0, reason: 'Zdroj odpovídá příležitostem, které uživatel ponechal oddělené. Je nutná ruční kontrola.', matchedSignals: [], conflictingSignals: ['manualSeparation'] }
        : await resolveOpportunity(facts, allowedCandidates, organizationId, deadline);
    } catch (error) {
      // Provider failure must neither lose an article nor silently merge it.
      if (!allowedCandidates.length) throw error;
      resolution = { decision: 'POSSIBLE_DUPLICATE', canonicalOpportunityId: allowedCandidates[0].id, confidence: 0, reason: 'AI porovnání nebylo dokončeno; je nutná ruční kontrola.', matchedSignals: [], conflictingSignals: ['resolverUnavailable'] };
    }
    let opportunityId = resolution.canonicalOpportunityId;
    const created = resolution.decision !== 'SAME_OPPORTUNITY';
    if (created) opportunityId = (await persistOpportunity({ ...normalizedInput, radarSignalId: source.id, semanticData: facts }, organizationId, db)).opportunity.id;
    if (!opportunityId) throw new Error('Chybí kanonická příležitost.');
    await db.radarSignal.update({ where: { id: source.id, organizationId }, data: { canonicalOpportunityId: opportunityId, discoveredOpportunityId: opportunityId, status: 'PROCESSED', semanticDecision: resolution.decision,
      semanticConfidence: resolution.confidence, candidateOpportunityId: resolution.decision === 'POSSIBLE_DUPLICATE' ? resolution.canonicalOpportunityId : null, resolution: json(resolution) } });
    await rebuildOpportunity(db, organizationId, opportunityId);
    await auditResolution(db, organizationId, source.id, candidates, resolution, undefined, legacy ? 'STAGE1' : 'RESOLVE');
    return { created, stage: resolution.decision, duplicateId: created ? undefined : opportunityId, opportunity: await db.salesOpportunity.findFirstOrThrow({ where: { organizationId, id: opportunityId } }) };
  });
}

export async function reviewSource(organizationId: string, userId: string, sourceId: string, action: 'MERGE' | 'KEEP_SEPARATE' | 'DETACH') {
  return withRadarTransaction(organizationId, async db => {
    const source = await db.radarSignal.findFirst({ where: { id: sourceId, organizationId } });
    if (!source?.canonicalOpportunityId) throw new OpportunityValidationError('Zdroj nebyl nalezen.', 404);
    const currentId = source.canonicalOpportunityId;
    const current = await db.salesOpportunity.findFirstOrThrow({ where: { organizationId, id: currentId, mergedIntoId: null } });
    const targetId = source.candidateOpportunityId;
    if (action !== 'DETACH' && (!targetId || source.semanticDecision !== 'POSSIBLE_DUPLICATE')) throw new OpportunityValidationError('Návrh již není aktuální.', 409);
    if (action === 'KEEP_SEPARATE') {
      const target = await db.salesOpportunity.findFirst({ where: { organizationId, id: targetId!, mergedIntoId: null } });
      if (!target) throw new OpportunityValidationError('Kandidát již není aktuální.', 409);
      await db.radarSignal.update({ where: { id: sourceId, organizationId }, data: { semanticDecision: 'KEEP_SEPARATE', candidateOpportunityId: null, keptSeparateIds: { push: target.id } } });
      const opposite = await db.radarSignal.findFirst({ where: { organizationId, canonicalOpportunityId: target.id }, orderBy: { createdAt: 'asc' } });
      if (opposite) await db.radarSignal.update({ where: { organizationId, id: opposite.id }, data: { keptSeparateIds: { push: currentId } } });
      // Resolve a reciprocal historical proposal as well; it must not undo the override.
      await db.radarSignal.updateMany({ where: { organizationId, canonicalOpportunityId: target.id, candidateOpportunityId: currentId, semanticDecision: 'POSSIBLE_DUPLICATE' }, data: { candidateOpportunityId: null, semanticDecision: 'KEEP_SEPARATE' } });
    } else if (action === 'MERGE') {
      const target = await db.salesOpportunity.findFirst({ where: { organizationId, id: targetId!, mergedIntoId: null } });
      if (!target || target.id === currentId) throw new OpportunityValidationError('Kandidát již není aktuální.', 409);
      const sources = await db.radarSignal.findMany({ where: { organizationId, canonicalOpportunityId: currentId } });
      for (const s of sources) await db.radarSignal.update({ where: { organizationId, id: s.id }, data: { canonicalOpportunityId: target.id, discoveredOpportunityId: target.id, candidateOpportunityId: null, semanticDecision: 'SAME_OPPORTUNITY', resolution: json({ ...asObject(s.resolution), previousOpportunityId: asObject(s.resolution).previousOpportunityId || currentId, manual: true, actorUserId: userId }) } });
      // Preserve original Opportunity, CRM/offer relationships and all source rows.
      await db.salesOpportunity.update({ where: { organizationId, id: currentId }, data: { mergedIntoId: target.id } });
      await db.salesOpportunity.updateMany({ where: { organizationId, mergedIntoId: currentId }, data: { mergedIntoId: target.id } });
      const referring = await db.radarSignal.findMany({ where: { organizationId, candidateOpportunityId: currentId, semanticDecision: 'POSSIBLE_DUPLICATE' } });
      for (const reference of referring) await db.radarSignal.update({ where: { organizationId, id: reference.id }, data: reference.canonicalOpportunityId === target.id
        ? { candidateOpportunityId: null, semanticDecision: 'SAME_OPPORTUNITY' }
        : { candidateOpportunityId: target.id } });
      await rebuildOpportunity(db, organizationId, target.id);
    } else {
      if (await db.radarSignal.count({ where: { organizationId, canonicalOpportunityId: currentId } }) < 2) throw new OpportunityValidationError('Jediný zdroj nelze oddělit.', 409);
      const previousId = asObject(source.resolution).previousOpportunityId;
      const previous = typeof previousId === 'string' ? await db.salesOpportunity.findFirst({ where: { organizationId, id: previousId, mergedIntoId: currentId, sources: { none: {} } } }) : null;
      const detached = previous || (await persistOpportunity({ ...asObject(source.parsedData), sourceUrl: source.sourceUrl, sourceTitle: source.sourceTitle, radarSignalId: source.id } as CreateOpportunityInput, organizationId, db)).opportunity;
      if (previous) await db.salesOpportunity.update({ where: { organizationId, id: previous.id }, data: { mergedIntoId: null } });
      await db.radarSignal.update({ where: { organizationId, id: source.id }, data: { canonicalOpportunityId: detached.id, discoveredOpportunityId: detached.id, candidateOpportunityId: null, semanticDecision: 'KEEP_SEPARATE', keptSeparateIds: { push: currentId } } });
      const opposite = await db.radarSignal.findFirst({ where: { organizationId, canonicalOpportunityId: currentId } });
      if (opposite) await db.radarSignal.update({ where: { organizationId, id: opposite.id }, data: { keptSeparateIds: { push: detached.id } } });
      await rebuildOpportunity(db, organizationId, currentId);
      await rebuildOpportunity(db, organizationId, detached.id);
    }
    await auditResolution(db, organizationId, source.id, [targetId], { decision: action, previousOpportunityId: current.id, originalResolution: source.resolution }, userId, action);
    return { ok: true };
  });
}

/** Bounded, resumable historical preview. Never automatically merges old Opportunities. */
export async function backfillSemanticPreview(organizationId: string, userId: string, cursor?: string) {
  const page = await prisma.salesOpportunity.findMany({ where: { organizationId, mergedIntoId: null, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 20 });
  let proposals = 0;
  for (const opportunity of page) await withRadarTransaction(organizationId, async db => {
    const facts = opportunityFacts(opportunity);
    await db.salesOpportunity.update({ where: { organizationId, id: opportunity.id }, data: { ...semanticKeys(facts), semanticData: json(facts) } });
    const source = await db.radarSignal.upsert({ where: { organizationId_sourceUrl: { organizationId, sourceUrl: opportunity.sourceUrl } }, update: {}, create: { organizationId, sourceUrl: opportunity.sourceUrl, sourceTitle: opportunity.sourceTitle, sourcePublishedAt: opportunity.sourcePublishedAt, parsedData: json({ ...opportunity, semanticData: facts }), canonicalOpportunityId: opportunity.id, discoveredOpportunityId: opportunity.id, status: 'PROCESSED' } });
    if (!source.canonicalOpportunityId) await db.radarSignal.update({ where: { id: source.id, organizationId }, data: { canonicalOpportunityId: opportunity.id, parsedData: json({ ...opportunity, semanticData: facts }) } });
    if (source.semanticDecision === 'KEEP_SEPARATE' || source.semanticDecision === 'POSSIBLE_DUPLICATE') return;
    const candidates = source.canonicalOpportunityId && source.canonicalOpportunityId !== opportunity.id
      ? [{ id: opportunity.id, facts }]
      : await findCandidates(db, organizationId, facts, [opportunity.id, ...source.keptSeparateIds]);
    const candidate = candidates[0];
    if (!candidate) return;
    const s = signals(facts, candidate.facts);
    // Preview deliberately uses no paid model calls. Ambiguous records remain separate.
    const resolution: Resolution = { decision: 'POSSIBLE_DUPLICATE', canonicalOpportunityId: candidate.id, confidence: s.identifier ? 1 : .75, reason: 'Historický návrh: vyžaduje ruční potvrzení.', matchedSignals: s.matched, conflictingSignals: s.conflicts };
    await db.radarSignal.update({ where: { id: source.id, organizationId }, data: { candidateOpportunityId: candidate.id, semanticDecision: resolution.decision, semanticConfidence: resolution.confidence, resolution: json(resolution) } });
    await auditResolution(db, organizationId, source.id, candidates, resolution, userId, 'BACKFILL_PREVIEW');
    proposals++;
  });
  return { processed: page.length, proposals, nextCursor: page.length === 20 ? page[page.length - 1].id : null };
}
