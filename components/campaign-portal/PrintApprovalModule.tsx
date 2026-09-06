'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileImage, Printer, Clock, AlertCircle } from 'lucide-react';
import { approvePrintJobByClient } from '@/app/production/public-actions';

export function PrintApprovalModule({ 
  printJob, 
  token,
  clientName
}: { 
  printJob: any; 
  token?: string;
  clientName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [artworkUrl, setArtworkUrl] = useState('');
  const [approverName, setApproverName] = useState('');
  const [note, setNote] = useState('');
  
  if (!printJob) return null;

  // Akce pro odeslani do tisku
  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !printJob.clientApprovalToken) return;
    
    startTransition(async () => {
      try {
        await approvePrintJobByClient(
          printJob.clientApprovalToken,
          approverName,
          note,
          artworkUrl
        );
        router.refresh(); // Obnovit UI
      } catch (err) {
        alert('Něco se pokazilo při odesílání.');
      }
    });
  };

  // State 1: Čeká na data (PREPARATION nebo CLIENT_APPROVAL)
  if (printJob.status === 'PREPARATION' || printJob.status === 'CLIENT_APPROVAL') {
    return (
      <div className="card bg-white border-2 border-purple-500/50 rounded-3xl overflow-hidden shadow-xl mb-8">
        <div className="bg-purple-50 border-b border-purple-100 p-6 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold tracking-wide uppercase mb-3">
              Čeká na schválení a tisková data
            </span>
            <h2 className="text-2xl font-bold text-gray-900">Tisk kampaně: Chybí tisková data</h2>
            <p className="text-gray-500 mt-1">Prosím nahrajte data pro tisk, abychom mohli kampaň včas vylepit.</p>
          </div>
        </div>
        
        <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <div className="w-full p-6 bg-gray-50 rounded-xl flex flex-col border-2 border-dashed border-gray-300 text-gray-500">
               <div className="flex justify-center mb-4"><FileImage className="w-12 h-12 text-gray-300" /></div>
               <h4 className="font-medium text-center text-gray-700 mb-2">Nahrajte tisková data</h4>
               <p className="text-sm text-center mb-4">Vložte odkaz na cloudové úložiště (WeTransfer, Google Drive) s grafikou.</p>
               <input
                 type="url"
                 required
                 placeholder="https://we.tl/..."
                 value={artworkUrl}
                 onChange={(e) => setArtworkUrl(e.target.value)}
                 className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
               />
            </div>
          </div>
          
          <div className="flex-1">
            <form onSubmit={handleApprove} className="space-y-4">
               <div>
                 <label htmlFor="approverName" className="block text-sm font-medium text-gray-700 mb-1">
                   Vaše jméno (schvalovatel) *
                 </label>
                 <input
                   type="text"
                   required
                   placeholder="Jan Novák"
                   value={approverName}
                   onChange={(e) => setApproverName(e.target.value)}
                   className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                 />
               </div>
               
               <div>
                 <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
                   Poznámka ke grafice (volitelné)
                 </label>
                 <textarea
                   rows={2}
                   placeholder="Např. prosím o doručení do..."
                   value={note}
                   onChange={(e) => setNote(e.target.value)}
                   className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                 />
               </div>

               <button
                 type="submit"
                 disabled={!approverName.trim() || !artworkUrl.trim() || isPending}
                 className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
               >
                 {isPending ? 'Odesílám...' : 'Schvaluji data do tisku'}
               </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // State 2: V tisku (IN_PRINT)
  if (printJob.status === 'IN_PRINT') {
    return (
      <div className="card bg-blue-50 border border-blue-200 rounded-3xl p-6 sm:p-8 flex items-center gap-4 mb-8 shadow-sm">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
          <Printer className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-blue-900">Tisková data schválena, kampaň se tiskne</h3>
          <p className="text-sm text-blue-700 mt-1">Data jste schválili {printJob.clientApprovedAt ? new Date(printJob.clientApprovedAt).toLocaleDateString('cs-CZ') : 'nedávno'}. Brzy zahájíme instalaci.</p>
        </div>
      </div>
    );
  }

  // State 3: Hotovo / Nainstalováno (Žádný velký banner, nebo jen jemný)
  return null;
}
