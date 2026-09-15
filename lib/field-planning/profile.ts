import type { Coordinates, JobConstraints, PlanningProfile } from './contracts';

export function coordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== 'object') return false;
  const p = value as Coordinates;
  return Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Neplatná konfigurace.');
  return value as Record<string, unknown>;
}
function bounded(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Neplatná hodnota: ${label}.`);
  return value;
}
export function parseProfile(value: unknown): PlanningProfile {
  const p = object(value);
  if (typeof p.timezone !== 'string') throw new Error('Vyplňte časovou zónu.');
  try { new Intl.DateTimeFormat('en', { timeZone: p.timezone }).format(); } catch { throw new Error('Neplatná časová zóna.'); }
  for (const key of ['workdayStart', 'workdayEnd']) if (typeof p[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p[key] as string)) throw new Error('Vyplňte pracovní dobu.');
  if (String(p.workdayStart) >= String(p.workdayEnd)) throw new Error('Konec směny musí být po začátku (V1: směna v jednom dni).');
  if (!coordinates(p.depot) || !coordinates(p.endLocation)) throw new Error('Vyplňte platné GPS výjezdu a návratu.');
  if (p.country !== null && (typeof p.country !== 'string' || !/^[A-Za-z]{2}$/.test(p.country))) throw new Error('Země musí být dvoupísmenný kód nebo null.');
  const durations = object(p.serviceMinutes);
  const serviceMinutes = Object.fromEntries(Object.entries(durations).map(([key, value]) => [key, bounded(value, 1, 1440, key)]));
  if (!['BALANCED', 'DISTANCE'].includes(String(p.strategy))) throw new Error('Neplatná strategie.');
  if (p.requireHumanApproval !== true || typeof p.enabled !== 'boolean' || typeof p.vehicleRequired !== 'boolean') throw new Error('Plán vždy vyžaduje lidské schválení.');
  const navigationPointMinutes = p.navigationPointMinutes === undefined ? undefined : Object.fromEntries(Object.entries(object(p.navigationPointMinutes)).map(([id, value]) => [id, bounded(value, 1, 1440, id)]));
  return { navigationPointMinutes, timezone: p.timezone, country: p.country as string | null, depot: p.depot, endLocation: p.endLocation,
    workdayStart: p.workdayStart as string, workdayEnd: p.workdayEnd as string,
    breakMinutes: bounded(p.breakMinutes, 0, 240, 'přestávka'), overtimeMinutes: bounded(p.overtimeMinutes, 0, 240, 'přesčas'),
    strategy: p.strategy as PlanningProfile['strategy'], serviceMinutes,
    fallbackSpeedKph: bounded(p.fallbackSpeedKph, 1, 130, 'odhad rychlosti'), fallbackDistanceFactor: bounded(p.fallbackDistanceFactor, 1, 5, 'koeficient vzdálenosti'),
    maximumJobsPerRoute: bounded(p.maximumJobsPerRoute, 1, 100, 'počet zastávek'), vehicleRequired: p.vehicleRequired,
    requireHumanApproval: true, enabled: p.enabled };
}
export function defaultPlanningProfile(overrides?: Partial<PlanningProfile>): PlanningProfile {
  const defaultDepot = { latitude: 49.8346, longitude: 18.2820 };
  return {
    timezone: 'Europe/Prague',
    country: 'CZ',
    depot: overrides?.depot ?? defaultDepot,
    endLocation: overrides?.endLocation ?? overrides?.depot ?? defaultDepot,
    workdayStart: '08:00',
    workdayEnd: '16:30',
    breakMinutes: 30,
    overtimeMinutes: 60,
    strategy: 'BALANCED',
    serviceMinutes: {
      INSTALLATION: 45,
      NAVIGATION_INSTALLATION: 30,
      REINSTALLATION: 45,
      DEINSTALLATION: 30,
      REPAIR: 45,
      CHECK: 20,
      TRANSPORT: 60,
      OTHER: 45,
      ...(overrides?.serviceMinutes ?? {}),
    },
    fallbackSpeedKph: 50,
    fallbackDistanceFactor: 1.25,
    maximumJobsPerRoute: 25,
    vehicleRequired: false,
    requireHumanApproval: true,
    enabled: true,
    ...overrides,
  };
}
export function parseConstraints(value: unknown): JobConstraints {
  if (value == null) return {};
  const p = object(value); const result: JobConstraints = {};
  for (const key of ['windowStart', 'windowEnd'] as const) {
    if (p[key] !== undefined) {
      if (typeof p[key] !== 'string' || !/T.*(Z|[+-]\d\d:\d\d)$/.test(p[key] as string) || !Number.isFinite(Date.parse(p[key] as string))) throw new Error('Časové okno musí obsahovat časovou zónu.');
      result[key] = p[key] as string;
    }
  }
  if (result.windowStart && result.windowEnd && Date.parse(result.windowStart) >= Date.parse(result.windowEnd)) throw new Error('Neplatné časové okno.');
  for (const key of ['requiredEmployeeIds', 'requiredPositions', 'predecessorIds'] as const) {
    if (p[key] !== undefined) {
      if (!Array.isArray(p[key]) || p[key].length > 100 || !p[key].every((v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 150)) throw new Error('Neplatné požadavky práce.');
      result[key] = [...new Set(p[key] as string[])];
    }
  }
  if (p.vehicleRequired !== undefined) {
    if (typeof p.vehicleRequired !== 'boolean') throw new Error('Neplatný požadavek na vozidlo.');
    result.vehicleRequired = p.vehicleRequired;
  }
  return result;
}
export function dayInZone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
/** Reject nonexistent/ambiguous DST wall times rather than silently moving a hard constraint. */
export function zonedTime(day: string, time: string, timezone: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error('Neplatný plánovací den.');
  const target = `${day}T${time}`;
  const naive = Date.parse(`${target}:00Z`);
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const offsets = new Set<number>();
  for (const shift of [-36, 0, 36]) {
    const t = naive + shift * 3600000;
    offsets.add(Date.parse(`${formatter.format(t).replace(' ', 'T')}:00Z`) - t);
  }
  const matches = [...offsets].map(offset => naive - offset).filter(t => formatter.format(t).replace(' ', 'T') === target);
  if (matches.length !== 1) throw new Error('Čas směny je nejednoznačný nebo neexistuje při změně letního času.');
  return matches[0];
}

/** Strip optional-module settings only in public/configuration views; retain snapshot geography and timing. */
export function profileForNavigation(profile: PlanningProfile, navigation: boolean): PlanningProfile {
  if (navigation) return profile;
  const { navigationPointMinutes: _hidden, ...rest } = profile;
  return { ...rest, serviceMinutes: Object.fromEntries(Object.entries(profile.serviceMinutes).filter(([key]) => !key.startsWith('NAVIGATION_INSTALLATION'))) };
}
