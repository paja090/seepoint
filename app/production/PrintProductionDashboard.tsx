'use client';

import { useState } from 'react';
import { PlusCircle, Image as ImageIcon, Printer, Truck, Package, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function PrintProductionDashboard() {
  const [activeTab, setActiveTab] = useState<'kanban' | 'list'>('kanban');

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

        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center shadow-sm">
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
              Příprava grafiky (5)
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {/* Card Template */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded">EUROBILLBOARD</span>
                  <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">10 + 2 ks</span>
                </div>
                <h4 className="font-medium text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">Podzimní kampaň 2026</h4>
                <p className="text-sm text-gray-500 mt-1">Alza.cz a.s.</p>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Dodat do: 15.10.</span>
                  <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full"><ImageIcon className="w-3 h-3" /> Chybí data</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Ke schválení */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Ke schválení klientem (7)
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
               {/* Demo Card */}
               <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer group border-l-4 border-l-yellow-400">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded">PVC BANNER</span>
                  <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">3 ks</span>
                </div>
                <h4 className="font-medium text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">Nová pobočka Plzeň</h4>
                <p className="text-sm text-gray-500 mt-1">Kaufland ČR v.o.s.</p>
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Dodat do: 20.10.</span>
                  </div>
                  <Link href={`/production/approve/demo-token-123`} target="_blank" className="text-xs text-center block w-full py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded border border-gray-200 font-medium">
                    🔍 Otevřít portál schvalování
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: V tisku */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              V tisku u tiskárny (8)
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
               {/* Demo Card */}
               <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer group border-l-4 border-l-blue-500">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded">BIGBOARD</span>
                  <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">1 + 0 ks</span>
                </div>
                <h4 className="font-medium text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">Vánoce 2026</h4>
                <p className="text-sm text-gray-500 mt-1">Mall.cz</p>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1 text-orange-600 font-medium"><Truck className="w-3 h-3" /> Dnes!</span>
                  <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Schváleno</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 4: Naskladněno */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 flex flex-col h-[600px]">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              Naskladněno / Výlep (45)
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
               {/* Demo Card */}
               <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 opacity-75 hover:opacity-100 transition-opacity cursor-pointer border-l-4 border-l-green-500">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded">CITYLIGHT</span>
                  <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">50 + 5 ks</span>
                </div>
                <h4 className="font-medium text-gray-900 leading-tight line-through decoration-gray-300">Představení nového modelu</h4>
                <p className="text-sm text-gray-500 mt-1">Škoda Auto</p>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1 text-green-700 font-medium bg-green-50 px-2 py-1 rounded"><Package className="w-3 h-3" /> Na skladu: Regál A4</span>
                </div>
              </div>
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
    </div>
  );
}
