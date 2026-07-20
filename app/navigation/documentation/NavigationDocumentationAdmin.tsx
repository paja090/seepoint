'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle2,
  Eye,
  Filter,
  Globe,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { NavigationReportEditor, type ReportItemEdit } from '@/components/navigation-documentation/NavigationReportEditor';
import { NavigationEmailModal } from '@/components/navigation-documentation/NavigationEmailModal';
import type { PrePublishWarning } from '@/lib/navigation-documentation';

export type ReportRow = {
  id: string;
  clientId: string;
  offerId?: string | null;
  title: string;
  description?: string | null;
  quarter?: number | null;
  year: number;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'SENT' | 'ARCHIVED';
  publishedAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  publicTokenHash?: string | null;
  tokenExpiresAt?: string | null;
  client: { id: string; name: string; email?: string | null };
  offer?: { id: string; campaignName: string | null; title: string } | null;
  createdBy?: { id: string; name: string } | null;
  _count: { items: number };
};

export function NavigationDocumentationAdmin({
  clients,
  offers,
  initialReports,
}: {
  clients: Array<{ id: string; name: string; email?: string | null }>;
  offers: Array<{ id: string; campaignName: string | null; title: string; clientId: string }>;
  initialReports: ReportRow[];
}) {
  const [reports, setReports] = useState<ReportRow[]>(initialReports);
  const [filterClient, setFilterClient] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterStatus, setFilterStatus] = useState('');

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [newOfferId, setNewOfferId] = useState('');
  const [newQuarter, setNewQuarter] = useState(2);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);

  // Active Report Detail / Editing state
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<{
    report: ReportRow;
    items: ReportItemEdit[];
    warnings: PrePublishWarning[];
    auditLogs: Array<{ id: string; action: string; message?: string | null; createdAt: string; actorUser?: { name: string } }>;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingItems, setSavingItems] = useState(false);

  const [saveFeedback, setSaveFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [publishResult, setPublishResult] = useState<{ publicUrl?: string; token?: string } | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [cloning, setCloning] = useState(false);

  const filteredReports = reports.filter((r) => {
    if (filterClient && r.clientId !== filterClient) return false;
    if (filterQuarter && r.quarter !== Number(filterQuarter)) return false;
    if (filterYear && r.year !== Number(filterYear)) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  async function loadReportDetail(id: string) {
    setActiveReportId(id);
    setLoadingDetail(true);
    setPublishResult(null);
    setCurrentToken(null);

    try {
      const response = await fetch(`/api/navigation/documentation/${id}`);
      const data = await response.json();
      if (response.ok) {
        setReportDetail({
          report: data,
          items: data.items || [],
          warnings: data.warnings || [],
          auditLogs: data.auditLogs || [],
        });
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreateReport() {
    if (!newClientId) return;
    setCreating(true);

    try {
      const response = await fetch('/api/navigation/documentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: newClientId,
          offerId: newOfferId || undefined,
          quarter: newQuarter,
          year: newYear,
        }),
      });

      const data = await response.json();
      if (response.ok && data.report) {
        setReports((curr) => [data.report, ...curr]);
        setShowCreateModal(false);
        loadReportDetail(data.report.id);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveItems(updatedItems: ReportItemEdit[]) {
    if (!activeReportId) return;
    setSavingItems(true);
    setSaveFeedback(null);

    try {
      const response = await fetch(`/api/navigation/documentation/${activeReportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems }),
      });

      const data = await response.json();
      if (response.ok) {
        setSaveFeedback({ ok: true, message: 'Všechny změny položek a směrů byly úspěšně uloženy.' });
        loadReportDetail(activeReportId);
        setTimeout(() => setSaveFeedback(null), 4000);
      } else {
        setSaveFeedback({ ok: false, message: data.error || 'Chyba při ukládání položek.' });
      }
    } catch {
      setSaveFeedback({ ok: false, message: 'Chyba při komunikaci se serverem.' });
    } finally {
      setSavingItems(false);
    }
  }

  async function handlePublish() {
    if (!activeReportId) return;
    try {
      const response = await fetch(`/api/navigation/documentation/${activeReportId}/publish`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok && data.report) {
        setPublishResult({ publicUrl: data.publicUrl, token: data.token });
        setCurrentToken(data.token);
        loadReportDetail(activeReportId);
        setReports((curr) => curr.map((r) => (r.id === activeReportId ? { ...r, status: 'PUBLISHED' } : r)));
      }
    } catch {
      /* error */
    }
  }

  async function handleOpenEmailModal() {
    if (!activeReportId) return;
    setLoadingToken(true);

    try {
      const response = await fetch(`/api/navigation/documentation/${activeReportId}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      });
      const data = await response.json();
      if (response.ok && data.token) {
        setCurrentToken(data.token);
        setPublishResult({ publicUrl: data.publicUrl, token: data.token });
        setReports((curr) =>
          curr.map((r) => (r.id === activeReportId && r.status === 'DRAFT' ? { ...r, status: 'PUBLISHED' } : r)),
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingToken(false);
      setShowEmailModal(true);
    }
  }

  async function handleCreateNextQuarter() {
    if (!activeReportId) return;
    setCloning(true);
    try {
      const response = await fetch(`/api/navigation/documentation/${activeReportId}/next-quarter`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok && data.report) {
        setReports((curr) => [data.report, ...curr]);
        loadReportDetail(data.report.id);
      }
    } finally {
      setCloning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-700">Modul Navigace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Kvartální fotodokumentace</h1>
          <p className="mt-2 text-sm text-slate-500">
            Správa, kontrola a publikace kvartální fotodokumentace navigačních nosičů pro klienty.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          type="button"
        >
          <Plus size={17} /> Vytvořit nový report
        </button>
      </header>

      {/* Filter Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Filter size={15} className="text-sky-600" />
          <span>Filtrovat fotodokumentace</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
          >
            <option value="">Všichni klienti</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
            value={filterQuarter}
            onChange={(e) => setFilterQuarter(e.target.value)}
          >
            <option value="">Všechna čtvrtletí</option>
            <option value="1">1. čtvrtletí (Q1)</option>
            <option value="2">2. čtvrtletí (Q2)</option>
            <option value="3">3. čtvrtletí (Q3)</option>
            <option value="4">4. čtvrtletí (Q4)</option>
          </select>

          <input
            type="number"
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
            placeholder="Rok (např. 2026)"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          />

          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Všechny stavy</option>
            <option value="DRAFT">Koncept (DRAFT)</option>
            <option value="PUBLISHED">Publikováno (PUBLISHED)</option>
            <option value="SENT">Odesláno klientovi (SENT)</option>
            <option value="ARCHIVED">Archivováno (ARCHIVED)</option>
          </select>
        </div>
      </section>

      {/* Main Grid: Report List (left) + Active Detail (right) */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Reports List */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50/70 px-4 py-3">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Seznam reportů ({filteredReports.length})
            </h2>
          </div>
          {filteredReports.length > 0 ? (
            <ul className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredReports.map((r) => {
                const isActive = r.id === activeReportId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => loadReportDetail(r.id)}
                      className={`w-full text-left p-4 transition flex flex-col gap-1.5 ${
                        isActive ? 'bg-sky-50/80 border-l-4 border-sky-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-900 truncate">{r.client.name}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            r.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'SENT'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{r.title}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>{r._count.items} navigací</span>
                        <span>{new Date(r.createdAt).toLocaleDateString('cs-CZ')}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">Žádný report neodpovídá filtru.</div>
          )}
        </section>

        {/* Report Active Detail & Editor */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm min-h-[500px]">
          {loadingDetail ? (
            <div className="flex h-full items-center justify-center p-12 text-slate-400">
              <RefreshCw className="animate-spin" size={24} />
            </div>
          ) : reportDetail ? (
            <div className="space-y-6">
              {/* Report Header Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{reportDetail.report.title}</h2>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
                      {reportDetail.report.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Klient: <strong>{reportDetail.report.client.name}</strong> · Období:{' '}
                    {reportDetail.report.quarter}. čtvrtletí {reportDetail.report.year}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handlePublish}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    type="button"
                  >
                    <CheckCircle2 size={15} /> Publikovat report
                  </button>

                  <button
                    onClick={handleOpenEmailModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                    type="button"
                  >
                    <Send size={15} /> Odeslat e-mail
                  </button>

                  <button
                    onClick={handleCreateNextQuarter}
                    disabled={cloning}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    type="button"
                  >
                    <Sparkles size={15} className="text-amber-500" />
                    {cloning ? 'Vytvářím…' : 'Vytvořit další kvartál'}
                  </button>

                  {publishResult?.publicUrl && (
                    <Link
                      href={publishResult.publicUrl}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      <Eye size={15} /> Náhled pro klienta
                    </Link>
                  )}
                </div>
              </div>

              {publishResult?.publicUrl && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-center justify-between text-xs text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <Globe size={15} className="text-emerald-600" /> Veřejný odkaz pro klienta je připraven!
                  </span>
                  <Link href={publishResult.publicUrl} target="_blank" className="font-bold underline">
                    Otevřít odkaz klienta →
                  </Link>
                </div>
              )}

              {saveFeedback && (
                <div
                  className={`rounded-xl border p-3 text-xs font-semibold ${
                    saveFeedback.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-red-200 bg-red-50 text-red-900'
                  }`}
                >
                  {saveFeedback.message}
                </div>
              )}

              {/* Editor component */}
              <NavigationReportEditor
                items={reportDetail.items}
                warnings={reportDetail.warnings}
                onSave={handleSaveItems}
                saving={savingItems}
              />

              {/* Audit Trail */}
              {reportDetail.auditLogs.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Historie a audit odeslání
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {reportDetail.auditLogs.map((log) => (
                      <li key={log.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                        <span>
                          <strong>{log.actorUser?.name ?? 'Systém'}</strong>: {log.message}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(log.createdAt).toLocaleString('cs-CZ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center text-slate-400 space-y-2">
              <Camera size={36} className="text-slate-300" />
              <p className="font-semibold text-slate-700">Vyberte report ze seznamu vlevo</p>
              <p className="text-xs max-w-xs">Nebo klikněte na &quot;Vytvořit nový report&quot; pro založení fotodokumentace.</p>
            </div>
          )}
        </section>
      </div>

      {/* Modal for Creating New Report */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Vytvořit nový report fotodokumentace</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Klient *</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                >
                  <option value="">-- Vyberte klienta --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Navigační kampaň / nabídka (volitelné)</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={newOfferId}
                  onChange={(e) => setNewOfferId(e.target.value)}
                >
                  <option value="">Všechny navigační body klienta</option>
                  {offers
                    .filter((o) => !newClientId || o.clientId === newClientId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.campaignName || o.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Čtvrtletí</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={newQuarter}
                    onChange={(e) => setNewQuarter(Number(e.target.value))}
                  >
                    <option value={1}>1. čtvrtletí (Q1)</option>
                    <option value={2}>2. čtvrtletí (Q2)</option>
                    <option value={3}>3. čtvrtletí (Q3)</option>
                    <option value={4}>4. čtvrtletí (Q4)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rok</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                disabled={creating || !newClientId}
                onClick={handleCreateReport}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {creating ? 'Vytvářím…' : 'Vytvořit koncept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Composer Modal */}
      {showEmailModal && reportDetail && (
        <NavigationEmailModal
          reportId={reportDetail.report.id}
          clientName={reportDetail.report.client.name}
          clientEmail={reportDetail.report.client.email}
          periodTitle={`${reportDetail.report.quarter}. čtvrtletí ${reportDetail.report.year}`}
          token={currentToken || publishResult?.token || undefined}
          itemsCount={reportDetail.items.filter((i) => i.isVisible).length}
          onClose={() => setShowEmailModal(false)}
          onSent={() => {
            setShowEmailModal(false);
            loadReportDetail(reportDetail.report.id);
          }}
        />
      )}
    </div>
  );
}
