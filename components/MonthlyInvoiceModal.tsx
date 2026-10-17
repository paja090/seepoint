'use client';

import React, { useEffect, useState } from 'react';
import { SettlementInvoiceData } from '@/lib/settlement-invoice';
import { StatusPill } from '@/lib/internal-format';

type MonthlyInvoiceModalProps = {
  settlementId: string;
  onClose: () => void;
  onSettlementUpdated?: () => void;
};

export function MonthlyInvoiceModal({ settlementId, onClose, onSettlementUpdated }: MonthlyInvoiceModalProps) {
  const [data, setData] = useState<SettlementInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/settlements/${settlementId}/invoice`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Nepodařilo se načíst doklad vyúčtování.');
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání vyúčtování.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [settlementId]);

  const handleCloseMonth = async () => {
    if (!confirm('Opravdu chcete provést měsíční uzávěrku a vystavit finální vyúčtování za tento měsíc?')) {
      return;
    }
    setClosing(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/settlements/${settlementId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeMonth: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Uzávěrka se nezdařila.');
      setNotice('Měsíční uzávěrka byla úspěšně provedena a doklad vygenerován.');
      setData(json.invoiceData);
      if (onSettlementUpdated) {
        onSettlementUpdated();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při provádění uzávěrky.');
    } finally {
      setClosing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.open(`/api/settlements/${settlementId}/pdf`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        {/* Modal Top Bar */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-6 py-4 backdrop-blur print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Měsíční vyúčtování & Podklad k fakturaci
              </h3>
              <p className="text-xs text-slate-500">
                Doklad za období: <strong>{data ? data.periodTitle : 'Načítání...'}</strong>
              </p>
            </div>
            {data && <StatusPill value={data.settlementStatus} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data && data.settlementStatus !== 'LOCKED' && data.settlementStatus !== 'PAID' && (
              <button
                type="button"
                onClick={handleCloseMonth}
                disabled={closing}
                className="rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-700 transition shadow-sm disabled:opacity-50"
              >
                {closing ? 'Uzavírám...' : '🔒 Provést měsíční uzávěrku'}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              🖨️ Vytisknout
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
            >
              📥 Stáhnout PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Zavřít"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notices & Errors */}
        {notice && (
          <div className="mx-6 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 print:hidden">
            {notice}
          </div>
        )}
        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800 print:hidden">
            {error}
          </div>
        )}

        {/* Printable Invoice Sheet Body */}
        <div className="p-6 md:p-8 space-y-6 text-slate-800" id="monthly-invoice-sheet">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">
              <span className="inline-block animate-spin mr-2">⏳</span> Načítám podklady měsíčního vyúčtování...
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-sm text-red-600">
              Doklad se nepodařilo načíst.
            </div>
          ) : (
            <>
              {/* Document Header */}
              <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black tracking-tight text-blue-600">SeePOINT</span>
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase">
                      OS
                    </span>
                  </div>
                  <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                    MĚSÍČNÍ VYÚČTOVÁNÍ PRACÍ & FAKTURAČNÍ PODKLAD
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evidenční číslo: <strong className="font-mono text-slate-800">{data.invoiceNumber}</strong>
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-right">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Konečná částka k výplatě</div>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                    {data.grossAmount.toLocaleString('cs-CZ')} Kč
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Zdaňovací období: <strong>{data.periodTitle}</strong>
                  </div>
                </div>
              </div>

              {/* Parties Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                {/* Supplier (Worker) */}
                <div className="space-y-1 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
                    Dodavatel (Pracovník / Zhotovitel)
                  </div>
                  <div className="text-sm font-bold text-slate-900">{data.supplier.name}</div>
                  <div className="text-slate-600">
                    {[data.supplier.street, [data.supplier.postalCode, data.supplier.city].filter(Boolean).join(' '), data.supplier.country].filter(Boolean).join(', ') || 'Adresa neuvedena'}
                  </div>
                  {data.supplier.companyId && (
                    <div className="text-slate-600">IČO: <strong>{data.supplier.companyId}</strong></div>
                  )}
                  {data.supplier.vatId && (
                    <div className="text-slate-600">DIČ: <strong>{data.supplier.vatId}</strong></div>
                  )}
                  {data.supplier.bankAccount && (
                    <div className="pt-1 text-slate-800">
                      Bankovní účet: <strong className="font-mono text-blue-700">{data.supplier.bankAccount}</strong>
                    </div>
                  )}
                  {data.supplier.iban && (
                    <div className="text-slate-500 text-[11px]">IBAN: {data.supplier.iban}</div>
                  )}
                  {data.supplier.email && (
                    <div className="text-slate-500 text-[11px]">E-mail: {data.supplier.email}</div>
                  )}
                </div>

                {/* Customer (Company) */}
                <div className="space-y-1 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
                    Odběratel (Objednatel)
                  </div>
                  <div className="text-sm font-bold text-slate-900">{data.customer.name}</div>
                  <div className="text-slate-600">
                    {[data.customer.street, [data.customer.postalCode, data.customer.city].filter(Boolean).join(' '), data.customer.country].filter(Boolean).join(', ') || 'SeePoint s.r.o.'}
                  </div>
                  {data.customer.companyId && (
                    <div className="text-slate-600">IČO: <strong>{data.customer.companyId}</strong></div>
                  )}
                  {data.customer.vatId && (
                    <div className="text-slate-600">DIČ: <strong>{data.customer.vatId}</strong></div>
                  )}
                  {data.customer.bankAccount && (
                    <div className="pt-1 text-slate-600">
                      Účet společnosti: <span className="font-mono">{data.customer.bankAccount}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dates & Payment Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-100/60 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Datum vystavení</div>
                  <div className="font-semibold text-slate-900 mt-0.5 font-mono">
                    {new Date(data.issueDate).toLocaleDateString('cs-CZ')}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Datum splatnosti</div>
                  <div className="font-semibold text-slate-900 mt-0.5 font-mono">
                    {new Date(data.dueDate).toLocaleDateString('cs-CZ')}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Rozsah období</div>
                  <div className="font-semibold text-slate-900 mt-0.5 font-mono text-[11px]">
                    {new Date(data.periodFrom).toLocaleDateString('cs-CZ')} – {new Date(data.periodTo).toLocaleDateString('cs-CZ')}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Variabilní symbol</div>
                  <div className="font-semibold text-blue-700 mt-0.5 font-mono">
                    {data.variableSymbol || '-'}
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Soupis provedených činností a nákladů
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs min-w-[550px]">
                    <thead className="bg-slate-900 text-white font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Položka / Činnost</th>
                        <th className="py-2.5 px-3 text-right">Počet</th>
                        <th className="py-2.5 px-3">MJ</th>
                        <th className="py-2.5 px-3 text-right">Sazba</th>
                        <th className="py-2.5 px-3 text-right">Částka celkem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                            Žádné zaúčtované položky v tomto měsíci.
                          </td>
                        </tr>
                      ) : (
                        data.items.map((item, idx) => {
                          const isNegative = item.amount < 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {item.description}
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                {item.quantity}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {item.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {item.unitPrice.toLocaleString('cs-CZ')} Kč
                              </td>
                              <td className={`py-2 px-3 text-right font-mono font-bold ${isNegative ? 'text-red-600' : 'text-slate-900'}`}>
                                {isNegative ? '' : '+'}{item.amount.toLocaleString('cs-CZ')} Kč
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Recap & Final Payable */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                <div className="space-y-1.5 text-xs text-slate-600 rounded-xl bg-slate-50 p-4 border border-slate-200 md:col-span-5 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-2">
                      Rekapitulace složek vyúčtování
                    </div>
                    <div className="flex justify-between">
                      <span>Odměna za práci (hodiny & úkoly):</span>
                      <strong className="font-mono text-slate-900">{data.totalWorkAmount.toLocaleString('cs-CZ')} Kč</strong>
                    </div>
                    {data.totalReimbursements > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Náhrady výdajů (palivo, auto...):</span>
                        <strong className="font-mono">+{data.totalReimbursements.toLocaleString('cs-CZ')} Kč</strong>
                      </div>
                    )}
                    {data.totalDeductions > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Srážky / odpočty:</span>
                        <strong className="font-mono">-{data.totalDeductions.toLocaleString('cs-CZ')} Kč</strong>
                      </div>
                    )}
                    {data.totalAdvances > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Vyplacené zálohy:</span>
                        <strong className="font-mono">-{data.totalAdvances.toLocaleString('cs-CZ')} Kč</strong>
                      </div>
                    )}
                  </div>
                  {data.note && (
                    <div className="mt-3 pt-2 border-t border-slate-200 text-slate-500 italic text-[11px]">
                      {data.note}
                    </div>
                  )}
                </div>

                {/* QR Platba Card */}
                {data.qrPaymentString ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col items-center justify-between text-center shadow-2xs md:col-span-3">
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase">
                        QR PLATBA
                      </span>
                      <div className="mt-1 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(data.qrPaymentString)}`}
                          alt="QR Platba"
                          width={110}
                          height={110}
                          className="rounded-md border border-slate-100"
                        />
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1">
                      Naskenujte v bankovní aplikaci
                    </span>
                  </div>
                ) : (
                  <div className="hidden md:flex md:col-span-3 rounded-xl border border-dashed border-slate-200 p-3 items-center justify-center text-center text-slate-400 text-[11px]">
                    {data.grossAmount <= 0
                      ? 'Vyúčtování je vyrovnané (0 Kč)'
                      : 'Pro QR platbu doplňte číslo účtu nebo IBAN'}
                  </div>
                )}

                {/* Total Payout Banner */}
                <div className="rounded-xl bg-slate-900 text-white p-4.5 flex flex-col justify-between shadow-sm md:col-span-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      Celková částka k převodu
                    </div>
                    <div className="text-2xl lg:text-3xl font-black font-mono mt-1 text-emerald-400">
                      {data.grossAmount.toLocaleString('cs-CZ')} Kč
                    </div>
                    {data.supplier.isVatPayer && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        Základ: {data.netPayableAmount.toLocaleString('cs-CZ')} Kč | DPH: {data.vatAmount.toLocaleString('cs-CZ')} Kč
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>Účet:</span>
                      <strong className="text-white font-mono">{data.supplier.bankAccount || data.paymentIban || 'Neuveden'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Var. symbol:</span>
                      <strong className="text-white font-mono">{data.variableSymbol}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="pt-4 text-center text-[11px] text-slate-400 border-t border-slate-100">
                Doklad byl vygenerován systémem SeePoint OS. Slouží jako oficiální podklad měsíční uzávěrky a fakturace za období {data.periodTitle}.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
