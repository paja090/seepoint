'use client';

import React, { useState, useEffect } from 'react';

type CompanyRatePayload = {
  id: string;
  type: string;
  name: string;
  workType: string | null;
  amount: string;
  unit: string;
  validFrom: string;
  validTo: string | null;
};

const workTypeLabels: Record<string, string> = {
  INSTALLATION: 'Instalace',
  REINSTALLATION: 'Reinstalace',
  DEINSTALLATION: 'Deinstalace',
  REPAIR: 'Oprava',
  CHECK: 'Kontrola',
  TRANSPORT: 'Převoz',
  OTHER: 'Jiná práce',
};

const rateTypeLabels: Record<string, string> = {
  HOURLY: 'Hodinová',
  TASK: 'Úkolová',
  FIXED: 'Pevná částka',
};

export function CompanyRatesSettings() {
  const [rates, setRates] = useState<CompanyRatePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [type, setType] = useState('HOURLY');
  const [name, setName] = useState('Základní firemní sazba');
  const [workType, setWorkType] = useState<string>('INSTALLATION');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('hod');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState('');

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/company-rates');
      if (res.ok) {
        const data = await res.json();
        setRates(data);
      }
    } catch {
      setErrorMsg('Chyba při načítání firemních sazeb.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  // Set unit default on type change
  useEffect(() => {
    if (type === 'HOURLY') {
      setUnit('hod');
    } else {
      setUnit('ks');
    }
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const body = {
      type,
      name,
      workType: workType || null,
      amount,
      unit,
      validFrom,
      validTo: validTo || null,
    };

    try {
      const res = await fetch('/api/company-rates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Uložení sazby selhalo.');
      }

      setSuccessMsg('Globální firemní sazba byla úspěšně uložena.');
      resetForm();
      fetchRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Uložení selhalo.';
      setErrorMsg(msg);
    }
  };

  const handleArchive = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    const today = new Date().toISOString().slice(0, 10);

    try {
      const res = await fetch(`/api/company-rates/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ validTo: today }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ukončení sazby selhalo.');
      }

      setSuccessMsg('Sazba byla ukončena k dnešnímu dni.');
      fetchRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ukončení selhalo.';
      setErrorMsg(msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu chcete tuto sazbu smazat?')) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/company-rates/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Smazání selhalo.');
      }

      setSuccessMsg('Firemní sazba byla smazána.');
      fetchRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Smazání selhalo.';
      setErrorMsg(msg);
    }
  };

  const resetForm = () => {
    setType('HOURLY');
    setName('Základní firemní sazba');
    setWorkType('INSTALLATION');
    setAmount('');
    setUnit('hod');
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo('');
  };

  return (
    <div className="space-y-6 mt-6">
      <h2 className="text-2xl font-bold">Globální firemní sazby</h2>
      <p className="text-sm text-slate-500">
        Výchozí odměňování pro pracovníky, pokud nemají definovanou individuální sazbu.
      </p>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <h3 className="sm:col-span-2 md:col-span-3 lg:col-span-4 text-lg font-bold border-b pb-2">
          Přidat firemní sazbu
        </h3>

        <label className="text-sm font-semibold">
          Typ sazby
          <select className="input mt-1 w-full" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="HOURLY">Hodinová (HOURLY)</option>
            <option value="TASK">Úkolová (TASK)</option>
            <option value="FIXED">Pevná (FIXED)</option>
          </select>
        </label>

        <label className="text-sm font-semibold">
          Název sazby / Popis
          <input
            className="input mt-1 w-full"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="např. Montážník standard..."
          />
        </label>

        <label className="text-sm font-semibold">
          Druh práce
          <select
            className="input mt-1 w-full"
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
          >
            <option value="">Jakýkoliv druh práce</option>
            {Object.entries(workTypeLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold">
          Částka (CZK)
          <input
            className="input mt-1 w-full"
            required
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="např. 250"
          />
        </label>

        <label className="text-sm font-semibold">
          Jednotka
          <input
            className="input mt-1 w-full"
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="hod, ks..."
            disabled={type === 'HOURLY'}
          />
        </label>

        <label className="text-sm font-semibold">
          Platnost od
          <input
            type="date"
            className="input mt-1 w-full"
            required
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </label>

        <label className="text-sm font-semibold">
          Platnost do (volitelné)
          <input
            type="date"
            className="input mt-1 w-full"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
          />
        </label>

        <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
          >
            Uložit sazbu
          </button>
        </div>
      </form>

      <section className="card overflow-x-auto">
        <h3 className="text-lg font-bold mb-4">Aktuální přehled sazeb</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Načítání...</p>
        ) : rates.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">Nejsou nastaveny žádné globální firemní sazby.</p>
        ) : (
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="text-xs uppercase text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-3">Název</th>
                <th className="py-2 pr-3">Typ</th>
                <th className="py-2 pr-3">Druh práce</th>
                <th className="py-2 pr-3">Sazba</th>
                <th className="py-2 pr-3">Platnost od</th>
                <th className="py-2 pr-3">Platnost do</th>
                <th className="py-2 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => {
                const isActive = !rate.validTo || new Date(rate.validTo) >= new Date();
                return (
                  <tr className={`border-b last:border-0 hover:bg-slate-50/50 ${!isActive ? 'opacity-50' : ''}`} key={rate.id}>
                    <td className="py-3 pr-3 font-semibold text-slate-900">{rate.name}</td>
                    <td className="py-3 pr-3 text-slate-600">{rateTypeLabels[rate.type] || rate.type}</td>
                    <td className="py-3 pr-3 text-slate-700">
                      {rate.workType ? workTypeLabels[rate.workType] : 'Jakýkoliv'}
                    </td>
                    <td className="py-3 pr-3 font-bold text-slate-900">
                      {Number(rate.amount).toLocaleString('cs-CZ')} CZK / {rate.unit}
                    </td>
                    <td className="py-3 pr-3 text-slate-500">{new Date(rate.validFrom).toLocaleDateString('cs-CZ')}</td>
                    <td className="py-3 pr-3 text-slate-500">
                      {rate.validTo ? new Date(rate.validTo).toLocaleDateString('cs-CZ') : 'Nekonečná'}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      {isActive && (
                        <button
                          onClick={() => handleArchive(rate.id)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Ukončit dnes
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(rate.id)}
                        className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
