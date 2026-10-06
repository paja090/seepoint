'use client';

import { useState } from 'react';
import {
  DollarSign,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import type { DraftPoint } from './types';
import { getPointPinVisual } from '@/lib/offers/navigation-carrier-types';

interface NavigationPricingStepProps {
  points: DraftPoint[];
  onPointsChange: (points: DraftPoint[]) => void;
  onApplyCatalogRates: () => void;
  hasSelectionSubmitted?: boolean;
}

export function NavigationPricingStep({
  points,
  onPointsChange,
  onApplyCatalogRates,
  hasSelectionSubmitted,
}: NavigationPricingStepProps) {
  const [showUnselected, setShowUnselected] = useState(false);

  // Split points into client-selected and unselected alternatives
  const selectedPoints = points.filter((p) => p.isSelectedByClient !== false);
  const unselectedPoints = points.filter((p) => p.isSelectedByClient === false);

  function handleUpdatePointPrice(
    pointId: string,
    field: 'unitPrice' | 'framePrice' | 'productionPrice' | 'installationPrice' | 'removalPrice' | 'quantity',
    value: string
  ) {
    onPointsChange(
      points.map((p) => (p.id === pointId ? { ...p, [field]: value } : p))
    );
  }

  function calculatePointSubtotal(p: DraftPoint) {
    const q = Number(p.quantity || 1);
    const rental = Number(p.unitPrice || 0);
    const frame = Number(p.framePrice || 0);
    const prod = Number(p.productionPrice || 0);
    const inst = Number(p.installationPrice || 0);
    const rem = Number(p.removalPrice || 0);
    return q * (rental + frame + prod + inst + rem);
  }

  // Financial summary breakdown
  let totalRental = 0;
  let totalFrame = 0;
  let totalProd = 0;
  let totalInst = 0;
  let totalRem = 0;

  for (const p of points) {
    const q = Number(p.quantity || 1);
    totalRental += q * Number(p.unitPrice || 0);
    totalFrame += q * Number(p.framePrice || 0);
    totalProd += q * Number(p.productionPrice || 0);
    totalInst += q * Number(p.installationPrice || 0);
    totalRem += q * Number(p.removalPrice || 0);
  }

  const subtotal = totalRental + totalFrame + totalProd + totalInst + totalRem;
  const taxAmount = Math.round(subtotal * 0.21);
  const totalWithTax = subtotal + taxAmount;

  const formatPrice = (val: number) =>
    new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <DollarSign className="text-purple-600" size={18} />
              <span>Cenová kalkulace navigačních bodů (Fáze 2)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Naceňte jednotlivé položky (nájem, rámy, tisk, montáž, demontáž) pro vybrané body trasy.
            </p>
          </div>

          <button
            type="button"
            onClick={onApplyCatalogRates}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer shadow-xs"
          >
            <Zap size={14} className="text-amber-600 fill-amber-500" />
            <span>Načíst ceníkové sazby pro všechny body</span>
          </button>
        </div>

        {hasSelectionSubmitted && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Klient potvrdil výběr v 1. fázi:</strong> V kalkulaci níže jsou prioritně zobrazeny klientem vybrané pozice ({selectedPoints.length}).
            </span>
          </div>
        )}

        {/* Pricing Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[960px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-3 w-12">#</th>
                <th className="px-3.5 py-3">Navigační bod & Nosič</th>
                <th className="px-3 py-3 w-16 text-center">Ks</th>
                <th className="px-3 py-3 w-28 text-right">Pronájem (rok)</th>
                <th className="px-3 py-3 w-24 text-right">Výroba rámu</th>
                <th className="px-3 py-3 w-24 text-right">Tisk cedule</th>
                <th className="px-3 py-3 w-24 text-right">Montáž</th>
                <th className="px-3 py-3 w-24 text-right">Demontáž</th>
                <th className="px-3.5 py-3 w-28 text-right font-black">Mezisoučet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedPoints.map((pt, idx) => {
                const vis = getPointPinVisual(pt);
                const ptSubtotal = calculatePointSubtotal(pt);

                return (
                  <tr key={`price-${pt.id}`} className="hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5 font-mono font-black text-slate-800">#{idx + 1}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-extrabold text-slate-900 truncate max-w-xs">{pt.label}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                        <span>{vis.icon} {vis.category.shortLabel}</span>
                        <span>·</span>
                        <span>{pt.variant || 'Standard'}</span>
                        {pt.pillarNumber && <span>· VO #{pt.pillarNumber}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        className="input text-xs font-mono text-center py-1 px-1.5 w-14"
                        value={pt.quantity}
                        onChange={(e) => handleUpdatePointPrice(pt.id, 'quantity', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="text"
                        className="input text-xs font-mono text-right py-1 px-2 font-bold text-slate-900"
                        placeholder="0"
                        value={pt.unitPrice}
                        onChange={(e) => handleUpdatePointPrice(pt.id, 'unitPrice', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="text"
                        className="input text-xs font-mono text-right py-1 px-2"
                        placeholder="0"
                        value={pt.framePrice}
                        onChange={(e) => handleUpdatePointPrice(pt.id, 'framePrice', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="text"
                        className="input text-xs font-mono text-right py-1 px-2"
                        placeholder="0"
                        value={pt.productionPrice}
                        onChange={(e) => handleUpdatePointPrice(pt.id, 'productionPrice', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="text"
                        className="input text-xs font-mono text-right py-1 px-2"
                        placeholder="0"
                        value={pt.installationPrice}
                        onChange={(e) => handleUpdatePointPrice(pt.id, 'installationPrice', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="text"
                        className="input text-xs font-mono text-right py-1 px-2"
                        placeholder="0"
                        value={pt.removalPrice}
                        onChange={(e) => handleUpdatePointPrice(pt.id, 'removalPrice', e.target.value)}
                      />
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900">
                      {formatPrice(ptSubtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Unselected Alternatives Collapsible Section (Never deleted!) */}
        {unselectedPoints.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <button
              type="button"
              onClick={() => setShowUnselected(!showUnselected)}
              className="flex w-full items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-950 cursor-pointer"
            >
              <span>
                📁 Nevybrané alternativy z 1. fáze ({unselectedPoints.length})
                <span className="font-normal text-slate-500 ml-2">
                  (Tyto body zůstávají v evidenci, ale nepočítají se do rozpočtu, dokud je neaktivujete)
                </span>
              </span>
              {showUnselected ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showUnselected && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white mt-2">
                <table className="min-w-[960px] w-full text-left text-xs opacity-70">
                  <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Bod</th>
                      <th className="px-3 py-2">Stav</th>
                      <th className="px-3 py-2 text-right">Pronájem</th>
                      <th className="px-3 py-2 text-right">Rám</th>
                      <th className="px-3 py-2 text-right">Tisk</th>
                      <th className="px-3 py-2 text-right">Montáž</th>
                      <th className="px-3 py-2 text-right">Demontáž</th>
                      <th className="px-3 py-2 text-center">Akce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unselectedPoints.map((pt) => (
                      <tr key={`unsel-${pt.id}`}>
                        <td className="px-3 py-2 font-bold text-slate-700">{pt.label}</td>
                        <td className="px-3 py-2 text-slate-500">Nevybráno klientem</td>
                        <td className="px-3 py-2 text-right font-mono">{pt.unitPrice}</td>
                        <td className="px-3 py-2 text-right font-mono">{pt.framePrice}</td>
                        <td className="px-3 py-2 text-right font-mono">{pt.productionPrice}</td>
                        <td className="px-3 py-2 text-right font-mono">{pt.installationPrice}</td>
                        <td className="px-3 py-2 text-right font-mono">{pt.removalPrice}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              onPointsChange(
                                points.map((p) =>
                                  p.id === pt.id ? { ...p, isSelectedByClient: true } : p
                                )
                              )
                            }
                            className="text-[10px] font-bold text-sky-700 hover:underline cursor-pointer"
                          >
                            + Zařadit do kalkulace
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sticky / Dedicated Financial Summary Breakdown */}
        <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/50 via-white to-sky-50/30 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-purple-100 pb-3">
            <h3 className="text-sm font-black text-slate-900">Souhrnná finanční rekapitulace</h3>
            <span className="text-xs font-semibold text-slate-500">Sazba DPH: 21 %</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Pronájem celkem</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{formatPrice(totalRental)}</span>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Výroba rámů</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{formatPrice(totalFrame)}</span>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Tisk celkem</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{formatPrice(totalProd)}</span>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Montáž celkem</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{formatPrice(totalInst)}</span>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Demontáž celkem</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{formatPrice(totalRem)}</span>
            </div>
          </div>

          <div className="border-t border-purple-100 pt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs">
              <div className="text-slate-600">
                Celkem bez DPH: <strong className="font-mono text-slate-900">{formatPrice(subtotal)}</strong>
              </div>
              <div className="text-slate-600">
                DPH 21 %: <strong className="font-mono text-slate-900">{formatPrice(taxAmount)}</strong>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 block">Celková částka s DPH</span>
              <span className="text-xl sm:text-2xl font-black text-purple-950 font-mono block">
                {formatPrice(totalWithTax)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
