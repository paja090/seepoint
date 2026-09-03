import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, money, StatusPill } from '@/lib/internal-format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MySettlementsPage() {
  const user = await requirePageAccess('mySettlements');
  if (!canAccess(user.role, 'mySettlements')) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { userId: user.id },
        { email: user.email }
      ]
    }
  });

  const settlements = employee
    ? await prisma.settlement.findMany({
        where: { employeeId: employee.id },
        include: {
          items: {
            include: { task: true }
          }
        },
        orderBy: { periodFrom: 'desc' },
        take: 100
      })
    : [];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Moje vyúčtování</h1>
        <p className="mt-1 text-sm text-slate-500">
          Osobní přehled vyúčtování pro přihlášeného pracovníka.
        </p>
      </div>

      {!employee ? (
        <section className="card">
          <h2 className="text-xl font-bold">Profil nenalezen</h2>
          <p className="mt-2 text-sm text-slate-500">
            Pro účet {user.email} zatím není založený zaměstnanecký profil.
          </p>
        </section>
      ) : (
        <section className="card">
          <h2 className="mb-4 text-xl font-bold border-b pb-3">
            {employee.firstName} {employee.lastName}
          </h2>

          {settlements.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-4">
              Zatím nemáte žádné vygenerované vyúčtování.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-3">Období</th>
                    <th className="py-2 pr-3">Stav</th>
                    <th className="py-2 pr-3">Položky</th>
                    <th className="py-2 pr-3 text-right">Částka k výplatě</th>
                    <th className="py-2 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((settlement) => (
                    <tr className="border-b last:border-0 hover:bg-slate-50/50 transition" key={settlement.id}>
                      <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                        {dateOnly(settlement.periodFrom)} – {dateOnly(settlement.periodTo)}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <StatusPill value={settlement.status} />
                      </td>
                      <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">
                        {settlement.items.length} položek
                      </td>
                      <td className="py-3 pr-3 text-right font-bold text-slate-900 whitespace-nowrap font-mono">
                        {money(settlement.finalPayableAmount)}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/my-settlements/${settlement.id}`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
                        >
                          Otevřít detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
