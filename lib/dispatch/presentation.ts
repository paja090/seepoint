import type { MyRouteDTO, PlannedCrew, PlanningResult } from '../field-planning/contracts';
import type { PlannerItem } from '../planner/domain';
import type { DispatchPlan } from './queue';

export const dispatchStatus: Record<string, string> = { DRAFT: 'Návrh', APPROVED: 'Schváleno', ACTIVE: 'Probíhá', COMPLETED: 'Uzavřeno' };
export const dispatchCrewKey = (planId: string, crewId: string) => `${planId}:${crewId}`;
export type DispatchProgress = Record<string, { total: number; done: number; issues: number }>;
export function dispatchPlanHref(plan: DispatchPlan) {
  const params = new URLSearchParams({ date: plan.date, plan: plan.id });
  if (plan.electionCampaignId) params.set('campaign', plan.electionCampaignId);
  else params.set('planner', 'work');
  return '/work/dispatch?' + params + '#planner';
}
export function dispatchCrews(plans: DispatchPlan[]) {
  return plans.flatMap(plan => ((plan.planningSummary as Partial<PlanningResult> | null)?.crews ?? []).map(crew => ({
    key: dispatchCrewKey(plan.id, crew.id), plan, crew,
    title: crew.name || crew.names?.join(' + ') || 'Posádka bez názvu',
  })));
}
export function dispatchProgress(routes: MyRouteDTO['routes']): DispatchProgress {
  return Object.fromEntries(routes.filter(route => route.crewId).map(route => [dispatchCrewKey(route.planId, route.crewId!), {
    total: route.stops.length,
    done: route.stops.filter(stop => stop.status === 'DONE').length,
    issues: route.stops.filter(stop => stop.status === 'ISSUE').length,
  }]));
}
export function dispatchTimeline(plans: DispatchPlan[]): PlannerItem[] {
  return dispatchCrews(plans).filter(({ crew }) => crew.stops.length && Number.isFinite(Date.parse(crew.departureAt)) && Date.parse(crew.endAt) > Date.parse(crew.departureAt)).map(({ key, plan, crew, title }) => ({
    id: key, title: `${title} · ${dispatchStatus[plan.status] ?? plan.status}`,
    source: 'FIELD_TRIP', startAt: crew.departureAt, endAt: crew.endAt,
    busy: plan.status !== 'DRAFT', editable: false,
    location: [crew.vehicleName, `${crew.stops.length} zastávek`].filter(Boolean).join(' · '), href: dispatchPlanHref(plan),
  }));
}
export function dispatchMapResult(plans: DispatchPlan[]): PlanningResult | undefined {
  const rows = dispatchCrews(plans);
  if (!rows.length) return undefined;
  const first = rows[0].plan.planningSummary as PlanningResult;
  const crews: PlannedCrew[] = rows.map(({ key, crew }) => ({ ...crew, id: key }));
  return { ...first, crews };
}
