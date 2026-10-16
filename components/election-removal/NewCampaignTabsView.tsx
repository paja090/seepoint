'use client';

import React, { useState } from 'react';
import { Map, FileUp, Database, Wrench } from 'lucide-react';
import { InteractiveMapCampaignCreator } from './InteractiveMapCampaignCreator';
import { KmlImportWizard } from './KmlImportWizard';
import { SystemSurfacesCampaignCreator } from './SystemSurfacesCampaignCreator';
import { NewFieldAction } from './NewFieldAction';

interface NewCampaignTabsViewProps {
  clients?: Array<{ id: string; name: string }>;
}

export function NewCampaignTabsView({ clients = [] }: NewCampaignTabsViewProps) {
  const [activeTab, setActiveTab] = useState<'SYSTEM' | 'KML' | 'MAP' | 'MANUAL'>('SYSTEM');

  return (
    <div className="space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab('SYSTEM')}
          className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition-all ${
            activeTab === 'SYSTEM'
              ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                activeTab === 'SYSTEM'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Database className="h-4 w-4" />
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
              Novinka • Kontrola
            </span>
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-900">
              🏢 Plochy ze systému (podle klientů)
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Navigace, lavičky, billboardy a další plochy v evidenci → fotky jako Kontrola
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('KML')}
          className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition-all ${
            activeTab === 'KML'
              ? 'border-sky-600 bg-sky-50/70 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                activeTab === 'KML' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <FileUp className="h-4 w-4" />
            </div>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold text-sky-800">
              Google My Maps
            </span>
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-900">
              📁 Nahrát KML / KMZ mapu
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Import vrstev a bodů z Google My Maps s rozdělením podle klientů
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MAP')}
          className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition-all ${
            activeTab === 'MAP'
              ? 'border-sky-600 bg-sky-50/70 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                activeTab === 'MAP' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Map className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-900">
              🗺️ Naklikat body v interaktivní mapě
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Ruční umístění bodů přímo na mapu pro přesuny, montáže a demontáže
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MANUAL')}
          className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition-all ${
            activeTab === 'MANUAL'
              ? 'border-sky-600 bg-sky-50/70 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                activeTab === 'MANUAL' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-900">
              ✍️ Založit zakázku krok za krokem
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Založení hlavičky zakázky a postupné doplnění úkolů v detailu
            </p>
          </div>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'SYSTEM' && <SystemSurfacesCampaignCreator />}
      {activeTab === 'KML' && <KmlImportWizard />}
      {activeTab === 'MAP' && <InteractiveMapCampaignCreator />}
      {activeTab === 'MANUAL' && <NewFieldAction clients={clients} />}
    </div>
  );
}

