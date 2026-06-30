import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { getCarriers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Carriers() {
  const carriers = await getCarriers();
  return <AppShell><div className="flex justify-between mb-6"><h1 className="text-3xl font-bold">Reklamní nosiče</h1><Link className="rounded-xl bg-slate-950 px-4 py-2 text-white" href="/map">Přidat v mapě</Link></div><div className="card overflow-x-auto"><table className="w-full text-sm"><tbody>{carriers.map((carrier) => <tr className="border-b" key={carrier.id}><td className="py-3"><Link className="font-semibold" href={`/carriers/${carrier.id}`}>{carrier.name}</Link><br/><span className="text-slate-500">{carrier.code}</span></td><td>{carrier.type}</td><td>{carrier.city}</td><td><StatusBadge value={carrier.status}/></td></tr>)}</tbody></table></div></AppShell>;
}
