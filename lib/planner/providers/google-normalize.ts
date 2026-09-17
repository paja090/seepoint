import { localInstant } from '../time';
import type { ProviderEvent } from './types';
export function sanitized(value: unknown, max = 200) { return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : ''; }
export function googleEvent(value: Record<string, unknown>, timezone: string): ProviderEvent | null {
  if (typeof value.id !== 'string') return null;
  const base = { externalEventId: value.id, title: sanitized(value.summary) || 'Událost', timezone, busy: value.transparency !== 'transparent', isPrivate: value.visibility !== 'public', location: sanitized(value.location, 500) || null, etag: typeof value.etag === 'string' ? value.etag : null };
  if (value.status === 'cancelled') return { ...base, cancelled: true, allDay: false };
  const start = value.start as { date?: string; dateTime?: string } | undefined;
  const end = value.end as { date?: string; dateTime?: string } | undefined;
  if (!start || !end) return null;
  const allDay = Boolean(start.date);
  const startAt = start.date ? localInstant(start.date, '00:00', timezone) : new Date(start.dateTime || '');
  const endAt = end.date ? localInstant(end.date, '00:00', timezone) : new Date(end.dateTime || '');
  if (!Number.isFinite(+startAt) || !Number.isFinite(+endAt) || endAt <= startAt) return null;
  return { ...base, startAt, endAt, allDay, cancelled: false };
}
