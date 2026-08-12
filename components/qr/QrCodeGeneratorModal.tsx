'use client';

import { useState } from 'react';
import { QrCode, Printer, X, Download } from 'lucide-react';

type QrCodeGeneratorModalProps = {
  carrier: {
    id: string;
    code: string;
    name: string;
    city: string;
    type?: string | null;
    structureCode?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
};

export function QrCodeGeneratorModal({ carrier, isOpen, onClose }: QrCodeGeneratorModalProps) {
  if (!isOpen) return null;

  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/qr/${encodeURIComponent(carrier.code)}`
    : `https://seepoint.vercel.app/qr/${encodeURIComponent(carrier.code)}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}&margin=10`;

  function handlePrint() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Štítek Nosiče - SeePOINT #${carrier.code}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f8fafc;
            }
            .sticker {
              width: 320px;
              padding: 24px;
              border: 3px solid #0f172a;
              border-radius: 20px;
              background: white;
              text-align: center;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .logo {
              font-size: 18px;
              font-weight: 900;
              color: #0f172a;
              margin-bottom: 4px;
              letter-spacing: -0.5px;
            }
            .subtitle {
              font-size: 10px;
              font-weight: 700;
              color: #0284c7;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 16px;
            }
            .qr-img {
              width: 200px;
              height: 200px;
              margin: 0 auto 16px auto;
              display: block;
            }
            .code {
              font-size: 20px;
              font-weight: 900;
              color: #0f172a;
              font-family: monospace;
              background: #f1f5f9;
              padding: 6px 12px;
              border-radius: 10px;
              display: inline-block;
              margin-bottom: 8px;
            }
            .carrier-name {
              font-size: 12px;
              font-weight: 700;
              color: #475569;
              margin-bottom: 4px;
            }
            .structure {
              font-size: 11px;
              font-weight: 800;
              color: #0284c7;
            }
          </style>
        </head>
        <body>
          <div class="sticker">
            <div class="logo">SeePOINT Outdoor</div>
            <div class="subtitle">Evidenční QR Štítek</div>
            <img src="${qrImageUrl}" class="qr-img" alt="QR Kód" />
            <div class="code">#${carrier.code}</div>
            <div class="carrier-name">${carrier.city} – ${carrier.name}</div>
            ${carrier.structureCode ? `<div class="structure">Sloup VO: ${carrier.structureCode}</div>` : ''}
          </div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-sky-600" />
            <h3 className="font-bold text-slate-950">QR Štítek Nosiče</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>

        {/* Preview Sticker Card */}
        <div className="rounded-2xl border-2 border-slate-900 bg-slate-50 p-5 text-center space-y-3 shadow-inner">
          <div className="text-xs font-black text-slate-900 uppercase tracking-wide">SeePOINT Outdoor</div>
          <div className="text-[10px] font-black text-sky-700 uppercase tracking-widest">Evidenční QR Štítek</div>
          
          <img src={qrImageUrl} alt="QR Kód Nosiče" className="mx-auto h-44 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xs" />
          
          <div>
            <span className="rounded-xl bg-slate-950 px-3 py-1 font-mono text-sm font-black text-white">
              #{carrier.code}
            </span>
            <p className="mt-2 text-xs font-bold text-slate-700 leading-tight">
              {carrier.city} – {carrier.name}
            </p>
            {carrier.structureCode && (
              <p className="mt-0.5 text-xs font-black text-sky-700">
                Sloup VO: {carrier.structureCode}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
            Zavřít
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-500 shadow-md transition cursor-pointer"
          >
            <Printer size={15} /> Vytisknout štítek
          </button>
        </div>
      </div>
    </div>
  );
}
