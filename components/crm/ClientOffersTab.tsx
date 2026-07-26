'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableHead, TableHeaderCell, TableCell, EmptyState, Button } from '@/components/ui';
import { OfferRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientOffersTab({ client }: { client: ClientProfileData }) {
  const router = useRouter();
  const offers = client.offers || [];
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleConvert = async (offerId: string) => {
    if (!confirm('Chcete tuto schválenou nabídku bezpečně převést na obchodní Zakázku?')) return;
    setConvertingId(offerId);
    try {
      const res = await fetch('/api/crm/orders/convert-from-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      });
      if (res.ok) {
        alert('Nabídka byla úspěšně převedena na Zakázku.');
        router.refresh();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Chyba při převodu nabídky.');
      }
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Nabídky a Poptávky ({offers.length})</h3>
          <p className="text-xs text-slate-500">Přehled všech vytvořených nabídek pro klienta.</p>
        </div>
        <a href={`/offers/new?clientId=${client.id}`} className="button">
          ➕ Vytvořit nabídku
        </a>
      </div>

      {offers.length === 0 ? (
        <EmptyState title="Žádné nabídky" description="Pro tohoto klienta zatím nebyla vystavena žádná nabídka." />
      ) : (
        <Table minWidth="min-w-[800px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Název nabídky</TableHeaderCell>
              <TableHeaderCell>Stav</TableHeaderCell>
              <TableHeaderCell>Platnost do</TableHeaderCell>
              <TableHeaderCell>Celková cena</TableHeaderCell>
              <TableHeaderCell>Vytvořil</TableHeaderCell>
              <TableHeaderCell>Akce</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {offers.map((offer: OfferRecordItem) => (
              <tr key={offer.id} className="hover:bg-slate-50/70">
                <TableCell>
                  <a href={`/offers/${offer.id}`} className="font-bold text-slate-900 hover:underline">{offer.title}</a>
                  {offer.campaignName && <div className="text-xs text-slate-500">{offer.campaignName}</div>}
                </TableCell>
                <TableCell>
                  <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 border border-slate-300">
                    {offer.status}
                  </span>
                </TableCell>
                <TableCell>{offer.validUntil ? new Date(offer.validUntil).toLocaleDateString('cs-CZ') : '-'}</TableCell>
                <TableCell className="font-bold">{offer.totalPrice ? `${Number(offer.totalPrice).toLocaleString('cs-CZ')} Kč` : '-'}</TableCell>
                <TableCell>{offer.createdByUser?.name || 'Systém'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <a href={`/offers/${offer.id}`} className="table-action">Zobrazit</a>
                    {(offer.status === 'APPROVED' || offer.status === 'ACCEPTED' || offer.status === 'SENT') && (
                      <Button
                        size="sm"
                        onClick={() => handleConvert(offer.id)}
                        disabled={convertingId === offer.id}
                        className="!py-1 !px-2.5 !text-xs !bg-emerald-600 hover:!bg-emerald-700"
                      >
                        {convertingId === offer.id ? 'Převádím...' : '🛒 Převést na Zakázku'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
