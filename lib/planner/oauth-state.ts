import { PlannerError } from './domain';
import type { PlannerActor } from './permissions';
export type CalendarOAuthSession = { organizationId: string; userId: string; nonce: string; verifier: string; expiresAt: number };
export function validateCalendarOAuthSession(state: CalendarOAuthSession, actor: PlannerActor, nonce: string | null, now = Date.now()) {
  if (!state || !Number.isFinite(state.expiresAt) || state.expiresAt < now || !state.verifier || !state.nonce || state.organizationId !== actor.organizationId || state.userId !== actor.id || state.nonce !== nonce) throw new PlannerError('Připojení nepatří aktuálnímu uživateli a firmě nebo vypršelo.', 403);
}
