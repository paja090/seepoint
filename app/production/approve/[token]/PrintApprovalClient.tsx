'use client';

import { useState } from 'react';
import { approvePrintJobByClient } from '../../actions';
import { CheckCircle2, AlertCircle, FileImage, Download, Upload, Clock, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function PrintApprovalClient({ job, token }: { job: any; token: string }) {
  const [approverName, setApproverName] = useState('');
  const [note, setNote] = useState('');
  const [artworkUrl, setArtworkUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproved, setIsApproved] = useState(job.status !== 'CLIENT_APPROVAL' && job.status !== 'PREPARATION');
  const router = useRouter();

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approverName.trim()) return;
    
    // Require artwork if it was missing initially
    if (!job.artworkUrl && !artworkUrl.trim()) {
      alert('Prosím, vložte odkaz na tisková data.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (token !== 'demo-token-123') {
        await approvePrintJobByClient(token, approverName, note, artworkUrl);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setIsApproved(true);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Došlo k chybě při schvalování. Zkuste to prosím znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isApproved) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-8 text-center max-w-2xl mx-auto mt-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Tisková data schválena!</h2>
        <p className="text-lg text-gray-600 mb-8">
          Děkujeme. Data byla úspěšně schválena k tisku. Zakázka se nyní odesílá do výroby.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-left border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">Detaily výroby:</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex justify-between border-b border-gray-200 pb-2">
              <span>Materiál:</span> <span className="font-medium">{job.materialType}</span>
            </li>
            <li className="flex justify-between border-b border-gray-200 pb-2">
              <span>Formát:</span> <span className="font-medium">{job.formatType}</span>
            </li>
            <li className="flex justify-between">
              <span>Počet kusů:</span> <span className="font-medium">{job.quantity} + {job.sparesQuantity} rezerva</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header Info */}
      <div className="bg-gray-50 border-b border-gray-200 p-6 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold tracking-wide uppercase mb-3">
            Čeká na schválení
          </span>
          <h2 className="text-2xl font-bold text-gray-900">{job.title}</h2>
          <p className="text-gray-500 mt-1">{job.clientName || 'Klient'}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 mb-1">Požadované datum dodání na sklad</p>
          <p className="font-semibold text-gray-900 flex items-center gap-1.5 justify-end">
            <Clock className="w-4 h-4 text-orange-500" />
            {job.deliveryDeadline ? new Date(job.deliveryDeadline).toLocaleDateString('cs-CZ') : 'Nespecifikováno'}
          </p>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Left Side: Artwork Preview */}
        <div className="p-6 sm:p-8 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/50 flex flex-col justify-center items-center">
           {job.artworkUrl ? (
             <div className="w-full aspect-[2/1] bg-gray-200 rounded-xl overflow-hidden relative shadow-inner border border-gray-300">
               {/* Replace with actual Next.js Image component when you have valid URL */}
               <img src={job.artworkUrl} alt="Náhled grafiky" className="object-cover w-full h-full" />
             </div>
           ) : (
             <div className="w-full p-6 bg-white rounded-xl flex flex-col border-2 border-dashed border-gray-300 text-gray-500">
               <div className="flex justify-center mb-4"><FileImage className="w-12 h-12 text-gray-300" /></div>
               <h4 className="font-medium text-center text-gray-700 mb-2">Tisková data zatím chybí</h4>
               <p className="text-sm text-center mb-4">Vložte odkaz na cloudové úložiště (WeTransfer, Google Drive, Úschovna) se soubory pro tisk.</p>
               <input
                 type="url"
                 placeholder="https://we.tl/..."
                 value={artworkUrl}
                 onChange={(e) => setArtworkUrl(e.target.value)}
                 className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
               />
             </div>
           )}

           <div className="mt-6 w-full space-y-3">
             <div className="flex justify-between text-sm bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-gray-500 flex items-center gap-2"><Printer className="w-4 h-4"/> Rozměr a Formát</span>
                <span className="font-semibold text-gray-900">{job.formatType}</span>
             </div>
             <div className="flex justify-between text-sm bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-gray-500">Materiál k tisku</span>
                <span className="font-semibold text-gray-900">{job.materialType}</span>
             </div>
             <div className="flex justify-between text-sm bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-gray-500">Tiskový náklad</span>
                <span className="font-semibold text-gray-900">{job.quantity} ks <span className="text-gray-400 font-normal"> (+ {job.sparesQuantity} rezerva)</span></span>
             </div>
           </div>
        </div>

        {/* Right Side: Approval Form */}
        <div className="p-6 sm:p-8">
           <div className="mb-6">
             <h3 className="text-lg font-bold text-gray-900 mb-2">Schvalovací doložka</h3>
             <p className="text-sm text-gray-600">
               Potvrzuji, že jsem zkontroloval/a výše uvedené tiskové podklady a souhlasím s jejich využitím pro tisk v požadovaném množství a specifikaci.
             </p>
           </div>

           <form onSubmit={handleApprove} className="space-y-5">
             <div>
               <label htmlFor="approverName" className="block text-sm font-medium text-gray-700 mb-1">
                 Jméno a příjmení schvalovatele *
               </label>
               <input
                 type="text"
                 id="approverName"
                 required
                 placeholder="Jan Novák"
                 value={approverName}
                 onChange={(e) => setApproverName(e.target.value)}
                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
               />
             </div>

             <div>
               <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
                 Poznámka pro tiskárnu / grafika (volitelné)
               </label>
               <textarea
                 id="note"
                 rows={3}
                 placeholder="Např. prosím o doručení do 10:00"
                 value={note}
                 onChange={(e) => setNote(e.target.value)}
                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm resize-none"
               />
             </div>

             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3 mt-6">
               <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
               <p className="text-xs text-blue-800">
                 Po kliknutí na tlačítko níže bude zakázka uzamčena a odeslána do tiskárny. Další úpravy grafiky již nebudou možné.
               </p>
             </div>

             <button
               type="submit"
               disabled={!approverName.trim() || isSubmitting}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
             >
               {isSubmitting ? (
                 <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               ) : (
                 <>
                   <CheckCircle2 className="w-5 h-5" />
                   Schvaluji data do tisku
                 </>
               )}
             </button>
           </form>
        </div>
      </div>
    </div>
  );
}
