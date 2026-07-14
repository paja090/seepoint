'use client';

import React, { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Rate = {
  id: string;
  name: string;
  type: string;
  amount: string;
  currency: string;
  unit: string | null;
  workType: string | null;
  carrierType?: string | null;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
};

const labels: Record<string, string> = {
  HOURLY: 'Hodinová',
  TASK: 'Úkolová',
  FIXED: 'Pevná',
};

const works = ['INSTALLATION', 'REINSTALLATION', 'DEINSTALLATION', 'REPAIR', 'CHECK', 'TRANSPORT', 'OTHER'];

const workTypeLabels: Record<string, string> = {
  INSTALLATION: 'Instalace',
  REINSTALLATION: 'Reinstalace',
  DEINSTALLATION: 'Deinstalace',
  REPAIR: 'Oprava',
  CHECK: 'Kontrola',
  TRANSPORT: 'Převoz',
  OTHER: 'Jiná práce',
};

const carrierTypeLabels: Record<string, string> = {
  BILLBOARD: 'Billboard',
  BIGBOARD: 'Bigboard',
  CITYLIGHT: 'CLV (Citylight)',
  BANNER: 'Banner',
  FACADE: 'Fasáda',
  LED_SCREEN: 'LED obrazovka',
  PROMO_BENCH: 'Lavička',
  PROMO_HORIZON: 'Horizon',
  CITY_POSTER: 'City Poster',
  NAVIGATION: 'Navigace',
  PROMO_TOWER: 'Tower',
  PROMO_MINITOWER: 'Minitower',
  OTHER: 'Jiné',
};

export function EmployeeRates({
  employeeId,
  rates,
  editable,
}: {
  employeeId: string;
  rates: Rate[];
  editable: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState('');

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Ensure empty option yields null in JSON
    if (!data.workType) data.workType = '';
    if (!data.carrierType) data.carrierType = '';

    const res = await fetch(`/api/employees/${employeeId}/rates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const out = await res.json();
    setMsg(out.error ?? 'Sazba byla vytvořena.');
    if (res.ok) {
      form.reset();
      router.refresh();
    }
  }

  async function end(id: string) {
    const validTo = prompt('Ukončit ke dni (RRRR-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!validTo) return;
    const res = await fetch(`/api/employees/${employeeId}/rates/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'end', validTo }),
    });
    const out = await res.json();
    setMsg(out.error ?? 'Sazba byla ukončena.');
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <section className="card mt-6">
      <h2 className="text-xl font-bold">Sazby</h2>
      <p className="mt-1 text-sm text-slate-500">
        Změna částky přes API vytváří novou verzi a zachová historii.
      </p>
      
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="py-2">Název</th>
              <th>Typ</th>
              <th>Typ práce</th>
              <th>Typ nosiče</th>
              <th>Částka</th>
              <th>Platnost</th>
              <th>Stav</th>
              {editable && <th>Akce</th>}
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr className="border-b last:border-0" key={r.id}>
                <td className="py-3 font-semibold text-slate-900">{r.name}</td>
                <td>{labels[r.type] ?? r.type}</td>
                <td>{r.workType ? (workTypeLabels[r.workType] || r.workType) : 'Obecná'}</td>
                <td>{r.carrierType ? (carrierTypeLabels[r.carrierType] || r.carrierType) : 'Jakýkoliv'}</td>
                <td className="font-bold text-slate-900">
                  {Number(r.amount).toLocaleString('cs-CZ')} {r.currency}
                  {r.unit ? ` / ${r.unit}` : ''}
                </td>
                <td className="text-slate-500">{r.validFrom} – {r.validTo ?? 'bez omezení'}</td>
                <td>{r.isActive ? 'Aktivní' : 'Historická'}</td>
                {editable && (
                  <td>
                    {r.isActive && (
                      <button className="table-action text-blue-600 hover:underline" onClick={() => end(r.id)}>
                        Ukončit
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rates.length && <p className="py-4 text-sm text-slate-500">Žádné sazby.</p>}
      </div>

      {editable && (
        <form className="mt-5 grid gap-3 md:grid-cols-3" onSubmit={create}>
          <label className="text-sm font-semibold">
            Název
            <input className="input mt-1 w-full" name="name" required />
          </label>
          <label className="text-sm font-semibold">
            Typ
            <select className="input mt-1 w-full" name="type">
              <option value="HOURLY">Hodinová</option>
              <option value="TASK">Úkolová</option>
              <option value="FIXED">Pevná</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Typ práce
            <select className="input mt-1 w-full" name="workType">
              <option value="">Obecná</option>
              {works.map((x) => (
                <option key={x} value={x}>
                  {workTypeLabels[x] || x}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Typ nosiče / plochy
            <select className="input mt-1 w-full" name="carrierType">
              <option value="">Jakýkoliv</option>
              {Object.entries(carrierTypeLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Částka
            <input className="input mt-1 w-full" name="amount" required />
          </label>
          <label className="text-sm font-semibold">
            Měna
            <input className="input mt-1 w-full" name="currency" defaultValue="CZK" />
          </label>
          <label className="text-sm font-semibold">
            Jednotka
            <input className="input mt-1 w-full" name="unit" />
          </label>
          <label className="text-sm font-semibold">
            Platnost od
            <input className="input mt-1 w-full" name="validFrom" type="date" required />
          </label>
          <label className="text-sm font-semibold">
            Platnost do
            <input className="input mt-1 w-full" name="validTo" type="date" />
          </label>
          <label className="text-sm font-semibold md:col-span-3">
            Poznámka
            <input className="input mt-1 w-full" name="note" />
          </label>
          <div className="md:col-span-3 flex justify-end">
            <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
              Přidat sazbu
            </button>
          </div>
        </form>
      )}
      {msg && <p className="mt-3 text-sm text-slate-800 font-semibold">{msg}</p>}
    </section>
  );
}
