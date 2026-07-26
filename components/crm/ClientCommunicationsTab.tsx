'use client';

import { COMMUNICATION_TYPE_LABELS, CommunicationRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientCommunicationsTab({ client }: { client: ClientProfileData }) {
  const communications = client.communications || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Záznamy Komunikace ({communications.length})</h3>
          <p className="text-xs text-slate-500">Kompletní historie telefonátů, schůzek, e-mailů a interních poznámek.</p>
        </div>
      </div>

      {communications.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-4">Zatím nebyl pořízen žádný záznam komunikace.</p>
      ) : (
        <div className="space-y-3">
          {communications.map((comm: CommunicationRecordItem) => {
            const typeObj = COMMUNICATION_TYPE_LABELS[comm.type as keyof typeof COMMUNICATION_TYPE_LABELS] || COMMUNICATION_TYPE_LABELS.PHONE_CALL;
            return (
              <div key={comm.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{typeObj.icon}</span>
                    <span className="font-bold text-slate-900 text-sm">{comm.subject}</span>
                    {comm.isInternal && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-300">
                        INTERNÍ (SKRYTO KLIENTOVI)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{new Date(comm.createdAt).toLocaleString('cs-CZ')}</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{comm.content}</p>
                {comm.result && <div className="text-xs text-emerald-700 font-medium">Výsledek: {comm.result}</div>}
                {comm.nextStep && <div className="text-xs text-sky-700 font-medium">Navazující krok: {comm.nextStep}</div>}
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t pt-2 mt-2">
                  <span>Autor: <strong>{comm.author?.name}</strong></span>
                  {comm.contact && <span>Kontakt: {comm.contact.firstName} {comm.contact.lastName}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
