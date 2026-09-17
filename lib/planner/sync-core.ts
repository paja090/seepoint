import type { ProviderEvent } from './providers/types';
/** Last occurrence wins, including tombstones; duplicates in provider pages cannot duplicate rows. */
export function uniqueProviderEvents(events: ProviderEvent[]) { return [...new Map(events.map(e => [e.externalEventId, e])).values()]; }
