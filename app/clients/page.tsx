import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { occupancies: true, offers: true, currentSurfaces: true } },
    },
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Klienti</h1>
        <p className="mt-1 text-sm text-slate-500">Zakladni obchodni evidence klientu pro obsazenost a nabidky.</p>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-xl font-bold">Seznam klientu</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-slate-500">Zatim neni ulozeny zadny klient.</p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b py-2 pr-3">Klient</th>
                <th className="border-b py-2 pr-3">Kontakt</th>
                <th className="border-b py-2 pr-3">Plochy</th>
                <th className="border-b py-2 pr-3">Obsazenost</th>
                <th className="border-b py-2 pr-3">Nabidky</th>
                <th className="border-b py-2 pr-3">Poznamka</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr className="border-b last:border-0" key={client.id}>
                  <td className="py-3 pr-3">
                    <b>{client.name}</b>
                    {client.companyId && <><br /><span className="text-slate-500">{client.companyId}</span></>}
                  </td>
                  <td className="py-3 pr-3">
                    {client.contactPerson ?? 'Neuvedeno'}
                    {client.email && <><br /><span className="text-slate-500">{client.email}</span></>}
                    {client.phone && <><br /><span className="text-slate-500">{client.phone}</span></>}
                  </td>
                  <td className="py-3 pr-3">{client._count.currentSurfaces}</td>
                  <td className="py-3 pr-3">{client._count.occupancies}</td>
                  <td className="py-3 pr-3">{client._count.offers}</td>
                  <td className="py-3 pr-3">{client.note ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
