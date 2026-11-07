'use client';

import { useMemo, useState } from 'react';
import {
  B2B_EMAIL_TEMPLATES,
  renderB2bOutreachEmailHtml,
  type B2bEmailTemplateId,
} from '@/lib/b2b-email-templates';

export interface DemoLeadRow {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string | null;
  surfaceCount: string | null;
  source: string;
  createdAtIso: string;
  createdAtFormatted: string;
}

const TEMPLATE_LIST = Object.values(B2B_EMAIL_TEMPLATES);

export function AdminOutreachEmailStudio({ leads }: { leads: DemoLeadRow[] }) {
  const [templateId, setTemplateId] = useState<B2bEmailTemplateId>('NAVIGATION_VO');
  const [toEmail, setToEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [subject, setSubject] = useState(() => B2B_EMAIL_TEMPLATES.NAVIGATION_VO.defaultSubject(''));
  const [message, setMessage] = useState(() =>
    B2B_EMAIL_TEMPLATES.NAVIGATION_VO.defaultMessage({ contactName: '', companyName: '' })
  );
  const [ctaLabel, setCtaLabel] = useState(B2B_EMAIL_TEMPLATES.NAVIGATION_VO.ctaLabel);
  const [ctaUrl, setCtaUrl] = useState(B2B_EMAIL_TEMPLATES.NAVIGATION_VO.ctaUrl);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const activeTemplate = B2B_EMAIL_TEMPLATES[templateId];

  function applyTemplate(nextTemplateId: B2bEmailTemplateId, nextName = contactName, nextCompany = companyName) {
    const def = B2B_EMAIL_TEMPLATES[nextTemplateId];
    setTemplateId(nextTemplateId);
    setSubject(def.defaultSubject(nextCompany));
    setMessage(def.defaultMessage({ contactName: nextName, companyName: nextCompany }));
    setCtaLabel(def.ctaLabel);
    setCtaUrl(def.ctaUrl);
    setFeedback(null);
  }

  function handleRecipientDetailsChange(nextName: string, nextCompany: string) {
    setContactName(nextName);
    setCompanyName(nextCompany);
    const def = B2B_EMAIL_TEMPLATES[templateId];
    setSubject(def.defaultSubject(nextCompany));
    setMessage(def.defaultMessage({ contactName: nextName, companyName: nextCompany }));
  }

  function selectLeadForReply(lead: DemoLeadRow) {
    setToEmail(lead.email);
    setContactName(lead.name);
    setCompanyName(lead.company);
    applyTemplate('DEMO_FOLLOWUP', lead.name, lead.company);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const previewHtml = useMemo(
    () =>
      renderB2bOutreachEmailHtml({
        segmentBadge: activeTemplate.segmentBadge,
        subject,
        message,
        highlights: activeTemplate.highlights,
        ctaLabel,
        ctaUrl,
      }),
    [activeTemplate, subject, message, ctaLabel, ctaUrl]
  );

  async function handleSend() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/admin/leads/send-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject,
          message,
          templateId,
          ctaLabel,
          ctaUrl,
        }),
      });
      const result = (await response.json()) as { error?: string; message?: string; warning?: string };
      if (!response.ok) {
        throw new Error(result.error || 'Odeslání e-mailu selhalo.');
      }
      setFeedback({
        ok: true,
        text: result.warning || result.message || 'E-mail byl úspěšně odeslán.',
      });
    } catch (error) {
      setFeedback({
        ok: false,
        text: error instanceof Error ? error.message : 'Odeslání e-mailu selhalo.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Studio Card */}
      <div className="card space-y-6 border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="rounded-full bg-purple-100 px-3 py-0.5 text-xs font-black text-purple-800">
              B2B E-mail Studio
            </span>
            <h2 className="mt-1.5 text-xl font-bold text-slate-900">
              Profesionální HTML šablony pro oslovení firem a zájemců o demo
            </h2>
            <p className="text-xs text-slate-500">
              Vyberte obor firmy, doplňte jméno a odešlete značkový HTML e-mail s Vaší vizitkou přímo ze systému.
            </p>
          </div>
        </div>

        {/* Template selector pills */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATE_LIST.map((tpl) => {
            const active = tpl.id === templateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl.id)}
                className={`rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-purple-700">
                  {tpl.segmentBadge}
                </span>
                <strong className="mt-1 block text-xs font-bold text-slate-900">{tpl.label}</strong>
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column: Editor */}
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-slate-700">
                E-mail příjemce *
                <input
                  type="email"
                  className="input mt-1 text-sm"
                  placeholder="reditel@agentura.cz"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                />
              </label>
              <label className="text-xs font-bold text-slate-700">
                Oslovení / Jméno
                <input
                  type="text"
                  className="input mt-1 text-sm"
                  placeholder="např. pane Nováku"
                  value={contactName}
                  onChange={(e) => handleRecipientDetailsChange(e.target.value, companyName)}
                />
              </label>
              <label className="text-xs font-bold text-slate-700">
                Název firmy
                <input
                  type="text"
                  className="input mt-1 text-sm"
                  placeholder="např. Morava Media s.r.o."
                  value={companyName}
                  onChange={(e) => handleRecipientDetailsChange(contactName, e.target.value)}
                />
              </label>
            </div>

            <label className="block text-xs font-bold text-slate-700">
              Předmět e-mailu *
              <input
                type="text"
                className="input mt-1 text-sm font-semibold"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Text zprávy (odstavce oddělujte prázdným řádkem) *
              <textarea
                rows={9}
                className="input mt-1 text-sm leading-relaxed"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700">
                Text tlačítka (CTA)
                <input
                  type="text"
                  className="input mt-1 text-sm"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                />
              </label>
              <label className="text-xs font-bold text-slate-700">
                Odkaz tlačítka (URL)
                <input
                  type="url"
                  className="input mt-1 text-sm"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={busy || !toEmail.trim()}
                onClick={handleSend}
                className="btn-primary"
              >
                {busy ? 'Odesílám e-mail…' : 'Odeslat profesionální HTML e-mail'}
              </button>
              {feedback ? (
                <p
                  aria-live="polite"
                  className={`text-xs font-bold ${feedback.ok ? 'text-emerald-700' : 'text-rose-700'}`}
                >
                  {feedback.text}
                </p>
              ) : null}
            </div>
          </div>

          {/* Right column: Live HTML Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Živý náhled HTML šablony (jak e-mail uvidí příjemce)</span>
              <span className="text-[11px] text-slate-400">Vizitka: Pavel Šubert · +420 777 807 717</span>
            </div>
            <div
              className="max-h-[600px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-inner"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </div>

      {/* Demo Leads Table */}
      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Přijaté poptávky dema z webu</h2>
            <p className="text-xs text-slate-500">
              Kliknutím na „Odpovědět šablonou“ předvyplníte e-mail zájemce nahoře v editoru.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {leads.length} poptávek
          </span>
        </div>

        {leads.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Zatím nepřišla žádná poptávka z webu.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3">Přijato</th>
                <th className="p-3">Firma</th>
                <th className="p-3">Kontakt</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Počet ploch</th>
                <th className="p-3 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr className="border-b last:border-0" key={lead.id}>
                  <td className="whitespace-nowrap p-3 text-slate-600">{lead.createdAtFormatted}</td>
                  <td className="p-3 font-semibold text-slate-900">{lead.company}</td>
                  <td className="p-3">
                    <span className="block">{lead.name}</span>
                    <a className="text-xs text-sky-700 hover:underline" href={`mailto:${lead.email}`}>
                      {lead.email}
                    </a>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {lead.phone ? (
                      <a className="text-sky-700 hover:underline" href={`tel:${lead.phone.replace(/\s+/g, '')}`}>
                        {lead.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">{lead.surfaceCount || '—'}</td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <button
                      type="button"
                      onClick={() => selectLeadForReply(lead)}
                      className="btn-secondary text-xs"
                    >
                      Odpovědět šablonou ↑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
