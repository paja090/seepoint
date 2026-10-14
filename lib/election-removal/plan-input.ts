import { coordinates, zonedTime } from '../field-planning/profile';
import type { PlanRoutesPayload } from './planning';

/** Validate before querying resources or saving a new depot configuration. */
export function validateFieldPlanInput(p: PlanRoutesPayload) {
  if (!p || typeof p !== 'object') throw new Error('Chybí návrh výjezdu.');
  zonedTime(p.date, '12:00', 'Europe/Prague');
  for (const time of [p.startTime, p.endTime]) if (time !== undefined && (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('Neplatný čas výjezdu.');
  if (p.routeMode !== undefined && !['SEPARATE_MEDIA', 'MIXED'].includes(p.routeMode)) throw new Error('Neplatný režim tras.');
  if (p.depot !== undefined && !coordinates(p.depot)) throw new Error('Neplatná GPS depa.');
  for (const key of ['flexibleHours', 'saveDepotAsDefault'] as const) if (p[key] !== undefined && typeof p[key] !== 'boolean') throw new Error('Neplatná volba plánování.');
  for (const [value, min, max] of [[p.vehicleCapacitySlots, 1, 500], [p.warehouseUnloadMinutes, 1, 240]] as const) if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) throw new Error('Neplatná kapacita nebo délka vykládky.');
  if (p.parentPlanId !== undefined && (typeof p.parentPlanId !== 'string' || !p.parentPlanId || p.parentPlanId.length > 150)) throw new Error('Neplatná revize výjezdu.');
  const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 150;
  if (!Array.isArray(p.crews) || !p.crews.length || p.crews.length > 100 || p.crews.some(c => !c || !id(c.id) || !Array.isArray(c.employeeIds) || !c.employeeIds.length || c.employeeIds.length > 20 || !c.employeeIds.every(id) || (c.vehicleId !== null && !id(c.vehicleId)))) throw new Error('Neplatné složení posádky.');
  if (p.selectedPointIds !== undefined && (!Array.isArray(p.selectedPointIds) || !p.selectedPointIds.length || p.selectedPointIds.length > 1000 || !p.selectedPointIds.every(id))) throw new Error('Neplatný výběr prací.');
}
