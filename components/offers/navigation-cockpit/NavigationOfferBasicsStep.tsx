'use client';

import { useState } from 'react';
import { Building2, Calendar, MapPin, Plus, UserPlus, X, Check } from 'lucide-react';
import type { ClientOption } from './types';

interface NavigationOfferBasicsStepProps {
  clients: ClientOption[];
  selectedClientId: string;
  onClientChange: (clientId: string) => void;
  campaignName: string;
  onCampaignNameChange: (name: string) => void;
  city: string;
  onCityChange: (city: string) => void;
  validUntil: string;
  onValidUntilChange: (date: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
  onClientCreated?: (newClient: ClientOption) => void;
}

export function NavigationOfferBasicsStep({
  clients,
  selectedClientId,
  onClientChange,
  campaignName,
  onCampaignNameChange,
  city,
  onCityChange,
  validUntil,
  onValidUntilChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClientCreated,
}: NavigationOfferBasicsStepProps) {
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientPerson, setNewClientPerson] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientError, setNewClientError] = useState('');

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const popularCities = ['Ostrava', 'Havířov', 'Opava', 'Frýdek-Místek', 'Karviná', 'Praha', 'Brno'];

  async function handleCreateClient() {
    if (!newClientName.trim()) {
      setNewClientError('Vyplňte název klienta.');
      return;
    }
    setCreatingClient(true);
    setNewClientError('');

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName.trim(),
          email: newClientEmail.trim() || undefined,
          phone: newClientPhone.trim() || undefined,
          contactPerson: newClientPerson.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error || 'Klienta se nepodařilo vytvořit.');
      }

      const created: ClientOption = {
        id: data.id,
        name: data.name || newClientName.trim(),
        email: data.email || newClientEmail.trim() || null,
        phone: data.phone || newClientPhone.trim() || null,
        contactPerson: data.contactPerson || newClientPerson.trim() || null,
        branches: [],
      };

      if (onClientCreated) {
        onClientCreated(created);
      }
      onClientChange(created.id);
      setShowNewClientModal(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientPerson('');
    } catch (err) {
      setNewClientError(err instanceof Error ? err.message : 'Chyba při zakládání klienta.');
    } finally {
      setCreatingClient(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="text-sky-600" size={18} />
            <span>Základní údaje nabídky a klient</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Zadejte klienta, pro kterého navigaci připravujete, název kampaně a plánované období.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Klient */}
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Klient / Odběratel <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowNewClientModal(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-800 hover:underline cursor-pointer"
              >
                <UserPlus size={13} /> + Rychle vytvořit nového klienta
              </button>
            </div>

            <select
              className="input font-semibold text-slate-900"
              value={selectedClientId}
              onChange={(e) => onClientChange(e.target.value)}
            >
              <option value="">Vyberte klienta ze seznamu...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.contactPerson ? `(${c.contactPerson})` : ''}
                </option>
              ))}
            </select>

            {selectedClient && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                {selectedClient.contactPerson && (
                  <span>👤 Kontakt: <strong className="text-slate-900">{selectedClient.contactPerson}</strong></span>
                )}
                {selectedClient.email && (
                  <span>✉️ {selectedClient.email}</span>
                )}
                {selectedClient.phone && (
                  <span>📞 {selectedClient.phone}</span>
                )}
                {selectedClient.branches && selectedClient.branches.length > 0 && (
                  <span className="font-semibold text-sky-800">
                    🏬 {selectedClient.branches.length} uložených poboček
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Název kampaně */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">
              Název kampaně / Nabídky <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              className="input font-semibold"
              placeholder="např. Navigační značení prodejny – Ostrava"
              value={campaignName}
              onChange={(e) => onCampaignNameChange(e.target.value)}
            />
          </div>

          {/* Město */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">
              Město / Lokalita kampaně
            </label>
            <input
              type="text"
              className="input"
              placeholder="např. Ostrava, Havířov..."
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {popularCities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCityChange(c)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold border transition cursor-pointer ${
                    city.toLowerCase() === c.toLowerCase()
                      ? 'bg-sky-100 text-sky-900 border-sky-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Platnost nabídky */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              <span>Platnost nabídky do</span>
            </label>
            <input
              type="date"
              className="input"
              value={validUntil}
              onChange={(e) => onValidUntilChange(e.target.value)}
            />
          </div>

          {/* Termín realizace */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              <span>Předpokládaný termín kampaně</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="input"
                placeholder="Od"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
              <input
                type="date"
                className="input"
                placeholder="Do"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Modal for creating client */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus size={18} className="text-sky-600" />
                <span>Nový klient</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewClientModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {newClientError && (
              <p className="rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-800 border border-rose-200">
                {newClientError}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Název firmy / Jméno klienta <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="např. Autocentrum Morava s.r.o."
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Kontaktní osoba</label>
                <input
                  type="text"
                  className="input"
                  placeholder="např. Ing. Jan Novák"
                  value={newClientPerson}
                  onChange={(e) => setNewClientPerson(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">E-mail</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="novak@firma.cz"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Telefon</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+420 777 123 456"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowNewClientModal(false)}
                className="btn btn-secondary text-xs px-3 py-2 font-bold cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                disabled={creatingClient}
                onClick={handleCreateClient}
                className="btn btn-primary text-xs px-4 py-2 font-bold cursor-pointer"
              >
                {creatingClient ? 'Ukládám...' : 'Vytvořit a vybrat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
