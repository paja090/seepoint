'use client';

import { useState } from 'react';
import { Sparkles, Calendar, Clock, Target, Layers, MapPin, CheckCircle2, TrendingUp, Compass, ShieldCheck } from 'lucide-react';
import type { ProposalOffer, ProposalCampaignPhase } from '@/lib/offers/presentation';
import { MEDIA_TYPE_META, TONE_CLASSES } from '@/lib/offers/presentation';

const phaseMeta: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: 'purple' | 'blue' | 'green'; defaultTime: string }> = {
  LAUNCH: { icon: Target, tone: 'blue', defaultTime: 'Zahájení kampaně' },
  FREQUENCY: { icon: Compass, tone: 'purple', defaultTime: 'Průběh hlavní kampaně' },
  RETENTION: { icon: TrendingUp, tone: 'green', defaultTime: 'Dlouhodobý dopad & stabilizace' },
  EVENT: { icon: Calendar, tone: 'purple', defaultTime: 'Ohlášení & předprodej' },
  TEASER: { icon: Clock, tone: 'purple', defaultTime: '2–3 týdny před zahájením' },
  OPENING: { icon: Target, tone: 'blue', defaultTime: 'Hlavní kampaňové období' },
  FOLLOW_UP: { icon: TrendingUp, tone: 'green', defaultTime: 'Následné stabilizační období' },
  PLANNING: { icon: Layers, tone: 'blue', defaultTime: 'Příprava' },
  INSTALLATION: { icon: CheckCircle2, tone: 'green', defaultTime: 'Realizace' },
};

export function CampaignStrategyPhases({ offer }: { offer: ProposalOffer }) {
  const strategy = offer.campaignStrategy;
  const phases = offer.campaignPhases || [];
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleGenerateAiCopy() {
    if (!offer.id || offer.id === 'public-offer') return;
    try {
      setIsGenerating(true);
      setGenerateError(null);
      const res = await fetch(`/api/offers/${offer.id}/ai-copy`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generování selhalo');
      }
      window.location.reload();
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : 'Chyba při volání AI');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section aria-labelledby="campaign-strategy-heading" className="space-y-6">
      {/* 1. Header & AI Strategy Summary */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-950/80 px-3.5 py-1 text-xs font-black tracking-wide text-purple-300 shadow-sm">
                <Sparkles className="size-3.5 text-purple-400 animate-pulse" />
                <span>Strategický koncept kampaně na míru klienta</span>
              </div>
              {offer.id && offer.id !== 'public-offer' && (
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerateAiCopy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/50 bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 hover:text-white px-3 py-1 text-xs font-bold transition shadow-xs print:hidden disabled:opacity-50"
                  title="Vygenerovat nové přizpůsobené texty a strategii pomocí AI"
                >
                  <Sparkles className={`size-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'AI generuje...' : 'Navrhnout texty AI'}</span>
                </button>
              )}
            </div>

            <h2 id="campaign-strategy-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Průběh kampaně & Výběr pozic
            </h2>

            <p className="text-sm sm:text-base leading-relaxed text-slate-300 font-medium">
              {strategy?.summary || offer.intro || offer.rawOffer?.clientMessage || offer.rawOffer?.campaignGoal || 'Komplexní návrh venkovní kampaně sestavený s důrazem na maximální viditelnost, frekventované trasy a spádové zóny pro vaše zákazníky.'}
            </p>

            {generateError && (
              <p className="text-xs font-semibold text-rose-400">{generateError}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-300">
              {strategy?.city && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5">
                  <MapPin className="size-3.5 text-sky-400" />
                  Cílové město: <strong className="text-white">{strategy.city}</strong>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5">
                <Calendar className="size-3.5 text-emerald-400" />
                Období: <strong className="text-white">{offer.campaignFrom} – {offer.campaignTo} ({offer.campaignDays} dní)</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5">
                <ShieldCheck className="size-3.5 text-purple-400" />
                Ověřeno: <strong className="text-white">{offer.carriers.length} vybraných ploch</strong>
              </span>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-indigo-400/30 bg-indigo-950/60 p-4 lg:p-5 text-center sm:text-right backdrop-blur-xs space-y-1 self-start">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block">
              Zacílení a rozsah
            </span>
            <p className="text-2xl font-black text-white">{offer.stats.carriers} nosičů</p>
            <p className="text-xs font-medium text-slate-400">{offer.stats.mediaTypes} mediální typy</p>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-20 -bottom-20 size-72 rounded-full bg-purple-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-sky-600/10 blur-3xl" />
      </div>

      {/* 2. Three Campaign Phases Timeline */}
      {phases.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-950">
                Strategické pilíře & Harmonogram kampaně
              </h3>
              <p className="text-xs text-slate-500">
                Doporučený postup nasazení pro dosažení nejvyšší návratnosti a stabilizace zákazníků.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {phases.length} {phases.length < 5 ? 'strategické fáze' : 'strategických fází'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {phases.map((phaseItem: ProposalCampaignPhase, idx: number) => {
              const meta = phaseMeta[phaseItem.phase] || phaseMeta.OPENING;
              const Icon = meta.icon;
              const isTeaser = phaseItem.phase === 'TEASER';
              const isOpening = phaseItem.phase === 'OPENING';

              return (
                <div
                  key={phaseItem.name || idx}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md ${
                    isOpening
                      ? 'border-sky-300 bg-sky-50/50 ring-2 ring-sky-200'
                      : isTeaser
                      ? 'border-purple-200 bg-purple-50/40'
                      : 'border-emerald-200 bg-emerald-50/40'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`inline-flex items-center gap-2 rounded-xl p-2.5 ${
                        isOpening ? 'bg-sky-600 text-white' : isTeaser ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'
                      }`}>
                        <Icon className="size-4" />
                      </div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        Krok {idx + 1} z {phases.length}
                      </span>
                    </div>

                    <div>
                      <span className="inline-block rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200 mb-1.5 shadow-2xs">
                        ⏱️ {phaseItem.timeframe || meta.defaultTime}
                      </span>
                      <h4 className="text-base font-extrabold text-slate-950">
                        {phaseItem.name}
                      </h4>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-600 font-medium">
                      {phaseItem.description}
                    </p>
                  </div>

                  {phaseItem.recommendedMediaTypes && phaseItem.recommendedMediaTypes.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200/80">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Doporučené nosiče:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {phaseItem.recommendedMediaTypes.map((mType) => {
                          const mKey = mType as keyof typeof MEDIA_TYPE_META;
                          const mMeta = MEDIA_TYPE_META[mKey];
                          return (
                            <span
                              key={mType}
                              className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-slate-800 border border-slate-200 shadow-2xs"
                            >
                              {mMeta?.label || mType}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Why AI selected these positions */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700 ring-1 ring-purple-200">
            <Target className="size-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-950">
              Proč AI vybrala tyto konkrétní pozice a plochy
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Každá reklamní plocha v nabídce byla ověřena podle 4 klíčových parametrů efektivity.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-1.5">
            <span className="text-lg">🚦</span>
            <h4 className="text-sm font-extrabold text-slate-900">Dopravní tepny & Křižovatky</h4>
            <p className="text-xs leading-relaxed text-slate-600">
              Pozice umístěné na hlavních příjezdových tazích a u kruhových objezdů s vysokým denním průjezdem vozidel a MHD.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-1.5">
            <span className="text-lg">📍</span>
            <h4 className="text-sm font-extrabold text-slate-900">Geografická spádovost</h4>
            <p className="text-xs leading-relaxed text-slate-600">
              Plochy pokrývají rezidenční čtvrti i nákupní zóny, ze kterých přirozeně proudí zákazníci k vašemu objektu.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-1.5">
            <span className="text-lg">📅</span>
            <h4 className="text-sm font-extrabold text-slate-900">Ověřená 100% dostupnost</h4>
            <p className="text-xs leading-relaxed text-slate-600">
              Algoritmus zkontroloval stav obsazenosti v celém požadovaném termínu kampaně bez termínových kolizí.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-1.5">
            <span className="text-lg">👁️</span>
            <h4 className="text-sm font-extrabold text-slate-900">Přímý zorný úhel 24/7</h4>
            <p className="text-xs leading-relaxed text-slate-600">
              Vybrány nosiče s optimální velikostí a nerušenou čitelností pro řidiče i pěší ve dne i v noci.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
