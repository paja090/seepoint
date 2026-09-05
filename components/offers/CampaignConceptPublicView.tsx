'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, MapPin, Target, Layers, Calendar, CheckCircle2, PhoneCall, Mail } from 'lucide-react';
import type { OfferView } from '@/lib/offers/view-model';
import type { CampaignPhase } from '@/lib/opportunities/types';

const GoogleNavigationOfferMap = dynamic(() => import('./GoogleNavigationOfferMap').then((m) => m.GoogleNavigationOfferMap), { ssr: false });

const mediaLabels: Record<string, { label: string; icon: string; desc: string }> = {
  CITY_POSTER: { label: 'City Poster (CLP) vitríny', icon: '🖼️', desc: 'Prestižní městské plakátové vitríny u úřadů, pošt, zdravotnických zařízeních a nákupních zón.' },
  PROMO_BENCH: { label: 'Reklamní lavičky', icon: '🪑', desc: 'Městský mobiliář pro opakovaný kontakt se značkou v rezidenčních částech a u zastávek MHD.' },
  NAVIGATION_SIGN: { label: 'Městská navigace (VO)', icon: '🧭', desc: 'Směrové desky na sloupech veřejného osvětlení zachycující řidiče na příjezdových křižovatkách.' },
  CITYLIGHT: { label: 'Prosvětlené Citylighty (CLV)', icon: '💡', desc: 'Svítící prosvětlené vitríny pro 24/7 viditelnost na hlavních třídách a v pěších zónách.' },
  BILLBOARD: { label: 'Billboardy (5.1 × 2.4 m)', icon: '📐', desc: 'Velkoplošná kampaňová síť u hlavních silničních tahů a vjezdů do města.' },
  BIGBOARD: { label: 'Bigboardy (9.6 × 3.6 m)', icon: '🏢', desc: 'Dominantní velkoplošné nosiče pro maximální zásah řidičů na obchvatech.' },
};

type ItemType = OfferView['items'][number];

export function CampaignConceptPublicView({ offer, publicToken }: { offer: OfferView; publicToken?: string }) {
  const [activeTab, setActiveTab] = useState<'strategy' | 'map' | 'phases'>('strategy');
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: '', email: '', message: 'Mám zájem o zpracování cenové nabídky na tento koncept.' });
  const brandName = offer.branding?.name || 'SeePOINT';
  const brandEmail = offer.branding?.email || 'info@seepoint.cz';
  const brandPhone = offer.branding?.phone || '+420 778 089 099';

  const rawPhases = (offer as unknown as Record<string, unknown>).campaignPhases;
  const phases: CampaignPhase[] = Array.isArray(rawPhases)
    ? (rawPhases as CampaignPhase[])
    : [
        {
          phase: 'TEASER',
          name: 'Před-otvírací fáze (Teaser)',
          timeframe: '2–3 týdny před otevřením',
          recommendedMediaTypes: ['CITY_POSTER', 'PROMO_BENCH'],
          description: 'Budování povědomí o příchodu značky a vyvolání prvotního zájmu obyvatel v širším okolí.',
        },
        {
          phase: 'OPENING',
          name: 'Fáze slavnostního otevření',
          timeframe: 'Týden otevření',
          recommendedMediaTypes: ['CITY_POSTER', 'NAVIGATION_SIGN', 'PROMO_BENCH'],
          description: 'Intenzivní lokální kampaň s přímou navigací zákazníků z hlavních příjezdových křižovatek k novému objektu.',
        },
        {
          phase: 'FOLLOW_UP',
          name: 'Stabilizační fáze (Follow-up)',
          timeframe: '1–2 týdny po otevření',
          recommendedMediaTypes: ['PROMO_BENCH', 'CITY_POSTER'],
          description: 'Upevnění návyku zákazníků navštěvovat novou pobočku v rezidenčních a spádových čtvrtích.',
        },
      ];

  // Group items by media type
  const mediaGroups = offer.items.reduce<Record<string, ItemType[]>>((acc: Record<string, ItemType[]>, item: ItemType) => {
    const key = item.surface.mediaType || 'OTHER';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicToken || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/proposals/${publicToken}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question',
          name: requestForm.name,
          email: requestForm.email,
          message: requestForm.message,
        })
      });
      if (!res.ok) throw new Error('Chyba při odesílání.');
      alert('Požadavek byl úspěšně odeslán obchodníkovi. Budeme Vás brzy kontaktovat.');
      setShowRequestModal(false);
    } catch (err) {
      alert('Něco se pokazilo. Zkuste prosím raději kontaktovat obchodníka napřímo e-mailem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased pb-16">
      {/* Top Brand Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 py-3.5 shadow-lg">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {offer.branding?.logoUrl ? (
              <img alt={brandName} className="h-8 max-w-44 object-contain" src={offer.branding.logoUrl} />
            ) : offer.client?.logoUrl ? (
              <img alt={`Logo ${offer.client.name}`} className="h-8 max-w-44 object-contain" src={offer.client.logoUrl} />
            ) : (
              <img alt="SeePOINT" className="h-8 w-auto object-contain" src="/seepoint-logo.svg" />
            )}
            <span className="hidden sm:inline-block h-4 w-px bg-slate-800" />
            <span className="hidden sm:inline-block text-xs font-bold text-slate-400">
              Nezávazný koncept OOH kampaně
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${brandPhone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-bold text-xs border border-purple-800/60 transition"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{brandPhone}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-8">
        {/* HERO SECTION */}
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/60 p-6 sm:p-10 text-white shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-950/90 text-purple-300 border border-purple-800/60">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Nezávazný strategický návrh</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                {offer.client.name} — <span className="text-purple-300">Návrh lokální OOH kampaně</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                Nezávazný koncept venkovní komunikace připravený přímo pro spuštění nové provozovny v regionu.
              </p>
            </div>

            <div className="shrink-0 rounded-2xl bg-slate-950/80 p-4 border border-slate-800 space-y-2 text-center sm:text-right">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                Stav návrhu
              </span>
              <span className="inline-block px-3 py-1 rounded-lg text-xs font-black bg-purple-950 text-purple-300 border border-purple-800">
                🔒 Koncept bez cen (Informační)
              </span>
              <p className="text-[10px] text-slate-400 font-medium">
                Garantovaná dostupnost sítě SeePOINT
              </p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 block">Doporučené plochy</span>
              <span className="text-lg font-black text-white">{offer.items.length} nosičů</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 block">Typy médií</span>
              <span className="text-lg font-black text-purple-300">{Object.keys(mediaGroups).length} kategorie</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 block">Doporučená délka</span>
              <span className="text-lg font-black text-white">1–3 měsíce</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 block">Regionální Zásah</span>
              <span className="text-lg font-black text-emerald-400">100% MS Kraj</span>
            </div>
          </div>
        </section>

        {/* PŘÍLEŽITOST & CÍL KAMPANĚ */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Box 1: Příležitost */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 text-purple-400 font-extrabold text-sm uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Příležitost & Kontext</span>
            </div>
            <h3 className="text-lg font-black text-white">Proč tento návrh vznikl</h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              V souvislosti s plánovaným otevřením nové provozovny jsme připravili nezávazný návrh lokální venkovní kampaně. Cílem je zasáhnout klíčovou spádovou oblast a vyvolat maximální zájem zákazníků.
            </p>
          </div>

          {/* Box 2: Cíl kampaně */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 text-sky-400 font-extrabold text-sm uppercase tracking-wider">
              <Target className="w-4 h-4" />
              <span>Hlavní cíle kampaně</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Oznámení termínu otevření nové prodejny / pobočky</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Vyvolání vysoké návštěvnosti během prvního měsíce</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Navedení řidičů přímo k parkovišti z hlavních křižovatek</span>
              </li>
            </ul>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <div className="flex rounded-2xl bg-slate-900 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('strategy')}
            className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition ${activeTab === 'strategy' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Layers className="w-4 h-4 inline mr-2" />
            Doporučená strategie podle médií ({Object.keys(mediaGroups).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('phases')}
            className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition ${activeTab === 'phases' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Fáze kampaně ({phases.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition ${activeTab === 'map' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <MapPin className="w-4 h-4 inline mr-2" />
            Mapa nosičů ({offer.items.length})
          </button>
        </div>

        {/* TAB 1: STRATEGY BY MEDIA TYPES */}
        {activeTab === 'strategy' && (
          <section className="space-y-6">
            <div className="space-y-4">
              {Object.entries(mediaGroups).map(([mediaType, groupItems]) => {
                const meta = mediaLabels[mediaType] || { label: mediaType, icon: '📍', desc: 'Reklamní nosiče s vysokým lokálním dopadem.' };
                return (
                  <div key={mediaType} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{meta.icon}</span>
                        <div>
                          <h3 className="text-lg font-black text-white">{meta.label}</h3>
                          <p className="text-xs text-slate-400 font-medium">{meta.desc}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-purple-950 text-purple-300 border border-purple-800 shrink-0">
                        {groupItems.length} navržených nosičů
                      </span>
                    </div>

                    {/* Carrier items list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupItems.map((item, idx) => (
                        <div key={idx} className="group rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 hover:border-purple-800/60 transition">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-extrabold text-white">{item.customTitle || item.surface.name}</h4>
                              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                📍 {item.surface.carrier.city}{item.surface.carrier.street ? `, ${item.surface.carrier.street}` : ''} ({item.surface.carrier.code})
                              </p>
                            </div>
                          </div>

                          {item.clientDescription && (
                            <p className="text-xs text-slate-300 font-medium leading-relaxed bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                              💡 {item.clientDescription}
                            </p>
                          )}

                          {item.surface.photos.length > 0 && (
                            <div className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-900 cursor-pointer" onClick={() => setActivePhoto(item.surface.photos[0].url)}>
                              <img src={item.surface.photos[0].url} alt={item.surface.name} className="h-full w-full object-cover group-hover:scale-105 transition duration-300" />
                              <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-slate-950/90 text-[10px] font-bold text-white border border-slate-800">🔍 Zvětšit</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Strategy Summary Block */}
            <div className="rounded-3xl border border-purple-800/60 bg-gradient-to-br from-purple-950/50 via-slate-900 to-indigo-950/60 p-6 sm:p-8 text-white shadow-2xl space-y-3">
              <span className="text-xs font-extrabold text-purple-300 uppercase tracking-wider block">
                🧠 Proč právě tato kombinace?
              </span>
              <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                City Postery budují široké povědomí o novém podniku v klíčových městských částech. Reklamní lavičky zaručují opakovaný kontakt se značkou v rezidenčních zónách a navigační desky na sloupech VO zachytí zákazníka přímo v poslední fázi jeho cesty k provozovně.
              </p>
            </div>
          </section>
        )}

        {/* TAB 2: CAMPAIGN PHASES */}
        {activeTab === 'phases' && (
          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 shadow-xl">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white">Harmonogram a fáze kampaně</h3>
                <p className="text-xs text-slate-400 font-medium">Navržený průběh komunikace pro maximální zásah zákazníků před i po otevření.</p>
              </div>

              <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-purple-900/60">
                {phases.map((ph, idx) => (
                  <div key={idx} className="relative pl-10 space-y-2">
                    <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full bg-purple-500 border-2 border-slate-900" />
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-extrabold text-white">{ph.name}</h4>
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                        {ph.timeframe}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-3xl">
                      {ph.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: MAP VIEW */}
        {activeTab === 'map' && (
          <section className="space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 space-y-3 shadow-xl">
              <div className="px-2 pt-2">
                <h3 className="text-base font-black text-white">Mapa vybraných nosičů SeePOINT</h3>
                <p className="text-xs text-slate-400 font-medium">Na mapě jsou zobrazeny výhradně reálné, dostupné reklamní nosiče ze sítě SeePOINT.</p>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-800 min-h-[450px]">
                <GoogleNavigationOfferMap
                  readOnly
                  mode="point"
                  onTargetSelect={() => {}}
                  onPointMove={() => {}}
                  onMapClick={() => {}}
                  points={offer.items.flatMap((item: ItemType, idx: number) => (
                    item.surface.carrier.latitude != null && item.surface.carrier.longitude != null
                      ? [{
                          id: item.surfaceId || `surface-${idx}`,
                          label: item.customTitle || item.surface.name,
                          latitude: item.surface.carrier.latitude,
                          longitude: item.surface.carrier.longitude,
                          calculatedDistanceMeters: undefined,
                        }]
                      : []
                  ))}
                  maxRadiusKm={5}
                />
              </div>
            </div>
          </section>
        )}

        {/* NEXT STEPS & ROADMAP SECTION */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-400">Průvodce realizací</span>
            <h2 className="text-xl sm:text-2xl font-black text-white">Jak probíhá daleký postup a realizace?</h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Od schválení nezávazného konceptu k aktivním reklamním plochám v terénu.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3 relative overflow-hidden">
              <span className="text-2xl font-black text-purple-500/40 absolute top-3 right-4">01</span>
              <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 flex items-center justify-center font-black text-sm border border-purple-800">
                1
              </div>
              <h3 className="font-bold text-white text-sm">Schválení konceptu & lokací</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Projdete navržené plochy, vyberete preferované lokality a potvrdíte rozsah kampaně.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3 relative overflow-hidden">
              <span className="text-2xl font-black text-purple-500/40 absolute top-3 right-4">02</span>
              <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 flex items-center justify-center font-black text-sm border border-purple-800">
                2
              </div>
              <h3 className="font-bold text-white text-sm">Příprava cenové kalkulace</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Obchodník pro vybrané plochy připraví ceníkovou kalkulaci se započtením slev a rozpočtu.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3 relative overflow-hidden">
              <span className="text-2xl font-black text-purple-500/40 absolute top-3 right-4">03</span>
              <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 flex items-center justify-center font-black text-sm border border-purple-800">
                3
              </div>
              <h3 className="font-bold text-white text-sm">Povolení & Výroba grafiky</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Zajistíme úřední zábor a stavební souhlasy (např. u VO) a vytiskneme kampaňové materiály.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3 relative overflow-hidden">
              <span className="text-2xl font-black text-purple-500/40 absolute top-3 right-4">04</span>
              <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 flex items-center justify-center font-black text-sm border border-purple-800">
                4
              </div>
              <h3 className="font-bold text-white text-sm">Instalace & Fotodokumentace</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Tým montážníků osadí plochy v terénu a zašleme vám kompletní klientský fotoreport.</p>
            </div>
          </div>
        </section>

        {/* CALL TO ACTION STRIP */}
        <section className="rounded-3xl border border-purple-800/80 bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 p-8 text-center space-y-4 shadow-2xl">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Máte zájem o nacenění nebo úpravu tohoto konceptu?
          </h3>
          <p className="text-xs sm:text-sm text-purple-200 font-medium max-w-2xl mx-auto">
            Rádi pro vás připravíme kompletní ceníkový kalkulační rozpočet včetně vyřízení úředních povolení a instalace na klíč.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            {publicToken ? (
              <button
                type="button"
                onClick={() => setShowRequestModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-slate-950 font-black text-xs sm:text-sm shadow-xl hover:bg-slate-100 transition transform active:scale-95 cursor-pointer"
              >
                <Mail className="w-4 h-4 text-purple-600" />
                <span>Chci zpracovat cenovou nabídku</span>
              </button>
            ) : (
              <a
                href={`mailto:${brandEmail}?subject=Zájem%20o%20nacenění%20kampaně`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-slate-950 font-black text-xs sm:text-sm shadow-xl hover:bg-slate-100 transition transform active:scale-95"
              >
                <Mail className="w-4 h-4 text-purple-600" />
                <span>Chci zpracovat cenovou nabídku</span>
              </a>
            )}

            <a
              href={`tel:${brandPhone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-purple-950/80 hover:bg-purple-900 text-purple-200 font-extrabold text-xs sm:text-sm border border-purple-700/60 shadow-lg transition"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Zavolat obchodníkovi ({brandPhone})</span>
            </a>
          </div>
        </section>
      </main>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">Zpracování nabídky</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>
            <p className="text-sm text-slate-600 mb-6">Máte zájem o tento koncept? Nechte nám kontakt a obchodník SeePOINT Vám připraví přesnou cenovou kalkulaci.</p>
            
            <form onSubmit={handleRequestSubmit} className="space-y-4 text-slate-900">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jméno a příjmení *</label>
                <input required type="text" value={requestForm.name} onChange={e => setRequestForm(prev => ({...prev, name: e.target.value}))} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail *</label>
                <input required type="email" value={requestForm.email} onChange={e => setRequestForm(prev => ({...prev, email: e.target.value}))} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Poznámka / Dotaz</label>
                <textarea rows={3} value={requestForm.message} onChange={e => setRequestForm(prev => ({...prev, message: e.target.value}))} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none" />
              </div>
              
              <button disabled={isSubmitting} type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm py-3 rounded-xl transition shadow-md disabled:opacity-50 mt-2">
                {isSubmitting ? 'Odesílám...' : 'Odeslat žádost'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md cursor-zoom-out"
          onClick={() => setActivePhoto(null)}
        >
          <img src={activePhoto} alt="Detail nosiče" className="max-h-[90vh] max-w-[90vw] rounded-2xl border border-slate-700 shadow-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
