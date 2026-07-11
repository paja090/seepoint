'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  LayoutGrid,
  List,
  MapPin,
  Megaphone,
  Minus,
  Plus,
  Sparkles,
  Store,
  Tag,
  Target,
  TrendingUp,
  Users,
  Wand2,
} from 'lucide-react';
import { TONE_CLASSES } from '@/lib/mock-offer-data';
import {
  audienceOptions,
  autoSuggestions,
  budgetTiers,
  campaignObjectives,
  crmClients,
  formatCzk,
  formatNumber,
  mediaOptions,
  recommendedPackages,
  regionOptions,
  wizardSteps,
  type CampaignObjective,
} from '@/lib/mock-sales-data';
import { Chip, ToneDot } from './ui';

const objectiveIcon: Record<CampaignObjective['icon'], React.ReactNode> = {
  store: <Store size={20} />,
  users: <Users size={20} />,
  tag: <Tag size={20} />,
  megaphone: <Megaphone size={20} />,
  trending: <TrendingUp size={20} />,
  calendar: <CalendarDays size={20} />,
};

type MediaMode = 'map' | 'list' | 'package' | 'auto';

const mediaModes: { key: MediaMode; label: string; icon: React.ReactNode }[] = [
  { key: 'map', label: 'Z mapy', icon: <MapPin size={16} /> },
  { key: 'list', label: 'Ze seznamu', icon: <List size={16} /> },
  { key: 'package', label: 'Doporučený balíček', icon: <LayoutGrid size={16} /> },
  { key: 'auto', label: 'Automatické návrhy', icon: <Wand2 size={16} /> },
];

export function CampaignWizard() {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState(crmClients[0].id);
  const [objective, setObjective] = useState('obj-awareness');
  const [budget, setBudget] = useState('bud-m');
  const [dateFrom, setDateFrom] = useState('2026-08-01');
  const [dateTo, setDateTo] = useState('2026-08-31');
  const [regions, setRegions] = useState<Set<string>>(new Set(['reg-ostrava', 'reg-fm']));
  const [audiences, setAudiences] = useState<Set<string>>(new Set(['aud-commuters', 'aud-shoppers']));
  const [mediaMode, setMediaMode] = useState<MediaMode>('package');
  const [quantities, setQuantities] = useState<Record<string, number>>({ CITY_POSTER: 20, PROMO_BENCH: 15, NAVIGATION: 8 });
  const [packageId, setPackageId] = useState<string | null>('pkg-regional');
  const [suggestions, setSuggestions] = useState<Set<string>>(new Set());

  const client = crmClients.find((item) => item.id === clientId)!;

  function toggle(set: Set<string>, updater: (next: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updater(next);
  }

  function setQty(key: string, delta: number) {
    setQuantities((prev) => {
      const value = Math.max(0, (prev[key] ?? 0) + delta);
      return { ...prev, [key]: value };
    });
  }

  const selection = useMemo(() => {
    if (mediaMode === 'package' && packageId) {
      const pkg = recommendedPackages.find((item) => item.id === packageId)!;
      return { surfaces: pkg.surfaces, price: pkg.price, reach: pkg.reach };
    }
    let surfaces = 0;
    let price = 0;
    let reach = 0;
    if (mediaMode === 'list' || mediaMode === 'map') {
      for (const media of mediaOptions) {
        const qty = quantities[media.key] ?? 0;
        surfaces += qty;
        price += qty * media.pricePerSurface;
        reach += qty * media.reachPerSurface;
      }
    }
    if (mediaMode === 'auto' || mediaMode === 'map') {
      for (const id of suggestions) {
        const sug = autoSuggestions.find((item) => item.id === id);
        if (sug) {
          surfaces += 1;
          price += sug.price;
          reach += sug.reach;
        }
      }
    }
    return { surfaces, price, reach };
  }, [mediaMode, packageId, quantities, suggestions]);

  const days = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const diff = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  }, [dateFrom, dateTo]);

  const isLast = step === wizardSteps.length - 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
      {/* Step rail */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ol className="space-y-1">
          {wizardSteps.map((item, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={item.key}>
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    active ? 'bg-slate-950 text-white' : done ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  onClick={() => setStep(index)}
                  type="button"
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    active ? 'bg-white text-slate-950' : done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {done ? <Check aria-hidden size={13} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                    <span className={`block text-[11px] leading-tight ${active ? 'text-slate-300' : 'text-slate-400'}`}>{item.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Step content */}
      <section className="card min-h-[420px]">
        {step === 0 && (
          <div>
            <StepTitle title="Pro koho kampaň připravujeme?" subtitle="Vyberte klienta z CRM nebo založte nového." />
            <div className="grid gap-3 sm:grid-cols-2">
              {crmClients.map((item) => (
                <button
                  className={`rounded-xl border p-4 text-left transition ${clientId === item.id ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`}
                  key={item.id}
                  onClick={() => setClientId(item.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-950">{item.name}</p>
                    {clientId === item.id && <Check aria-hidden className="text-slate-950" size={18} />}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.industry} · klient od {item.since}</p>
                </button>
              ))}
            </div>
            <button className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-900" type="button">
              <Plus aria-hidden size={15} /> Založit nového klienta
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <StepTitle title="Jaký je cíl kampaně?" subtitle="Cíl ovlivní doporučenou skladbu médií a lokalit." />
            <div className="grid gap-3 sm:grid-cols-2">
              {campaignObjectives.map((item) => (
                <button
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${objective === item.id ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`}
                  key={item.id}
                  onClick={() => setObjective(item.id)}
                  type="button"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${objective === item.id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {objectiveIcon[item.icon]}
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-950">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-500">{item.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepTitle title="Jaký je orientační rozpočet?" subtitle="Slouží k doporučení počtu ploch a médií." />
            <div className="grid gap-3 sm:grid-cols-2">
              {budgetTiers.map((tier) => (
                <button
                  className={`rounded-xl border p-4 text-left transition ${budget === tier.id ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`}
                  key={tier.id}
                  onClick={() => setBudget(tier.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-950">{tier.label}</p>
                    {tier.recommended && <Chip tone="green"><Sparkles aria-hidden size={12} /> Doporučeno</Chip>}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700">{tier.range}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{tier.surfaces}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <StepTitle title="Kdy má kampaň běžet?" subtitle="Termín ovlivní dostupnost ploch a kontrolu kolizí." />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Začátek kampaně
                <input className="input mt-1" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Konec kampaně
                <input className="input mt-1" onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-800 ring-1 ring-sky-200">
              <CalendarDays aria-hidden size={16} />
              Délka kampaně: <strong>{days} dní</strong>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <StepTitle title="Kde chceme být vidět?" subtitle="Vyberte města a lokality pro kampaň." />
            <div className="grid gap-3 sm:grid-cols-2">
              {regionOptions.map((region) => {
                const selected = regions.has(region.id);
                return (
                  <button
                    className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${selected ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`}
                    key={region.id}
                    onClick={() => toggle(regions, setRegions, region.id)}
                    type="button"
                  >
                    <span>
                      <span className="block font-semibold text-slate-950">{region.name}</span>
                      <span className="text-xs text-slate-500">{region.surfaces} dostupných ploch</span>
                    </span>
                    <span className={`grid h-6 w-6 place-items-center rounded-full border ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300'}`}>
                      {selected && <Check aria-hidden size={14} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <StepTitle title="Koho chceme oslovit?" subtitle="Cílová skupina zpřesní automatická doporučení ploch." />
            <div className="flex flex-wrap gap-2">
              {audienceOptions.map((audience) => {
                const selected = audiences.has(audience.id);
                return (
                  <button
                    className={`rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`}
                    key={audience.id}
                    onClick={() => toggle(audiences, setAudiences, audience.id)}
                    type="button"
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-950">
                      {selected && <Check aria-hidden size={15} />}
                      {audience.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{audience.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <StepTitle title="Výběr médií" subtitle="Vyberte plochy podle preferovaného způsobu." />
            <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600">
              {mediaModes.map((mode) => (
                <button
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${mediaMode === mode.key ? 'bg-slate-950 text-white' : 'hover:bg-slate-100'}`}
                  key={mode.key}
                  onClick={() => setMediaMode(mode.key)}
                  type="button"
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>

            {mediaMode === 'map' && (
              <div>
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200">
                  <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                  <div className="relative grid h-72 place-items-center">
                    <p className="absolute left-4 top-4 rounded-lg bg-white/80 px-2 py-1 text-xs font-medium text-slate-600">Moravskoslezský kraj</p>
                    {autoSuggestions.map((sug, index) => {
                      const selected = suggestions.has(sug.id);
                      const positions = [
                        { left: '28%', top: '55%' },
                        { left: '64%', top: '68%' },
                        { left: '46%', top: '38%' },
                        { left: '38%', top: '24%' },
                        { left: '58%', top: '50%' },
                      ];
                      return (
                        <button
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          key={sug.id}
                          onClick={() => toggle(suggestions, setSuggestions, sug.id)}
                          style={positions[index % positions.length]}
                          title={`${sug.code} · ${sug.city}`}
                          type="button"
                        >
                          <span className={`grid h-8 w-8 place-items-center rounded-full text-white shadow-md ring-2 transition ${selected ? `${TONE_CLASSES[sug.tone].bg} ring-white scale-110` : 'bg-slate-400 ring-white/70 hover:bg-slate-500'}`}>
                            <MapPin aria-hidden size={16} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-500">Klikněte na značky pro přidání ploch. Vybráno: <strong className="text-slate-900">{suggestions.size}</strong></p>
              </div>
            )}

            {mediaMode === 'list' && (
              <div className="space-y-3">
                {mediaOptions.map((media) => {
                  const qty = quantities[media.key] ?? 0;
                  return (
                    <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3" key={media.key}>
                      <img alt={media.name} className="h-14 w-16 shrink-0 rounded-lg object-cover" src={media.image || '/placeholder.svg'} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <ToneDot tone={media.tone} />
                          <p className="font-semibold text-slate-950">{media.name}</p>
                        </div>
                        <p className="text-xs text-slate-500">{media.description} · {media.available} volných</p>
                        <p className="text-xs text-slate-400">{formatCzk(media.pricePerSurface)} / plocha · zásah {formatNumber(media.reachPerSurface)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50" onClick={() => setQty(media.key, -1)} type="button" aria-label="Ubrat">
                          <Minus aria-hidden size={15} />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-slate-950">{qty}</span>
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50" onClick={() => setQty(media.key, 1)} type="button" aria-label="Přidat">
                          <Plus aria-hidden size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mediaMode === 'package' && (
              <div className="grid gap-3 md:grid-cols-3">
                {recommendedPackages.map((pkg) => {
                  const selected = packageId === pkg.id;
                  return (
                    <button
                      className={`flex flex-col rounded-xl border p-4 text-left transition ${selected ? 'border-slate-950 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`}
                      key={pkg.id}
                      onClick={() => setPackageId(pkg.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-950">{pkg.name}</p>
                        {pkg.recommended && <Chip tone="green">Top</Chip>}
                      </div>
                      <p className="mt-1 text-xs leading-snug text-slate-500">{pkg.tagline}</p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{formatCzk(pkg.price)}</p>
                      <p className="text-xs text-slate-500">{pkg.surfaces} ploch · zásah {formatNumber(pkg.reach)}</p>
                      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                        {pkg.mix.map((item) => (
                          <div className="flex items-center gap-2 text-xs text-slate-600" key={item.name}>
                            <ToneDot tone={item.tone} />
                            <span className="flex-1">{item.name}</span>
                            <span className="font-semibold text-slate-800">{item.count}×</span>
                          </div>
                        ))}
                      </div>
                      {selected && (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-950">
                          <Check aria-hidden size={14} /> Vybráno
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {mediaMode === 'auto' && (
              <div>
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800 ring-1 ring-indigo-200">
                  <Sparkles aria-hidden size={16} />
                  Návrhy generované na základě cíle, rozpočtu, regionu a cílové skupiny.
                </div>
                <div className="space-y-2.5">
                  {autoSuggestions.map((sug) => {
                    const selected = suggestions.has(sug.id);
                    return (
                      <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${selected ? 'border-slate-950 bg-slate-50' : 'border-slate-200'}`} key={sug.id}>
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white ${TONE_CLASSES[sug.tone].bg}`}>
                          <MapPin aria-hidden size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-950">{sug.code} · {sug.mediaType}</p>
                          <p className="truncate text-xs text-slate-500">{sug.city}, {sug.locality} — {sug.reason}</p>
                          <p className="text-xs text-slate-400">Zásah {formatNumber(sug.reach)} · {formatCzk(sug.price)}</p>
                        </div>
                        <button
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${selected ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                          onClick={() => toggle(suggestions, setSuggestions, sug.id)}
                          type="button"
                        >
                          {selected ? 'Přidáno' : 'Přidat'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-300 enabled:hover:bg-slate-50 disabled:opacity-40"
            disabled={step === 0}
            onClick={() => setStep((prev) => Math.max(0, prev - 1))}
            type="button"
          >
            <ArrowLeft aria-hidden size={16} /> Zpět
          </button>
          {isLast ? (
            <Link className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800" href="/sales/planner">
              Pokračovat na plánování <ArrowRight aria-hidden size={16} />
            </Link>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => setStep((prev) => Math.min(wizardSteps.length - 1, prev + 1))}
              type="button"
            >
              Pokračovat <ArrowRight aria-hidden size={16} />
            </button>
          )}
        </div>
      </section>

      {/* Live summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Target aria-hidden className="text-sky-600" size={16} />
            Souhrn návrhu
          </h3>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryRow label="Klient" value={client.name} />
            <SummaryRow label="Cíl" value={campaignObjectives.find((item) => item.id === objective)?.title ?? '-'} />
            <SummaryRow label="Termín" value={`${days} dní`} />
            <SummaryRow label="Regiony" value={`${regions.size} měst`} />
            <SummaryRow label="Cílové skupiny" value={`${audiences.size}`} />
          </dl>
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Vybrané plochy</span>
              <span className="font-semibold text-slate-950">{selection.surfaces}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Odhad zásahu</span>
              <span className="font-semibold text-slate-950">{formatNumber(selection.reach)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Odhad ceny</span>
              <span className="text-lg font-bold tracking-tight text-slate-950">{formatCzk(selection.price)}</span>
            </div>
            <p className="text-[11px] text-slate-400">Bez DPH, orientační cena před finální kalkulací.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
