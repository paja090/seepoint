import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess, canViewSensitiveEmployeeData, getCurrentUser, roleLabel, roles } from '@/lib/rbac';
import { dateOnly, StatusPill, statusLabel } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: string | string[] | undefined) {
  return first(value)?.trim() || undefined;
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = getCurrentUser();
  if (!canAccess(user.role, 'employees')) return <AppShell><AccessDenied /></AppShell>;

  const params = await searchParams;
  const q = clean(params.q);
  const role = clean(params.role);
  const position = clean(params.position);
  const active = clean(params.active);
  const showSensitive = canViewSensitiveEmployeeData(user.role);
  const where: Prisma.EmployeeWhereInput = {};

  if (q) where.OR = [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }];
  if (role && roles.includes(role as typeof roles[number])) where.role = role as typeof roles[number];
  if (position) where.position = { contains: position, mode: 'insensitive' };
  if (active === 'active') where.isActive = true;
  if (active === 'inactive') where.isActive = false;

  const [employees, positions] = await Promise.all([
    prisma.employee.findMany({ where, orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }], include: { _count: { select: { assignedTasks: true, settlements: true, vehicleReservations: true } } }, take: 500 }),
    prisma.employee.findMany({ where: { position: { not: null } }, distinct: ['position'], select: { position: true }, orderBy: { position: 'asc' } }),
  ]);

  return (
    <AppShell>
      <div className="mb-6"><h1 className="text-3xl font-bold">Zaměstnanci</h1><p className="mt-1 text-sm text-slate-500">Interní evidence rolí, kontaktů a základních pracovních vazeb.</p></div>
      <form className="card mb-6 grid gap-3 md:grid-cols-5">
        <label className="text-sm font-semibold">Hledání<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="q" defaultValue={q} placeholder="Jméno, e-mail, telefon" /></label>
        <label className="text-sm font-semibold">Role<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="role" defaultValue={role ?? ''}><option value="">Všechny role</option>{roles.map((item) => <option value={item} key={item}>{roleLabel(item)}</option>)}</select></label>
        <label className="text-sm font-semibold">Pozice<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="position" defaultValue={position ?? ''}><option value="">Všechny pozice</option>{positions.map((item) => item.position && <option value={item.position} key={item.position}>{item.position}</option>)}</select></label>
        <label className="text-sm font-semibold">Stav<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="active" defaultValue={active ?? ''}><option value="">Všichni</option><option value="active">Aktivní</option><option value="inactive">Neaktivní</option></select></label>
        <div className="flex items-end gap-2"><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrovat</button><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/employees">Vymazat</Link></div>
      </form>
      <section className="card overflow-x-auto">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Seznam zaměstnanců</h2><p className="text-sm text-slate-500">Nalezeno {employees.length}</p></div>
        {employees.length === 0 ? <p className="text-sm text-slate-500">Zatím není evidovaný žádný zaměstnanec.</p> : (
          <table className="w-full min-w-[980px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="border-b py-2 pr-3">Jméno</th><th className="border-b py-2 pr-3">Role</th><th className="border-b py-2 pr-3">Pozice</th><th className="border-b py-2 pr-3">Kontakt</th><th className="border-b py-2 pr-3">Citlivé údaje</th><th className="border-b py-2 pr-3">Úkoly</th><th className="border-b py-2 pr-3">Vyúčtování</th><th className="border-b py-2 pr-3">Stav</th></tr></thead><tbody>
            {employees.map((employee) => <tr className="border-b last:border-0" key={employee.id}><td className="py-3 pr-3"><Link className="font-semibold hover:underline" href={`/employees/${employee.id}`}>{employee.firstName} {employee.lastName}</Link><br /><span className="text-slate-500">{statusLabel(employee.employmentType)}</span></td><td className="py-3 pr-3">{roleLabel(employee.role)}</td><td className="py-3 pr-3">{employee.position ?? '-'}</td><td className="py-3 pr-3">{employee.email ?? '-'}<br /><span className="text-slate-500">{employee.phone ?? '-'}</span></td><td className="py-3 pr-3">{showSensitive ? <span>IČO: {employee.ico ?? '-'}<br />Narození: {dateOnly(employee.dateOfBirth)}</span> : <span className="text-slate-500">Skryto podle role</span>}</td><td className="py-3 pr-3">{employee._count.assignedTasks}</td><td className="py-3 pr-3">{employee._count.settlements}</td><td className="py-3 pr-3"><StatusPill value={employee.isActive ? 'ACTIVE' : 'CANCELLED'} /></td></tr>)}
          </tbody></table>
        )}
      </section>
    </AppShell>
  );
}
