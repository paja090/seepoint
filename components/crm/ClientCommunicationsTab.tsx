'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { COMMUNICATION_TYPE_LABELS, CommunicationRecordItem, ClientProfileData } from '@/lib/crm/types';
import { BrandedEmailComposerModal } from '@/components/email/BrandedEmailComposerModal';

export function ClientCommunicationsTab({ client }: { client: ClientProfileData }) {
  const router = useRouter();
  const communications = client.communications || [];

  const defaultRecipient =
    client.contacts?.find((c) => c.isPrimary && c.email)?.email ||
    client.contacts?.find((c) => c.email)?.email ||
    '';

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipient);
  const [subject, setSubject] = useState('');
  const [greeting, setGreeting] = useState('Dobrý den,');
  const [message, setMessage] = useState('');
  const [closingNote, setClosingNote] = useState('V případě dotazů jsme vám plně k dispozici.\n\nS pozdravem,\nSeePOINT tým');
  const [isSending, setIsSending] = useState(false);

  async function handleSendEmail() {
    setIsSending(true);
    try {
      const fullMessage = `${greeting}\n\n${message.trim()}\n\n${closingNote}`;
      const res = await fetch(`/api/crm/clients/${client.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail.trim(),
          subject: subject.trim(),
          message: fullMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Odeslání e-mailu selhalo.');
      }

      setShowEmailModal(false);
      setSubject('');
      setMessage('');
      router.refresh();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Záznamy Komunikace ({communications.length})</h3>
          <p className="text-xs text-slate-500">Kompletní historie telefonátů, schůzek, e-mailů a interních poznámek.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowEmailModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
        >
          <Mail size={14} />
          <span>Napsat e-mail klientovi</span>
        </button>
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

      {showEmailModal && (
        <BrandedEmailComposerModal
          open={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          title={`Nový e-mail pro: ${client.name}`}
          subtitle="Zpráva bude odeslána ze systému SeePOINT a automaticky zaevidována v CRM kartě klienta."
          recipientEmail={recipientEmail}
          onRecipientEmailChange={setRecipientEmail}
          canEditRecipient={true}
          subject={subject}
          onSubjectChange={setSubject}
          greeting={greeting}
          onGreetingChange={setGreeting}
          message={message}
          onMessageChange={setMessage}
          closingNote={closingNote}
          onClosingNoteChange={setClosingNote}
          badgeLabel="CRM Klient"
          submitLabel="Odeslat e-mail klientovi"
          sendingLabel="Odesílám e-mail…"
          busy={isSending}
          onSubmit={handleSendEmail}
        />
      )}
    </div>
  );
}
