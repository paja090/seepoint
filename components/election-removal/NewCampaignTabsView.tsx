'use client';

import React, { useState } from 'react';
import { Map, FileUp, Sparkles, Navigation } from 'lucide-react';
import { InteractiveMapCampaignCreator } from './InteractiveMapCampaignCreator';
import { KmlImportWizard } from './KmlImportWizard';

export function NewCampaignTabsView() {
  const [activeTab, setActiveTab] = useState<'MAP' | 'KML'>('MAP');

  return (
    <div className="space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('MAP')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all ${
            activeTab === 'MAP'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <Map className="h-4 w-4" />
          <span>🗺️ Plánovat přímo v interaktivní mapě</span>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold text-sky-800">
            Doporučeno
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('KML')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all ${
            activeTab === 'KML'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <FileUp className="h-4 w-4" />
          <span>📁 Vložit KML soubor (Google My Maps)</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'MAP' ? (
        <InteractiveMapCampaignCreator />
      ) : (
        <KmlImportWizard />
      )}
    </div>
  );
}
