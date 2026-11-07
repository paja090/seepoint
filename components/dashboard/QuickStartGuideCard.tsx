'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Building2, MapPinned, Send, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface QuickStartGuideCardProps {
  organizationName: string;
  hasCompanyBranding: boolean;
  totalSurfaces: number;
  hasCreatedOffer: boolean;
  isSuperAdmin?: boolean;
}

export function QuickStartGuideCard({
  organizationName,
  hasCompanyBranding,
  totalSurfaces,
  hasCreatedOffer,
  isSuperAdmin = false,
}: QuickStartGuideCardProps) {
  const isNewOrganization = totalSurfaces === 0;
  const [expanded, setExpanded] = useState(isNewOrganization);

  const completedSteps =
    (hasCompanyBranding ? 1 : 0) +
    (totalSurfaces > 0 ? 1 : 0) +
    (hasCreatedOffer ? 1 : 0);

  return (
    <div className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black shadow-sm">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-800">
                Rychlý start ({completedSteps}/3 hotovo)
              </span>
              {isSuperAdmin ? (
                <Link
                  href="/admin/leads"
                  className="rounded-full bg-purple-700 px-3 py-0.5 text-[11px] font-bold text-white hover:bg-purple-800"
                >
                  🚀 Otevřít Prodej & Oslovení firem →
                </Link>
              ) : null}
            </div>
            <h2 className="mt-1 text-lg font-black text-slate-900">
              Vítejte v SeePoint OS ({organizationName}) – Začněte ve 3 jednoduchých krocích
            </h2>
            <p className="text-xs text-slate-600">
              Místo hodin lepení fotek a map do Excelu vyberete plochy na mapě a za 30 vteřin pošlete klientovi interaktivní odkaz s Google Street View.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          {expanded ? (
            <>
              <span>Skrýt průvodce</span>
              <ChevronUp size={15} />
            </>
          ) : (
            <>
              <span>Zobrazit 3 kroky pro start</span>
              <ChevronDown size={15} />
            </>
          )}
        </button>
      </div>

      {expanded ? (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {/* Krok 1 */}
          <div
            className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
              hasCompanyBranding
                ? 'border-emerald-200 bg-emerald-50/40'
                : 'border-slate-200 bg-white shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-white">
                  1. KROK
                </span>
                {hasCompanyBranding ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={16} /> Hotovo
                  </span>
                ) : (
                  <Building2 size={18} className="text-indigo-600" />
                )}
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                Nahrajte si logo a kontakt firmy
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Všechny webové nabídky a PDF prezentace pro Vaše klienty budou odcházet pod Vaším logem, telefonem a e-mailem.
              </p>
            </div>
            <div className="mt-4 pt-2">
              <Link
                href="/settings/company"
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                {hasCompanyBranding ? 'Upravit logo a kontakt →' : 'Nastavit logo a kontakt →'}
              </Link>
            </div>
          </div>

          {/* Krok 2 */}
          <div
            className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
              totalSurfaces > 0
                ? 'border-emerald-200 bg-emerald-50/40'
                : 'border-indigo-300 bg-white shadow-sm ring-2 ring-indigo-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-black text-white">
                  2. KROK
                </span>
                {totalSurfaces > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={16} /> {totalSurfaces} ploch v mapě
                  </span>
                ) : (
                  <MapPinned size={18} className="text-indigo-600" />
                )}
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                Vložte své reklamní plochy na mapu
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Přidejte první billboard/nosič ručně na mapu (GPS + fotka + cena), nebo nahrajte celý svůj ceník z Excelu.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 pt-2">
              <Link
                href="/carriers"
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Přidat plochu →
              </Link>
              <Link
                href="/import"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Import z Excelu
              </Link>
            </div>
          </div>

          {/* Krok 3 */}
          <div
            className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
              hasCreatedOffer
                ? 'border-emerald-200 bg-emerald-50/40'
                : 'border-slate-200 bg-white shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">
                  3. KROK
                </span>
                {hasCreatedOffer ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={16} /> Vyzkoušeno
                  </span>
                ) : (
                  <Send size={18} className="text-emerald-600" />
                )}
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                Pošlete si zkušební nabídku
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Vyberte plochy a vytvořte první nabídku. Otevřete si klientský odkaz s mapou, Street View a PDF prezentací.
              </p>
            </div>
            <div className="mt-4 pt-2">
              <Link
                href="/offers"
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Vytvořit nabídku klientovi →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
