import type { Interval, PlannerConfig } from './domain';
import { dateInZone, localInstant, plusDays } from './time';
export function overlaps(a: Interval, b: Interval) { return Date.parse(a.startAt) < Date.parse(b.endAt) && Date.parse(b.startAt) < Date.parse(a.endAt); }
export function busyMinutes(items: Interval[], range: Interval) {
  const spans = items.map(i => [Math.max(Date.parse(range.startAt), Date.parse(i.startAt)), Math.min(Date.parse(range.endAt), Date.parse(i.endAt))]).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  let end = -Infinity, total = 0;
  for (const [s, e] of spans) { total += Math.max(0, e - Math.max(s, end)); end = Math.max(end, e); }
  return Math.round(total / 60000);
}
export function workingWindows(date: string, p: PlannerConfig): Interval[] {
  if (!p.workingDays.includes(new Date(`${date}T12:00Z`).getUTCDay())) return [];
  const start = localInstant(date, p.workingStart, p.timezone), end = localInstant(date, p.workingEnd, p.timezone);
  const lunchStart = localInstant(date, p.lunchStart, p.timezone), lunchEnd = localInstant(date, p.lunchEnd, p.timezone);
  return [[start, new Date(Math.min(+end, +lunchStart))], [new Date(Math.max(+start, +lunchEnd)), end]].filter(([s, e]) => e > s).map(([s, e]) => ({ startAt: s.toISOString(), endAt: e.toISOString() }));
}
export function capacity(date: string, p: PlannerConfig, items: Interval[]) {
  const windows = workingWindows(date, p);
  const total = windows.reduce((sum, w) => sum + (Date.parse(w.endAt) - Date.parse(w.startAt)) / 60000, 0);
  const used = windows.reduce((sum, w) => sum + busyMinutes(items, w), 0);
  return { totalMinutes: total, busyMinutes: used, freeMinutes: Math.max(0, total - used), utilization: total ? Math.round(used / total * 100) : 0 };
}
export function findSlots(input: { from: Date; to: Date; durationMinutes: number; participants: { preferences: PlannerConfig; busy: Interval[] }[]; focus?: boolean; limit?: number }) {
  const slots: Interval[] = [];
  for (let t = Math.ceil(+input.from / 900000) * 900000; t + input.durationMinutes * 60000 <= +input.to && slots.length < (input.limit ?? 5); t += 900000) {
    const candidate = { startAt: new Date(t).toISOString(), endAt: new Date(t + input.durationMinutes * 60000).toISOString() };
    if (input.participants.every(({ preferences: p, busy }) => {
      const date = dateInZone(new Date(t), p.timezone);
      if (!workingWindows(date, p).some(w => candidate.startAt >= w.startAt && candidate.endAt <= w.endAt)) return false;
      const preferred = { startAt: localInstant(date, input.focus ? p.preferredFocusStart : p.preferredMeetingStart, p.timezone).toISOString(), endAt: localInstant(date, input.focus ? p.preferredFocusEnd : p.preferredMeetingEnd, p.timezone).toISOString() };
      if (candidate.startAt < preferred.startAt || candidate.endAt > preferred.endAt) return false;
      const day = new Date(`${date}T12:00Z`).getUTCDay();
      if (!input.focus && p.noMeetingBlocks.filter(b => b.day === day).some(b => overlaps(candidate, { startAt: localInstant(date, b.start, p.timezone).toISOString(), endAt: localInstant(date, b.end, p.timezone).toISOString() }))) return false;
      const buffer = input.focus ? 0 : p.meetingBufferMinutes * 60000;
      return !busy.some(b => overlaps(candidate, { startAt: new Date(Date.parse(b.startAt) - buffer).toISOString(), endAt: new Date(Date.parse(b.endAt) + buffer).toISOString() }));
    })) slots.push(candidate);
  }
  return slots;
}
export function weekDates(date: string) { const day = new Date(date).getUTCDay(); const monday = plusDays(date, -((day + 6) % 7)); return Array.from({ length: 7 }, (_, i) => plusDays(monday, i)); }
