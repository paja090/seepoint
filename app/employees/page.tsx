import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { EmployeeCreateForm } from '@/components/EmployeeCreateForm';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, FilterBar, PageHeader, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess, canViewSensitiveEmployeeData, getCurrentUser, roleLabel, roles } from '@/lib/rbac';
import { dateOnly, statusLabel } from '@/lib/internal-format';

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
  const canCreate = user.role === 'ADMIN' || user.role === 'MANAGER';
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
      <PageHeader
        title="Zaměstnanci"
        description="Interní evidence rolí, kontaktů a základních pracovních vazeb."
      />
      <EmployeeCreateForm canCreate={canCreate} />
      <FilterBar>
        <form className="grid gap-3 md:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700">Hledání<input className="input mt-1 font-normal" name="q" defaultValue={q} placeholder="Jméno, e-mail, telefon" /></label>
          <label className="text-sm font-semibold text-slate-700">Role<select className="input mt-1 font-normal" name="role" defaultValue={role ?? ''}><option value="">Všechny role</option>{roles.map((item) => <option value={item} key={item}>{roleLabel(item)}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">Pozice<select className="input mt-1 font-normal" name="position" defaultValue={position ?? ''}><option value="">Všechny pozice</option>{positions.map((item) => item.position && <option value={item.position} key={item.position}>{item.position}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">Stav<select className="input mt-1 font-normal" name="active" defaultValue={active ?? ''}><option value="">Všichni</option><option value="active">Aktivní</option><option value="inactive">Neaktivní</option></select></label>
          <div className="flex items-end gap-2"><Button type="submit" variant="primary">Filtrovat</Button><Button href="/employees" variant="secondary">Vymazat</Button></div>
        </form>
      </FilterBar>
      <section className="card !p-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4"><h2 className="text-lg font-semibold text-slate-950">Seznam zaměstnanců</h2><p className="text-sm text-slate-500">Nalezeno {employees.length}</p></div>
        {employees.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState title="Zatím není evidovaný žádný zaměstnanec." description="Založte první profil výše. Pokud bude jméno stejné jako pracovník v plánu práce, nové nebo znovu uložené zakázky se na něj automaticky spárují." /></div>
        ) : (
          <Table minWidth="min-w-[980px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Jméno</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Pozice</TableHeaderCell>
                <TableHeaderCell>Kontakt</TableHeaderCell>
                <TableHeaderCell>Citlivé údaje</TableHeaderCell>
                <TableHeaderCell>Úkoly</TableHeaderCell>
                <TableHeaderCell>Vyúčtování</TableHeaderCell>
                <TableHeaderCell>Stav</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {employees.map((employee) => (
                <tr className="hover:bg-slate-50/60" key={employee.id}>
                  <TableCell><Link className="font-semibold text-slate-950 hover:underline" href={`/employees/${employee.id}`}>{employee.firstName} {employee.lastName}</Link><br /><span className="text-slate-500">{statusLabel(employee.employmentType)}</span></TableCell>
                  <TableCell>{roleLabel(employee.role)}</TableCell>
                  <TableCell>{employee.position ?? '-'}</TableCell>
                  <TableCell>{employee.email ?? '-'}<br /><span className="text-slate-500">{employee.phone ?? '-'}</span></TableCell>
                  <TableCell>{showSensitive ? <span>IČO: {employee.ico ?? '-'}<br />Narození: {dateOnly(employee.dateOfBirth)}</span> : <span className="text-slate-400">Skryto podle role</span>}</TableCell>
                  <TableCell>{employee._count.assignedTasks}</TableCell>
                  <TableCell>{employee._count.settlements}</TableCell>
                  <TableCell><StatusBadge value={employee.isActive ? 'ACTIVE' : 'INACTIVE'} /></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </AppShell>
  );
}
