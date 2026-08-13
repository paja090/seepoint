'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientLogoControl } from '@/components/ClientLogoControl';
import { Button } from '@/components/ui';
import { CLIENT_PRICING_SEGMENT_LABELS, CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS, CLIENT_SOURCE_LABELS, ClientProfileData, ClientStatus } from '@/lib/crm/types';

export function ClientHeader({ client }: { client: ClientProfileData }) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCommModal, setShowCommModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [name, setName] = useState(client.name || '');
  const [tradingName, setTradingName] = useState(client.tradingName || '');
  const [companyId, setCompanyId] = useState(client.companyId || '');
  const [dic, setDic] = useState(client.dic || '');
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [website, setWebsite] = useState(client.website || '');
  const [status, setStatus] = useState(client.status || 'ACTIVE');
  const [clientType] = useState(client.clientType || 'DIRECT_CLIENT');
  const [pricingSegment, setPricingSegment] = useState(client.pricingSegment || 'COMMERCIAL');
  const [source] = useState(client.source || 'WEBSITE');
  const [billingStreet, setBillingStreet] = useState(client.billingStreet || '');
  const [billingCity, setBillingCity] = useState(client.billingCity || '');
  const [billingZip, setBillingZip] = useState(client.billingZip || '');
  const [note, setNote] = useState(client.note || '');

  // Contact form state
  const [cFirstName, setCFirstName] = useState('');
  const [cLastName, setCLastName] = useState('');
  const [cTitle, CSetTitle] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cIsPrimary, setCIsPrimary] = useState(false);

  // Branch form state
  const [bName, setBName] = useState('');
  const [bCode, setBCode] = useState('');
  const [bStreet, setBStreet] = useState('');
  const [bCity, setBCity] = useState('');
  const [bZip, setBZip] = useState('');

  // Comm form state
  const [commType, setCommType] = useState('PHONE_CALL');
  const [commSubject, setCommSubject] = useState('');
  const [commContent, setCommContent] = useState('');
  const [commIsInternal] = useState(false);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);

  // Merge form state
  const [sourceClientId, setSourceClientId] = useState('');

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          tradingName,
          companyId,
          dic,
          email,
          phone,
          website,
          status,
          clientType,
          pricingSegment,
          source,
          billingStreet,
          billingCity,
          billingZip,
          note,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Chyba při úpravě profilu.');
      } else {
        setShowEditModal(false);
        router.refresh();
      }
    } catch {
      alert('Chyba při ukládání.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/clients/${client.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: cFirstName,
          lastName: cLastName,
          title: cTitle,
          email: cEmail,
          phone: cPhone,
          isPrimary: cIsPrimary,
        }),
      });
      if (res.ok) {
        setShowContactModal(false);
        router.refresh();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Chyba při zakládání kontaktu.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/clients/${client.id}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bName,
          code: bCode,
          street: bStreet,
          city: bCity,
          zip: bZip,
        }),
      });
      if (res.ok) {
        setShowBranchModal(false);
        router.refresh();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Chyba při zakládání pobočky.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddComm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/clients/${client.id}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: commType,
          subject: commSubject,
          content: commContent,
          isInternal: commIsInternal,
        }),
      });
      if (res.ok) {
        setShowCommModal(false);
        router.refresh();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Chyba při ukládání záznamu.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          title: taskTitle,
          dueDate: taskDueDate,
        }),
      });
      if (res.ok) {
        setShowTaskModal(false);
        router.refresh();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Chyba při zakládání úkolu.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMergeClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceClientId.trim()) return;
    if (!confirm(`Opravdu chcete sloučit zdrojového klienta (${sourceClientId}) do tohoto klienta? Všechny kontakty, nabídek i zakázky se převedou sem a zdrojový klient bude archivován.`)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/crm/clients/${client.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceClientId: sourceClientId.trim() }),
      });
      if (res.ok) {
        alert('Sloučení klientů proběhlo úspěšně.');
        setShowMergeModal(false);
        router.refresh();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Chyba při slučování klientů.');
      }
    } finally {
      setSaving(false);
    }
  };

  const statusObj = CLIENT_STATUS_LABELS[client.status as keyof typeof CLIENT_STATUS_LABELS] || CLIENT_STATUS_LABELS.ACTIVE;

  return (
    <div className="card space-y-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-xl border-slate-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="p-1 bg-white rounded-xl shadow-md">
            <ClientLogoControl
              clientId={client.id}
              clientName={client.name}
              logoUrl={client.logoDriveFileId ? `/api/clients/${client.id}/logo/file` : undefined}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-white">{client.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusObj.badge}`}>
                {statusObj.label}
              </span>
              <span className="bg-slate-700/80 text-slate-300 text-xs px-2.5 py-0.5 rounded-full border border-slate-600">
                {CLIENT_TYPE_LABELS[client.clientType as keyof typeof CLIENT_TYPE_LABELS] || client.clientType}
              </span>
            </div>

            {client.tradingName && <p className="text-slate-300 text-sm italic mt-0.5">{client.tradingName}</p>}

            <div className="flex items-center gap-4 text-xs text-slate-300 mt-2 flex-wrap">
              {client.companyId && <span>IČO: <strong className="text-white">{client.companyId}</strong></span>}
              {client.dic && <span>DIČ: <strong className="text-white">{client.dic}</strong></span>}
              {client.email && <span>E-mail: <a href={`mailto:${client.email}`} className="text-sky-300 hover:underline">{client.email}</a></span>}
              {client.phone && <span>Tel: <a href={`tel:${client.phone}`} className="text-sky-300 hover:underline">{client.phone}</a></span>}
              {client.website && <span>Web: <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">{client.website}</a></span>}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>Obchodník: <strong className="text-slate-200">{client.assignedUser?.name || 'Nepřiřazen'}</strong></span>
              <span>•</span>
              <span>Zdroj: <strong className="text-slate-200">{CLIENT_SOURCE_LABELS[client.source as keyof typeof CLIENT_SOURCE_LABELS] || client.source}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => setShowEditModal(true)} variant="secondary" className="!bg-slate-700 !text-white hover:!bg-slate-600 border-slate-600 text-xs">
            ✏️ Upravit profil
          </Button>
          <Button onClick={() => setShowMergeModal(true)} variant="secondary" className="!bg-purple-950 !text-purple-200 border-purple-800 hover:!bg-purple-900 text-xs">
            🔗 Sloučit duplicity
          </Button>
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-t border-slate-700/80 text-xs scrollbar-thin">
        <button onClick={() => setShowContactModal(true)} className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition">
          <span>➕</span> Kontakt
        </button>
        <button onClick={() => setShowBranchModal(true)} className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition">
          <span>➕</span> Pobočka
        </button>
        <a href={`/offers/new?clientId=${client.id}`} className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition">
          <span>📄</span> Nová Nabídka
        </a>
        <button onClick={() => setShowCommModal(true)} className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition">
          <span>📞</span> Záznam komunikace
        </button>
        <button onClick={() => setShowTaskModal(true)} className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition">
          <span>✅</span> Nový Úkol
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70 text-center">
          <div className="text-xs text-slate-400 font-medium">Aktivní kampaně</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{client.metrics.activeOccupanciesCount}</div>
        </div>
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70 text-center">
          <div className="text-xs text-slate-400 font-medium">Zakázky v přípravě</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{client.metrics.inPreparationOrdersCount}</div>
        </div>
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70 text-center">
          <div className="text-xs text-slate-400 font-medium">Celkem vyfakturováno</div>
          <div className="text-base font-bold text-sky-300 mt-1">{client.metrics.totalBilled.toLocaleString('cs-CZ')} Kč</div>
        </div>
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70 text-center">
          <div className="text-xs text-slate-400 font-medium">Neuhrazené faktury</div>
          <div className={`text-base font-bold mt-1 ${client.metrics.totalOverdue > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
            {client.metrics.totalUnpaid.toLocaleString('cs-CZ')} Kč
          </div>
        </div>
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70 text-center">
          <div className="text-xs text-slate-400 font-medium">Úkoly k řešení</div>
          <div className="text-xl font-bold text-indigo-300 mt-1">{client.metrics.pendingTasksCount}</div>
        </div>
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70 text-center">
          <div className="text-xs text-slate-400 font-medium">Smlouvy před koncem</div>
          <div className="text-xl font-bold text-purple-300 mt-1">{client.metrics.expiringContractsCount}</div>
        </div>
      </div>

      {/* Edit Client Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-2xl w-full bg-white max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold border-b pb-2">✏️ Úprava CRM Profilu Klienta</h2>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs font-semibold">Název společnosti *<input className="input text-sm mt-1" value={name} onChange={e => setName(e.target.value)} required /></label>
                <label className="text-xs font-semibold">Obchodní název (značka)<input className="input text-sm mt-1" value={tradingName} onChange={e => setTradingName(e.target.value)} /></label>
                <label className="text-xs font-semibold">IČO<input className="input text-sm mt-1" value={companyId} onChange={e => setCompanyId(e.target.value)} /></label>
                <label className="text-xs font-semibold">DIČ<input className="input text-sm mt-1" value={dic} onChange={e => setDic(e.target.value)} /></label>
                <label className="text-xs font-semibold">E-mail<input className="input text-sm mt-1" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
                <label className="text-xs font-semibold">Telefon<input className="input text-sm mt-1" value={phone} onChange={e => setPhone(e.target.value)} /></label>
                <label className="text-xs font-semibold">Webová stránka<input className="input text-sm mt-1" value={website} onChange={e => setWebsite(e.target.value)} /></label>
                <label className="text-xs font-semibold">Stav klienta
                  <select className="input text-sm mt-1" value={status} onChange={e => setStatus(e.target.value as ClientStatus)}>
                    <option value="ACTIVE">Aktivní klient</option>
                    <option value="LEAD">Lead / Poptávající</option>
                    <option value="INACTIVE">Neaktivní</option>
                    <option value="BLOCKED">Blokován</option>
                    <option value="FORMER_CLIENT">Bývalý klient</option>
                  </select>
                </label>
                <label className="text-xs font-semibold">Cenová kategorie
                  <select className="input text-sm mt-1" value={pricingSegment} onChange={e => setPricingSegment(e.target.value as typeof pricingSegment)}>
                    {Object.entries(CLIENT_PRICING_SEGMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <span className="mt-1 block font-normal text-slate-500">Změna platí jen pro nové nabídky; historické ceny zůstávají ve snapshotu.</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-xs font-semibold">Fakturační Ulice<input className="input text-sm mt-1" value={billingStreet} onChange={e => setBillingStreet(e.target.value)} /></label>
                <label className="text-xs font-semibold">Fakturační Město<input className="input text-sm mt-1" value={billingCity} onChange={e => setBillingCity(e.target.value)} /></label>
                <label className="text-xs font-semibold">Fakturační PSČ<input className="input text-sm mt-1" value={billingZip} onChange={e => setBillingZip(e.target.value)} /></label>
              </div>

              <label className="text-xs font-semibold">Interní poznámka<textarea className="input text-sm mt-1 h-20" value={note} onChange={e => setNote(e.target.value)} /></label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Ukládám...' : 'Uložit zmeny'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold border-b pb-2">➕ Přidat Kontaktní Osobu</h2>
            <form onSubmit={handleAddContact} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Jméno *<input className="input text-sm mt-1" value={cFirstName} onChange={e => setCFirstName(e.target.value)} required /></label>
                <label className="text-xs font-semibold">Příjmení *<input className="input text-sm mt-1" value={cLastName} onChange={e => setCLastName(e.target.value)} required /></label>
              </div>
              <label className="text-xs font-semibold">Pozice / Funkce<input className="input text-sm mt-1" placeholder="Např. Obchodní ředitel" value={cTitle} onChange={e => CSetTitle(e.target.value)} /></label>
              <label className="text-xs font-semibold">E-mail<input className="input text-sm mt-1" type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} /></label>
              <label className="text-xs font-semibold">Telefon<input className="input text-sm mt-1" value={cPhone} onChange={e => setCPhone(e.target.value)} /></label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input type="checkbox" checked={cIsPrimary} onChange={e => setCIsPrimary(e.target.checked)} />
                <span>Nastavit jako Hlavní kontakt klienta</span>
              </label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowContactModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Ukládám...' : 'Přidat kontakt'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold border-b pb-2">➕ Přidat Pobočku / Provozovnu</h2>
            <form onSubmit={handleAddBranch} className="space-y-3">
              <label className="text-xs font-semibold">Název pobočky *<input className="input text-sm mt-1" placeholder="Např. Prodejna Brno Vankovka" value={bName} onChange={e => setBName(e.target.value)} required /></label>
              <label className="text-xs font-semibold">Kód pobočky<input className="input text-sm mt-1" placeholder="Např. BRN-01" value={bCode} onChange={e => setBCode(e.target.value)} /></label>
              <label className="text-xs font-semibold">Ulice<input className="input text-sm mt-1" value={bStreet} onChange={e => setBStreet(e.target.value)} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Město<input className="input text-sm mt-1" value={bCity} onChange={e => setBCity(e.target.value)} /></label>
                <label className="text-xs font-semibold">PSČ<input className="input text-sm mt-1" value={bZip} onChange={e => setBZip(e.target.value)} /></label>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowBranchModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Ukládám...' : 'Přidat pobočku'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Communication Modal */}
      {showCommModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold border-b pb-2">📞 Zaznamenat Komunikaci</h2>
            <form onSubmit={handleAddComm} className="space-y-3">
              <label className="text-xs font-semibold">Typ komunikace
                <select className="input text-sm mt-1" value={commType} onChange={e => setCommType(e.target.value)}>
                  <option value="PHONE_CALL">📞 Telefonát</option>
                  <option value="EMAIL">✉️ E-mail</option>
                  <option value="IN_PERSON_MEETING">🤝 Osobní schůzka</option>
                  <option value="ONLINE_MEETING">💻 Online schůzka</option>
                  <option value="NOTE">📝 Poznámka</option>
                  <option value="INTERNAL_NOTE">🔒 Interní poznámka (neveřejná)</option>
                </select>
              </label>
              <label className="text-xs font-semibold">Předmět *<input className="input text-sm mt-1" placeholder="Např. Projednání prodloužení navigace" value={commSubject} onChange={e => setCommSubject(e.target.value)} required /></label>
              <label className="text-xs font-semibold">Obsah jednání *<textarea className="input text-sm mt-1 h-24" placeholder="Detailní zápis komunikace..." value={commContent} onChange={e => setCommContent(e.target.value)} required /></label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowCommModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Ukládám...' : 'Uložit zápis'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold border-b pb-2">✅ Nový Úkol pro Klienta</h2>
            <form onSubmit={handleAddTask} className="space-y-3">
              <label className="text-xs font-semibold">Název úkolu *<input className="input text-sm mt-1" placeholder="Např. Zavolat ohledně podkladů do tiskárny" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required /></label>
              <label className="text-xs font-semibold">Termín splnění *<input className="input text-sm mt-1" type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} required /></label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowTaskModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Ukládám...' : 'Vytvořit úkol'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold border-b pb-2 text-purple-950">🔗 Sloučit Duplicitního Klienta</h2>
            <p className="text-xs text-slate-600">Zadejte ID zdrojového klienta, který má být sloučen do cílového klienta <strong>{client.name}</strong>. Všechny zakázky, kontakty, nabídky a historii převedeme automaticky.</p>
            <form onSubmit={handleMergeClient} className="space-y-3">
              <label className="text-xs font-semibold">ID Zdrojového Klienta *<input className="input text-sm mt-1 font-mono" placeholder="Zadejte ID duplicitního klienta..." value={sourceClientId} onChange={e => setSourceClientId(e.target.value)} required /></label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowMergeModal(false)}>Zrušit</Button>
                <Button type="submit" variant="secondary" className="!bg-purple-900 !text-white hover:!bg-purple-800" disabled={saving}>{saving ? 'Provádím...' : 'Sloučit klienty'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
