'use client';

import React, { useState, useEffect, useCallback } from 'react';

type WorkOrderRatePayload = {
  id: string;
  type: string;
  name: string;
  workType: string | null;
  amount: string;
  unit: string;
  validFrom: string;
  validTo: string | null;
};

type WorkOrderRatesManagerProps = {
  workOrderId: string;
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

export function WorkOrderRatesManager({ workOrderId }: WorkOrderRatesManagerProps) {
  const [rates, setRates] = useState<WorkOrderRatePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [type, setType] = useState('HOURLY');
  const [name, setName] = useState('Sazba zakázky');
  const [workType, setWorkType] = useState('INSTALLATION');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('hod');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState('');

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/rates`);
      if (res.ok) {
        const data = await res.json();
        setRates(data);
      }
    } catch {
      setErrorMsg('Chyba při načítání sazeb zakázky.');
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

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
      const res = await fetch(`/api/work-orders/${workOrderId}/rates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Uložení sazby selhalo.');
      }

      setSuccessMsg('Sazba zakázky byla úspěšně uložena.');
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
      const res = await fetch(`/api/work-orders/${workOrderId}/rates/${id}`, {
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
      const res = await fetch(`/api/work-orders/${workOrderId}/rates/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Smazání selhalo.');
      }

      setSuccessMsg('Sazba zakázky byla smazána.');
      fetchRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Smazání selhalo.';
      setErrorMsg(msg);
    }
  };

  const resetForm = () => {
    setType('HOURLY');
    setName('Sazba zakázky');
    setWorkType('INSTALLATION');
    setAmount('');
    setUnit('hod');
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo('');
  };

  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-bold">Specifické sazby pro tuto zakázku</h2>
      <p className="text-xs text-slate-500">
        Tyto sazby mají vyšší prioritu než globální firemní sazby. Jsou platné pouze pro tuto zakázku.
      </p>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800" role="status">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border-b pb-4">
        <label className="text-xs font-semibold">
          Typ sazby
          <select className="input mt-1 w-full text-xs" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="HOURLY">Hodinová (HOURLY)</option>
            <option value="TASK">Úkolová (TASK)</option>
            <option value="FIXED">Pevná (FIXED)</option>
          </select>
        </label>

        <label className="text-xs font-semibold">
          Název sazby / Popis
          <input
            className="input mt-1 w-full text-xs"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="např. Výšková montáž..."
          />
        </label>

        <label className="text-xs font-semibold">
          Druh práce
          <select
            className="input mt-1 w-full text-xs"
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

        <label className="text-xs font-semibold">
          Částka (CZK)
          <input
            className="input mt-1 w-full text-xs"
            required
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="např. 350"
          />
        </label>

        <label className="text-xs font-semibold">
          Jednotka
          <input
            className="input mt-1 w-full text-xs"
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="hod, ks..."
            disabled={type === 'HOURLY'}
          />
        </label>

        <label className="text-xs font-semibold">
          Platnost od
          <input
            type="date"
            className="input mt-1 w-full text-xs"
            required
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </label>

        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
          >
            Uložit sazbu
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-xs text-slate-500">Načítání sazeb...</p>
        ) : rates.length === 0 ? (
          <p className="text-xs text-slate-500 py-1">Nejsou nastaveny žádné specifické sazby pro tuto zakázku.</p>
        ) : (
          <table className="w-full text-left text-xs min-w-[500px]">
            <thead className="text-[10px] uppercase text-slate-500 border-b">
              <tr>
                <th className="py-1.5 pr-2">Název</th>
                <th className="py-1.5 pr-2">Typ</th>
                <th className="py-1.5 pr-2">Druh</th>
                <th className="py-1.5 pr-2">Sazba</th>
                <th className="py-1.5 pr-2">Platnost od</th>
                <th className="py-1.5 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => {
                const isActive = !rate.validTo || new Date(rate.validTo) >= new Date();
                return (
                  <tr className={`border-b last:border-0 hover:bg-slate-50/50 ${!isActive ? 'opacity-50' : ''}`} key={rate.id}>
                    <td className="py-2 pr-2 font-semibold text-slate-900">{rate.name}</td>
                    <td className="py-2 pr-2 text-slate-600">{rateTypeLabels[rate.type] || rate.type}</td>
                    <td className="py-2 pr-2 text-slate-700">
                      {rate.workType ? workTypeLabels[rate.workType] : 'Jakýkoliv'}
                    </td>
                    <td className="py-2 pr-2 font-bold text-slate-900">
                      {Number(rate.amount).toLocaleString('cs-CZ')} CZK / {rate.unit}
                    </td>
                    <td className="py-2 pr-2 text-slate-500">{new Date(rate.validFrom).toLocaleDateString('cs-CZ')}</td>
                    <td className="py-2 text-right space-x-1.5">
                      {isActive && (
                        <button
                          onClick={() => handleArchive(rate.id)}
                          className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Ukončit
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(rate.id)}
                        className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50"
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
      </div>
    </section>
  );
}
