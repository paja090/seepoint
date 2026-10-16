'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CarrierFilterOptions, CarrierFilters } from '@/lib/db';
import { carrierTypeOptions, mediaTypeOptions, surfaceStatusOptions } from '@/lib/carrier-filters';
import { Search, SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';

type CarrierFiltersProps = {
  filters: CarrierFilters;
  options: CarrierFilterOptions;
  carrierTypes?: Array<{ id: string; code: string; name: string; icon?: string | null; color?: string | null }>;
  action: '/carriers' | '/map';
  resultCount: number;
};

function value(val?: string) {
  return val ?? '';
}

export function CarrierFilters({ filters, options, carrierTypes, action, resultCount }: CarrierFiltersProps) {
  const hasActiveAdvancedFilters = Boolean(
    filters.mediaType ||
    (filters.archived && filters.archived !== 'active') ||
    filters.gps ||
    filters.photo ||
    filters.damage ||
    filters.description ||
    filters.occupancy ||
    filters.importBatchId ||
    filters.locality ||
    filters.street
  );

  const activeAdvancedCount = [
    filters.mediaType,
    filters.archived && filters.archived !== 'active',
    filters.gps,
    filters.photo,
    filters.damage,
    filters.description,
    filters.occupancy,
    filters.importBatchId,
    filters.locality,
    filters.street,
  ].filter(Boolean).length;

  const [showAdvanced, setShowAdvanced] = useState(hasActiveAdvancedFilters);

  return (
    <form action={action} className="card mb-6 grid gap-4 !p-4 border border-slate-200/90 shadow-sm bg-white">
      {/* Hidden view parameter preservation */}
      {filters.view && <input type="hidden" name="view" defaultValue={filters.view} />}
      {/* Hidden carrierType if already selected via top category tabs */}
      {action === '/carriers' && (filters.carrierTypeId || filters.carrierType) && !showAdvanced && (
        <input type="hidden" name="carrierType" defaultValue={value(filters.carrierTypeId || filters.carrierType)} />
      )}

      {/* Primary Clean Filter Row */}
      <div className={action === '/map' ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end"}>
        <label className={action === '/map' ? "block" : "sm:col-span-2 lg:col-span-5"}>
          <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            <Search size={13} className="text-sky-600" />
            <span>Rychlé hledání</span>
          </span>
          <input
            className="input w-full"
            name="q"
            placeholder="Kód, číslo sloupu VO, název, ulice, klient…"
            type="search"
            defaultValue={value(filters.q)}
          />
        </label>

        <label className={action === '/map' ? "block" : "lg:col-span-3"}>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Město</span>
          <input
            className="input w-full"
            list={`${action}-cities`}
            name="city"
            defaultValue={value(filters.city)}
            placeholder="Všechna města"
          />
          <datalist id={`${action}-cities`}>{options.cities.map((item) => <option key={item} value={item} />)}</datalist>
        </label>

        <label className={action === '/map' ? "block" : "lg:col-span-2"}>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Klient</span>
          <input
            className="input w-full"
            list={`${action}-clients`}
            name="client"
            defaultValue={value(filters.client)}
            placeholder="Všichni klienti"
          />
          <datalist id={`${action}-clients`}>{options.clients.map((item) => <option key={item} value={item} />)}</datalist>
        </label>

        <label className={action === '/map' ? "block" : "lg:col-span-2"}>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">Obsazenost</span>
          <select className="input w-full" name="surfaceStatus" defaultValue={value(filters.surfaceStatus)}>
            <option value="">Všechny stavy</option>
            {surfaceStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Advanced / Collapsible Filter Section */}
      {showAdvanced && (
        <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Podrobné parametry filtru</span>
            {activeAdvancedCount > 0 && (
              <span className="text-sky-700 font-semibold lowercase">
                ({activeAdvancedCount} aktivních podrobných filtrů)
              </span>
            )}
          </div>

          <div className={action === '/map' ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1 text-xs" : "grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 text-xs"}>
            <label>
              <span className="mb-1 block font-semibold text-slate-600">Typ nosiče</span>
              <select className="input w-full" name="carrierType" defaultValue={value(filters.carrierTypeId || filters.carrierType)}>
                <option value="">Všechny typy</option>
                {carrierTypes && carrierTypes.length > 0
                  ? carrierTypes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.icon ? `${option.icon} ` : ''}{option.name}
                      </option>
                    ))
                  : carrierTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">Typ média</span>
              <select className="input w-full" name="mediaType" defaultValue={value(filters.mediaType)}>
                <option value="">Všechna média</option>
                {mediaTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">Část obce / Lokalita</span>
              <input className="input w-full" list={`${action}-localities`} name="locality" defaultValue={value(filters.locality)} placeholder="Část města / katastr" />
              <datalist id={`${action}-localities`}>{options.localities.map((item) => <option key={item} value={item} />)}</datalist>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">Ulice</span>
              <input className="input w-full" list={`${action}-streets`} name="street" defaultValue={value(filters.street)} placeholder="Ulice nebo orientační bod" />
              <datalist id={`${action}-streets`}>{options.streets.map((item) => <option key={item} value={item} />)}</datalist>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">GPS souřadnice</span>
              <select className="input w-full" name="gps" defaultValue={value(filters.gps)}>
                <option value="">Vše (s GPS i bez)</option>
                <option value="missing">Bez GPS (k doplnění)</option>
                <option value="present">S GPS polohou</option>
                <option value="UNVERIFIED">Čeká na ověření</option>
                <option value="VERIFIED">Ověřená poloha</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">Fotodokumentace</span>
              <select className="input w-full" name="photo" defaultValue={value(filters.photo)}>
                <option value="">Vše (s fotkou i bez)</option>
                <option value="missing">Bez fotografie</option>
                <option value="present">S fotografií</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block font-bold text-rose-600">🚨 Stav nosiče / Závada</span>
              <select className="input w-full font-semibold" name="damage" defaultValue={value(filters.damage)}>
                <option value="">Vše</option>
                <option value="present">🚨 Jen se ZÁVADOU</option>
                <option value="missing">✓ Bez závady (v pořádku)</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">Stav v archivu</span>
              <select className="input w-full" name="archived" defaultValue={filters.archived ?? 'active'}>
                <option value="active">Jen aktivní nosiče</option>
                <option value="archived">Jen archivované</option>
                <option value="all">Aktivní i archiv</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">Popis v terénu</span>
              <select className="input w-full" name="description" defaultValue={value(filters.description)}>
                <option value="">Vše</option>
                <option value="missing">Chybí popis umístění</option>
                <option value="present">Má popis umístění</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">Kampaň</span>
              <select className="input w-full" name="occupancy" defaultValue={value(filters.occupancy)}>
                <option value="">Vše</option>
                <option value="missing">Bez běžící kampaně</option>
                <option value="present">Má aktivní kampaň</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-600">Importní dávka</span>
              <select className="input w-full" name="importBatchId" defaultValue={value(filters.importBatchId)}>
                <option value="">Všechny importy</option>
                {options.importBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl bg-slate-950 hover:bg-slate-800 px-5 py-2.5 text-xs font-black text-white shadow-xs transition cursor-pointer"
            type="submit"
          >
            Filtrovat
          </button>
          <Link
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-950 transition"
            href={action}
          >
            Zrušit filtry
          </Link>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition cursor-pointer ml-1"
          >
            <SlidersHorizontal size={13} className="text-slate-500" />
            <span>{showAdvanced ? 'Méně filtrů' : 'Podrobné filtry'}</span>
            {activeAdvancedCount > 0 && !showAdvanced && (
              <span className="rounded-full bg-sky-600 px-1.5 py-0.2 text-[10px] font-black text-white">
                +{activeAdvancedCount}
              </span>
            )}
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        <span className="text-xs font-medium text-slate-500">
          Nalezeno: <strong className="font-extrabold text-slate-900">{resultCount}</strong> nosičů
        </span>
      </div>
    </form>
  );
}
