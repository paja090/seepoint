'use client';

import type { PrintProductionJob, PrintProductionStatus } from '@prisma/client';
import { productionKpis } from '@/lib/production/production-policy';
import { useState } from 'react';
import { PlusCircle, Image as ImageIcon, Printer, Truck, Package, Clock, CheckCircle2, X, Edit3, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { createPrintJob, updatePrintJob, updatePrintJobStatus } from './actions';
import { useRouter } from 'next/navigation';

type DashboardJob = PrintProductionJob & { client: { name: string } | null; offer: { portalToken: string | null } | null };
type DashboardOffer = { id: string; title: string; campaignName: string | null; client: { id: string; name: string } };

const STATUS_STYLE_MAP: Record<PrintProductionStatus, { borderClass: string; badgeClass: string; label: string }> = {
  PREPARATION: {
    borderClass: 'border-l-purple-500',
    badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
    label: 'Příprava grafiky',
  },
  CLIENT_APPROVAL: {
    borderClass: 'border-l-amber-500',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    label: 'Ke schválení klientem',
  },
  IN_PRINT: {
    borderClass: 'border-l-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    label: 'V tisku u tiskárny',
  },
  DELIVERED_TO_WAREHOUSE: {
    borderClass: 'border-l-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    label: 'Naskladněno / K výlepu',
  },
};

const FORMAT_LABELS: Record<string, string> = {
  EUROBILLBOARD: 'Eurobillboard (5,1 × 2,4m)',
  BIGBOARD: 'Bigboard (9,6 × 3,6m)',
  CLP: 'Citylight (118,5 × 175cm)',
  BENCH: 'Promolavička',
  CITY_POSTER: 'CityPoster',
  TOWER: 'Tower / Minitower',
  OTHER: 'Vlastní formát',
};

const MATERIAL_LABELS: Record<string, string> = {
  BLUEBACK_120G: 'Blueback papír 120g',
  PVC_BANNER_510G: 'PVC Banner 510g',
  CITYLIGHT_PAPER: 'Citylight papír 150g',
  SELF_ADHESIVE_FOIL: 'Samolepicí fólie',
  OTHER: 'Jiný materiál',
};

export function PrintProductionDashboard({ offers = [], jobs = [] }: { offers?: DashboardOffer[]; jobs?: DashboardJob[] }) {
  const [activeTab, setActiveTab] = useState<'kanban' | 'list'>('kanban');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<DashboardJob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PrintProductionStatus>('ALL');
  const router = useRouter();

  const [selectedOfferId, setSelectedOfferId] = useState('');
  const selectedOffer = offers.find(o => o.id === selectedOfferId);

  const getDeadlineColor = (date: Date | null) => {
    if (!date) return 'text-gray-500';
    const now = new Date();
    const deadline = new Date(date);
    const diff = deadline.getTime() - now.getTime();
    if (diff < 0) return 'text-red-600 font-bold';
    if (diff < 2 * 24 * 60 * 60 * 1000) return 'text-orange-500 font-bold';
    return 'text-gray-500';
  };

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== 'ALL' && job.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = job.title.toLowerCase().includes(q);
      const matchClient = (job.client?.name || '').toLowerCase().includes(q);
      const matchFormat = job.formatType.toLowerCase().includes(q);
      if (!matchTitle && !matchClient && !matchFormat) return false;
    }
    return true;
  });

  const renderJobCard = (job: DashboardJob) => {
    const style = STATUS_STYLE_MAP[job.status] || STATUS_STYLE_MAP.PREPARATION;
    return (
      <div
        key={job.id}
        className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors group border-l-4 ${style.borderClass}`}
      >
        <div className="flex justify-between items-start mb-2 gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${style.badgeClass}`}>
            {FORMAT_LABELS[job.formatType] || job.formatType}
          </span>
          <span className="text-xs text-gray-600 font-semibold bg-gray-100 px-2 py-0.5 rounded shrink-0">
            {job.quantity} + {job.sparesQuantity} ks
          </span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">
              {job.title}
            </h4>
            <p className="text-xs text-gray-500 mt-1">{job.client?.name || 'Neznámý klient'}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{MATERIAL_LABELS[job.materialType] || job.materialType}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditingJob(job)}
            title="Upravit zakázku / doplnit grafiku"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {job.deliveryDeadline && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className={`flex items-center gap-1 ${getDeadlineColor(job.deliveryDeadline)}`}>
                <Clock className="w-3 h-3" /> Termín: {new Date(job.deliveryDeadline).toLocaleDateString('cs-CZ')}
              </span>
            </div>
          )}

          {!job.artworkUrl ? (
            <button
              type="button"
              onClick={() => setEditingJob(job)}
              className="flex items-center gap-1 text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-full text-xs font-medium w-max mt-1 transition"
            >
              <ImageIcon className="w-3 h-3" /> + Doplnit tisková data
            </button>
          ) : (
            <a
              href={job.artworkUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-medium w-max mt-1 transition"
            >
              <CheckCircle2 className="w-3 h-3" /> Tisková data <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}

          {job.offer?.portalToken && (
            <Link
              href={`/p/${job.offer.portalToken}`}
              target="_blank"
              className="text-xs text-center block w-full py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded border border-purple-200 font-semibold mt-1 transition"
            >
              🌟 Otevřít Live Portál kampaně
            </Link>
          )}

          <div className="pt-2 mt-1 border-t border-gray-100 flex gap-1.5 justify-end">
            {job.status === 'PREPARATION' && (
              <button
                type="button"
                onClick={async () => {
                  await updatePrintJobStatus(job.id, 'CLIENT_APPROVAL');
                  router.refresh();
                }}
                className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-md transition font-semibold"
              >
                Poslat ke schválení →
              </button>
            )}
            {job.status === 'CLIENT_APPROVAL' && (
              <button
                type="button"
                onClick={async () => {
                  await updatePrintJobStatus(job.id, 'IN_PRINT');
                  router.refresh();
                }}
                className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-md transition font-semibold"
              >
                Zahájit tisk →
              </button>
            )}
            {job.status === 'IN_PRINT' && (
              <button
                type="button"
                onClick={async () => {
                  await updatePrintJobStatus(job.id, 'DELIVERED_TO_WAREHOUSE');
                  router.refresh();
                }}
                className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-md transition font-semibold"
              >
                ✓ Naskladnit (Výlep)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const kpis = productionKpis(jobs);
  const prepJobs = filteredJobs.filter(j => j.status === 'PREPARATION');
  const approvalJobs = filteredJobs.filter(j => j.status === 'CLIENT_APPROVAL');
  const printJobs = filteredJobs.filter(j => j.status === 'IN_PRINT');
  const deliveredJobs = filteredJobs.filter(j => j.status === 'DELIVERED_TO_WAREHOUSE');

  return (
    <div className="space-y-6">
      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Čeká na grafiku / schválení</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.preparation + kpis.approval}</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
            <ImageIcon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">V tisku u tiskárny</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.printing}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <Printer className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Očekávané doručení &lt; 48h</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{kpis.dueSoon}</p>
          </div>
          <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Naskladněno / K výlepu</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{kpis.delivered}</p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs, Search & Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('kanban')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                activeTab === 'kanban' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Kanban Board
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                activeTab === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Seznam zakázek ({filteredJobs.length})
            </button>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat zakázku, klienta..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | PrintProductionStatus)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">Všechny stavy</option>
            <option value="PREPARATION">Příprava grafiky</option>
            <option value="CLIENT_APPROVAL">Ke schválení klientem</option>
            <option value="IN_PRINT">V tisku u tiskárny</option>
            <option value="DELIVERED_TO_WAREHOUSE">Naskladněno / Výlep</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors justify-center shadow-sm text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Nová tisková zakázka
        </button>
      </div>

      {/* Main Content Area: Kanban */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              Příprava grafiky ({prepJobs.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {prepJobs.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Žádné zakázky</p>}
              {prepJobs.map(j => renderJobCard(j))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Ke schválení klientem ({approvalJobs.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {approvalJobs.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Žádné zakázky</p>}
              {approvalJobs.map(j => renderJobCard(j))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              V tisku u tiskárny ({printJobs.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {printJobs.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Žádné zakázky</p>}
              {printJobs.map(j => renderJobCard(j))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              Naskladněno / Výlep ({deliveredJobs.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {deliveredJobs.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Žádné zakázky</p>}
              {deliveredJobs.map(j => renderJobCard(j))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area: Table List View */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              Žádné tiskové zakázky neodpovídají zvolenému filtru.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Motiv / Kampaň</th>
                    <th className="px-4 py-3">Klient</th>
                    <th className="px-4 py-3">Formát & Materiál</th>
                    <th className="px-4 py-3">Množství</th>
                    <th className="px-4 py-3">Tisková data</th>
                    <th className="px-4 py-3">Termín dodání</th>
                    <th className="px-4 py-3">Stav</th>
                    <th className="px-4 py-3 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredJobs.map((job) => {
                    const style = STATUS_STYLE_MAP[job.status] || STATUS_STYLE_MAP.PREPARATION;
                    return (
                      <tr key={job.id} className="hover:bg-gray-50/80 transition">
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          <div>{job.title}</div>
                          {job.offer?.portalToken && (
                            <Link
                              href={`/p/${job.offer.portalToken}`}
                              target="_blank"
                              className="text-[11px] text-purple-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                            >
                              🌟 Live Portál <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{job.client?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{FORMAT_LABELS[job.formatType] || job.formatType}</div>
                          <div className="text-xs text-gray-500">{MATERIAL_LABELS[job.materialType] || job.materialType}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {job.quantity} ks <span className="text-xs font-normal text-gray-500">(+{job.sparesQuantity} rez.)</span>
                        </td>
                        <td className="px-4 py-3">
                          {job.artworkUrl ? (
                            <a
                              href={job.artworkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Otevřít data <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingJob(job)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-full"
                            >
                              <ImageIcon className="w-3 h-3" /> + Doplnit URL
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {job.deliveryDeadline ? (
                            <span className={`inline-flex items-center gap-1 ${getDeadlineColor(job.deliveryDeadline)}`}>
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(job.deliveryDeadline).toLocaleDateString('cs-CZ')}
                            </span>
                          ) : (
                            <span className="text-gray-400">Neurčeno</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.badgeClass}`}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {job.status === 'PREPARATION' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updatePrintJobStatus(job.id, 'CLIENT_APPROVAL');
                                  router.refresh();
                                }}
                                className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-md font-semibold"
                              >
                                Ke schválení →
                              </button>
                            )}
                            {job.status === 'CLIENT_APPROVAL' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updatePrintJobStatus(job.id, 'IN_PRINT');
                                  router.refresh();
                                }}
                                className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-md font-semibold"
                              >
                                Do tisku →
                              </button>
                            )}
                            {job.status === 'IN_PRINT' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updatePrintJobStatus(job.id, 'DELIVERED_TO_WAREHOUSE');
                                  router.refresh();
                                }}
                                className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-md font-semibold"
                              >
                                ✓ Naskladnit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingJob(job)}
                              className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md font-medium inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" /> Upravit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Print Job Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Nová tisková zakázka</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form action={async (formData) => {
              setIsSubmitting(true);
              try {
                const oId = formData.get('offerId') as string;
                const targetOffer = offers.find(o => o.id === oId);
                await createPrintJob({
                  title: formData.get('title') as string,
                  offerId: oId || undefined,
                  clientId: targetOffer?.client?.id || undefined,
                  formatType: formData.get('formatType'),
                  materialType: formData.get('materialType'),
                  quantity: parseInt(formData.get('quantity') as string) || 1,
                  sparesQuantity: parseInt(formData.get('sparesQuantity') as string) || 0,
                  deliveryDeadline: formData.get('deliveryDeadline') ? new Date(formData.get('deliveryDeadline') as string) : undefined,
                  artworkUrl: (formData.get('artworkUrl') as string) || undefined,
                  status: 'PREPARATION',
                });
                setIsModalOpen(false);
                router.refresh();
              } catch {
                alert('Chyba při vytváření zakázky');
              } finally {
                setIsSubmitting(false);
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Přiřadit k existující zakázce / kampani</label>
                <select
                  name="offerId"
                  value={selectedOfferId}
                  onChange={(e) => setSelectedOfferId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Bez napojení na zakázku --</option>
                  {offers.map(o => (
                    <option key={o.id} value={o.id}>{o.campaignName || o.title} ({o.client?.name || 'Bez klienta'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Název tiskového motivu</label>
                <input type="text" name="title" defaultValue={selectedOffer?.campaignName || selectedOffer?.title || ''} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Formát / Nosič</label>
                  <select name="formatType" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="EUROBILLBOARD">Eurobillboard (5,1 × 2,4m)</option>
                    <option value="BIGBOARD">Bigboard (9,6 × 3,6m)</option>
                    <option value="CLP">Citylight (118,5 × 175cm)</option>
                    <option value="BENCH">Lavička (city/street)</option>
                    <option value="CITY_POSTER">City poster</option>
                    <option value="TOWER">Tower</option>
                    <option value="OTHER">Jiné / Vlastní formát</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materiál</label>
                  <select name="materialType" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="BLUEBACK_120G">Blueback (Papír)</option>
                    <option value="PVC_BANNER_510G">PVC Banner</option>
                    <option value="CITYLIGHT_PAPER">Citylight Papír</option>
                    <option value="SELF_ADHESIVE_FOIL">Samolepicí fólie</option>
                    <option value="OTHER">Jiné</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Počet kusů</label>
                  <input type="number" name="quantity" defaultValue={1} min={1} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rezerva</label>
                  <input type="number" name="sparesQuantity" defaultValue={0} min={0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Clock className="w-4 h-4 text-orange-500" /> Termín dodání (Tisk)</label>
                  <input type="date" name="deliveryDeadline" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odkaz na grafiku (Drive / WeTransfer)</label>
                  <input type="url" name="artworkUrl" placeholder="https://" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors">Zrušit</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Vytvářím...' : 'Vytvořit zakázku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Print Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Upravit tiskovou zakázku</h3>
              <button type="button" onClick={() => setEditingJob(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form action={async (formData) => {
              setIsSubmitting(true);
              try {
                await updatePrintJob(editingJob.id, {
                  title: formData.get('title') as string,
                  formatType: formData.get('formatType'),
                  materialType: formData.get('materialType'),
                  quantity: parseInt(formData.get('quantity') as string) || 1,
                  sparesQuantity: parseInt(formData.get('sparesQuantity') as string) || 0,
                  deliveryDeadline: formData.get('deliveryDeadline') ? new Date(formData.get('deliveryDeadline') as string) : null,
                  artworkUrl: (formData.get('artworkUrl') as string) || undefined,
                });
                setEditingJob(null);
                router.refresh();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Chyba při ukládání změn');
              } finally {
                setIsSubmitting(false);
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Název tiskového motivu</label>
                <input type="text" name="title" defaultValue={editingJob.title} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Formát / Nosič</label>
                  <select name="formatType" defaultValue={editingJob.formatType} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="EUROBILLBOARD">Eurobillboard (5,1 × 2,4m)</option>
                    <option value="BIGBOARD">Bigboard (9,6 × 3,6m)</option>
                    <option value="CLP">Citylight (118,5 × 175cm)</option>
                    <option value="BENCH">Lavička (city/street)</option>
                    <option value="CITY_POSTER">City poster</option>
                    <option value="TOWER">Tower</option>
                    <option value="OTHER">Jiné / Vlastní formát</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materiál</label>
                  <select name="materialType" defaultValue={editingJob.materialType} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="BLUEBACK_120G">Blueback (Papír)</option>
                    <option value="PVC_BANNER_510G">PVC Banner</option>
                    <option value="CITYLIGHT_PAPER">Citylight Papír</option>
                    <option value="SELF_ADHESIVE_FOIL">Samolepicí fólie</option>
                    <option value="OTHER">Jiné</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Počet kusů</label>
                  <input type="number" name="quantity" defaultValue={editingJob.quantity} min={1} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rezerva</label>
                  <input type="number" name="sparesQuantity" defaultValue={editingJob.sparesQuantity} min={0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-orange-500" /> Termín dodání
                  </label>
                  <input
                    type="date"
                    name="deliveryDeadline"
                    defaultValue={editingJob.deliveryDeadline ? new Date(editingJob.deliveryDeadline).toISOString().split('T')[0] : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odkaz na grafiku (URL)</label>
                  <input
                    type="url"
                    name="artworkUrl"
                    defaultValue={editingJob.artworkUrl || ''}
                    placeholder="https://"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingJob(null)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors">Zrušit</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Ukládám...' : 'Uložit změny'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

