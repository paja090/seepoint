'use client';

import { Printer } from 'lucide-react';

export function WarehousePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-xl bg-slate-950 px-5 py-2 text-xs font-black text-white hover:bg-slate-800 transition shadow-md"
    >
      <Printer size={14} />
      <span>Vytisknout arch</span>
    </button>
  );
}
