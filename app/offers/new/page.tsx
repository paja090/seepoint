import { ArrowRight, GalleryHorizontalEnd, MapPinned, PanelsTopLeft } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { requirePageAccess } from '@/lib/page-auth';

const types = [
  { href: '/offers/new/navigation', title: 'Navigace', description: 'Flexibilní cílový bod a plánované navigační body vytvářené přímo v mapě.', icon: MapPinned, tone: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { href: '/offers/new/city-gallery', title: 'Galerie venku / City Gallery', description: 'Samostatná nabídka pro projekt, lokalitu nebo připravovanou realizaci Galerie venku.', icon: GalleryHorizontalEnd, tone: 'bg-purple-50 text-purple-700 ring-purple-200' },
  { href: '/offers/new/standard', title: 'Standardní reklamní média', description: 'Existující lavičky, citypostery, CLV, towery a další pevné plochy s dostupností.', icon: PanelsTopLeft, tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
] as const;

export default async function NewOfferTypePage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  await requirePageAccess('offers');
  const { clientId } = await searchParams;
  return <AppShell><PageHeader description="Každý typ má vlastní data a workflow. Navigace nejsou běžné reklamní plochy." title="Jaký typ nabídky vytváříte?" /><div className="grid gap-5 lg:grid-cols-3">{types.map(({ href, title, description, icon: Icon, tone }) => {
    const targetHref = clientId ? `${href}?clientId=${encodeURIComponent(clientId)}` : href;
    return <Link className="group flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg" href={targetHref} key={href}><span className={`grid size-14 place-items-center rounded-2xl ring-1 ${tone}`}><Icon size={27} /></span><h2 className="mt-6 text-xl font-semibold text-slate-950">{title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{description}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">Pokračovat <ArrowRight className="transition group-hover:translate-x-1" size={16} /></span></Link>;
  })}</div></AppShell>;
}
