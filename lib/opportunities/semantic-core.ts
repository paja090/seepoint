/** Pure extraction/decision policy shared by ingestion, preview and tests. */
export const factFields = ['companyName', 'projectName', 'location', 'city', 'region', 'country', 'address', 'opportunityType', 'category', 'projectDescription', 'estimatedValue', 'currency', 'projectSize', 'projectIdentifier', 'tenderIdentifier', 'announcementDate', 'expectedStartDate', 'expectedCompletionDate', 'sourceTitle', 'sourceUrl', 'sourceDomain'] as const;
export type Facts = Partial<Record<typeof factFields[number], string>>;
export type Decision = 'SAME_OPPORTUNITY' | 'POSSIBLE_DUPLICATE' | 'NEW_OPPORTUNITY';
export type Resolution = { decision: Decision; canonicalOpportunityId: string | null; confidence: number; reason: string; matchedSignals: string[]; conflictingSignals: string[]; model?: string };
export type Candidate = { id: string; facts: Facts };
export function normalize(value?: string | null): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function extractFacts(raw: unknown): Facts {
  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const result: Facts = {};
  for (const field of factFields) {
    const value = obj[field];
    if ((typeof value === 'string' || (field === 'estimatedValue' && typeof value === 'number' && Number.isFinite(value))) && String(value).trim() && String(value).trim().toLowerCase() !== 'null') {
      const text = String(value).trim().slice(0, field === 'projectDescription' ? 4000 : field === 'sourceUrl' ? 2000 : field === 'sourceTitle' ? 500 : 300);
      if (field.endsWith('Date') && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text)) continue;
      result[field] = text;
    }
  }
  if (result.sourceUrl) { try { result.sourceDomain = new URL(result.sourceUrl).hostname; } catch { delete result.sourceUrl; } }
  return result;
}
export function factsFromInput(input: Record<string, unknown>): Facts {
  const semantic = extractFacts(input.semanticData);
  return extractFacts({ ...input, ...semantic, companyName: input.companyName || semantic.companyName, city: input.city || semantic.city, region: input.region || semantic.region, address: input.address || semantic.address, opportunityType: semantic.opportunityType || input.eventType, projectDescription: semantic.projectDescription || input.summary, expectedStartDate: semantic.expectedStartDate || (input.eventDate instanceof Date ? input.eventDate.toISOString().slice(0, 10) : typeof input.eventDate === 'string' ? input.eventDate.slice(0, 10) : undefined), sourceUrl: input.sourceUrl, sourceTitle: input.sourceTitle });
}
export function semanticConfig(env: Record<string, string | undefined> = process.env) {
  const auto = Number(env.RADAR_MERGE_THRESHOLD ?? .90);
  const possible = Number(env.RADAR_REVIEW_THRESHOLD ?? .75);
  if (!(possible > 0 && possible < auto && auto <= 1)) throw new Error('Neplatné confidence prahy Radaru.');
  return { auto, possible, candidateLimit: 10 };
}
const identityFields = ['projectIdentifier', 'tenderIdentifier'] as const;
const conflictFields = [...identityFields, 'city', 'country', 'address', 'location', 'projectSize'] as const;
const identityValue = (value?: string) => (value || '').toLowerCase().replace(/\s+/g, '').trim();
function comparable(field: string, value?: string) { return identityFields.includes(field as typeof identityFields[number]) ? identityValue(value) : normalize(value); }
function specificName(facts: Facts) {
  const generic = new Set(normalize(`${facts.companyName || ''} ${facts.city || ''} nová nový nové projekt prodejna pobočka výstavba stavba expanze bateriové úložiště bess fotovoltaika elektrárna retail park obchod`).split(' '));
  return normalize(facts.projectName).split(' ').some(word => word.length > 2 && !generic.has(word));
}
export function signals(a: Facts, b: Facts) {
  const matched = factFields.filter(k => a[k] && b[k] && comparable(k, a[k]) === comparable(k, b[k]));
  const conflicts: string[] = conflictFields.filter(k => a[k] && b[k] && comparable(k, a[k]) !== comparable(k, b[k]));
  if (a.estimatedValue && b.estimatedValue && a.currency && b.currency && (normalize(a.currency) !== normalize(b.currency) || normalize(a.estimatedValue) !== normalize(b.estimatedValue))) conflicts.push('estimatedValue');
  for (const k of ['expectedStartDate', 'expectedCompletionDate'] as const) if (a[k] && b[k] && Math.abs(Date.parse(a[k]!) - Date.parse(b[k]!)) > 90 * 86400000) conflicts.push(k);
  const identifier = identityFields.some(k => matched.includes(k));
  // Company/category/city alone never identifies a concrete project.
  const exactLocation = matched.includes('location') && normalize(a.location) !== normalize(a.city) && normalize(a.location).length >= 8;
  const exactAddress = matched.includes('address') && normalize(a.address) !== normalize(a.city) && /\d/.test(a.address || '');
  const anchor = identifier || (matched.includes('projectName') && specificName(a) && specificName(b) && matched.some(k => ['city', 'address', 'location', 'projectSize'].includes(k))) || (exactAddress && matched.includes('companyName')) || (exactLocation && matched.includes('projectSize'));
  return { matched, conflicts, identifier, anchor };
}
export function newResolution(reason = 'Žádný relevantní kandidát.'): Resolution {
  return { decision: 'NEW_OPPORTUNITY', canonicalOpportunityId: null, confidence: 0, reason, matchedSignals: [], conflictingSignals: [] };
}
export function guardResolution(raw: unknown, incoming: Facts, candidates: Candidate[], config = semanticConfig()): Resolution {
  const r = raw as Partial<Resolution> | null;
  if (!r || !['SAME_OPPORTUNITY', 'POSSIBLE_DUPLICATE', 'NEW_OPPORTUNITY'].includes(String(r.decision)) || typeof r.confidence !== 'number' || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1) throw new Error('Neplatný výsledek semantic resolveru.');
  if (r.decision === 'NEW_OPPORTUNITY') return { ...newResolution(typeof r.reason === 'string' ? r.reason.slice(0, 1500) : undefined), confidence: r.confidence };
  const candidate = candidates.find(c => c.id === r.canonicalOpportunityId);
  if (!candidate) throw new Error('Resolver vrátil ID mimo kandidáty.');
  const s = signals(incoming, candidate.facts);
  const conflicts = [...new Set([...s.conflicts, ...(Array.isArray(r.conflictingSignals) ? r.conflictingSignals.filter(x => typeof x === 'string').slice(0, 20) : [])])];
  if (candidates.filter(c => { const other = signals(incoming, c.facts); return other.anchor && !other.conflicts.length; }).length > 1) conflicts.push('ambiguousCandidates');
  if (r.confidence < config.possible) return { ...newResolution('Confidence pod prahem pro kontrolu.'), confidence: r.confidence };
  return {
    decision: r.decision === 'SAME_OPPORTUNITY' && r.confidence >= config.auto && !conflicts.length && s.anchor ? 'SAME_OPPORTUNITY' : 'POSSIBLE_DUPLICATE',
    canonicalOpportunityId: candidate.id, confidence: r.confidence,
    reason: `${typeof r.reason === 'string' ? r.reason.slice(0, 1200) : 'Sémantická shoda.'}${!s.anchor ? ' Chybí konkrétní identifikační znak projektu.' : ''}${conflicts.length ? ' Konfliktní údaje vyžadují kontrolu.' : ''}`,
    matchedSignals: s.matched, conflictingSignals: conflicts,
  };
}
export function deterministicResolution(incoming: Facts, candidates: Candidate[]): Resolution | null {
  const matches = candidates.filter(c => signals(incoming, c.facts).identifier);
  if (matches.length === 1) return guardResolution({ decision: 'SAME_OPPORTUNITY', canonicalOpportunityId: matches[0].id, confidence: 1, reason: 'Shodný explicitní identifikátor projektu nebo tendru.' }, incoming, candidates);
  if (matches.length > 1) return { decision: 'POSSIBLE_DUPLICATE', canonicalOpportunityId: matches[0].id, confidence: 1, reason: 'Identifikátor odpovídá více historickým příležitostem.', matchedSignals: [], conflictingSignals: ['ambiguousCandidates'] };
  if (candidates.length && candidates.every(c => signals(incoming, c.facts).conflicts.some(k => identityFields.includes(k as typeof identityFields[number]) || k === 'city' || k === 'country'))) return newResolution('Kandidáti mají rozdílný explicitní identifikátor nebo město.');
  return candidates.length ? null : newResolution();
}
export function candidateScore(incoming: Facts, candidate: Facts) {
  const s = signals(incoming, candidate);
  const tokens = new Set(normalize(incoming.projectDescription).split(' ').filter(x => x.length > 3));
  const overlap = normalize(candidate.projectDescription).split(' ').filter(x => tokens.has(x)).length;
  return (s.identifier ? 1000 : 0) + (s.anchor ? 100 : 0) + s.matched.length * 5 + Math.min(overlap, 20) - s.conflicts.length * 10;
}
export function semanticKeys(facts: Facts) {
  return { normalizedCompany: normalize(facts.companyName) || null, normalizedCity: normalize(facts.city) || null, normalizedProject: normalize(facts.projectName) || null, projectIdentifier: identityValue(facts.projectIdentifier) || null, tenderIdentifier: identityValue(facts.tenderIdentifier) || null };
}
export function combineSources(sources: { id: string; facts: Facts }[]) {
  const facts: Facts = {}, provenance: Record<string, string> = {}, conflicts: { field: string; sourceId: string; value: string; existingValue: string }[] = [];
  for (const source of sources) for (const field of factFields) {
    if (field.startsWith('source')) continue;
    const value = source.facts[field];
    if (!value) continue;
    if (!facts[field]) { facts[field] = value; provenance[field] = source.id; }
    else if (normalize(facts[field]) !== normalize(value)) {
      if (field === 'projectDescription') {
        if (value.length > facts[field]!.length) { facts[field] = value; provenance[field] = source.id; }
      } else if (!['category', 'opportunityType'].includes(field)) conflicts.push({ field, sourceId: source.id, value, existingValue: facts[field]! });
    }
  }
  return { facts, provenance, conflicts };
}
export const extractionInstruction = `Doplň objekt semanticData s poli companyName (investor), projectName, location (přesné místo stavby), city, region, country, address, opportunityType, category, projectDescription, estimatedValue (číselná hodnota v základních jednotkách jako text), currency (ISO), projectSize (výkon/kapacita včetně jednotky), projectIdentifier, tenderIdentifier, announcementDate, expectedStartDate, expectedCompletionDate, sourceTitle, sourceUrl, sourceDomain. Pouze výslovně doložené údaje; chybějící null. Datum YYYY-MM-DD pouze je-li znám celý den. Název projektu není titulek článku ani obecné označení typu projektu. Identifikátory musí označovat konkrétní projekt/tendr, nikoli firmu. Nevymýšlej údaje.`;
