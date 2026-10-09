'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  Send,
  X,
  Eye,
  Edit3,
  Columns,
  FileText,
  Building2,
  Mail,
  ExternalLink,
  Sparkles,
  Paperclip,
} from 'lucide-react';

export type InvoiceItemDraft = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
};

type PartySnapshot = {
  name: string;
  companyId?: string | null;
  vatId?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  bankAccount?: string | null;
  iban?: string | null;
  swift?: string | null;
};

export function NavigationInvoiceModal({
  orderId,
  orderNumber,
  orderTitle,
  clientName,
  initialRecipientEmail,
  onClose,
  onSuccess,
}: {
  orderId: string;
  orderNumber: string;
  orderTitle: string;
  clientName: string;
  initialRecipientEmail?: string | null;
  onClose: () => void;
  onSuccess: (result: { invoiceNumber: string; delivered: boolean }) => void;
}) {
  const [activeTab, setActiveTab] = useState<'items' | 'email'>('items');
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Draft invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [variableSymbol, setVariableSymbol] = useState('');
  const [dueDays, setDueDays] = useState(14);
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString());
  const [periodFrom, setPeriodFrom] = useState<string>('');
  const [periodTo, setPeriodTo] = useState<string>('');
  const [currency, setCurrency] = useState('CZK');
  const [supplier, setSupplier] = useState<PartySnapshot | null>(null);
  const [customer, setCustomer] = useState<PartySnapshot | null>(null);
  const [items, setItems] = useState<InvoiceItemDraft[]>([]);
  const [existingInvoice, setExistingInvoice] = useState<{
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    driveFileId?: string | null;
    pdfUrl?: string | null;
  } | null>(null);

  // Email fields
  const [recipientEmail, setRecipientEmail] = useState(initialRecipientEmail || '');
  const [subject, setSubject] = useState('');
  const [greeting, setGreeting] = useState('Dobrý den,');
  const [message, setMessage] = useState('');
  const [closingNote, setClosingNote] = useState('V případě dotazů nebo nejasností nás prosím kontaktujte.');

  // Load preview data from backend on mount
  useEffect(() => {
    async function fetchPreview() {
      try {
        setLoading(true);
        const res = await fetch(`/api/navigation/orders/${orderId}/invoice/preview`);
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          const d = json.data;
          setInvoiceNumber(d.invoiceNumber);
          setVariableSymbol(d.variableSymbol);
          setDueDays(d.dueDays || 14);
          setIssueDate(d.issueDate);
          setPeriodFrom(d.periodFrom);
          setPeriodTo(d.periodTo);
          setCurrency(d.currency || 'CZK');
          setSupplier(d.supplier);
          setCustomer(d.customer);
          setExistingInvoice(d.existingInvoice);

          if (d.recipientEmail) setRecipientEmail(d.recipientEmail);
          if (d.defaultSubject) setSubject(d.defaultSubject);
          if (d.defaultGreeting) setGreeting(d.defaultGreeting);
          if (d.defaultMessage) setMessage(d.defaultMessage);
          if (d.defaultClosingNote) setClosingNote(d.defaultClosingNote);

          if (Array.isArray(d.items) && d.items.length > 0) {
            setItems(
              d.items.map((it: { description: string; quantity: number; unit: string; unitPrice: number; vatRate: number }, idx: number) => ({
                id: `item-${idx}-${Date.now()}`,
                description: it.description,
                quantity: it.quantity,
                unit: it.unit || 'ks',
                unitPrice: it.unitPrice,
                vatRate: it.vatRate ?? 21,
              }))
            );
          }
        } else {
          setFeedback({ ok: false, message: json.error || 'Nepodařilo se načíst návrh faktury.' });
        }
      } catch {
        setFeedback({ ok: false, message: 'Chyba při komunikaci se serverem.' });
      } finally {
        setLoading(false);
      }
    }
    void fetchPreview();
  }, [orderId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Live item calculations
  const calculatedItems = items.map((it) => {
    const amount = Math.round(it.quantity * it.unitPrice * 100) / 100;
    const vatAmount = Math.round(amount * (it.vatRate / 100) * 100) / 100;
    const lineTotal = amount + vatAmount;
    return { ...it, amount, vatAmount, lineTotal };
  });

  const subtotal = calculatedItems.reduce((acc, it) => acc + it.amount, 0);
  const taxAmount = calculatedItems.reduce((acc, it) => acc + it.vatAmount, 0);
  const totalAmount = subtotal + taxAmount;

  const calculatedDueDate = new Date(new Date(issueDate).getTime() + dueDays * 24 * 60 * 60 * 1000);
  const dueDateFormatted = calculatedDueDate.toLocaleDateString('cs-CZ');
  const issueDateFormatted = new Date(issueDate).toLocaleDateString('cs-CZ');
  const periodFormatted = periodFrom && periodTo
    ? `${new Date(periodFrom).toLocaleDateString('cs-CZ')} – ${new Date(periodTo).toLocaleDateString('cs-CZ')}`
    : '';

  function updateItem(id: string, field: keyof InvoiceItemDraft, value: string | number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return { ...it, [field]: value };
      })
    );
  }

  function removeItem(id: string) {
    if (items.length <= 1) {
      setFeedback({ ok: false, message: 'Faktura musí obsahovat alespoň jednu položku.' });
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function addItem(custom?: Partial<InvoiceItemDraft>) {
    setFeedback(null);
    const newItem: InvoiceItemDraft = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      description: custom?.description || 'Nová položka faktury',
      quantity: custom?.quantity ?? 1,
      unit: custom?.unit || 'ks',
      unitPrice: custom?.unitPrice ?? 0,
      vatRate: custom?.vatRate ?? 21,
    };
    setItems((prev) => [...prev, newItem]);
  }

  // Quick preset templates
  function addPreset(preset: 'installation' | 'graphics' | 'extra_board' | 'express') {
    if (preset === 'installation') {
      addItem({ description: 'Montáž a výjezd technika v terénu', quantity: 1, unit: 'kpl', unitPrice: 3500, vatRate: 21 });
    } else if (preset === 'graphics') {
      addItem({ description: 'Grafická příprava dat a tisková kontrola', quantity: 1, unit: 'kpl', unitPrice: 1500, vatRate: 21 });
    } else if (preset === 'extra_board') {
      addItem({ description: 'Doplňková navigační směrovka a nosič', quantity: 1, unit: 'ks', unitPrice: 4800, vatRate: 21 });
    } else if (preset === 'express') {
      addItem({ description: 'Expresní výroba a instalace do 48 hodin', quantity: 1, unit: 'kpl', unitPrice: 2500, vatRate: 21 });
    }
  }

  async function openLivePdfPreview() {
    try {
      const res = await fetch(`/api/navigation/orders/${orderId}/invoice/preview?format=pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customItems: items,
          dueDays,
          issueDate,
          periodFrom,
          periodTo,
          invoiceNumber,
          variableSymbol,
        }),
      });

      if (!res.ok) {
        setFeedback({ ok: false, message: 'Nepodařilo se vygenerovat PDF náhled.' });
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch {
      setFeedback({ ok: false, message: 'Chyba při otevírání PDF náhledu.' });
    }
  }

  async function handleSubmit(sendEmail: boolean) {
    if (items.length === 0) {
      setFeedback({ ok: false, message: 'Faktura musí obsahovat alespoň jednu položku.' });
      return;
    }

    if (sendEmail && !recipientEmail) {
      setFeedback({ ok: false, message: 'Zadejte e-mail příjemce pro odeslání.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const fullFormattedMessage = `${greeting}\n\n${message}\n\nČástka k úhradě: ${totalAmount.toLocaleString('cs-CZ')} ${currency}\nVariabilní symbol: ${variableSymbol}\nDatum splatnosti: ${dueDateFormatted}\n\n${closingNote}\n\nS pozdravem\nTým SeePOINT`;

    try {
      const response = await fetch(`/api/navigation/orders/${orderId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customItems: items,
          dueDays,
          recipientEmail: sendEmail ? recipientEmail : undefined,
          subject: sendEmail ? subject : undefined,
          message: sendEmail ? fullFormattedMessage : undefined,
          sendEmail,
        }),
      });

      const data = await response.json() as { error?: string; message?: string; delivered?: boolean; billingPeriod?: { invoiceNumber?: string } };
      if (!response.ok) {
        setFeedback({ ok: false, message: data.error || 'Fakturu se nepodařilo zpracovat.' });
      } else {
        const finalNumber = data.billingPeriod?.invoiceNumber || invoiceNumber;
        setFeedback({ ok: true, message: data.message || 'Faktura byla úspěšně zpracována.' });
        setTimeout(() => {
          onSuccess({ invoiceNumber: finalNumber, delivered: Boolean(data.delivered) });
        }, 1200);
      }
    } catch {
      setFeedback({ ok: false, message: 'Chyba při komunikaci se serverem.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div
        aria-modal="true"
        role="dialog"
        aria-labelledby="invoice-modal-title"
        className="relative flex max-h-[96vh] w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-xs">
              <CreditCard size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="invoice-modal-title" className="text-base font-bold text-slate-900">
                  Faktura a daňový doklad
                </h2>
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                  {invoiceNumber || 'Návrh dokladu'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Zakázka: <b>{orderNumber}</b> ({orderTitle}) · Klient: <b>{clientName}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Top Level Step / Tab Switcher */}
            <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('items')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition ${
                  activeTab === 'items'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText size={14} className={activeTab === 'items' ? 'text-emerald-600' : ''} />
                Položky & Daňový doklad
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                  {items.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition ${
                  activeTab === 'email'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail size={14} className={activeTab === 'email' ? 'text-sky-600' : ''} />
                E-mail klientovi & Náhled
              </button>
            </div>

            {/* Email Layout Switcher (when email tab is active) */}
            {activeTab === 'email' && (
              <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  title="Vedle sebe"
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns size={13} />
                  <span className="hidden sm:inline">Vedle sebe</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  title="Pouze formulář"
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    viewMode === 'edit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 size={13} />
                  <span className="hidden sm:inline">Formulář</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  title="Náhled e-mailu"
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    viewMode === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye size={13} />
                  <span className="hidden sm:inline">Náhled</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              aria-label="Zavřít dialog"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Main Body Container */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-500 space-y-2">
              <div className="inline-block size-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <p>Načítám podklady faktury…</p>
            </div>
          ) : (
            <>
              {/* TAB 1: ITEMS AND DOCUMENT DRAFT */}
              {activeTab === 'items' && (
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  {/* Left Column: Items Editor */}
                  <div className="space-y-5">
                    {/* Invoice Meta Controls */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Building2 size={14} className="text-emerald-700" />
                          Fakturační údaje zakázky
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Období: <b>{periodFormatted || 'neuvedeno'}</b>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Číslo faktury</label>
                          <input
                            type="text"
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Variabilní symbol</label>
                          <input
                            type="text"
                            value={variableSymbol}
                            onChange={(e) => setVariableSymbol(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Splatnost (dny)</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={dueDays}
                              onChange={(e) => setDueDays(Math.max(1, parseInt(e.target.value) || 14))}
                              className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                            />
                            <span className="text-[11px] text-slate-500 font-medium">➔ do {dueDateFormatted}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="rounded-2xl border border-slate-200 bg-emerald-50/40 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                          <Sparkles size={14} className="text-emerald-700" />
                          Rychlé doplnění dalších položek k fakturaci
                        </span>
                        <span className="text-[11px] text-emerald-700 font-medium">Kliknutím přidáte na doklad</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => addPreset('installation')}
                          className="inline-flex items-center gap-1 rounded-xl bg-white border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition"
                        >
                          <Plus size={13} /> Montáž & výjezd (+3 500 Kč)
                        </button>
                        <button
                          type="button"
                          onClick={() => addPreset('graphics')}
                          className="inline-flex items-center gap-1 rounded-xl bg-white border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition"
                        >
                          <Plus size={13} /> Grafické práce (+1 500 Kč)
                        </button>
                        <button
                          type="button"
                          onClick={() => addPreset('extra_board')}
                          className="inline-flex items-center gap-1 rounded-xl bg-white border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition"
                        >
                          <Plus size={13} /> Doplňková směrovka (+4 800 Kč)
                        </button>
                        <button
                          type="button"
                          onClick={() => addPreset('express')}
                          className="inline-flex items-center gap-1 rounded-xl bg-white border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition"
                        >
                          <Plus size={13} /> Expresní realizace (+2 500 Kč)
                        </button>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Položky faktury ({items.length})
                        </h3>
                        <button
                          type="button"
                          onClick={() => addItem()}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition"
                        >
                          <Plus size={13} /> Přidat položku
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-100/60 font-semibold text-slate-600">
                            <tr>
                              <th className="py-2 px-3">Popis položky</th>
                              <th className="py-2 px-2 w-20 text-right">Počet</th>
                              <th className="py-2 px-2 w-16">MJ</th>
                              <th className="py-2 px-2 w-28 text-right">Cena/MJ</th>
                              <th className="py-2 px-2 w-20 text-right">DPH</th>
                              <th className="py-2 px-3 w-28 text-right">Celkem s DPH</th>
                              <th className="py-2 px-2 w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {calculatedItems.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="p-2 pl-3">
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                                    placeholder="Popis položky..."
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-right font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.unit}
                                    onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={item.unitPrice}
                                    onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-right font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={item.vatRate}
                                    onChange={(e) => updateItem(item.id, 'vatRate', parseInt(e.target.value) || 21)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-right text-slate-700 focus:border-emerald-500 focus:outline-none"
                                  >
                                    <option value={21}>21 %</option>
                                    <option value={12}>12 %</option>
                                    <option value={0}>0 %</option>
                                  </select>
                                </td>
                                <td className="p-2 pr-3 text-right font-bold text-slate-900">
                                  {item.lineTotal.toLocaleString('cs-CZ')} Kč
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    title="Smazat položku"
                                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Items Summary Footer */}
                      <div className="border-t border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <button
                            type="button"
                            onClick={() => addItem()}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                          >
                            <Plus size={14} /> Přidat další položku
                          </button>

                          <div className="space-y-1 text-right text-xs">
                            <div className="flex justify-between gap-6 text-slate-500">
                              <span>Základ daně:</span>
                              <span className="font-semibold text-slate-800">{subtotal.toLocaleString('cs-CZ')} Kč</span>
                            </div>
                            <div className="flex justify-between gap-6 text-slate-500">
                              <span>DPH:</span>
                              <span className="font-semibold text-slate-800">{taxAmount.toLocaleString('cs-CZ')} Kč</span>
                            </div>
                            <div className="flex justify-between gap-6 text-sm font-bold border-t border-slate-200 pt-1 text-emerald-800">
                              <span>Celkem k úhradě:</span>
                              <span>{totalAmount.toLocaleString('cs-CZ')} Kč</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visual Styled A4 Invoice Draft Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Eye size={14} className="text-emerald-700" />
                        Živý náhled dokladu pro klienta
                      </span>
                      <button
                        type="button"
                        onClick={openLivePdfPreview}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                      >
                        <ExternalLink size={12} /> Otevřít originální PDF
                      </button>
                    </div>

                    {/* Paper Document Card Container */}
                    <div className="rounded-2xl border border-slate-300/80 bg-white p-6 shadow-sm font-sans space-y-5 text-slate-800 text-xs">
                      {/* Document Header */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                        <div>
                          <div className="text-xl font-black tracking-tight text-[#009EE2]">SeePOINT</div>
                          <div className="text-[9px] font-bold tracking-widest text-[#10253F] uppercase">Outdoor reklama</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-[#10253F]">FAKTURA - DAŇOVÝ DOKLAD</div>
                          <div className="text-xs font-bold text-[#009EE2] mt-0.5">{invoiceNumber}</div>
                        </div>
                      </div>

                      {/* Parties Columns */}
                      <div className="grid grid-cols-2 gap-4 text-[11px] leading-relaxed">
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-bold text-[#009EE2] tracking-wider uppercase">Dodavatel</div>
                          <div className="font-bold text-slate-900">{supplier?.name || 'SeePOINT s.r.o.'}</div>
                          <div className="text-slate-600">{supplier?.street || 'Příkladná 12'}</div>
                          <div className="text-slate-600">{supplier?.postalCode} {supplier?.city}</div>
                          <div className="text-slate-500 pt-1">IČO: {supplier?.companyId || '-'} | DIČ: {supplier?.vatId || '-'}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-bold text-[#009EE2] tracking-wider uppercase">Odběratel</div>
                          <div className="font-bold text-slate-900">{customer?.name || clientName}</div>
                          <div className="text-slate-600">{customer?.street || 'Sídlo neuvedeno'}</div>
                          <div className="text-slate-600">{customer?.postalCode} {customer?.city}</div>
                          <div className="text-slate-500 pt-1">IČO: {customer?.companyId || '-'} | DIČ: {customer?.vatId || '-'}</div>
                        </div>
                      </div>

                      {/* Meta Grid */}
                      <div className="grid grid-cols-4 rounded-xl bg-slate-50 p-2.5 text-[10px] border border-slate-100 text-center">
                        <div>
                          <div className="text-slate-400 font-semibold">Vystaveno</div>
                          <div className="font-bold text-slate-900 mt-0.5">{issueDateFormatted}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 font-semibold">Splatnost</div>
                          <div className="font-bold text-slate-900 mt-0.5">{dueDateFormatted}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 font-semibold">DUZP</div>
                          <div className="font-bold text-slate-900 mt-0.5">{issueDateFormatted}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 font-semibold">Var. symbol</div>
                          <div className="font-bold text-slate-900 mt-0.5">{variableSymbol}</div>
                        </div>
                      </div>

                      {/* Order Context Note */}
                      <div className="border-l-2 border-[#009EE2] pl-2.5 py-0.5 text-[11px] text-slate-700">
                        <span className="font-bold">Zakázka {orderNumber}:</span> {orderTitle}
                        {periodFormatted && <div className="text-slate-500 text-[10px]">Fakturační období: {periodFormatted}</div>}
                      </div>

                      {/* Minimal Items Breakdown */}
                      <div className="border-t border-slate-100 pt-3 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                          <span>Položka</span>
                          <span>Celkem</span>
                        </div>
                        {calculatedItems.slice(0, 5).map((it) => (
                          <div key={it.id} className="flex justify-between text-[11px] text-slate-700">
                            <span className="truncate max-w-[200px]">{it.description} ({it.quantity} {it.unit})</span>
                            <span className="font-semibold">{it.lineTotal.toLocaleString('cs-CZ')} Kč</span>
                          </div>
                        ))}
                        {calculatedItems.length > 5 && (
                          <div className="text-[10px] text-slate-400 italic">
                            + dalších {calculatedItems.length - 5} položek
                          </div>
                        )}
                      </div>

                      {/* Payment & Totals */}
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-[11px]">
                        <div>
                          <div className="text-[9px] font-bold text-[#009EE2] uppercase">Platební údaje</div>
                          <div className="text-slate-600 mt-0.5">Účet: <b>{supplier?.bankAccount || 'neuveden'}</b></div>
                          <div className="text-slate-500 text-[10px]">VS: <b>{variableSymbol}</b></div>
                        </div>
                        <div className="rounded-xl bg-slate-900 p-3 text-white text-right">
                          <div className="text-[9px] uppercase tracking-wider text-slate-300">Celkem k úhradě</div>
                          <div className="text-base font-black text-white mt-0.5">{totalAmount.toLocaleString('cs-CZ')} Kč</div>
                        </div>
                      </div>

                      {/* Proceed to Email Button */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('email')}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-50 border border-sky-200 p-2.5 text-xs font-bold text-sky-800 hover:bg-sky-100 transition"
                        >
                          <Mail size={14} /> Přejít na kontrolu a úpravu e-mailu klientovi ➔
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EMAIL EDITOR & LIVE EMAIL PREVIEW */}
              {activeTab === 'email' && (
                <div
                  className={`grid gap-6 ${
                    viewMode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'
                  }`}
                >
                  {/* Left Column: Email Form */}
                  {(viewMode === 'split' || viewMode === 'edit') && (
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Edit3 size={14} className="text-sky-600" /> Úprava e-mailu před odesláním
                        </h3>
                        <span className="text-[11px] text-slate-500">Změny se ihned promítají do náhledu</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Příjemce (E-mail klienta)</label>
                        <input
                          type="email"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="klient@firma.cz"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Předmět e-mailu</label>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Oslovení</label>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                          value={greeting}
                          onChange={(e) => setGreeting(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Hlavní text zprávy</label>
                        <textarea
                          rows={6}
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 focus:border-sky-500 focus:outline-none"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Závěrečná poznámka</label>
                        <textarea
                          rows={2}
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 focus:border-sky-500 focus:outline-none"
                          value={closingNote}
                          onChange={(e) => setClosingNote(e.target.value)}
                        />
                      </div>

                      <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-800 flex items-center gap-2">
                        <Paperclip size={16} className="text-sky-600 shrink-0" />
                        <span>K e-mailu bude automaticky přiložen daňový doklad <b>faktura-{invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf</b>.</span>
                      </div>
                    </div>
                  )}

                  {/* Right Column: Live Visual Email Preview */}
                  {(viewMode === 'split' || viewMode === 'preview') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Eye size={14} className="text-emerald-600" /> Živý vizuální náhled e-mailu
                        </h3>
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Vzhled ve schránce klienta
                        </span>
                      </div>

                      {/* Email Envelope Container */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-4 shadow-sm">
                        {/* Envelope Header */}
                        <div className="mb-3 rounded-xl bg-white p-3 text-xs border border-slate-200 space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">
                              Od: <strong className="text-slate-800">SeePOINT Fakturace &lt;fakturace@seepoint.cz&gt;</strong>
                            </span>
                            <span className="text-[10px] text-slate-400">{new Date().toLocaleDateString('cs-CZ')}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Komu: </span>
                            <span className="font-semibold text-slate-900">{recipientEmail || 'klient@firma.cz'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Předmět: </span>
                            <span className="font-semibold text-sky-900">{subject || `Faktura ${invoiceNumber} – SeePOINT`}</span>
                          </div>
                        </div>

                        {/* HTML Email Body Container */}
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 text-slate-800 font-sans">
                          {/* Brand Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img alt="SeePOINT" className="h-8 w-auto" src="/seepoint-logo.svg" />
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                                Fakturace
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 font-medium">Daňový doklad</span>
                          </div>

                          {/* Email Body */}
                          <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                            <p className="font-bold text-slate-900 text-sm">{greeting}</p>
                            <div className="whitespace-pre-line text-slate-700">{message}</div>
                          </div>

                          {/* Highlight Invoice Summary Box */}
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs space-y-2">
                            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                              <div>
                                <p className="font-bold text-slate-900">{invoiceNumber}</p>
                                <p className="text-slate-600 text-[11px]">Zakázka: <b>{orderNumber}</b></p>
                              </div>
                              <span className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs">
                                Daňový doklad
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                              <div>
                                <span className="text-slate-500 block">Částka k úhradě</span>
                                <span className="font-black text-slate-900 text-sm text-emerald-900">
                                  {totalAmount.toLocaleString('cs-CZ')} {currency}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Variabilní symbol</span>
                                <span className="font-mono font-bold text-slate-800">{variableSymbol}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Splatnost</span>
                                <span className="font-bold text-slate-800">{dueDateFormatted}</span>
                              </div>
                            </div>
                          </div>

                          {/* PDF Attachment Badge */}
                          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                                <FileText size={16} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">faktura-{invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf</p>
                                <p className="text-[10px] text-slate-400">Příloha zprávy · Daňový doklad PDF</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PDF</span>
                          </div>

                          {/* Footer & Signature */}
                          <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-600">
                            <p>{closingNote}</p>
                            <div className="pt-2 text-slate-500 text-[11px]">
                              <p className="font-bold text-slate-800">Tým SeePOINT</p>
                              <p>E-mail: fakturace@seepoint.cz | Web: www.seepoint.cz</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 gap-3">
          <div className="text-xs">
            {feedback && (
              <span className={`font-medium ${feedback.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                {feedback.message}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Zrušit
            </button>

            {/* Option to create without sending email */}
            <button
              type="button"
              disabled={submitting || loading}
              onClick={() => handleSubmit(false)}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition"
              title="Vystaví fakturu a vytvoří PDF na disku, ale neodešle e-mail klientovi"
            >
              Pouze vystavit (bez e-mailu)
            </button>

            {/* Main Action: Create and deliver email */}
            <button
              type="button"
              disabled={submitting || loading}
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50 transition"
            >
              <Send size={14} />
              {submitting ? 'Zpracovávám…' : existingInvoice?.status === 'ISSUED' ? 'Odeslat vystavenou fakturu klientovi' : 'Vytvořit a odeslat fakturu klientovi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
