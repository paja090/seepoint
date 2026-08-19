'use client';

import { ORDER_STATUS_LABELS, ClientProfileData, OfferRecordItem, CrmOrderRecordItem } from '@/lib/crm/types';
import { Sparkles, Building2, Lightbulb, Target, Store, FileText, CheckCircle2, MessageSquare } from 'lucide-react';

function FormattedClientNote({ note }: { note: string }) {
  if (!note) return null;

  // Check if note contains AI structured section markers
  const isAiStructured = note.includes('🤖 AI PROFIL & STRATEGIE') || note.includes('💡 TIPY PRO OBCHODNÍKA') || note.includes('🎯 DOPORUČENÁ REKLAMNÍ STRATEGIE');

  if (!isAiStructured) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <MessageSquare size={16} className="text-slate-500" />
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Poznámka ke klientovi</h4>
        </div>
        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{note}</p>
      </div>
    );
  }

  // Parse lines into logical blocks
  const lines = note.split('\n').map((l) => l.trim()).filter(Boolean);

  const profileLines: string[] = [];
  const branchLines: string[] = [];
  const tipLines: string[] = [];
  const strategyLines: string[] = [];
  const manualNoteLines: string[] = [];

  let currentSection: 'profile' | 'branches' | 'tips' | 'strategy' | 'manual' = 'manual';

  for (const line of lines) {
    if (line.includes('🤖 AI PROFIL & STRATEGIE')) {
      currentSection = 'profile';
      continue;
    }
    if (line.includes('🏬 POBOČKY A PRODEJNY')) {
      currentSection = 'branches';
      continue;
    }
    if (line.includes('💡 TIPY PRO OBCHODNÍKA')) {
      currentSection = 'tips';
      continue;
    }
    if (line.includes('🎯 DOPORUČENÁ REKLAMNÍ STRATEGIE')) {
      currentSection = 'strategy';
      continue;
    }

    if (currentSection === 'profile') profileLines.push(line);
    else if (currentSection === 'branches') branchLines.push(line);
    else if (currentSection === 'tips') tipLines.push(line);
    else if (currentSection === 'strategy') strategyLines.push(line);
    else manualNoteLines.push(line);
  }

  return (
    <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50/60 via-indigo-50/30 to-white p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sky-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">AI Profil Klienta & Obchodní Strategie</h3>
            <p className="text-[11px] text-slate-500">Dohledaná data, pobočková síť v MS kraji a doporučené nosiče SeePoint</p>
          </div>
        </div>
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-black text-sky-800 uppercase tracking-wider">
          ULOŽENO V CRM
        </span>
      </div>

      {/* Manual Notes (if any) */}
      {manualNoteLines.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Poznámka obchodníka</div>
          <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap">{manualNoteLines.join('\n')}</p>
        </div>
      )}

      {/* Grid: Profile & Sales Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile Card */}
        {profileLines.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2">
                <Building2 size={16} className="text-sky-600" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider">Profil & Zaměření firmy</h4>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                {profileLines.map((line, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {line.startsWith('•') ? line : `• ${line}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Sales Tips Card */}
        {tipLines.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-amber-950 border-b border-amber-200/80 pb-2">
              <Lightbulb size={16} className="text-amber-600" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider">Tipy pro obchodníka (MS kraj)</h4>
            </div>
            <ul className="space-y-1.5 text-xs text-amber-950 font-medium">
              {tipLines.map((line, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{line.replace(/^-\s*/, '').replace(/^•\s*/, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Branches Section */}
      {branchLines.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2">
            <Store size={16} className="text-amber-600" />
            <h4 className="font-extrabold text-xs uppercase tracking-wider">
              Pobočky & prodejny v Moravskoslezském kraji ({branchLines.length})
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-800">
            {branchLines.map((line, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0"></span>
                <span>{line.replace(/^-\s*/, '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Strategy Section */}
      {strategyLines.length > 0 && (
        <div className="rounded-2xl border border-sky-800 bg-sky-900 text-white p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-sky-800 pb-2">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-sky-300" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-white">
                Doporučená reklamní strategie SeePoint (Ostrava & MS Kraj)
              </h4>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            {strategyLines.map((line, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-sky-950/70 border border-sky-800 leading-relaxed font-medium">
                {line.replace(/^-\s*/, '')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientOverviewTab({ client }: { client: ClientProfileData }) {
  const openOffers = client.offers.filter((o: OfferRecordItem) => o.status !== 'REJECTED' && o.status !== 'EXPIRED');
  const activeOrders = client.crmOrders.filter((o: CrmOrderRecordItem) => o.status !== 'CANCELLED' && o.status !== 'COMPLETED');

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {client.metrics.overdueInvoicesCount > 0 && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="font-bold text-rose-900 text-sm">Pozor: Klient má neuhrazené faktury po splatnosti!</h4>
              <p className="text-xs text-rose-700">
                Celkem po splatnosti: <strong>{client.metrics.totalOverdue.toLocaleString('cs-CZ')} Kč</strong>
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg border border-rose-300">
            {client.metrics.overdueInvoicesCount} faktur
          </span>
        </div>
      )}

      {client.metrics.expiringContractsCount > 0 && (
        <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📜</span>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">Upozornění: Smlouva před koncem platnosti</h4>
              <p className="text-xs text-amber-700">Klient má {client.metrics.expiringContractsCount} smluv končících v nejbližších 30–90 dnech.</p>
            </div>
          </div>
        </div>
      )}

      {/* Styled Structured AI Notes & Strategy Card */}
      {client.note && <FormattedClientNote note={client.note} />}

      {/* Grid Overview Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Open Offers & Deals */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span>📄</span> Otevřené Nabídky ({openOffers.length})
            </h3>
            <a href={`/offers/new?clientId=${client.id}`} className="text-xs text-sky-600 hover:underline font-semibold">
              + Nová nabídka
            </a>
          </div>
          {openOffers.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-3">Žádné otevřené nabídky.</p>
          ) : (
            <div className="space-y-2">
              {openOffers.slice(0, 4).map((offer: OfferRecordItem) => (
                <div
                  key={offer.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between transition"
                >
                  <div>
                    <a href={`/offers/${offer.id}`} className="font-bold text-sm text-slate-900 hover:underline">
                      {offer.title}
                    </a>
                    <div className="text-xs text-slate-500 mt-0.5">Vytvořil: {offer.createdByUser?.name || 'Systém'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-sm">
                      {offer.totalPrice ? `${Number(offer.totalPrice).toLocaleString('cs-CZ')} Kč` : 'Nekalkulováno'}
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-slate-600">{offer.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Orders */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span>🛒</span> Zakázky v realizaci ({activeOrders.length})
            </h3>
          </div>
          {activeOrders.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-3">Žádné aktivní zakázky.</p>
          ) : (
            <div className="space-y-2">
              {activeOrders.slice(0, 4).map((order: CrmOrderRecordItem) => {
                const statusObj = ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || ORDER_STATUS_LABELS.DRAFT;
                return (
                  <div
                    key={order.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between transition"
                  >
                    <div>
                      <a href={`/navigation/orders/${order.id}`} className="font-bold text-sm text-slate-900 hover:underline">
                        {order.title || order.orderNumber}
                      </a>
                      <div className="text-xs text-slate-500 mt-0.5">Číslo: {order.orderNumber}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusObj.badge}`}>
                      {statusObj.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
