'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProjectSubNav } from '../navigation/ProjectSubNav';
import { Search, Layers } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { cityInventoryCategory, type CityInventoryCategory, type CityInventorySummary } from '@/lib/city-inventory';
import { carrierTypeLabel } from '@/lib/carrier-filters';
import type { CarrierType } from '@prisma/client';

export type CarrierItem = {
  id: string;
  code: string;
  name: string;
  city: string;
  type: CarrierType;
  status: string;
  address: string | null;
};

const navItems = [
  { href: '/projects/city-inventory', label: '📊 Přehled & Nástěnka' },
  { href: '/carriers', label: '🪧 Evidence nosičů' },
  { href: '/occupancy', label: '📅 Obsazenost ploch' },
  { href: '/map', label: '🗺️ Mapa nosičů' },
];

export function CityInventoryModuleClient({ carriers, summary }: { carriers: CarrierItem[]; summary: CityInventorySummary }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | CityInventoryCategory>('ALL');

  const totalCarriers = summary.total;

  const filteredCarriers = carriers.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase());

    if (selectedType === 'ALL') return matchesSearch;
    return matchesSearch && cityInventoryCategory(c.type) === selectedType;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">Městský Reklamní Inventář</span>
        <h1 className="text-3xl font-black text-slate-900">🪧 City Postery, Lavičky & Nosiče</h1>
        <p className="text-xs text-slate-500 mt-1">
          Přehled a správa všech reklamních ploch, městského mobiliáře a obsazenosti po celém Česku.
        </p>
      </div>

      {/* Shared SubNav Tabs */}
      <ProjectSubNav items={navItems} />

      {/* Mini Dashboard KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* City Postery */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === 'POSTER' ? 'ALL' : 'POSTER')}
          aria-pressed={selectedType === 'POSTER'}
          className={`card text-left p-5 transition cursor-pointer border-2 ${
            selectedType === 'POSTER' ? 'border-sky-500 bg-sky-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-xl bg-sky-100 p-2 text-sky-700 font-bold">🖼️</span>
            <span className="text-[11px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md">City Postery</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{summary.categories.POSTER} ks</div>
            <p className="text-xs text-slate-500 mt-0.5">Plakáty na sloupech VO a panelech</p>
          </div>
        </button>

        {/* Lavičky */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === 'BENCH' ? 'ALL' : 'BENCH')}
          aria-pressed={selectedType === 'BENCH'}
          className={`card text-left p-5 transition cursor-pointer border-2 ${
            selectedType === 'BENCH' ? 'border-emerald-500 bg-emerald-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700 font-bold">🪑</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Lavičky</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{summary.categories.BENCH} ks</div>
            <p className="text-xs text-slate-500 mt-0.5">Reklama na městských lavičkách</p>
          </div>
        </button>

        {/* Navigační nosiče */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === 'NAVIGATION' ? 'ALL' : 'NAVIGATION')}
          aria-pressed={selectedType === 'NAVIGATION'}
          className={`card text-left p-5 transition cursor-pointer border-2 ${
            selectedType === 'NAVIGATION' ? 'border-amber-500 bg-amber-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700 font-bold">🧭</span>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">Navigace</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{summary.categories.NAVIGATION} ks</div>
            <p className="text-xs text-slate-500 mt-0.5">Navigační směrové nosiče</p>
          </div>
        </button>

        {/* Solitéry & Ostatní */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === 'OTHER' ? 'ALL' : 'OTHER')}
          aria-pressed={selectedType === 'OTHER'}
          className={`card text-left p-5 transition cursor-pointer border-2 ${
            selectedType === 'OTHER' ? 'border-purple-500 bg-purple-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-xl bg-purple-100 p-2 text-purple-700 font-bold">🪧</span>
            <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">Solitéry & Ostatní</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{summary.categories.OTHER} ks</div>
            <p className="text-xs text-slate-500 mt-0.5">Ostatní nosiče a panely</p>
          </div>
        </button>
      </div>

      {/* Inventory Table Section */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-slate-700" />
            <h2 className="text-lg font-bold text-slate-900">Seznam inventáře nosičů</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {filteredCarriers.length} / {summary.displayed} z {totalCarriers}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Hledat v zobrazeném náhledu..."
                aria-label="Hledat v zobrazeném náhledu inventáře"
                className="input w-full pl-8 py-1.5 text-xs border-slate-300 rounded-xl"
              />
            </div>

            <Link
              href="/carriers"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
            >
              + Správa nosičů
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span>
            Aktivní: <strong>{summary.statuses.ACTIVE}</strong> · Údržba: <strong>{summary.statuses.MAINTENANCE}</strong> · Neaktivní: <strong>{summary.statuses.INACTIVE}</strong>
          </span>
          {summary.displayed < summary.total && (
            <span>
              Dashboard zobrazuje vyvážený náhled {summary.displayed} z {summary.total} nearchivovaných nosičů, nejvýše 60 z každé kategorie.{' '}
              <Link href="/carriers" className="font-bold text-sky-700 hover:underline">Otevřít úplnou stránkovanou evidenci</Link>
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 uppercase tracking-wider text-slate-500 text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Kód</th>
                <th className="py-2.5 px-3">Název nosiče</th>
                <th className="py-2.5 px-3">Město / Lokalita</th>
                <th className="py-2.5 px-3">Typ inventáře</th>
                <th className="py-2.5 px-3">Stav</th>
                <th className="py-2.5 px-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCarriers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    Žádný nosič neodpovídá zadání.
                  </td>
                </tr>
              ) : (
                filteredCarriers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{c.code}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{c.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      📍 {c.city} {c.address ? `(${c.address})` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">{carrierTypeLabel(c.type)}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge value={c.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/carriers/${c.id}`}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Detail ➔
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
