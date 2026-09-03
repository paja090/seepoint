'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientLogoControl } from '@/components/ClientLogoControl';
import { Button } from '@/components/ui';
import { CLIENT_PRICING_SEGMENT_LABELS, CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS, CLIENT_SOURCE_LABELS, ClientProfileData, ClientStatus } from '@/lib/crm/types';
import { Building2, ShieldCheck, Mail, Phone, Globe, MapPin, Plus, Edit3, Trash2, Link2, CheckSquare, MessageSquare, FilePlus, Store, AlertTriangle, TrendingUp, DollarSign, Layers } from 'lucide-react';

export function ClientHeader({ client, canManageLifecycle }: { client: ClientProfileData; canManageLifecycle: boolean }) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCommModal, setShowCommModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const handleArchiveClient = async () => {
    if (!confirm(`Opravdu chcete klienta ${client.name} archivovat? Data i historie zůstanou zachované.`)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/crm/clients/${client.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        alert('Klient byl bezpečně archivován.');
        router.push('/clients');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Chyba při odstraňování klienta.');
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Chyba spojení.');
    } finally {
      setSaving(false);
    }
  };

  const statusObj = CLIENT_STATUS_LABELS[client.status as keyof typeof CLIENT_STATUS_LABELS] || CLIENT_STATUS_LABELS.ACTIVE;

  return (
    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-800 space-y-6 w-full max-w-full overflow-hidden">
      {/* Top Header Row: Logo, Company Name, Status Badges & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0 flex-1">
          {/* Logo Container */}
          <div className="p-1.5 bg-slate-900/90 rounded-2xl shadow-md border border-slate-800 shrink-0">
            <ClientLogoControl
              clientId={client.id}
              clientName={client.name}
              logoUrl={
                client.logoDriveFileId
                  ? `/api/clients/${client.id}/logo/file`
                  : client.website && client.website.trim()
                  ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                      client.website.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split('?')[0]
                    )}&sz=256`
                  : undefined
              }
            />
          </div>

          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white break-words">{client.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusObj.badge} shrink-0`}>
                {statusObj.label}
              </span>
              {client.companyId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider shrink-0">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  OVĚŘENO ARES
                </span>
              )}
            </div>

            {client.tradingName && (
              <p className="text-sky-300 text-xs sm:text-sm font-semibold italic">{client.tradingName}</p>
            )}

            {/* Information Meta Strip */}
            <div className="flex items-center gap-x-4 gap-y-1.5 text-xs text-slate-300 pt-1 flex-wrap font-medium">
              {client.companyId && (
                <span className="shrink-0">
                  IČO: <strong className="text-white font-mono">{client.companyId}</strong>
                </span>
              )}
              {client.dic && (
                <span className="shrink-0">
                  DIČ: <strong className="text-white font-mono">{client.dic}</strong>
                </span>
              )}
              {client.billingCity && (
                <span className="flex items-center gap-1 shrink-0">
                  <MapPin size={12} className="text-amber-400" />
                  <span>Sídlo: <strong className="text-white">{client.billingCity}</strong></span>
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1 shrink-0">
                  <Mail size={12} className="text-sky-400" />
                  <a href={`mailto:${client.email}`} className="text-sky-300 hover:underline">{client.email}</a>
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1 shrink-0">
                  <Phone size={12} className="text-emerald-400" />
                  <a href={`tel:${client.phone}`} className="text-emerald-300 hover:underline font-mono">{client.phone}</a>
                </span>
              )}
              {client.website && (
                <span className="flex items-center gap-1 shrink-0">
                  <Globe size={12} className="text-indigo-400" />
                  <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline font-bold">
                    {client.website.replace(/^https?:\/\//i, '').split('/')[0]}
                  </a>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Primary Header Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
          <Button onClick={() => setShowEditModal(true)} variant="secondary" className="!bg-slate-800 !text-white hover:!bg-slate-700 border-slate-700 text-xs font-bold shadow-md cursor-pointer">
            <Edit3 size={13} className="mr-1 text-sky-400" />
            <span>Upravit profil</span>
          </Button>
          {canManageLifecycle && (
            <>
              <Button onClick={() => setShowMergeModal(true)} variant="secondary" className="!bg-purple-950 !text-purple-200 border-purple-800 hover:!bg-purple-900 text-xs font-bold cursor-pointer">
                <Link2 size={13} className="mr-1 text-purple-400" />
                <span>Sloučit</span>
              </Button>
              <Button onClick={() => setShowDeleteModal(true)} variant="secondary" className="!bg-rose-950 !text-rose-200 border-rose-800 hover:!bg-rose-900 text-xs font-bold cursor-pointer">
                <Trash2 size={13} className="mr-1 text-rose-400" />
                <span>Archivovat</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Action Bar Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-t border-slate-800/80 pt-3 scrollbar-thin">
        <button onClick={() => setShowContactModal(true)} className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-xl border border-slate-700 transition font-bold cursor-pointer shrink-0">
          <Plus size={13} className="text-emerald-400" />
          <span>Kontakt</span>
        </button>
        <button onClick={() => setShowBranchModal(true)} className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-xl border border-slate-700 transition font-bold cursor-pointer shrink-0">
          <Store size={13} className="text-amber-400" />
          <span>Pobočka MS Kraj</span>
        </button>
        <a href={`/offers/new?clientId=${client.id}`} className="flex items-center gap-1.5 bg-sky-950 hover:bg-sky-900 text-sky-200 px-3 py-1.5 rounded-xl border border-sky-800 transition font-bold shrink-0">
          <FilePlus size={13} className="text-sky-400" />
          <span>Nová Nabídka</span>
        </a>
        <button onClick={() => setShowCommModal(true)} className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-xl border border-slate-700 transition font-bold cursor-pointer shrink-0">
          <MessageSquare size={13} className="text-indigo-400" />
          <span>Záznam Hovoru</span>
        </button>
        <button onClick={() => setShowTaskModal(true)} className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-xl border border-slate-700 transition font-bold cursor-pointer shrink-0">
          <CheckSquare size={13} className="text-teal-400" />
          <span>Nový Úkol</span>
        </button>
      </div>

      {/* KPI Cards Grid (4 High-Impact Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Celkem vyfakturováno</span>
            <DollarSign size={15} className="text-sky-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">
            {client.metrics.totalBilled ? `${client.metrics.totalBilled.toLocaleString('cs-CZ')} Kč` : '0 Kč'}
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Aktivní kampaně</span>
            <Layers size={15} className="text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400 mt-1">
            {client.metrics.activeOccupanciesCount || 0}
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Zakázky v realizaci</span>
            <TrendingUp size={15} className="text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 mt-1">
            {client.metrics.inPreparationOrdersCount || 0}
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Pobočky v MS kraji</span>
            <Store size={15} className="text-indigo-400" />
          </div>
          <div className="text-xl font-black text-indigo-300 mt-1">
            {client.branches?.length || 0}
          </div>
        </div>
      </div>

      {/* Edit Client Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-lg w-full bg-white space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-base text-slate-900">✏️ Upravit profil klienta</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleSaveClient} className="space-y-3">
              <label className="text-xs font-bold text-slate-700">Název firmy *
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="input text-xs mt-1 font-bold" />
              </label>
              <label className="text-xs font-bold text-slate-700">Obchodní název značky
                <input type="text" value={tradingName} onChange={e => setTradingName(e.target.value)} className="input text-xs mt-1" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-slate-700">IČO
                  <input type="text" value={companyId} onChange={e => setCompanyId(e.target.value)} className="input text-xs mt-1 font-mono" />
                </label>
                <label className="text-xs font-bold text-slate-700">DIČ
                  <input type="text" value={dic} onChange={e => setDic(e.target.value)} className="input text-xs mt-1 font-mono" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-slate-700">E-mail
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input text-xs mt-1" />
                </label>
                <label className="text-xs font-bold text-slate-700">Telefon
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="input text-xs mt-1 font-mono" />
                </label>
              </div>
              <label className="text-xs font-bold text-slate-700">Webové stránky
                <input type="text" value={website} onChange={e => setWebsite(e.target.value)} className="input text-xs mt-1" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs font-bold text-slate-700">Ulice sídla
                  <input type="text" value={billingStreet} onChange={e => setBillingStreet(e.target.value)} className="input text-xs mt-1" />
                </label>
                <label className="text-xs font-bold text-slate-700">Město sídla
                  <input type="text" value={billingCity} onChange={e => setBillingCity(e.target.value)} className="input text-xs mt-1 font-bold" />
                </label>
                <label className="text-xs font-bold text-slate-700">PSČ sídla
                  <input type="text" value={billingZip} onChange={e => setBillingZip(e.target.value)} className="input text-xs mt-1 font-mono" />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving} className="font-bold bg-sky-600 hover:bg-sky-700 text-white">
                  {saving ? 'Ukládám...' : '💾 Uložit profil'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900">➕ Přidat novou kontaktní osobu</h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleAddContact} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Jméno *<input type="text" value={cFirstName} onChange={e => setCFirstName(e.target.value)} required className="input text-xs mt-1" /></label>
                <label className="text-xs font-semibold">Příjmení *<input type="text" value={cLastName} onChange={e => setCLastName(e.target.value)} required className="input text-xs mt-1" /></label>
              </div>
              <label className="text-xs font-semibold">Pozice / Funkce<input type="text" value={cTitle} onChange={e => CSetTitle(e.target.value)} placeholder="Např. Manažer nákupu" className="input text-xs mt-1" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">E-mail<input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} className="input text-xs mt-1" /></label>
                <label className="text-xs font-semibold">Telefon<input type="text" value={cPhone} onChange={e => setCPhone(e.target.value)} className="input text-xs mt-1 font-mono" /></label>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowContactModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving} className="font-bold">Uložit kontakt</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900">🏬 Přidat novou pobočku klienta</h3>
              <button onClick={() => setShowBranchModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleAddBranch} className="space-y-3">
              <label className="text-xs font-semibold">Název pobočky *<input type="text" value={bName} onChange={e => setBName(e.target.value)} required placeholder="Např. Prodejna Ostrava Svinov" className="input text-xs mt-1" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Ulice a číslo<input type="text" value={bStreet} onChange={e => setBStreet(e.target.value)} className="input text-xs mt-1" /></label>
                <label className="text-xs font-semibold">Město *<input type="text" value={bCity} onChange={e => setBCity(e.target.value)} required placeholder="Ostrava" className="input text-xs mt-1" /></label>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowBranchModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving} className="font-bold">Uložit pobočku</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Communication Modal */}
      {showCommModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900">📞 Zaznamenat komunikaci</h3>
              <button onClick={() => setShowCommModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleAddComm} className="space-y-3">
              <label className="text-xs font-semibold">Typ komunikace
                <select value={commType} onChange={e => setCommType(e.target.value)} className="input text-xs mt-1">
                  <option value="PHONE_CALL">Telefonní hovor</option>
                  <option value="EMAIL">E-mailová zpráva</option>

                  <option value="MEETING">Osobní schůzka</option>
                </select>
              </label>
              <label className="text-xs font-semibold">Předmět / Téma *<input type="text" value={commSubject} onChange={e => setCommSubject(e.target.value)} required placeholder="Např. Projednání nabídky na zábor VO" className="input text-xs mt-1" /></label>
              <label className="text-xs font-semibold">Obsah / Poznámka z jednání<textarea value={commContent} onChange={e => setCommContent(e.target.value)} rows={3} className="input text-xs mt-1" /></label>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowCommModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving} className="font-bold">Uložit hovor</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900">✅ Vytvořit nový úkol pro klienta</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleAddTask} className="space-y-3">
              <label className="text-xs font-semibold">Název úkolu *<input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required placeholder="Např. Zavolat ohledně prodloužení smlouvy" className="input text-xs mt-1" /></label>
              <label className="text-xs font-semibold">Termín splnění *<input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} required className="input text-xs mt-1 font-mono" /></label>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowTaskModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving} className="font-bold">Vytvořit úkol</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Client Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900">🔗 Sloučit jiného klienta do tohoto profilu</h3>
              <button onClick={() => setShowMergeModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleMergeClient} className="space-y-3">
              <p className="text-xs text-slate-600">Všechny nabídky, zakázky, pobočky i kontakty zdrojového klienta budou sloučeny do profilu <strong>{client.name}</strong>.</p>
              <label className="text-xs font-semibold">ID zdrojového klienta ke sloučení *
                <input type="text" value={sourceClientId} onChange={e => setSourceClientId(e.target.value)} required placeholder="Vložte ID klienta (C-xxx nebo CUID)" className="input text-xs mt-1 font-mono" />
              </label>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowMergeModal(false)}>Zrušit</Button>
                <Button type="submit" disabled={saving} className="font-bold bg-purple-600 text-white">Sloučit klienta</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Client Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 text-slate-900">
          <div className="card max-w-md w-full bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-slate-900">📦 Archivace klienta</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <div className="space-y-3 text-xs text-slate-700">
              <p>Klient <strong>{client.name}</strong> se přestane zobrazovat mezi aktivními klienty. Všechny kontakty, zakázky, faktury a auditní historie zůstanou zachované.</p>
              <div className="space-y-2 pt-1">
                <button type="button" onClick={handleArchiveClient} disabled={saving} className="w-full p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-left transition disabled:opacity-50">
                  <strong className="text-amber-950 block font-bold">Archivovat / deaktivovat</strong>
                  <span className="text-amber-800 text-[11px]">Bez nevratného mazání dat. Akci smí provést pouze administrátor nebo manažer.</span>
                </button>
              </div>
            </div>
            <div className="flex justify-end border-t pt-3">
              <Button type="button" variant="secondary" onClick={() => setShowDeleteModal(false)}>Zrušit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
