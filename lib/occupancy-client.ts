export type ClientResolutionFilter = 'all' | 'resolved' | 'unresolved';

export function occupancyClientLabel(
  client: { name: string } | null | undefined,
  clientId: string | null | undefined,
  storedName?: string | null,
) {
  if (!clientId) return 'Klient neurčen';
  return client?.name ?? storedName ?? 'Klient neurčen';
}

export function clientResolutionFilter(value: string | undefined): ClientResolutionFilter {
  return value === 'resolved' || value === 'unresolved' ? value : 'all';
}
