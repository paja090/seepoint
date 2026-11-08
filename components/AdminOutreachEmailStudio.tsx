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
  const [provisioningLeadId, setProvisioningLeadId] = useState<string | null>(null);
  const [createdOrgsByLead, setCreatedOrgsByLead] = useState<Record<string, { id: string; slug: string }>>({});
  const [leadActionError, setLeadActionError] = useState<string | null>(null);

  // Super-simple company creator with optional IČO ARES auto-fill
  const [quickIco, setQuickIco] = useState('');
  const [quickAresLoading, setQuickAresLoading] = useState(false);
  const [quickCompanyName, setQuickCompanyName] = useState('');
  const [quickOwnerEmail, setQuickOwnerEmail] = useState('');
  const [quickAresMeta, setQuickAresMeta] = useState<{
    companyId?: string;
    vatId?: string | null;
    street?: string;
    city?: string;
    postalCode?: string;
  }>({});
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickCreatedOrg, setQuickCreatedOrg] = useState<{ id: string; slug: string; message: string } | null>(null);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);

  const activeTemplate = B2B_EMAIL_TEMPLATES[templateId];

  function toSlug(value: string) {
    return (
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 36) || 'partner-firma'
    );
  }

  async function lookupQuickAres(rawIco: string) {
    const clean = rawIco.replace(/\D/g, '').slice(0, 8);
    if (clean.length !== 8) return;
    setQuickAresLoading(true);
    setQuickCreateError(null);
    try {
      const res = await fetch(`/api/client/catalog?aresIco=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.success && data.company) {
        if (data.company.companyName) {
          setQuickCompanyName(data.company.companyName);
        }
        setQuickAresMeta({
          companyId: data.company.companyId || clean,
          vatId: data.company.dic || undefined,
          street: data.company.street || undefined,
          city: data.company.city || undefined,
          postalCode: data.company.postalCode || undefined,
        });
      }
    } catch {
      // Ignore ARES error in quick lookup; user can still type name manually
    } finally {
      setQuickAresLoading(false);
    }
  }

  async function handleQuickCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setQuickCreating(true);
    setQuickCreateError(null);
    setQuickCreatedOrg(null);
    const baseSlug = toSlug(quickCompanyName);

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: quickCompanyName.trim(),
          slug: baseSlug,
          ownerEmail: quickOwnerEmail.trim(),
          companyId: quickAresMeta.companyId || (quickIco.length === 8 ? quickIco : undefined),
          vatId: quickAresMeta.vatId || undefined,
          street: quickAresMeta.street || undefined,
          city: quickAresMeta.city || undefined,
          postalCode: quickAresMeta.postalCode || undefined,
          plan: 'BUSINESS',
          enableNetwork: true,
          enableNavigation: false,
          simpleMenu: true,
        }),
      });
      const result = (await response.json()) as {
        id?: string;
        slug?: string;
        organization?: { id: string; slug: string };
        message?: string;
        error?: string;
      };
      const orgId = result.organization?.id || result.id;
      const orgSlug = result.organization?.slug || result.slug || baseSlug;
      if (!response.ok || !orgId) {
        throw new Error(result.error || 'Vytvoření účtu selhalo.');
      }
      setQuickCreatedOrg({
        id: orgId,
        slug: orgSlug,
        message: result.message || 'Účet byl založen a majiteli odešel e-mail s odkazem pro přihlášení.',
      });
      setQuickIco('');
      setQuickCompanyName('');
      setQuickOwnerEmail('');
      setQuickAresMeta({});
    } catch (err) {
      setQuickCreateError(err instanceof Error ? err.message : 'Vytvoření účtu selhalo.');
    } finally {
      setQuickCreating(false);
    }
  }

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

  async function handleProvisionPilot(lead: DemoLeadRow) {
    setProvisioningLeadId(lead.id);
    setLeadActionError(null);

    const icoMatch = lead.company.match(/IČO:\s*(\d{8})/i);
    const extractedIco = icoMatch ? icoMatch[1] : undefined;
    const cleanLeadCompanyName = lead.company.replace(/\s*\(IČO:.*$/i, '').trim() || lead.company;
    const baseSlug = toSlug(cleanLeadCompanyName);

    let aresExtra: {
      companyId?: string;
      vatId?: string;
      street?: string;
      city?: string;
      postalCode?: string;
    } = extractedIco ? { companyId: extractedIco } : {};

    if (extractedIco) {
      try {
        const aresRes = await fetch(`/api/client/catalog?aresIco=${encodeURIComponent(extractedIco)}`);
        const aresData = await aresRes.json();
        if (aresRes.ok && aresData.success && aresData.company) {
          aresExtra = {
            companyId: aresData.company.companyId || extractedIco,
            vatId: aresData.company.dic || undefined,
            street: aresData.company.street || undefined,
            city: aresData.company.city || undefined,
            postalCode: aresData.company.postalCode || undefined,
          };
        }
      } catch {
        // Proceed with extractedIco if ARES is unreachable
      }
    }

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: cleanLeadCompanyName,
          slug: baseSlug,
          ownerEmail: lead.email,
          phone: lead.phone || undefined,
          ...aresExtra,
          plan: 'BUSINESS',
          enableNetwork: true,
          enableNavigation: false,
          simpleMenu: true,
        }),
      });
      const result = (await response.json()) as {
        id?: string;
        slug?: string;
        organization?: { id: string; slug: string };
        error?: string;
      };
      const orgId = result.organization?.id || result.id;
      const orgSlug = result.organization?.slug || result.slug || baseSlug;
      if (!response.ok || !orgId) {
        throw new Error(result.error || 'Vytvoření organizace selhalo.');
      }
      setCreatedOrgsByLead((prev) => ({
        ...prev,
        [lead.id]: { id: orgId, slug: orgSlug },
      }));
    } catch (err) {
      setLeadActionError(err instanceof Error ? err.message : 'Vytvoření organizace selhalo.');
    } finally {
      setProvisioningLeadId(null);
    }
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
      {/* Super-simple company creator with ARES */}
      <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-800">
              Nejrychlejší cesta (IČO z ARES + e-mail)
            </span>
            <h2 className="mt-1.5 text-xl font-black text-slate-900">
              Rychle založit účet nové firmě (30 dní zdarma)
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Zadejte 8místné IČO (automaticky načte název, DIČ a sídlo z ARES) a e-mail majitele. Systém firmě zapne <strong>zjednodušené menu</strong>, <strong>B2B síť</strong> a pošle majiteli přihlašovací odkaz.
            </p>
          </div>
          <a
            href="/join-network"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-50"
          >
            Veřejný registrační formulář pro partnery (/join-network) ↗
          </a>
        </div>

        <form onSubmit={handleQuickCreateCompany} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-xs font-bold text-slate-700">
            1. IČO firmy (ARES)
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="např. 27082440"
              className="input mt-1 bg-white font-mono text-sm"
              value={quickIco}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                setQuickIco(digits);
                if (digits.length === 8) {
                  void lookupQuickAres(digits);
                }
              }}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            2. Název firmy * {quickAresLoading && <span className="text-emerald-600">(ARES…)</span>}
            <input
              type="text"
              required
              placeholder="např. Morava Media s.r.o."
              className="input mt-1 bg-white text-sm"
              value={quickCompanyName}
              onChange={(e) => setQuickCompanyName(e.target.value)}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            3. E-mail majitele *
            <input
              type="email"
              required
              placeholder="např. novak@moravamedia.cz"
              className="input mt-1 bg-white text-sm"
              value={quickOwnerEmail}
              onChange={(e) => setQuickOwnerEmail(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={quickCreating || !quickCompanyName.trim() || !quickOwnerEmail.trim()}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {quickCreating ? 'Zakládám účet…' : '✓ Založit účet a poslat přístup'}
            </button>
          </div>
        </form>

        {quickCreatedOrg ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-100/80 px-4 py-2.5 text-xs font-bold text-emerald-900">
            <span>✓ {quickCreatedOrg.message}</span>
            <a
              href={`/admin/organizations/${quickCreatedOrg.id}`}
              className="rounded-lg bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800"
            >
              Otevřít detail firmy ({quickCreatedOrg.slug}) →
            </a>
          </div>
        ) : null}

        {quickCreateError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">
            {quickCreateError}
          </div>
        ) : null}
      </div>

      {/* Studio Card */}
      <div className="card space-y-6 border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="rounded-full bg-purple-100 px-3 py-0.5 text-xs font-black text-purple-800">
              B2B E-mail Studio
            </span>
            <h2 className="mt-1.5 text-xl font-bold text-slate-900">
              Poslat firmě pozvánku e-mailem (před založením účtu)
            </h2>
            <p className="text-xs text-slate-500">
              Vyberte obor firmy, doplňte jméno a odešlete značkový HTML e-mail s Vaší vizitkou přímo ze systému.
            </p>
          </div>
        </div>

        {/* Template selector pills */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
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
              Kliknutím na „Založit 30denní Pilot“ vytvoříte firmě tenant (BUSINESS + B2B síť) a odešlete majiteli aktivační odkaz.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {leads.length} poptávek
          </span>
        </div>

        {leadActionError ? (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">
            {leadActionError}
          </div>
        ) : null}

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
              {leads.map((lead) => {
                const createdOrg = createdOrgsByLead[lead.id];
                const isProvisioning = provisioningLeadId === lead.id;
                return (
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
                      <div className="flex items-center justify-end gap-2">
                        {createdOrg ? (
                          <a
                            href={`/admin/organizations/${createdOrg.id}`}
                            className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
                          >
                            ✓ Pilot založen ({createdOrg.slug}) →
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled={isProvisioning}
                            onClick={() => handleProvisionPilot(lead)}
                            className="btn-primary text-xs py-1.5 px-2.5"
                          >
                            {isProvisioning ? 'Zakládám…' : 'Založit 30denní Pilot'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => selectLeadForReply(lead)}
                          className="btn-secondary text-xs py-1.5 px-2.5"
                        >
                          Odpovědět šablonou ↑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
