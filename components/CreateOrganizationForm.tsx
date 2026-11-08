'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

function slugifyCompanyName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function CreateOrganizationForm() {
  const [result, setResult] = useState<{ message: string; organizationId?: string; activationUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [vatId, setVatId] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [aresLoading, setAresLoading] = useState(false);
  const [aresStatus, setAresStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function lookupAres(icoInput?: string) {
    const cleanIco = (icoInput ?? companyId).replace(/\s+/g, '').trim();
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
      if (res.ok && data.ok && data.company) {
        const c = data.company;
        setCompanyId(c.companyId || cleanIco);
        if (c.companyName) {
          setName(c.companyName);
          if (!slugTouched) {
            setSlug(slugifyCompanyName(c.companyName));
          }
        }
        if (c.dic) setVatId(c.dic);
        if (c.street || c.address) setStreet(c.street || c.address || '');
        if (c.city) setCity(c.city);
        if (c.postalCode) setPostalCode(c.postalCode);
        setAresStatus({
          ok: true,
          text: `✓ Ověřeno v ARES: ${c.companyName || cleanIco}${c.city ? ` (${c.city})` : ''}`,
        });
      } else {
        setAresStatus({ ok: false, text: data.error || 'Subjekt s tímto IČO nebyl v ARES nalezen.' });
      }
    } catch {
      setAresStatus({ ok: false, text: 'Nepodařilo se spojit s registrem ARES.' });
    } finally {
      setAresLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setResult(null);
    try {
      const formData = new FormData(form);
      const body: Record<string, unknown> = Object.fromEntries(formData.entries());
      body.enableNetwork = formData.get('enableNetwork') === 'on';
      body.enableNavigation = formData.get('enableNavigation') === 'on';
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: string;
        warning?: string;
        message?: string;
        activationUrl?: string;
        organization?: { id: string };
      };
      setResult(
        response.ok
          ? {
              message: payload.warning || payload.message || 'Organizace byla založena.',
              organizationId: payload.organization?.id,
              activationUrl: payload.activationUrl,
            }
          : { message: payload.error || 'Založení selhalo.' }
      );
      if (response.ok) {
        form.reset();
        setName('');
        setSlug('');
        setSlugTouched(false);
        setCompanyId('');
        setVatId('');
        setStreet('');
        setCity('');
        setPostalCode('');
        setAresStatus(null);
      }
    } catch {
      setResult({ message: 'Založení selhalo.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card grid gap-4 md:grid-cols-2" onSubmit={submit}>
      {/* ARES Quick Lookup Banner */}
      <div className="md:col-span-2 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 block">
              ⚡ Rychlé založení podle IČO (Registr ARES)
            </label>
            <p className="text-xs text-slate-600 mt-0.5">
              Zadejte 8místné IČO firmy — název, slug, DIČ i sídlo se vyplní automaticky.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              className="input font-mono text-sm sm:w-44 bg-white"
              name="companyId"
              placeholder="např. 01234567"
              value={companyId}
              onChange={(e) => {
                const val = e.target.value;
                setCompanyId(val);
                const digits = val.replace(/\s+/g, '');
                if (/^\d{8}$/.test(digits)) {
                  void lookupAres(digits);
                }
              }}
            />
            <button
              type="button"
              disabled={aresLoading}
              onClick={() => void lookupAres()}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {aresLoading ? 'Načítám ARES…' : 'Načíst z ARES'}
            </button>
          </div>
        </div>
        {aresStatus ? (
          <p className={`mt-2 text-xs font-bold ${aresStatus.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
            {aresStatus.text}
          </p>
        ) : null}
      </div>

      <label className="text-sm font-semibold">
        Název firmy *
        <input
          className="input mt-1"
          name="name"
          placeholder="např. Outdoor Media Brno s.r.o."
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) {
              setSlug(slugifyCompanyName(e.target.value));
            }
          }}
        />
      </label>
      <label className="text-sm font-semibold">
        Slug (URL identifikátor) *
        <input
          className="input mt-1"
          name="slug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
      </label>
      <label className="text-sm font-semibold">
        E-mail OWNERA (obdrží pozvánku) *
        <input className="input mt-1" name="ownerEmail" required type="email" placeholder="majitel@firma.cz" />
      </label>
      <label className="text-sm font-semibold">
        Firemní kontaktní e-mail
        <input className="input mt-1" name="email" type="email" placeholder="info@firma.cz" />
      </label>
      <label className="text-sm font-semibold">
        DIČ
        <input
          className="input mt-1"
          name="vatId"
          placeholder="CZ..."
          value={vatId}
          onChange={(e) => setVatId(e.target.value)}
        />
      </label>
      <label className="text-sm font-semibold">
        Město
        <input
          className="input mt-1"
          name="city"
          placeholder="např. Brno"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </label>
      <label className="text-sm font-semibold">
        Ulice a č.p.
        <input
          className="input mt-1"
          name="street"
          placeholder="např. Masarykova 12"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
        />
      </label>
      <label className="text-sm font-semibold">
        PSČ
        <input
          className="input mt-1"
          name="postalCode"
          placeholder="např. 60200"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
        />
      </label>

      {/* Plan & Partner Network Setup */}
      <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-1">
        <h3 className="font-bold text-slate-800 mb-3">Výchozí tarif a zapojení do sítě</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">
            Počáteční tarif (30 dní zkušební provoz)
            <select className="input mt-1" name="plan" defaultValue="BUSINESS">
              <option value="BUSINESS">BUSINESS – Doporučeno pro 30denní Pilot (AI Inbox, terén, nabídky)</option>
              <option value="START">START – Partnerský / Základní profil (katalog nosičů a mapa)</option>
              <option value="PRO">PRO – Kompletní systém vč. Navigace VO a B2B sítě</option>
            </select>
          </label>
          <div className="space-y-2 pt-1 text-xs">
            <label className="flex items-start gap-2.5 font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" name="enableNetwork" defaultChecked className="mt-0.5 size-4 accent-purple-700" />
              <span>
                Zapojit do <strong>B2B Partnerské sítě (/network)</strong>
                <span className="block text-[11px] font-normal text-slate-500">
                  Umožní firmě sdílet volné plochy a přijímat poptávky a montáže v kraji.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 font-semibold text-slate-800 cursor-pointer">
              <input type="checkbox" name="enableNavigation" className="mt-0.5 size-4 accent-purple-700" />
              <span>
                Zapnout doplněk <strong>Navigace VO (/navigation)</strong>
                <span className="block text-[11px] font-normal text-slate-500">
                  Pro provozovatele navigačních a orientačních systémů na sloupech VO.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
        <h3 className="font-bold text-slate-800 mb-4">Firemní identita (White-label)</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">
            URL loga společnosti
            <input className="input mt-1" name="logoUrl" type="url" placeholder="https://..." />
            <span className="text-xs text-slate-500 block mt-1">Logo se zobrazí v menu, na PDF nabídkách a portálech pro klienty.</span>
          </label>
          <label className="text-sm font-semibold">
            Hlavní firemní barva (HEX)
            <div className="flex gap-2 mt-1">
              <input type="color" name="primaryColor" defaultValue="#0ea5e9" className="h-10 w-14 rounded cursor-pointer border border-slate-200" />
              <input
                type="text"
                name="primaryColorText"
                placeholder="#0ea5e9"
                className="input flex-1"
                onChange={(e) => {
                  const colorInput = e.target.previousSibling as HTMLInputElement;
                  if (colorInput && /^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    colorInput.value = e.target.value;
                  }
                }}
              />
            </div>
            <span className="text-xs text-slate-500 block mt-1">Tlačítka a hlavičky budou v této barvě.</span>
          </label>
        </div>
      </div>

      <div className="md:col-span-2 mt-4">
        <button className="btn-primary" disabled={busy} type="submit">
          {busy ? 'Zakládám…' : 'Založit organizaci a odeslat pozvánku OWNEROVI'}
        </button>
        {result ? (
          <div aria-live="polite" className="mt-3 space-y-2 text-sm font-semibold">
            <p className={result.organizationId ? 'text-emerald-700' : 'text-rose-600'}>{result.message}</p>
            {result.organizationId ? (
              <Link className="text-blue-700 underline" href={`/admin/organizations/${result.organizationId}`}>
                Otevřít detail organizace
              </Link>
            ) : null}
            {result.activationUrl ? (
              <p>
                <a className="text-blue-700 underline" href={result.activationUrl}>
                  Preview aktivační odkaz
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
