import { PlannerError, type PlannerConfig } from './domain';
export const defaultPreferences: PlannerConfig = {
  timezone: 'Europe/Prague', workingDays: [1, 2, 3, 4, 5], workingStart: '09:00', workingEnd: '17:00',
  lunchStart: '12:00', lunchEnd: '12:30', meetingBufferMinutes: 15, defaultMeetingDuration: 45,
  preferredFocusStart: '09:00', preferredFocusEnd: '12:00', preferredMeetingStart: '09:00', preferredMeetingEnd: '17:00',
  noMeetingBlocks: [], aiEnabled: false, autoSuggestions: false,
};
export function validatePreferences(value: unknown): PlannerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PlannerError('Neplatné plánovací preference.');
  const v = value as PlannerConfig;
  try { new Intl.DateTimeFormat('cs', { timeZone: v.timezone }).format(); } catch { throw new PlannerError('Neplatná časová zóna.'); }
  if (typeof v.timezone !== 'string' || !Array.isArray(v.workingDays) || !v.workingDays.length || v.workingDays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new PlannerError('Vyberte pracovní dny.');
  const time = (t: unknown) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  for (const [start, end] of [[v.workingStart, v.workingEnd], [v.lunchStart, v.lunchEnd], [v.preferredFocusStart, v.preferredFocusEnd], [v.preferredMeetingStart, v.preferredMeetingEnd]]) {
    if (!time(start) || !time(end) || start >= end) throw new PlannerError('Začátek intervalu musí být před koncem.');
  }
  if (!Number.isInteger(v.meetingBufferMinutes) || v.meetingBufferMinutes < 0 || v.meetingBufferMinutes > 120 || !Number.isInteger(v.defaultMeetingDuration) || v.defaultMeetingDuration < 15 || v.defaultMeetingDuration > 480) throw new PlannerError('Neplatná délka schůzky nebo rezerva.');
  if (!Array.isArray(v.noMeetingBlocks) || v.noMeetingBlocks.length > 30 || v.noMeetingBlocks.some(b => !b || !Number.isInteger(b.day) || b.day < 0 || b.day > 6 || !time(b.start) || !time(b.end) || b.start >= b.end)) throw new PlannerError('Neplatné zakázané časy.');
  if (typeof v.aiEnabled !== 'boolean' || typeof v.autoSuggestions !== 'boolean') throw new PlannerError('Neplatné nastavení AI.');
  return { timezone: v.timezone, workingDays: [...new Set(v.workingDays)].sort(), workingStart: v.workingStart, workingEnd: v.workingEnd, lunchStart: v.lunchStart, lunchEnd: v.lunchEnd, meetingBufferMinutes: v.meetingBufferMinutes, defaultMeetingDuration: v.defaultMeetingDuration, preferredFocusStart: v.preferredFocusStart, preferredFocusEnd: v.preferredFocusEnd, preferredMeetingStart: v.preferredMeetingStart, preferredMeetingEnd: v.preferredMeetingEnd, noMeetingBlocks: v.noMeetingBlocks.map(b => ({ day: b.day, start: b.start, end: b.end })), aiEnabled: v.aiEnabled, autoSuggestions: v.autoSuggestions };
}
export function resolvePreferences(tenant: unknown, personal: unknown): PlannerConfig {
  return validatePreferences({ ...defaultPreferences, ...(tenant && typeof tenant === 'object' ? tenant : {}), ...(personal && typeof personal === 'object' ? personal : {}) });
}
