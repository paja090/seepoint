'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Handshake,
  ArrowRight,
  MapPin,
  Sparkles,
} from 'lucide-react';

const PARTNER_ROLES = [
  {
    id: 'OWNER',
    label: 'Vlastník reklamních ploch (nabízím volné kapacity do sítě)',
    desc: 'Máte billboardy, CLV, štíty, LED nebo lavičky a chcete prodávat neobsazené plochy přes partnerské agentury.',
  },
  {
    id: 'AGENCY',
    label: 'Mediální / reklamní agentura (hledám plochy pro klienty)',
    desc: 'Sestavujete kampaně pro klienty a potřebujete rychlý přístup k ověřeným plochám v regionech po celé ČR.',
  },
  {
    id: 'BOTH',
    label: 'Obojí – vlastním plochy a zároveň nakupuji u partnerů',
    desc: 'Kombinujete vlastní lokální nosiče s dokupováním ploch v dalších městech pro celorepublikové kampaně.',
  },
  {
    id: 'INSTALLER',
    label: 'Montážní, výlepový nebo tiskový partner',
    desc: 'Zajišťujete výlepy, montáže plachet, servis nebo velkoplošný tisk a fotodokumentaci v terénu.',
  },
] as const;

export default function JoinNetworkPage() {
  const [ico, setIco] = useState('');
  const [aresLoading, setAresLoading] = useState(false);
  const [aresMessage, setAresMessage] = useState<string | null>(null);
  const [aresError, setAresError] = useState<string | null>(null);

  const [company, setCompany] = useState('');
  const [dic, setDic] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [partnerRole, setPartnerRole] = useState<string>(PARTNER_ROLES[0].label);
  const [surfaceCount, setSurfaceCount] = useState('10–50 ploch');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  async function lookupAres(rawIco: string) {
    const clean = rawIco.replace(/\D/g, '').slice(0, 8);
    if (clean.length !== 8) {
      setAresError('Zadejte prosím přesně 8 číslic IČO.');
      return;
    }
    setAresLoading(true);
    setAresError(null);
    setAresMessage(null);
    try {
      const res = await fetch(`/api/client/catalog?aresIco=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.company) {
        setAresError(data.error || 'Subjekt v ARES nebyl nalezen. Údaje můžete vyplnit ručně.');
        return;
      }
      const c = data.company;
      if (c.companyName) setCompany(c.companyName);
      if (c.dic) setDic(c.dic);
      if (c.city) setCity(c.city);
      if (c.street) setStreet(c.street);
      setAresMessage(`Ověřeno v ARES: ${c.companyName}${c.city ? ` (${c.city})` : ''}`);
    } catch {
      setAresError('Nepodařilo se spojit s registrem ARES. Vyplňte prosím název firmy ručně.');
    } finally {
      setAresLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/leads/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          company,
          ico,
          dic,
          city: [city, street].filter(Boolean).join(', '),
          partnerRole,
          surfaceCount,
          source: 'B2B_PARTNER_NETWORK',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Odeslání registrace se nezdařilo.');
      }
      setSubmittedMessage(
        data.message ||
          'Vaše registrace do B2B sítě SeePoint byla přijata. Brzy vám pošleme aktivační odkaz do vašeho partnerského účtu.'
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Odeslání registrace se nezdařilo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/os" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-500 font-black text-slate-950">
              S
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white">SeePoint</span>
              <span className="ml-2 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                B2B Partner Network ČR
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 text-xs font-bold">
            <Link
              href="/client/catalog"
              className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-slate-300 hover:bg-slate-800 transition"
            >
              Veřejný katalog ploch
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-white px-3.5 py-2 font-black text-slate-950 hover:bg-slate-200 transition"
            >
              Přihlášení partnera
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Value Proposition & How Czech B2B Network Works */}
          <div className="space-y-6 lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-black text-emerald-300">
              <Sparkles size={14} />
              <span>Registrace přes IČO za 30 vteřin · 30 dní pilot zdarma</span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl leading-tight">
              Zapojte svou firmu do české B2B sítě venkovní reklamy
            </h1>

            <p className="text-sm leading-relaxed text-slate-300">
              Propojujeme regionální vlastníky reklamních ploch, mediální agentury a realizační týmy v celé ČR. Žádné přepisování Excelů – stačí zadat IČO, naimportovat plochy a jedním kliknutím publikovat volné kapacity.
            </p>

            <div className="space-y-3 pt-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2.5 text-sm font-black text-emerald-400">
                  <Building2 size={18} />
                  <span>1. Okamžité načtení firmy z ARES podle IČO</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Zadáte 8 číslic IČO a systém automaticky vyplní obchodní firmu, DIČ i fakturační sídlo z registru Ministerstva financí.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2.5 text-sm font-black text-indigo-400">
                  <Globe size={18} />
                  <span>2. Publikování volných ploch 1 klikem</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Všechny vaše plochy jsou ve výchozím stavu <strong>PRIVATE</strong> (jen pro vás). Do B2B burzy uvolníte pouze ty neobsazené kapacity, které sami určíte.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2.5 text-sm font-black text-amber-400">
                  <ShieldCheck size={18} />
                  <span>3. 100% ochrana vašich koncových klientů</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Ostatní agentury nikdy nevidí vaše interní nájemní smlouvy, majitele pozemků ani přímé klienty. Každá organizace má striktně oddělený tenant.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Registration Form */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-slate-800 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
              {submittedMessage ? (
                <div className="space-y-5 py-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={34} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Registrace do B2B sítě byla odeslána!
                  </h2>
                  <p className="mx-auto max-w-md text-sm text-slate-600 leading-relaxed">
                    {submittedMessage}
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-700 space-y-1">
                    <div className="font-black text-slate-900">Co následuje?</div>
                    <p>1. Na váš e-mail <strong>{email}</strong> dorazí aktivační odkaz pro nastavení hesla.</p>
                    <p>2. V průvodci nahrajete své plochy (CSV / Excel nebo ručně na mapě).</p>
                    <p>3. V sekci <strong>B2B Síť (/network)</strong> jedním kliknutím zvolíte, které plochy chcete nabídnout partnerům.</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Link
                      href="/client/catalog"
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black text-white hover:bg-slate-800 transition"
                    >
                      Prohlédnout veřejný katalog ploch
                    </Link>
                    <Link
                      href="/login"
                      className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Přejít na přihlášení
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
                      B2B Onboarding České republiky
                    </span>
                    <h2 className="mt-1 text-xl font-black text-slate-900">
                      Zaregistrovat firmu do sítě SeePoint
                    </h2>
                    <p className="text-xs text-slate-500">
                      Zadejte IČO pro automatické načtení údajů z ARES a vyberte způsob zapojení.
                    </p>
                  </div>

                  {/* Step 1: ARES IČO */}
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-2">
                    <label className="block text-xs font-black text-indigo-950">
                      1. IČO společnosti (automatické načtení z ARES)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        value={ico}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                          setIco(digits);
                          if (digits.length === 8) {
                            void lookupAres(digits);
                          }
                        }}
                        placeholder="Zadejte 8 číslic IČO (např. 27082440)"
                        className="flex-1 min-w-[200px] rounded-xl border border-indigo-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={aresLoading || ico.length !== 8}
                        onClick={() => void lookupAres(ico)}
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                      >
                        {aresLoading ? 'Načítám ARES…' : 'Načíst z ARES'}
                      </button>
                    </div>
                    {aresMessage && (
                      <p className="text-xs font-bold text-emerald-700">✓ {aresMessage}</p>
                    )}
                    {aresError && (
                      <p className="text-xs font-bold text-amber-700">{aresError}</p>
                    )}
                  </div>

                  {/* Company Details */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-slate-700 sm:col-span-2">
                      Obchodní název společnosti *
                      <input
                        type="text"
                        required
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="např. Outdoor Media Morava s.r.o."
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </label>

                    <label className="text-xs font-bold text-slate-700">
                      DIČ (volitelné)
                      <input
                        type="text"
                        value={dic}
                        onChange={(e) => setDic(e.target.value)}
                        placeholder="CZ27082440"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </label>

                    <label className="text-xs font-bold text-slate-700">
                      Město / hlavní působnost
                      <div className="relative mt-1">
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="např. Brno / Jihomoravský kraj"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                        <MapPin size={14} className="absolute right-3 top-2.5 text-slate-400" />
                      </div>
                    </label>
                  </div>

                  {/* Step 2: Role in Network */}
                  <div className="space-y-2">
                    <span className="block text-xs font-black text-slate-800">
                      2. Jak se chcete v B2B síti zapojit? *
                    </span>
                    <div className="grid gap-2">
                      {PARTNER_ROLES.map((role) => {
                        const active = partnerRole === role.label;
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => setPartnerRole(role.label)}
                            className={`w-full rounded-2xl border p-3 text-left transition cursor-pointer ${
                              active
                                ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">{role.label}</span>
                              <span
                                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                  active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                                }`}
                              >
                                {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">{role.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Contact & Volume */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-slate-700">
                      Kontaktní osoba (jméno a příjmení) *
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jan Novák"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </label>

                    <label className="text-xs font-bold text-slate-700">
                      Počet reklamních ploch / rozsah
                      <select
                        value={surfaceCount}
                        onChange={(e) => setSurfaceCount(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
                      >
                        <option value="Do 10 ploch">Do 10 ploch</option>
                        <option value="10–50 ploch">10–50 ploch</option>
                        <option value="50–200 ploch">50–200 ploch</option>
                        <option value="200+ ploch (velká síť)">200+ ploch (velká síť)</option>
                        <option value="Agentura (nakupuji kapacity)">Agentura (nakupuji kapacity)</option>
                        <option value="Montážní / tiskový partner">Montážní / tiskový partner</option>
                      </select>
                    </label>

                    <label className="text-xs font-bold text-slate-700">
                      Pracovní e-mail (pro zaslání přístupu) *
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jan.novak@firma.cz"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </label>

                    <label className="text-xs font-bold text-slate-700">
                      Telefon *
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+420 777 123 456"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </label>
                  </div>

                  {submitError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                      {submitError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-6 py-3.5 text-sm font-black text-white shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Handshake size={18} />
                    <span>
                      {submitting
                        ? 'Odesílám registraci…'
                        : 'Požádat o B2B partnerský účet (30 dní zdarma)'}
                    </span>
                    <ArrowRight size={16} />
                  </button>

                  <p className="text-center text-[11px] text-slate-400">
                    Registrace je nezávazná. Vaše plochy zůstávají ve výchozím stavu soukromé, dokud je sami nezveřejníte.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
