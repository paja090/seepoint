'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Mail,
  Printer,
  TrendingUp,
  AlertTriangle,
  Database,
} from 'lucide-react';
import type {
  CompanyExecutiveReport,
  DataAutomationLevel,
  ReportPeriodKey,
} from '@/lib/reports/company-report';

const PERIOD_OPTIONS: Array<{ key: ReportPeriodKey; label: string }> = [
  { key: 'week', label: 'Posledních 7 dní' },
  { key: 'month', label: 'Posledních 30 dní' },
  { key: 'quarter', label: 'Kvartál (90 dní)' },
  { key: 'year', label: 'Letošní rok (YTD)' },
];

function automationBadge(level: DataAutomationLevel) {
  if (level === 'AUTO') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
        ● Automaticky
      </span>
    );
  }
  if (level === 'SEMI_AUTO') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
        ◐ Částečně auto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-700">
      ○ Ruční podklad
    </span>
  );
}

function czk(val: number) {
  return `${Math.round(val).toLocaleString('cs-CZ')} Kč`;
}

export function CompanyReportClient({ report }: { report: CompanyExecutiveReport }) {
  const router = useRouter();
  const { kpis } = report;
  const csvHref = `/api/reports/company?period=${report.period.key}&format=csv`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* HEADER + PERIOD SWITCHER + ACTIONS */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
              <FileSpreadsheet size={13} /> Tabulkový manažerský přehled
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {report.organizationName} · {report.period.dateFromIso} – {report.period.dateToIso}
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
            Firemní reporty & Přehled výkonu
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 md:text-sm">
            Stručný tabulkový přehled obchodu, realizací, e-mailů a obsazenosti ploch s vyznačením automatických a ručních zdrojů dat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <a
            href={csvHref}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Download size={15} /> Export CSV (Excel)
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
          >
            <Printer size={14} /> Tisk / PDF
          </button>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 transition hover:bg-sky-100"
          >
            <BarChart3 size={14} /> Detail ploch & tržeb →
          </Link>
        </div>
      </div>

      {/* PERIOD PILLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs">
          {PERIOD_OPTIONS.map((opt) => {
            const active = report.period.key === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => router.push(`/reports?period=${opt.key}`)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          Aktualizováno:{' '}
          {new Date(report.generatedAt).toLocaleString('cs-CZ', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Prague',
          })}
        </span>
      </div>

      {/* EXECUTIVE KPI RIBBON */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Zakázky (Plán)</span>
            <Briefcase size={15} className="text-sky-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{kpis.workOrdersTotal}</p>
          <p className="text-[11px] font-semibold text-emerald-700">
            {kpis.workOrdersDone} hotovo · {kpis.workOrdersOpen} otevřeno
          </p>
        </div>

        <Link
          href="/work?filter=overdue"
          className={`rounded-2xl border p-4 shadow-sm transition ${
            kpis.workOrdersOverdue > 0
              ? 'border-amber-300 bg-amber-50/70 hover:bg-amber-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Po termínu</span>
            <AlertTriangle size={15} className={kpis.workOrdersOverdue > 0 ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{kpis.workOrdersOverdue}</p>
          <p className="text-[11px] font-semibold text-amber-800">
            {kpis.workOrdersAwaitingInvoice} čeká na fakturu
          </p>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Nabídky</span>
            <TrendingUp size={15} className="text-emerald-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-slate-900">
            {kpis.offersAccepted}/{kpis.offersCreated}
          </p>
          <p className="text-[11px] font-semibold text-slate-600">
            Konverze {kpis.offersConversionPct} % · {czk(kpis.offersAcceptedValue)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">CRM zakázky</span>
            <Building2 size={15} className="text-indigo-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{kpis.crmOrdersCount}</p>
          <p className="text-[11px] font-semibold text-indigo-700">
            {czk(kpis.crmOrdersValue)} ({kpis.crmOrdersViaAgencyCount} agenturní)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Gmail / Poptávky</span>
            <Mail size={15} className="text-purple-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{kpis.inboxTotalRelevant}</p>
          <p className="text-[11px] font-semibold text-purple-700">
            {kpis.inboxNewInquiries} poptávek · {kpis.inboxComplaints} reklamací
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Obsazenost</span>
            <CheckCircle2 size={15} className="text-teal-600" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{kpis.surfaceOccupancyPct} %</p>
          <p className="text-[11px] font-semibold text-slate-600">
            {kpis.expirationsTotal30d} expirací do 30 d
          </p>
        </div>
      </div>

      {/* TABLE 1: COMPACT COMPANY SUMMARY TABLE */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
          <div>
            <h2 className="text-base font-black text-slate-900">1. Stručný souhrn za firmu ({report.period.label})</h2>
            <p className="text-xs text-slate-500">Jednotný přehled klíčových čísel firmy na jedné tabulce.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Oblast</th>
                <th className="px-4 py-3">Metrika</th>
                <th className="px-4 py-3">Hodnota v období</th>
                <th className="px-4 py-3">Doplňující detail</th>
                <th className="px-4 py-3">Zdroj dat</th>
                <th className="px-5 py-3 text-right">Sběr dat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.summaryTable.map((row) => (
                <tr key={`${row.area}-${row.metric}`} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-extrabold text-slate-900 whitespace-nowrap">{row.area}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{row.metric}</td>
                  <td className="px-4 py-3 font-black text-slate-950 whitespace-nowrap">{row.valueDisplay}</td>
                  <td className="px-4 py-3 text-slate-600">{row.detail}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.source}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">{automationBadge(row.automation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* TABLE 2 & 3 SIDE BY SIDE: WORK BY TYPE + GMAIL INBOX */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
            <h2 className="text-sm font-black text-slate-900">2. Realizace podle typu práce</h2>
            <p className="text-[11px] text-slate-500">
              Výkazy práce: {kpis.workEntriesHours} hod · přímé náklady techniků {czk(kpis.workEntriesLaborCost)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Typ práce</th>
                  <th className="px-3 py-2.5 text-right">Celkem</th>
                  <th className="px-3 py-2.5 text-right">Hotovo</th>
                  <th className="px-3 py-2.5 text-right">Po termínu</th>
                  <th className="px-5 py-2.5 text-right">Hodnota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.workByType.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                      Za vybrané období nejsou evidovány žádné realizační zakázky.
                    </td>
                  </tr>
                ) : (
                  report.workByType.map((row) => (
                    <tr key={row.workType} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2.5 font-bold text-slate-900">{row.label}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-slate-900">{row.total}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{row.done}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-amber-700">{row.overdue}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-700">{czk(row.totalPrice)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-black text-slate-900">3. E-maily z Gmailu (AI Inbox)</h2>
              <p className="text-[11px] text-slate-500">
                Automatické roztřídění příchozí firemní pošty bez spamu.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                kpis.gmailConnected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {kpis.gmailConnected ? '✓ Gmail připojen' : 'Gmail nepřipojen'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Kategorie e-mailu</th>
                  <th className="px-3 py-2.5 text-right">Počet</th>
                  <th className="px-5 py-2.5 text-right">Čeká na kontrolu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.inboxByCategory.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                      Za vybrané období nebyly v AI Inboxu zaznamenány žádné obchodní e-maily.
                    </td>
                  </tr>
                ) : (
                  report.inboxByCategory.map((row) => (
                    <tr key={row.classification} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2.5 font-bold text-slate-900">{row.label}</td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-slate-900">{row.count}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-amber-700">
                        {row.pendingReview > 0 ? row.pendingReview : '0'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* TABLE 4: TOP CLIENTS & AGENCIES */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
          <h2 className="text-sm font-black text-slate-900">4. Nejvýznamnější klienti a agentury v období</h2>
          <p className="text-[11px] text-slate-500">
            Agregace zakázek z CRM i Plánu práce včetně přiřazené reklamní/mediální agentury.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Koncový klient</th>
                <th className="px-4 py-2.5">Agentura</th>
                <th className="px-4 py-2.5 text-right">Počet zakázek</th>
                <th className="px-4 py-2.5 text-right">Evidovaná hodnota</th>
                <th className="px-5 py-2.5 text-right">Zdroj</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.topClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    Za toto období nejsou evidovány zakázky s přiřazeným klientem.
                  </td>
                </tr>
              ) : (
                report.topClients.map((c) => (
                  <tr key={c.clientName} className="hover:bg-slate-50/60">
                    <td className="px-5 py-2.5 font-extrabold text-slate-900">{c.clientName}</td>
                    <td className="px-4 py-2.5">
                      {c.agencyName ? (
                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                          {c.agencyName}
                        </span>
                      ) : (
                        <span className="text-slate-400">Přímý klient</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">{c.ordersCount}</td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-950">{czk(c.totalValue)}</td>
                    <td className="px-5 py-2.5 text-right text-slate-500">
                      {c.source === 'MIXED' ? 'CRM + Plán' : c.source === 'CRM' ? 'CRM' : 'Plán práce'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* TABLE 5: DATA SOURCE AUTOMATION MATRIX (ANSWERS MAREK'S MEETING ITEM DIRECTLY) */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
          <Database size={16} className="text-indigo-600" />
          <div>
            <h2 className="text-sm font-black text-slate-900">
              5. Zdroje dat pro reporting — co se získává automaticky a co zůstává ruční
            </h2>
            <p className="text-[11px] text-slate-500">
              Přehled pro vedení firmy: které údaje systém již načítá sám z e-mailů a tabulek a které vyžadují externí/ruční podklad.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Oblast</th>
                <th className="px-4 py-2.5">Sledované údaje</th>
                <th className="px-4 py-2.5">Zdroj</th>
                <th className="px-4 py-2.5">Režim</th>
                <th className="px-4 py-2.5">Aktuální stav</th>
                <th className="px-5 py-2.5">Doporučení</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.dataSourceAudit.map((row) => (
                <tr key={row.category} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-extrabold text-slate-900 whitespace-nowrap">{row.category}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{row.metricName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.sourceSystem}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{automationBadge(row.automation)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.currentStatus}</td>
                  <td className="px-5 py-3 text-slate-500">{row.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 text-[11px] text-slate-400">
        <Clock size={12} />
        <span>Exportovatelná data jsou vždy omezena výhradně na aktuální organizaci ({report.organizationName}).</span>
      </div>
    </div>
  );
}
