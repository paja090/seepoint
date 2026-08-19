'use client';

import { ORDER_STATUS_LABELS, ClientProfileData, OfferRecordItem, CrmOrderRecordItem, CommunicationRecordItem } from '@/lib/crm/types';

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
              <p className="text-xs text-rose-700">Celkem po splatnosti: <strong>{client.metrics.totalOverdue.toLocaleString('cs-CZ')} Kč</strong></p>
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

      {/* Client Note & AI Profile Card */}
      {client.note && (
        <div className="card space-y-2 border-l-4 border-sky-500 bg-sky-50/30">
          <div className="flex items-center justify-between border-b border-sky-100 pb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>📝</span> Poznámky klienta & AI Profil pro obchodníka
            </h3>
            <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
              ULOŽENO V DATABÁZI
            </span>
          </div>
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
            {client.note}
          </p>
        </div>
      )}

      {/* Grid Overview Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Open Offers & Deals */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span>📄</span> Otevřené Nabídky ({openOffers.length})
            </h3>
            <a href={`/offers/new?clientId=${client.id}`} className="text-xs text-sky-600 hover:underline font-semibold">+ Nová nabídka</a>
          </div>
          {openOffers.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-3">Žádné otevřené nabídky.</p>
          ) : (
            <div className="space-y-2">
              {openOffers.slice(0, 4).map((offer: OfferRecordItem) => (
                <div key={offer.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between transition">
                  <div>
                    <a href={`/offers/${offer.id}`} className="font-bold text-sm text-slate-900 hover:underline">{offer.title}</a>
                    <div className="text-xs text-slate-500 mt-0.5">Vytvořil: {offer.createdByUser?.name || 'Systém'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-sm">{offer.totalPrice ? `${Number(offer.totalPrice).toLocaleString('cs-CZ')} Kč` : 'Nekalkulováno'}</div>
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
                  <div key={order.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between transition">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{order.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{order.orderNumber} • Obchodník: {order.assignedUser?.name || 'Nepřiřazen'}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusObj.badge}`}>
                      {statusObj.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="card space-y-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
          <span>🕒</span> Časová osa komunikace a aktivit
        </h3>
        {client.communications.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3">Zatím nebyly zaznamenány žádné aktivity.</p>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {client.communications.slice(0, 6).map((comm: CommunicationRecordItem) => (
              <div key={comm.id} className="relative group">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-sky-500 border-2 border-white ring-2 ring-slate-100"></div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold text-slate-800">{comm.subject}</span>
                    <span>{new Date(comm.createdAt).toLocaleString('cs-CZ')}</span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{comm.content}</p>
                  <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                    <span>Autor: <strong>{comm.author?.name}</strong></span>
                    {comm.contact && <span>Kontakt: {comm.contact.firstName} {comm.contact.lastName}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
