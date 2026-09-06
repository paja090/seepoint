'use client';

import { useState } from 'react';
import { PlusCircle, Image as ImageIcon, Printer, Truck, Package, Clock, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { createPrintJob, updatePrintJobStatus } from './actions';
import { useRouter } from 'next/navigation';

export function PrintProductionDashboard({ offers = [], jobs = [] }: { offers?: any[], jobs?: any[] }) {
  const [activeTab, setActiveTab] = useState<'kanban' | 'list'>('kanban');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const [selectedOfferId, setSelectedOfferId] = useState('');
  const selectedOffer = offers.find(o => o.id === selectedOfferId);

  const getDeadlineColor = (date: Date) => {
    if (!date) return 'text-gray-500';
    const now = new Date();
    const deadline = new Date(date);
    const diff = deadline.getTime() - now.getTime();
    if (diff < 0) return 'text-red-600 font-bold'; // Overdue
    if (diff < 2 * 24 * 60 * 60 * 1000) return 'text-orange-500 font-bold'; // Next 48h
    return 'text-gray-500';
  };

  const renderJobCard = (job: any, bgColor: string, accentColor: string) => (
    <div key={job.id} className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer group border-l-4 border-l-${accentColor}`}>
      <div className="flex justify-between items-start mb-2">
        <span className={`text-xs font-semibold bg-${bgColor} text-${accentColor} px-2 py-1 rounded`}>{job.formatType}</span>
        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{job.quantity} + {job.sparesQuantity} ks</span>
      </div>
      <h4 className="font-medium text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">{job.title}</h4>
      <p className="text-sm text-gray-500 mt-1">{job.client?.name || job.clientName || 'Neznámý klient'}</p>
      
      <div className="mt-4 flex flex-col gap-2">
        {job.deliveryDeadline && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className={`flex items-center gap-1 ${getDeadlineColor(job.deliveryDeadline)}`}>
              <Clock className="w-3 h-3" /> Termín: {new Date(job.deliveryDeadline).toLocaleDateString('cs-CZ')}
            </span>
          </div>
        )}
        
        {job.status === 'PREPARATION' && !job.artworkUrl && (
          <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-xs w-max mt-1"><ImageIcon className="w-3 h-3" /> Chybí tisková data</span>
        )}
        {job.status === 'PREPARATION' && job.artworkUrl && (
          <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs w-max mt-1"><CheckCircle2 className="w-3 h-3" /> Data nahrána</span>
        )}

        {job.status === 'CLIENT_APPROVAL' && job.offer?.publicTokenHash && (
          <Link href={`/p/${job.offer.publicTokenHash}`} target="_blank" className="text-xs text-center block w-full py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded border border-gray-200 font-medium mt-1">
            🔍 Otevřít portál pro klienta
          </Link>
        )}

        <div className="pt-2 mt-2 border-t border-gray-100 flex gap-1 justify-end">
          {job.status === 'PREPARATION' && (
            <button onClick={() => updatePrintJobStatus(job.id, 'CLIENT_APPROVAL')} className="text-xs px-2 py-1 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-md transition font-medium">Poslat ke schválení</button>
          )}
          {job.status === 'CLIENT_APPROVAL' && (
            <button onClick={() => updatePrintJobStatus(job.id, 'IN_PRINT')} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition font-medium">Zahájit tisk</button>
          )}
          {job.status === 'IN_PRINT' && (
            <button onClick={() => updatePrintJobStatus(job.id, 'DELIVERED_TO_WAREHOUSE')} className="text-xs px-2 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition font-medium">Naskladnit (Výlep)</button>
          )}
        </div>
      </div>
    </div>
  );

  const prepJobs = jobs.filter(j => j.status === 'PREPARATION');
  const approvalJobs = jobs.filter(j => j.status === 'CLIENT_APPROVAL');
  const printJobs = jobs.filter(j => j.status === 'IN_PRINT');
  const deliveredJobs = jobs.filter(j => j.status === 'DELIVERED_TO_WAREHOUSE');

  return (
    <div className="space-y-6">
      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Čeká na grafiku / schválení</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
            <ImageIcon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">V tisku u tiskárny</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">8</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <Printer className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Očekávané doručení &lt; 48h</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">3</p>
          </div>
          <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Naskladněno / K výlepu</p>
            <p className="text-2xl font-bold text-green-600 mt-1">45</p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex gap-1 p-1 bg-gray-50 rounded-md">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'kanban' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'list' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Seznam zakázek
          </button>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Nová tisková zakázka
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Column 1: Příprava */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              Příprava grafiky ({prepJobs.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {prepJobs.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Žádné zakázky</p>}
              {prepJobs.map(j => renderJobCard(j, 'blue-50', 'blue-700'))}
            </div>
          </div>

          {/* Column 2: Ke schválení */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Ke schválení klientem ({approvalJobs.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {approvalJobs.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Žádné zakázky</p>}
              {approvalJobs.map(j => renderJobCard(j, 'gray-100', 'yellow-500'))}
            </div>
          </div>

          {/* Column 3: V tisku */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              V tisku u tiskárny ({printJobs.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {printJobs.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Žádné zakázky</p>}
              {printJobs.map(j => renderJobCard(j, 'blue-50', 'blue-600'))}
            </div>
          </div>

          {/* Column 4: Naskladněno */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              Naskladněno / Výlep ({deliveredJobs.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {deliveredJobs.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Žádné zakázky</p>}
              {deliveredJobs.map(j => renderJobCard(j, 'gray-100', 'green-600'))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8 text-center text-gray-500">
            Tabulkové zobrazení bude brzy přidáno.
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Nová tisková zakázka</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
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
                  clientId: targetOffer?.client?.id || undefined, // use clientId if found
                  formatType: formData.get('formatType') as any,
                  materialType: formData.get('materialType') as any,
                  quantity: parseInt(formData.get('quantity') as string) || 1,
                  sparesQuantity: parseInt(formData.get('sparesQuantity') as string) || 0,
                  deliveryDeadline: formData.get('deliveryDeadline') ? new Date(formData.get('deliveryDeadline') as string) : undefined,
                  artworkUrl: formData.get('artworkUrl') as string || undefined,
                  status: 'PREPARATION',
                });
                setIsModalOpen(false);
                router.refresh();
              } catch (e) {
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
                    <option value="CITYLIGHT">Citylight (118,5 × 175cm)</option>
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
                    <option value="PVC_BANNER_450G">PVC Banner</option>
                    <option value="CITYLIGHT_150G">Citylight Papír</option>
                    <option value="SELF_ADHESIVE_FOIL">Samolepící fólie</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odkaz na grafiku (WeTransfer)</label>
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
    </div>
  );
}
