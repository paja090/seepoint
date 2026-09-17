import 'server-only';
import { googleOAuthConfiguration } from '@/lib/integrations/google-oauth';
import { googleEvent, sanitized } from './google-normalize';
import { ProviderError, type CalendarProvider, type ProviderCalendar } from './types';
export const calendarScopes = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly'];
async function googleFetch(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (response.status === 410) throw new ProviderError('SYNC_RESET');
  if (response.status === 404) throw new ProviderError('CALENDAR_REMOVED');
  if (response.status === 429 || response.status === 403) throw new ProviderError('RATE_LIMITED');
  if (response.status === 401 || response.status === 400) throw new ProviderError('REAUTH_REQUIRED');
  if (!response.ok) throw new ProviderError('PROVIDER_ERROR');
  return response;
}
export const googleCalendarProvider: CalendarProvider = {
  id: 'GOOGLE', canWrite: false,
  async refreshCredentials(refreshToken) {
    const config = googleOAuthConfiguration();
    const response = await googleFetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
    const data = await response.json();
    if (typeof data.access_token !== 'string') throw new ProviderError('REAUTH_REQUIRED');
    return data.access_token;
  },
  async disconnect(refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token: refreshToken }), cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok && response.status !== 400) throw new ProviderError('PROVIDER_ERROR');
  },
  async getCalendars(accessToken) {
    const result: ProviderCalendar[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ maxResults: '100', minAccessRole: 'reader' });
      if (pageToken) query.set('pageToken', pageToken);
      const response = await googleFetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${query}`, { headers: { authorization: `Bearer ${accessToken}` } });
      const data = await response.json();
      for (const c of data.items || []) if (typeof c.id === 'string') result.push({ externalId: c.id, name: sanitized(c.summary) || 'Kalendář', timezone: c.timeZone || 'Europe/Prague', primary: c.primary === true });
      pageToken = data.nextPageToken;
      if (result.length > 500) throw new ProviderError('PROVIDER_ERROR');
    } while (pageToken);
    return result;
  },
  async getEvents(accessToken, calendar, cursor) {
    const query = new URLSearchParams({ maxResults: '2500', singleEvents: 'true', showDeleted: 'true' });
    if (cursor.syncToken) query.set('syncToken', cursor.syncToken);
    else { query.set('timeMin', cursor.from.toISOString()); query.set('timeMax', cursor.to.toISOString()); }
    if (cursor.pageToken) query.set('pageToken', cursor.pageToken);
    const response = await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.externalId)}/events?${query}`, { headers: { authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    return { events: (data.items || []).map((v: Record<string, unknown>) => googleEvent(v, calendar.timezone)).filter(Boolean), nextPageToken: data.nextPageToken, nextSyncToken: data.nextSyncToken };
  },
};
export function calendarProvider(provider: string): CalendarProvider {
  if (provider !== 'GOOGLE') throw new ProviderError('PROVIDER_ERROR');
  return googleCalendarProvider;
}
