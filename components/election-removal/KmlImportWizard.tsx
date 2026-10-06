'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Clock,
  MapPin,
  Calendar,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import type { ElectionRemovalMediaType } from '@prisma/client';
import {
  DEFAULT_MEDIA_SERVICE_MINUTES,
  ELECTION_REMOVAL_MEDIA_LABELS,
} from '@/lib/election-removal/constants';
import type { KmlParseResult, ParsedKmlLayer, ParsedKmlPoint } from '@/lib/election-removal/kml-parser';

interface LayerMappingState {
  layerName: string;
  mediaType: ElectionRemovalMediaType;
  serviceMinutes: number;
}

export function KmlImportWizard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Wizard steps: 'upload' -> 'configure' -> 'confirming'
  const [step, setStep] = useState<'upload' | 'configure'>('upload');

  // File & Parse State
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<KmlParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);

  // Campaign Form State
  const [campaignName, setCampaignName] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Layer mapping adjustments: Map<layerName, LayerMappingState>
  const [layerMappings, setLayerMappings] = useState<Record<string, LayerMappingState>>({});

  // Point filter in configure step
  const [selectedLayerFilter, setSelectedLayerFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Saving state
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Handle file selection and parsing
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsParsing(true);
    setParseError(null);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/election-removal/kml/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se zpracovat KML soubor.');
      }

      const parsed: KmlParseResult = data.parseResult;
      setParseResult(parsed);
      setCampaignName(parsed.suggestedCampaignName || file.name.replace(/\.[^/.]+$/, ''));

      // Initialize layer mappings from parsed suggestions
      const initialMappings: Record<string, LayerMappingState> = {};
      parsed.layers.forEach((layer) => {
        initialMappings[layer.name] = {
          layerName: layer.name,
          mediaType: layer.detectedMediaType,
          serviceMinutes: layer.defaultServiceMinutes,
        };
      });
      setLayerMappings(initialMappings);

      setStep('configure');
    } catch (err: any) {
      setParseError(err.message || 'Nastala chyba při zpracování souboru.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Update a layer's mapped media type
  const handleLayerMediaTypeChange = (layerName: string, newMediaType: ElectionRemovalMediaType) => {
    setLayerMappings((prev) => {
      const current = prev[layerName];
      const defaultMinutes = DEFAULT_MEDIA_SERVICE_MINUTES[newMediaType] ?? 10;
      return {
        ...prev,
        [layerName]: {
          ...current,
          mediaType: newMediaType,
          serviceMinutes: defaultMinutes,
        },
      };
    });
  };

  // Update a layer's service minutes
  const handleLayerMinutesChange = (layerName: string, minutes: number) => {
    const safeMinutes = Math.max(1, Math.min(180, Math.floor(minutes || 1)));
    setLayerMappings((prev) => {
      const current = prev[layerName];
      return {
        ...prev,
        [layerName]: {
          ...current,
          serviceMinutes: safeMinutes,
        },
      };
    });
  };

  // Compute points adjusted with manager's layer mappings
  const adjustedPoints = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.points.map((pt) => {
      const mapping = layerMappings[pt.layerName];
      const mediaType = mapping ? mapping.mediaType : pt.mediaType;
      const baseMinutes = mapping ? mapping.serviceMinutes : pt.serviceMinutes;
      const totalMinutes = baseMinutes * pt.quantity;

      return {
        ...pt,
        mediaType,
        serviceMinutes: totalMinutes,
      };
    });
  }, [parseResult, layerMappings]);

  // Filtered points for table display
  const displayedPoints = useMemo(() => {
    return adjustedPoints.filter((pt) => {
      const matchesLayer = selectedLayerFilter === 'ALL' || pt.layerName === selectedLayerFilter;
      const matchesSearch =
        !searchTerm ||
        pt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pt.layerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pt.description && pt.description.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesLayer && matchesSearch;
    });
  }, [adjustedPoints, selectedLayerFilter, searchTerm]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    let validCount = 0;
    let invalidCount = 0;
    let outsideCzechCount = 0;
    let totalMinutes = 0;

    adjustedPoints.forEach((pt) => {
      if (pt.isValid) {
        validCount++;
        totalMinutes += pt.serviceMinutes;
        if (pt.isOutsideCzechBounds) outsideCzechCount++;
      } else {
        invalidCount++;
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return {
      total: adjustedPoints.length,
      validCount,
      invalidCount,
      outsideCzechCount,
      totalMinutes,
      formattedTime: `${hours} h ${mins} min`,
    };
  }, [adjustedPoints]);

  // Final submission: Create campaign & bulk insert points
  const handleSubmit = async () => {
    if (!campaignName.trim()) {
      setSaveError('Zadejte prosím název kampaně.');
      return;
    }

    if (aggregateStats.validCount === 0) {
      setSaveError('Kampaň neobsahuje žádné platné body k importu.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const validPointsPayload = adjustedPoints
        .filter((pt) => pt.isValid)
        .map((pt) => ({
          name: pt.name,
          description: pt.description,
          layerName: pt.layerName,
          mediaType: pt.mediaType,
          latitude: pt.latitude,
          longitude: pt.longitude,
          quantity: pt.quantity,
          serviceMinutes: pt.serviceMinutes,
        }));

      const res = await fetch('/api/election-removal/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim(),
          description: description.trim() || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
          kmlFileName: fileName,
          mediaDefaults: { layerMappings },
          points: validPointsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se uložit kampaň.');
      }

      startTransition(() => {
        router.push(`/election-removal/${data.campaignId}`);
      });
    } catch (err: any) {
      setSaveError(err.message || 'Chyba při ukládání volební kampaně.');
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card space-y-6 p-8 border-2 border-dashed border-slate-200 hover:border-sky-300 transition-colors">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center text-center py-10 space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Nahrát KML export z Google My Maps
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-lg mx-auto">
                Přetáhněte sem soubor <code>.kml</code> vyexportovaný z Vaší Google mapy, nebo klikněte na tlačítko níže pro výběr.
              </p>
            </div>

            <label className="btn btn-primary cursor-pointer mt-2 inline-flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Vybrat KML soubor</span>
              <input
                type="file"
                accept=".kml,application/vnd.google-earth.kml+xml,text/xml"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={isParsing}
              />
            </label>

            {isParsing && (
              <div className="flex items-center gap-2 text-sm text-sky-700 animate-pulse mt-4">
                <Clock className="w-4 h-4 animate-spin" />
                <span>Zpracovávám a analyzuji KML data...</span>
              </div>
            )}

            {parseError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-4 rounded-xl max-w-md w-full flex items-start gap-2 text-left">
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Chyba importu KML</p>
                  <p>{parseError}</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-6 bg-slate-50/50 -mx-8 -mb-8 p-6 rounded-b-xl">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-500" />
              Pravidla a chování importu
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>
                <strong>Každý bod v KML = 1 fyzické médium:</strong> Body se stejnými GPS souřadnicemi nebudou sloučeny.
              </li>
              <li>
                <strong>Vrstvy mapy určují typ média:</strong> Názvy vrstev v KML se automaticky namapují na Áčka, Towery, Bannery atd.
              </li>
              <li>
                <strong>Možnost úpravy před importem:</strong> V dalším kroku můžete typy médií i servisní časy jednotlivých vrstev upravit.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Configure & Review */}
      {step === 'configure' && parseResult && (
        <div className="space-y-6">
          {/* Top card: Campaign Details */}
          <div className="card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                  Krok 2 ze 2
                </span>
                <h2 className="text-xl font-bold text-slate-900">
                  Nastavení a revize volební kampaně
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Soubor: <strong>{fileName}</strong></span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Název kampaně *
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="např. Senátní volby 2026 - Ostrava"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Plánovaný termín
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Poznámka ke kampani (volitelná)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Instrukce pro týmy, sklad pro odevzdání nosičů, specifika lokality..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section: Layer & Media Type Mapping */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-600" />
                  Mapování vrstev na typy médií a servisní časy
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Zkontrolujte navržené typy médií pro každou KML vrstvu. Změna se ihned projeví u všech bodů v dané vrstvě.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">Vrstva z KML</th>
                    <th className="py-2.5 px-3 text-center">Počet bodů</th>
                    <th className="py-2.5 px-3">Typ média (v SeePoint OS)</th>
                    <th className="py-2.5 px-3 text-right">Čas demontáže (min/ks)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseResult.layers.map((layer) => {
                    const currentMapping = layerMappings[layer.name] || {
                      mediaType: layer.detectedMediaType,
                      serviceMinutes: layer.defaultServiceMinutes,
                    };

                    return (
                      <tr key={layer.name} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {layer.name}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            {layer.pointCount} ks
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={currentMapping.mediaType}
                            onChange={(e) =>
                              handleLayerMediaTypeChange(
                                layer.name,
                                e.target.value as ElectionRemovalMediaType
                              )
                            }
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                          >
                            {(
                              Object.keys(
                                ELECTION_REMOVAL_MEDIA_LABELS
                              ) as ElectionRemovalMediaType[]
                            ).map((type) => (
                              <option key={type} value={type}>
                                {ELECTION_REMOVAL_MEDIA_LABELS[type]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={currentMapping.serviceMinutes}
                              onChange={(e) =>
                                handleLayerMinutesChange(
                                  layer.name,
                                  parseInt(e.target.value, 10)
                                )
                              }
                              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-right focus:ring-2 focus:ring-sky-500 focus:outline-none"
                            />
                            <span className="text-xs text-slate-500">min</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Points Preview & GPS Checks */}
          <div className="card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-sky-600" />
                  Náhled importovaných bodů a GPS kontrola
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Každý řádek představuje samostatný bod demontáže. Body se stejnou GPS jsou zachovány odděleně.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedLayerFilter}
                  onChange={(e) => setSelectedLayerFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:outline-none"
                >
                  <option value="ALL">Všechny vrstvy ({adjustedPoints.length})</option>
                  {parseResult.layers.map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name} ({l.pointCount})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Hledat bod..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-36 sm:w-48 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Název bodu</th>
                    <th className="py-2.5 px-3">Vrstva</th>
                    <th className="py-2.5 px-3">Typ média</th>
                    <th className="py-2.5 px-3">GPS</th>
                    <th className="py-2.5 px-3 text-center">Stav GPS</th>
                    <th className="py-2.5 px-3 text-right">Čas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedPoints.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Žádné body neodpovídají zadanému filtru.
                      </td>
                    </tr>
                  ) : (
                    displayedPoints.map((pt, idx) => (
                      <tr
                        key={pt.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          !pt.isValid ? 'bg-rose-50/40' : pt.isOutsideCzechBounds ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-semibold text-slate-900">{pt.name}</p>
                          {pt.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-1">
                              {pt.description}
                            </p>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-medium">
                          {pt.layerName}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                            {ELECTION_REMOVAL_MEDIA_LABELS[pt.mediaType] || pt.mediaType}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                          {pt.isValid ? (
                            <a
                              href={`https://www.google.com/maps?q=${pt.latitude},${pt.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-600 hover:underline inline-flex items-center gap-1"
                              title="Zobrazit na Google Maps"
                            >
                              <span>
                                {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                              </span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <span className="text-rose-500">Neplatné</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {pt.isValid ? (
                            pt.isOutsideCzechBounds ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                                title="Souřadnice leží mimo geografický rámeček České republiky."
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Mimo ČR
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Platné
                              </span>
                            )
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                              title={pt.validationError}
                            >
                              <XCircle className="w-3 h-3" />
                              Chyba
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-700">
                          {pt.serviceMinutes} min
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Bar: Summary & Confirmation */}
          <div className="card p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Celkem bodů
                </p>
                <p className="text-xl font-bold text-white">
                  {aggregateStats.total} ks
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  K importu
                </p>
                <p className="text-xl font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {aggregateStats.validCount} ks
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Mimo ČR (varování)
                </p>
                <p className="text-xl font-bold text-amber-400">
                  {aggregateStats.outsideCzechCount}
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Celkový odhad práce
                </p>
                <p className="text-xl font-bold text-sky-400 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {aggregateStats.formattedTime}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                Nahrát jiný KML
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving || isPending || aggregateStats.validCount === 0}
                className="btn btn-primary px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Ukládám kampaň...</span>
                  </>
                ) : (
                  <>
                    <span>Potvrdit a vytvořit kampaň</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {saveError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-4 rounded-xl flex items-center gap-2">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
