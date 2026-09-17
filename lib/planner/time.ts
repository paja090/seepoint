import { PlannerError } from './domain';
export function dateInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (key: string) => parts.find(p => p.type === key)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new PlannerError('Neplatné datum.');
  return date;
}
export function plusDays(date: string, count: number) { return new Date(Date.parse(validDate(date)) + count * 86400000).toISOString().slice(0, 10); }
export function localInstant(date: string, time: string, timezone: string) {
  validDate(date);
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) throw new PlannerError('Neplatný čas.');
  let guess = target;
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 4; i++) {
    const represented = Date.parse(formatter.format(new Date(guess)).replace(' ', 'T') + 'Z');
    if (represented === target) return new Date(guess);
    guess += target - represented;
  }
  throw new PlannerError('Tento místní čas neexistuje kvůli změně letního času.');
}
export function dayRange(date: string, timezone: string) { return { start: localInstant(date, '00:00', timezone), end: localInstant(plusDays(date, 1), '00:00', timezone) }; }
