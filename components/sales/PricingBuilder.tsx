'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Percent, Receipt, Send, TrendingUp } from 'lucide-react';
import {
  formatCzk,
  pricingCategoryLabels,
  pricingConfig,
  pricingLines,
  type PricingLine,
} from '@/lib/mock-sales-data';
import { WorkflowStepper } from './WorkflowStepper';
import { Chip, WorkflowFooter } from './ui';

const CATEGORY_ORDER: PricingLine['category'][] = ['media', 'production', 'service'];

export function PricingBuilder() {
  const [discount, setDiscount] = useState(pricingConfig.discountPercent);
  const [showInternal, setShowInternal] = useState(false);

  const totals = useMemo(() => {
    const subtotal = pricingLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
    const discountValue = Math.round((subtotal * discount) / 100);
    const afterDiscount = subtotal - discountValue;
    const vat = Math.round(afterDiscount * (pricingConfig.vatPercent / 100) * 100) / 100;
    const total = afterDiscount + vat;
    const margin = afterDiscount - pricingConfig.costBase;
    const marginPercent = afterDiscount > 0 ? Math.round((margin / afterDiscount) * 100) : 0;
    return { subtotal, discountValue, afterDiscount, vat, total, margin, marginPercent };
  }, [discount]);

  return (
    <div className="space-y-6">
      <WorkflowStepper current="pricing" />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Line items */}
        <div className="space-y-4">
          {CATEGORY_ORDER.map((category) => {
            const lines = pricingLines.filter((line) => line.category === category);
            const groupTotal = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
            return (
              <section className="card" key={category}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{pricingCategoryLabels[category]}</h2>
                  <span className="text-sm font-semibold text-slate-950">{formatCzk(groupTotal)}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <div className="flex items-center gap-3 py-3" key={line.id}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{line.label}</p>
                        <p className="text-xs text-slate-500">{line.detail}</p>
                      </div>
                      <div className="hidden text-right text-xs text-slate-500 sm:block">
                        {line.qty} {line.unit} × {formatCzk(line.unitPrice)}
                      </div>
                      <div className="w-28 text-right font-semibold text-slate-950">
                        {formatCzk(line.qty * line.unitPrice)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Internal margin (not shown to client) */}
          <section className="card border-dashed !border-slate-300 bg-slate-50/60">
            <button
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setShowInternal((prev) => !prev)}
              type="button"
            >
              <Lock aria-hidden className="text-slate-500" size={16} />
              <span className="text-sm font-semibold text-slate-800">Interní kalkulace marže</span>
              <Chip className="ml-1">Neviditelné klientovi</Chip>
              <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-sky-700">
                {showInternal ? <><EyeOff aria-hidden size={15} /> Skrýt</> : <><Eye aria-hidden size={15} /> Zobrazit</>}
              </span>
            </button>
            {showInternal && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">Nákladová základna</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{formatCzk(pricingConfig.costBase)}</p>
                </div>
                <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">Hrubá marže</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCzk(totals.margin)}</p>
                </div>
                <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="flex items-center gap-1 text-xs text-slate-500"><TrendingUp aria-hidden size={13} /> Marže %</p>
                  <p className={`mt-1 text-lg font-semibold ${totals.marginPercent >= 25 ? 'text-emerald-700' : 'text-amber-600'}`}>{totals.marginPercent} %</p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Summary rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="card">
            <div className="mb-4 flex items-center gap-2">
              <Receipt aria-hidden className="text-slate-500" size={18} />
              <h2 className="text-base font-semibold text-slate-950">Souhrn nabídky</h2>
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Percent aria-hidden size={14} /> Sleva ({discount} %)
              </span>
              <input
                className="w-full accent-slate-950"
                max={30}
                min={0}
                onChange={(event) => setDiscount(Number(event.target.value))}
                step={1}
                type="range"
                value={discount}
              />
            </label>

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Mezisoučet</dt>
                <dd className="font-medium text-slate-900">{formatCzk(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Sleva ({discount} %)</dt>
                <dd className="font-medium text-emerald-700">−{formatCzk(totals.discountValue)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2.5">
                <dt className="font-medium text-slate-700">Cena bez DPH</dt>
                <dd className="font-semibold text-slate-900">{formatCzk(totals.afterDiscount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">DPH ({pricingConfig.vatPercent} %)</dt>
                <dd className="font-medium text-slate-900">{formatCzk(totals.vat)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-white">
              <span className="text-sm font-medium">Celkem s DPH</span>
              <span className="text-xl font-semibold tracking-tight">{formatCzk(totals.total)}</span>
            </div>

            {discount !== pricingConfig.discountPercent && (
              <p className="mt-3 text-xs text-slate-500">
                Výchozí sleva je {pricingConfig.discountPercent} %.
              </p>
            )}

            <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700" type="button">
              <Send aria-hidden size={16} /> Odeslat ke schválení
            </button>
          </section>
        </aside>
      </div>

      <WorkflowFooter current="pricing" />
    </div>
  );
}
