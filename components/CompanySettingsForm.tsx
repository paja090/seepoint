'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2, CheckCircle2 } from 'lucide-react';

type Company = Record<string, string | number | null>;

const contactAndBillingFields = [
  ['name', 'Název firmy *'],
  ['phone', 'Telefon (zobrazí se v nabídkách)'],
  ['email', 'Firemní e-mail (zobrazí se v nabídkách)'],
  ['website', 'Webové stránky (např. mojefirma.cz)'],
  ['companyId', 'IČO'],
  ['vatId', 'DIČ'],
  ['street', 'Ulice a č.p.'],
  ['city', 'Město'],
  ['postalCode', 'PSČ'],
  ['country', 'Země (CZ / SK)'],
  ['bankAccount', 'Bankovní účet'],
  ['iban', 'IBAN'],
  ['swift', 'SWIFT'],
  ['defaultCurrency', 'Výchozí měna (CZK / EUR)'],
] as const;

async function fileToOptimizedDataUri(file: File): Promise<string> {
  if (file.type === 'image/svg+xml' || file.size <= 250 * 1024) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Soubor se nepodařilo načíst.'));
      reader.readAsDataURL(file);
    });
  }

  // For larger PNG/JPG/WebP images, resize to max 640x240 in canvas preserving transparency
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Soubor se nepodařilo načíst.'));
    reader.readAsDataURL(file);
  });

  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 640;
      const maxH = 240;
      let { width, height } = img;
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function CompanySettingsForm({ organization }: { organization: Company }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [logoUrl, setLogoUrl] = useState<string>(String(organization.logoUrl ?? ''));
  const [primaryColor, setPrimaryColor] = useState<string>(String(organization.primaryColor || '#2563eb'));
  const [secondaryColor, setSecondaryColor] = useState<string>(String(organization.secondaryColor || '#0f172a'));
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [aresIcoInput, setAresIcoInput] = useState<string>(String(organization.companyId ?? ''));
  const [aresLoading, setAresLoading] = useState(false);
  const [aresStatus, setAresStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleAresLookup(icoOverride?: string) {
    const cleanIco = (icoOverride ?? aresIcoInput).replace(/\s+/g, '').trim();
    if (!/^\d{8}$/.test(cleanIco)) {
      setAresStatus({ ok: false, text: 'Zadejte platné 8místné IČO pro načtení z ARES.' });
      return;
    }
    setAresLoading(true);
    setAresStatus(null);
    try {
      const res = await fetch(`/api/client/catalog?aresIco=${encodeURIComponent(cleanIco)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        company?: {
          companyId?: string;
          dic?: string;
          companyName?: string;
          city?: string;
          street?: string;
          postalCode?: string;
          address?: string;
        };
      };
      if (res.ok && data.ok && data.company && formRef.current) {
        const c = data.company;
        const setField = (fieldName: string, value?: string) => {
          if (!value || !formRef.current) return;
          const el = formRef.current.elements.namedItem(fieldName) as HTMLInputElement | null;
          if (el) el.value = value;
        };
        setField('companyId', c.companyId || cleanIco);
        setField('name', c.companyName);
        setField('vatId', c.dic);
        setField('street', c.street || c.address);
        setField('city', c.city);
        setField('postalCode', c.postalCode);
        setField('country', 'CZ');
        setAresIcoInput(c.companyId || cleanIco);
        setAresStatus({
          ok: true,
          text: `✓ Načteno z ARES: ${c.companyName || cleanIco}. Zkontrolujte údaje a klikněte dole na Uložit firemní údaje.`,
        });
      } else {
        setAresStatus({ ok: false, text: data.error || 'Subjekt v ARES nebyl nalezen.' });
      }
    } catch {
      setAresStatus({ ok: false, text: 'Nepodařilo se spojit s registrem ARES.' });
    } finally {
      setAresLoading(false);
    }
  }

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ text: 'Vyberte prosím obrázek ve formátu PNG, JPG, SVG nebo WebP.', ok: false });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ text: 'Soubor je příliš velký (maximum je 10 MB).', ok: false });
      return;
    }

    setUploadingLogo(true);
    setFeedback(null);
    try {
      const optimizedDataUri = await fileToOptimizedDataUri(file);
      setLogoUrl(optimizedDataUri);

      // Rovnou uložit logo na server, aby uživatel nemusel ještě hledat tlačítko Uložit dole
      const response = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logoUrl: optimizedDataUri }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || 'Logo se nepodařilo uložit.');
      }
      setFeedback({ text: '✓ Firemní logo bylo nahráno a uloženo.', ok: true });
      router.refresh();
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Logo se nepodařilo nahrát.',
        ok: false,
      });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    setLogoUrl('');
    setFeedback(null);
    try {
      const response = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logoUrl: '' }),
      });
      if (response.ok) {
        setFeedback({ text: 'Logo bylo odstraněno.', ok: true });
        router.refresh();
      }
    } catch {
      // ignore
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    data.logoUrl = logoUrl;
    data.primaryColor = primaryColor;
    data.secondaryColor = secondaryColor;

    try {
      const response = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as { error?: string };
      setFeedback({
        text: response.ok ? '✓ Firemní údaje a logo byly uloženy.' : result.error || 'Uložení se nezdařilo.',
        ok: response.ok,
      });
      if (response.ok) {
        router.refresh();
      }
    } catch {
      setFeedback({ text: 'Spojení se serverem selhalo. Zkontrolujte připojení a zkuste to znovu.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="card space-y-6 p-6" onSubmit={submit}>
      {/* 1. Firemní logo a barvy */}
      <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-800">
              1. Krok – Vzhled nabídek
            </span>
            <h2 className="mt-1 text-lg font-black text-slate-950">Firemní logo a barvy značky</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Logo se automaticky propíše do horní lišty systému, na všechny klientské webové nabídky i do PDF prezentací.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5">
          {/* Náhled loga */}
          <div className="flex h-24 w-48 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3 shadow-inner">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Firemní logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-center text-xs font-semibold text-slate-400">
                Zatím bez loga
              </span>
            )}
          </div>

          {/* Tlačítka pro nahrání */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              className="hidden"
              onChange={handleLogoFileChange}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <ImagePlus size={16} />
                <span>{uploadingLogo ? 'Nahrávám logo…' : 'Nahrát logo z počítače (PNG, JPG, SVG)'}</span>
              </button>

              {logoUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                  <span>Smazat logo</span>
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500">
              Doporučujeme PNG nebo SVG s průhledným pozadím (max. 10 MB). Po výběru souboru se logo rovnou uloží.
            </p>
          </div>
        </div>

        {/* Barvy značky */}
        <div className="mt-5 grid gap-4 border-t border-slate-200/80 pt-4 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700">
            <span>Primární barva firmy (tlačítka a akcenty)</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : '#2563eb'}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-slate-300"
              />
              <span className="font-mono text-xs text-slate-500">{primaryColor}</span>
            </div>
          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700">
            <span>Sekundární barva firmy</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(secondaryColor) ? secondaryColor : '#0f172a'}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-slate-300"
              />
              <span className="font-mono text-xs text-slate-500">{secondaryColor}</span>
            </div>
          </label>
        </div>
      </div>

      {feedback ? (
        <div
          aria-live="polite"
          role={feedback.ok ? 'status' : 'alert'}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
            feedback.ok
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-rose-300 bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.ok ? <CheckCircle2 size={18} /> : null}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {/* 2. Kontaktní a fakturační údaje */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Kontaktní a fakturační údaje firmy</h2>
          <p className="mt-1 text-sm text-slate-500">
            Telefon a e-mail se zobrazí klientům v patičce Vašich nabídek. Fakturační údaje se použijí na dokladech.
          </p>
        </div>

        {/* Rychlé načtení z ARES podle IČO */}
        <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-2.5 shrink-0">
          <input
            type="text"
            placeholder="Zadejte IČO (8 číslic)"
            value={aresIcoInput}
            onChange={(e) => {
              const val = e.target.value;
              setAresIcoInput(val);
              const digits = val.replace(/\s+/g, '');
              if (/^\d{8}$/.test(digits)) {
                void handleAresLookup(digits);
              }
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-900 w-40 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            disabled={aresLoading}
            onClick={() => void handleAresLookup()}
            className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {aresLoading ? 'Načítám…' : '⚡ Doplnit z ARES'}
          </button>
        </div>
      </div>

      {aresStatus ? (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
            aresStatus.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {aresStatus.text}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {contactAndBillingFields.map(([name, label]) => (
          <label className="text-sm font-semibold text-slate-700" key={name}>
            {label}
            <input
              className="input mt-1"
              defaultValue={organization[name] ?? ''}
              name={name}
              required={name === 'name'}
            />
          </label>
        ))}
      </div>

      <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <legend className="px-2 text-sm font-bold text-slate-900">Výchozí nastavení vystavených faktur</legend>
        <p className="mb-4 text-xs text-slate-500">
          Změna platí pouze pro nové faktury. Již vystavené doklady zůstávají beze změny.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Splatnost (dní)
            <input
              className="input mt-1"
              defaultValue={organization.invoiceDueDays ?? 14}
              max={365}
              min={1}
              name="invoiceDueDays"
              required
              type="number"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Výchozí DPH (%)
            <input
              className="input mt-1"
              defaultValue={organization.defaultVatRate ?? 21}
              max={100}
              min={0}
              name="defaultVatRate"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Prefix číselné řady
            <input
              className="input mt-1 uppercase"
              defaultValue={organization.invoiceNumberPrefix ?? 'NAV'}
              maxLength={12}
              name="invoiceNumberPrefix"
              pattern="[A-Za-z0-9-]{1,12}"
              required
            />
          </label>
        </div>
      </fieldset>

      <label className="block text-sm font-semibold text-slate-700">
        E-mailový podpis
        <textarea
          className="input mt-1 min-h-24"
          defaultValue={organization.emailSignature ?? ''}
          name="emailSignature"
        />
      </label>

      <button className="btn-primary" disabled={busy} type="submit">
        {busy ? 'Ukládám…' : 'Uložit firemní údaje'}
      </button>
    </form>
  );
}
