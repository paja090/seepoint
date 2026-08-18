import Link from 'next/link';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { Printer, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function WarehousePrintQrPage() {
  await ensureWarehouseSchema();

  const items = await prisma.warehouseItem.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return (
    <div className="min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
      {/* Header Bar - Hidden during printing */}
      <div className="mb-6 flex items-center justify-between border-b border-slate-300 pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900">🖨️ Tisk QR Štítků na regály skladu</h1>
          <p className="text-xs text-slate-600">Vytiskněte si arch štítků a nalepte je na regály nebo nářadí v dílně.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/warehouse"
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <ArrowLeft size={14} />
            <span>Zpět do skladu</span>
          </Link>

          {/* Trigger browser print dialog */}
          <button
            onClick={undefined}
            className="flex items-center gap-1.5 rounded-xl bg-slate-950 px-5 py-2 text-xs font-black text-white hover:bg-slate-800 transition shadow-md"
          >
            <Printer size={14} />
            <span>Vytisknout arch (Ctrl+P)</span>
          </button>
        </div>
      </div>

      {/* Grid of Printable Labels */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-3 print:gap-2">
        {items.map((item) => {
          // Generate quick QR image URL via quickchart / Google API chart
          const qrData = encodeURIComponent(`SEEPOINT_WH:${item.id}:${item.name}`);
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

          return (
            <div
              key={item.id}
              className="rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-2xs flex flex-col justify-between items-center text-center print:border print:border-slate-800 print:rounded-lg print:p-2 print:break-inside-avoid"
            >
              <div className="w-full text-left border-b border-slate-200 pb-1 mb-2 flex justify-between items-center">
                <span className="font-mono text-[9px] font-black uppercase text-slate-500">
                  {item.code || 'SEEPOINT-SKLAD'}
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                  {item.category === 'CONSUMABLE' ? '📦 Spotřební' : '🔨 Vratné'}
                </span>
              </div>

              {/* QR Image */}
              <img
                src={qrUrl}
                alt={item.name}
                className="h-28 w-28 object-contain my-1 print:h-24 print:w-24"
              />

              <h3 className="text-xs font-black text-slate-900 leading-tight mt-1 line-clamp-2">
                {item.name}
              </h3>

              <div className="mt-2 w-full pt-1.5 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-600">
                <span>{item.location || 'Dílna / Regál'}</span>
                <span>{item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
