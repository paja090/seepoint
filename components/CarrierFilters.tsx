import Link from 'next/link';
import type { CarrierFilterOptions, CarrierFilters } from '@/lib/db';
import { carrierTypeOptions, mediaTypeOptions, surfaceStatusOptions } from '@/lib/carrier-filters';

type CarrierFiltersProps = {
  filters: CarrierFilters;
  options: CarrierFilterOptions;
  action: '/carriers' | '/map';
  resultCount: number;
};

function value(value?: string) {
  return value ?? '';
}

export function CarrierFilters({ filters, options, action, resultCount }: CarrierFiltersProps) {
  return (
    <form action={action} className="card mb-6 grid gap-3 !p-4">
      <div className={action === '/map' ? "grid gap-3" : "flex flex-col gap-3 lg:flex-row lg:items-end"}>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hledání</span>
          <input className="input" name="q" placeholder="Kód, název, adresa, klient…" type="search" defaultValue={value(filters.q)} />
        </label>
        <label className="lg:w-52">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Typ nosiče</span>
          <select className="input" name="carrierType" defaultValue={value(filters.carrierType)}>
            <option value="">Všechny typy</option>
            {carrierTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="lg:w-52">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Typ média</span>
          <select className="input" name="mediaType" defaultValue={value(filters.mediaType)}>
            <option value="">Všechna média</option>
            {mediaTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="lg:w-52">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Obsazenost</span>
          <select className="input" name="surfaceStatus" defaultValue={value(filters.surfaceStatus)}>
            <option value="">Všechny stavy</option>
            {surfaceStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className={action === '/map' ? "grid gap-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-4"}>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Město</span>
          <input className="input" list={`${action}-cities`} name="city" defaultValue={value(filters.city)} placeholder="Např. Ostrava" />
          <datalist id={`${action}-cities`}>{options.cities.map((item) => <option key={item} value={item} />)}</datalist>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lokalita</span>
          <input className="input" list={`${action}-localities`} name="locality" defaultValue={value(filters.locality)} placeholder="Část města / katastr" />
          <datalist id={`${action}-localities`}>{options.localities.map((item) => <option key={item} value={item} />)}</datalist>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ulice</span>
          <input className="input" list={`${action}-streets`} name="street" defaultValue={value(filters.street)} placeholder="Ulice nebo adresa" />
          <datalist id={`${action}-streets`}>{options.streets.map((item) => <option key={item} value={item} />)}</datalist>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Klient</span>
          <input className="input" list={`${action}-clients`} name="client" defaultValue={value(filters.client)} placeholder="Název klienta" />
          <datalist id={`${action}-clients`}>{options.clients.map((item) => <option key={item} value={item} />)}</datalist>
        </label>
      </div>

      <div className={action === '/map' ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-1" : "grid gap-3 md:grid-cols-2 xl:grid-cols-6"}>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Archiv</span>
          <select className="input" name="archived" defaultValue={filters.archived ?? 'active'}>
            <option value="active">Jen aktivní</option>
            <option value="archived">Jen archivované</option>
            <option value="all">Aktivní i archiv</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">GPS</span>
          <select className="input" name="gps" defaultValue={value(filters.gps)}>
            <option value="">Vše</option>
            <option value="missing">Bez GPS</option>
            <option value="present">S GPS</option>
            <option value="UNVERIFIED">Čeká na kontrolu</option>
            <option value="VERIFIED">Ověřeno</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fotka</span>
          <select className="input" name="photo" defaultValue={value(filters.photo)}>
            <option value="">Vše</option>
            <option value="missing">Bez fotky</option>
            <option value="present">S fotkou</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Popis</span>
          <select className="input" name="description" defaultValue={value(filters.description)}>
            <option value="">Vše</option>
            <option value="missing">Chybí popis</option>
            <option value="present">Má popis</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kampaň</span>
          <select className="input" name="occupancy" defaultValue={value(filters.occupancy)}>
            <option value="">Vše</option>
            <option value="missing">Bez aktuální kampaně</option>
            <option value="present">Má aktuální kampaň</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Import</span>
          <select className="input" name="importBatchId" defaultValue={value(filters.importBatchId)}>
            <option value="">Všechny importy</option>
            {options.importBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">Filtrovat</button>
        <Link className="text-sm font-medium text-slate-600 hover:text-slate-950" href={action}>Zrušit filtry</Link>
        <span className="ml-auto text-sm text-slate-500">Nalezeno: <strong className="text-slate-900">{resultCount}</strong></span>
      </div>
    </form>
  );
}
