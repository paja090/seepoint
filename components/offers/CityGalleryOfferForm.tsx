'use client';

import { ArrowLeft, GalleryHorizontalEnd, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { OfferView } from '@/lib/offers/view-model';

type Client = { id: string; name: string };
type Project = { id: string; title: string; city: string | null; status: string };

export function CityGalleryOfferForm({ clients, projects, initialOffer }: { clients: Client[]; projects: Project[]; initialOffer?: OfferView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(formData: FormData) {
    setBusy(true);
    setError('');
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch(initialOffer?.id ? `/api/offers/city-gallery/${initialOffer.id}` : '/api/offers/city-gallery', { method: initialOffer?.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json() as { offer?: { id: string }; id?: string; error?: string };
      const offerId = data.offer?.id ?? data.id ?? initialOffer?.id;
      if (!response.ok || !offerId) throw new Error(data.error || 'Nabídku se nepodařilo uložit.');
      router.push(`/offers/${offerId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nabídku se nepodařilo uložit.');
      setBusy(false);
    }
  }

  const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
  return (
    <div className="mx-auto max-w-5xl">
      <Link className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950" href={initialOffer?.id ? `/offers/${initialOffer.id}` : '/offers/new'}><ArrowLeft size={16} /> {initialOffer ? 'Zpět na nabídku' : 'Zpět na výběr typu'}</Link>
      <header className="mb-6 flex items-start gap-4"><span className="rounded-2xl bg-fuchsia-100 p-3 text-fuchsia-700"><GalleryHorizontalEnd size={24} /></span><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-fuchsia-700">Galerie venku</p><h1 className="text-3xl font-semibold tracking-tight">{initialOffer ? 'Upravit nabídku City Gallery' : 'Nová nabídka City Gallery'}</h1><p className="mt-2 text-sm text-slate-500">Samostatná nabídka projektu, bez vazby na běžné reklamní plochy.</p></div></header>
      <form action={(data) => void submit(data)} className="space-y-5">
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <label className="text-sm font-medium">Klient<select className={field} defaultValue={initialOffer?.clientId ?? ''} name="clientId" required><option value="">Vyberte klienta</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label className="text-sm font-medium">Existující projekt (volitelné)<select className={field} defaultValue={initialOffer?.cityGallery?.projectId ?? ''} name="projectId"><option value="">Nová příležitost bez projektu</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}{project.city ? ` · ${project.city}` : ''}</option>)}</select></label>
          <label className="text-sm font-medium md:col-span-2">Název nabídky<input className={field} defaultValue={initialOffer?.title ?? ''} name="title" required /></label>
          <label className="text-sm font-medium md:col-span-2">Název kampaně<input className={field} defaultValue={initialOffer?.campaignName ?? ''} name="campaignName" /></label>
          <label className="text-sm font-medium">Kontaktní osoba<input className={field} defaultValue={initialOffer?.contactPerson ?? ''} name="contactPerson" /></label><label className="text-sm font-medium">Kontaktní e-mail<input className={field} defaultValue={initialOffer?.contactEmail ?? ''} name="contactEmail" type="email" /></label><label className="text-sm font-medium">Telefon<input className={field} defaultValue={initialOffer?.contactPhone ?? ''} name="contactPhone" /></label><label className="text-sm font-medium">Platnost nabídky<input className={field} defaultValue={initialOffer?.validUntil ?? ''} name="validUntil" type="date" /></label>
          <label className="text-sm font-medium md:col-span-2">Cena bez DPH<input className={field} defaultValue={initialOffer?.subtotal ?? '0'} min="0" name="subtotal" step="0.01" type="number" /></label>
        </section>
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-medium">Koncept projektu<textarea className={field} defaultValue={initialOffer?.cityGallery?.concept ?? ''} name="concept" rows={4} /></label>
          <label className="text-sm font-medium">Lokalita / zadání prostoru<textarea className={field} defaultValue={initialOffer?.cityGallery?.locationBrief ?? ''} name="locationBrief" rows={3} /></label>
          <label className="text-sm font-medium">Poznámka k realizaci<textarea className={field} defaultValue={initialOffer?.cityGallery?.realizationNote ?? ''} name="realizationNote" rows={3} /></label>
          <label className="text-sm font-medium">Sdělení klientovi<textarea className={field} defaultValue={initialOffer?.clientMessage ?? ''} name="clientMessage" rows={3} /></label>
          <label className="text-sm font-medium">Interní poznámka<textarea className={field} defaultValue={initialOffer?.internalNote ?? ''} name="internalNote" rows={3} /></label>
        </section>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end"><button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">{busy && <LoaderCircle className="animate-spin" size={17} />} Uložit koncept</button></div>
      </form>
    </div>
  );
}
