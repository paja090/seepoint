'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  MapPin,
  Layers,
  ArrowRight,
  Eye,
  CheckCircle2,
  Building2,
  Compass,
  FileText,
  Sliders,
  DollarSign,
  TrendingUp,
  Tag,
  Share2,
} from 'lucide-react';

export type OfferTemplate = {
  id: string;
  category: 'STANDARD' | 'PRESTIGE' | 'URBAN' | 'NAVIGATION' | 'DOOH';
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  targetAudience: string;
  typicalDuration: string;
  typicalSurfacesCount: string;
  mediaTypes: Array<{ label: string; icon: string }>;
  features: string[];
  visualPreview: {
    heroImage: string;
    styleTitle: string;
    layoutType: 'MAP_PHOTO_SPLIT' | 'PHOTO_HERO' | 'ROUTE_MAP' | 'GRID_CATALOG';
  };
  samplePricing: {
    fromCzk: number;
    billingPeriod: string;
    includes: string[];
  };
  createOfferUrl: string;
};

export const OFFER_TEMPLATES: OfferTemplate[] = [
  {
    id: 'billboard-network',
    category: 'STANDARD',
    title: 'Billboardová síť (Kampaň na tazích)',
    subtitle: 'Standardní euroformáty 5,1 × 2,4 m u hlavních komunikací a křižovatek',
    badge: 'Nejpopulárnější',
    description: 'Osvědčený koncept pro masové zasažení řidičů a cestujících. Kombinace frekventovaných příjezdových tahů a městských okruhů.',
    targetAudience: 'Řidiči, dojíždějící, retailoví zákazníci, masový trh',
    typicalDuration: '1 – 3 měsíce',
    typicalSurfacesCount: '3 – 15 ploch',
    mediaTypes: [
      { label: 'Billboard 5,1×2,4', icon: '🪧' },
      { label: 'Bigboard 9,6×3,6', icon: '🏗️' },
    ],
    features: [
      'Interaktivní mapa všech ploch s reálnými fotkami z terénu',
      'Přepínání pohledu z ulice a vizualizace plakátu',
      'Kalkulace nájmu, tisku papír/blueback a výlepu',
      'Klient může schválit celou síť nebo vybrat konkrétní kusy',
    ],
    visualPreview: {
      heroImage: '/offer/hero-campaign.png',
      styleTitle: 'Interaktivní mapa + Detailní karty s fotkami z terénu',
      layoutType: 'MAP_PHOTO_SPLIT',
    },
    samplePricing: {
      fromCzk: 7900,
      billingPeriod: 'měsíc / plocha',
      includes: ['Nájem reklamního prostoru', 'Garance viditelnosti', 'Základní fotodokumentace výlepu'],
    },
    createOfferUrl: '/offers/new/standard?type=BILLBOARD',
  },
  {
    id: 'urban-furniture',
    category: 'URBAN',
    title: 'Městský mobiliář & Promo lavičky',
    subtitle: 'Reklama v přímém kontaktu s chodci v centrech měst, parcích a u zastávek',
    badge: 'Vysoká frekvence',
    description: 'Ideální formát pro lokální povědomí, gastronomii, služby a zdravotnictví. Dlouhá doba kontaktu s procházejícími a čekajícími lidmi.',
    targetAudience: 'Pěší, obyvatelé města, návštěvníci center, cestující MHD',
    typicalDuration: '3 – 12 měsíců',
    typicalSurfacesCount: '5 – 25 laviček / posterů',
    mediaTypes: [
      { label: 'Promo lavička', icon: '🪑' },
      { label: 'City poster', icon: '📜' },
      { label: 'Promo věž', icon: '🗼' },
    ],
    features: [
      'Detailní lokalizace u klíčových bodů (školy, nádraží, náměstí)',
      'Prezentace oboustranných ploch (A/B)',
      'Balíčkové slevy na větší počet kusů v městě',
    ],
    visualPreview: {
      heroImage: '/offer/media-promo-bench.png',
      styleTitle: 'Katalogový list s fotkami laviček a pěší mapou',
      layoutType: 'GRID_CATALOG',
    },
    samplePricing: {
      fromCzk: 2900,
      billingPeriod: 'měsíc / lavička',
      includes: ['Dlouhodobý pronájem', 'Pravidelná kontrola a údržba', 'Výroba a montáž desky'],
    },
    createOfferUrl: '/offers/new/standard?type=PROMO_BENCH',
  },
  {
    id: 'clv-showcase',
    category: 'URBAN',
    title: 'Citylight Showcase (CLV vitríny)',
    subtitle: 'Podsvícené prémiové vitríny 118,5 × 175 cm s nepřetržitou 24/7 viditelností',
    badge: 'Noční efekt',
    description: 'Reprezentativní kampaň pro prémiové značky, kulturu, bankovnictví a módu. Světelný efekt v podvečer a v noci násobí zásah.',
    targetAudience: 'Městská populace, nakupující, večerní provoz',
    typicalDuration: '14 dní – 2 měsíce',
    typicalSurfacesCount: '2 – 10 vitrín',
    mediaTypes: [
      { label: 'Citylight (CLV)', icon: '💡' },
      { label: 'Promo horizont', icon: '🌅' },
    ],
    features: [
      'Denní a noční vizualizace podsvícení',
      'Přesné rozměry pro grafické podklady citylight papíru',
      'Vysoká estetická úroveň nabídky pro náročné klienty',
    ],
    visualPreview: {
      heroImage: '/offer/media-clv.png',
      styleTitle: 'Světelná prezentace s vizualizací CLV vitríny',
      layoutType: 'PHOTO_HERO',
    },
    samplePricing: {
      fromCzk: 4500,
      billingPeriod: '14 dní / vitrína',
      includes: ['Podsvícená vitrína', 'Tisk na prosvětlovací CLV papír', 'Instalace'],
    },
    createOfferUrl: '/offers/new/standard?type=CITYLIGHT',
  },
  {
    id: 'prestige-facades',
    category: 'PRESTIGE',
    title: 'Prestižní fasády & LED obrazovky',
    subtitle: 'Dominantní velkoplošné štíty budov a digitální LED panely (DOOH)',
    badge: 'Maximální prestiž',
    description: 'Nepřehlédnutelné dominanty měst s obrovským denním zásahem. Pro klienty požadující maximální vizuální sílu a budování značky.',
    targetAudience: 'Celé město, tranzitní doprava, obchodní zóny',
    typicalDuration: '6 – 24 měsíců',
    typicalSurfacesCount: '1 – 3 dominanty',
    mediaTypes: [
      { label: 'Fasádní plocha', icon: '🏢' },
      { label: 'LED obrazovka', icon: '📺' },
      { label: 'Velkoformátový banner', icon: '🚩' },
    ],
    features: [
      'Reprezentativní celoobrazovková fotka fasády / LED obrazovky',
      'Odhad denního počtu projíždějících vozidel a pěších',
      'Individuální kalkulace výroby plachty s oky / digitálního vysílacího spotu',
    ],
    visualPreview: {
      heroImage: '/offer/media-city-poster.png',
      styleTitle: 'Exkluzivní Portfolio s dominantní fotkou plochy',
      layoutType: 'PHOTO_HERO',
    },
    samplePricing: {
      fromCzk: 18000,
      billingPeriod: 'měsíc / plocha',
      includes: ['Exkluzivita na prémiovém štítě budovy', 'Noční osvětlení', 'Statické posouzení a revize'],
    },
    createOfferUrl: '/offers/new/standard?type=FACADE',
  },
  {
    id: 'navigation-routes',
    category: 'NAVIGATION',
    title: 'Navigační systém pro prodejny & pobočky',
    subtitle: 'Směrové tabule na sloupech VO vedoucí zákazníky z dálnice/křižovatky k provozovně',
    badge: 'Dlouhodobý přínos',
    description: 'Funkční navigační řetězec, který navede zákazníky přímo k autosalonu, restauraci, prodejně nebo skladovému areálu.',
    targetAudience: 'Zákazníci hledající provozovnu, projíždějící řidiči',
    typicalDuration: '1 – 3 roky',
    typicalSurfacesCount: '2 – 8 navigačních bodů',
    mediaTypes: [
      { label: 'Směrovka na sloupu VO', icon: '🧭' },
      { label: 'Trakční sloup', icon: '⚡' },
    ],
    features: [
      'Přehledná mapa trasy s vyznačenými směrovými šipkami (rovně / doprava)',
      'Vzdálenost po silnici v metrech / kilometrech k cíli',
      'Povolení od města, správy komunikací a Policie ČR v ceně',
    ],
    visualPreview: {
      heroImage: '/offer/media-navigation.png',
      styleTitle: 'Interaktivní trasa s šipkami a fotkami sloupů VO',
      layoutType: 'ROUTE_MAP',
    },
    samplePricing: {
      fromCzk: 1200,
      billingPeriod: 'měsíc / tabule (roční smlouva)',
      includes: ['Pronájem sloupu VO', 'Kompletní legislativa a povolení', 'Výroba oboustranné směrovky'],
    },
    createOfferUrl: '/offers/new/navigation',
  },
];

export function OfferTemplatesCatalogView({
  clients = [],
}: {
  clients?: Array<{ id: string; name: string }>;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [activePreviewTemplate, setActivePreviewTemplate] = useState<OfferTemplate | null>(null);

  const filteredTemplates = OFFER_TEMPLATES.filter((t) => {
    if (selectedCategory === 'ALL') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Katalog & Vzory nabídek</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Vzorové šablony a balíčky pro nabídky
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Vyberte si předpřipravený koncept kampaně podle typu médií (Billboardy, Lavičky, CLV, Fasády, Navigace) a okamžitě z něj vytvořte profesionální interaktivní nabídku pro klienta.
            </p>
          </div>

          {/* Quick Client Pre-selector */}
          <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800 space-y-2 shrink-0 min-w-[260px]">
            <label className="text-[11px] font-black uppercase text-amber-400 block tracking-wider">
              Vytvořit nabídku pro klienta:
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">-- Vyberte klienta (volitelné) --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 block">
              Zvolený klient se automaticky předvyplní do nové nabídky.
            </span>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pt-6 border-t border-slate-800/80 mt-6 text-xs font-bold scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              selectedCategory === 'ALL'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            Všechny koncepty ({OFFER_TEMPLATES.length})
          </button>
          <button
            onClick={() => setSelectedCategory('STANDARD')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              selectedCategory === 'STANDARD'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            <span>🪧 Billboardy & Bigboardy</span>
          </button>
          <button
            onClick={() => setSelectedCategory('URBAN')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              selectedCategory === 'URBAN'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            <span>🪑 Městský mobiliář & Lavičky</span>
          </button>
          <button
            onClick={() => setSelectedCategory('PRESTIGE')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              selectedCategory === 'PRESTIGE'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            <span>🏢 Fasády & LED dominanty</span>
          </button>
          <button
            onClick={() => setSelectedCategory('NAVIGATION')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              selectedCategory === 'NAVIGATION'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            <span>🧭 Navigační směrovky</span>
          </button>
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => {
          const finalUrl = selectedClientId
            ? `${template.createOfferUrl}${template.createOfferUrl.includes('?') ? '&' : '?'}clientId=${encodeURIComponent(selectedClientId)}`
            : template.createOfferUrl;

          return (
            <div
              key={template.id}
              className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs hover:border-emerald-400 hover:shadow-xl transition-all duration-200 group"
            >
              <div className="space-y-4">
                {/* Top Badge & Media Icons */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {template.badge}
                  </span>
                  <div className="flex items-center gap-1 text-sm">
                    {template.mediaTypes.map((m, idx) => (
                      <span key={idx} title={m.label} className="p-1 rounded-lg bg-slate-100 text-slate-700">
                        {m.icon}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition">
                    {template.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1 line-clamp-2">
                    {template.subtitle}
                  </p>
                </div>

                {/* Visual Style Preview Snippet */}
                <div className="rounded-2xl bg-slate-950 p-3 text-white space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-400">
                    <span className="flex items-center gap-1">
                      <Eye size={12} /> Vizuální styl nabídky:
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-200">{template.visualPreview.styleTitle}</p>
                </div>

                {/* Key Features List */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  {template.features.slice(0, 3).map((f, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{f}</span>
                    </div>
                  ))}
                </div>

                {/* Pricing Hint */}
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                    Orientační sazba:
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <strong className="text-base font-black text-slate-900">
                      od {template.samplePricing.fromCzk.toLocaleString('cs-CZ')} Kč
                    </strong>
                    <span className="text-[11px] text-slate-500">/ {template.samplePricing.billingPeriod}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-5 mt-4 border-t border-slate-100 flex gap-2">
                <Link
                  href={finalUrl}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 group-hover:bg-emerald-600 py-3 text-xs font-black text-white shadow-sm transition active:scale-98"
                >
                  <span>Použít tento koncept</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
