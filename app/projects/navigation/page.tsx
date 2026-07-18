import { MapPinned, Plus } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function NavigationProjectsPage() {
  await requirePageAccess('navigationProjects');
  const offers = await prisma.offer.findMany({ where: { offerType: 'NAVIGATION', archivedAt: null }, select: { id: true, campaignName: true, status: true, updatedAt: true, client: { select: { name: true } }, navigationOffer: { select: { targetName: true, _count: { select: { points: true } } } } }, orderBy: { updatedAt: 'desc' }, take: 100 });
  return <AppShell><div className="space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-700">Projekty</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Navigace</h1><p className="mt-2 text-sm text-slate-500">Flexibilně plánované navigační body a cíle na mapě.</p></div><Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" href="/offers/new/navigation"><Plus size={17} /> Nová nabídka navigace</Link></header><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{offers.length ? <ul className="divide-y divide-slate-100">{offers.map((offer) => <li key={offer.id}><Link className="flex items-center gap-4 p-5 transition hover:bg-slate-50" href={`/offers/${offer.id}`}><span className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><MapPinned size={20} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{offer.campaignName}</strong><span className="mt-1 block text-xs text-slate-500">{offer.client.name} · {offer.navigationOffer?.targetName ?? 'Cíl neuveden'} · {offer.navigationOffer?._count.points ?? 0} bodů</span></span><span className="text-xs font-semibold text-slate-500">{offer.status}</span></Link></li>)}</ul> : <div className="p-10 text-center"><MapPinned className="mx-auto text-slate-300" size={36} /><h2 className="mt-3 font-semibold">Zatím bez navigačních nabídek</h2><p className="mt-1 text-sm text-slate-500">První projekt vznikne uložením konceptu nabídky.</p></div>}</section></div></AppShell>;
}
