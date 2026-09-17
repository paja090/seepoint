export type ProviderCalendar = { externalId: string; name: string; timezone: string; primary: boolean };
export type ProviderEvent = { externalEventId: string; cancelled: boolean; title: string; startAt?: Date; endAt?: Date; timezone: string; allDay: boolean; busy: boolean; isPrivate: boolean; location: string | null; etag: string | null };
export type EventPage = { events: ProviderEvent[]; nextPageToken?: string; nextSyncToken?: string };
export interface CalendarProvider {
  readonly id: string;
  readonly canWrite: boolean;
  refreshCredentials(refreshToken: string): Promise<string>;
  disconnect(refreshToken: string): Promise<void>;
  getCalendars(accessToken: string): Promise<ProviderCalendar[]>;
  getEvents(accessToken: string, calendar: ProviderCalendar, cursor: { syncToken?: string; pageToken?: string; from: Date; to: Date }): Promise<EventPage>;
  // Future providers can implement writes; orchestration must still require confirmed commands.
  createEvent?: (accessToken: string, calendarId: string, event: ProviderEvent) => Promise<string>;
  updateEvent?: (accessToken: string, calendarId: string, event: ProviderEvent) => Promise<void>;
  deleteEvent?: (accessToken: string, calendarId: string, eventId: string) => Promise<void>;
}
export class ProviderError extends Error { constructor(public code: 'REAUTH_REQUIRED' | 'RATE_LIMITED' | 'SYNC_RESET' | 'PROVIDER_ERROR' | 'CALENDAR_REMOVED') { super(code); } }
