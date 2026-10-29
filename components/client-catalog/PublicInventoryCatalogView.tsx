'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MapPin,
  Calendar,
  Search,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Building2,
  Phone,
  Mail,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Printer,
  Layers,
  Filter,
  ArrowRight,
  ShieldCheck,
  Eye,
  Map,
  LayoutGrid,
  Share2,
  TrendingDown,
  Users,
} from 'lucide-react';
import { CatalogInteractiveMap } from './CatalogInteractiveMap';

export type CatalogSurfaceItem = {
  surfaceId: string;
  surfaceName: string;
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  carrierType: string;
  mediaType: string;
  city: string;
  street: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  size: string;
  orientation: string;
  directionDescription: string;
  monthlyPrice: number;
  printInstallPrice: number;
  minQuantity?: number;
  priceListName?: string | null;
  photoUrl: string | null;
  photoUrls?: string[];
  isAvailable: boolean;
  occupiedUntil: string | null;
  nextAvailableFrom: string | null;
};

type CatalogOrganization = {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
};

const MEDIA_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  BILLBOARD: { label: 'Billboardy', icon: '📐' },
  BIGBOARD: { label: 'Bigboardy', icon: '🏢' },
  CITYLIGHT: { label: 'Citylight (CLV)', icon: '💡' },
  CITY_POSTER: { label: 'City Poster (CLP)', icon: '🖼️' },
  PROMO_BENCH: { label: 'Reklamní lavičky', icon: '🪑' },
  PROMO_HORIZON: { label: 'Reklamní horizonty', icon: '↔️' },
  PROMO_TOWER: { label: 'Reklamní věže', icon: '🗼' },
  PROMO_MINITOWER: { label: 'Mini věže', icon: '🏛️' },
  FACADE: { label: 'Fasády & Štítové plachty', icon: '🧱' },
  LED_SCREEN: { label: 'LED obrazovky', icon: '📺' },
  BANNER: { label: 'Plachty & Bannery', icon: '🖨️' },
  OTHER: { label: 'Ostatní plochy', icon: '📍' },
};

function getInitialDates() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 3, 0));
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

function addMonthsToDateStr(dateFromStr: string, months: number): string {
  const d = new Date(`${dateFromStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateFromStr;
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 0));
  return end.toISOString().slice(0, 10);
}

export function PublicInventoryCatalogView() {
  const initialDates = useMemo(() => getInitialDates(), []);
  const [dateFrom, setDateFrom] = useState(initialDates.dateFrom);
  const [dateTo, setDateTo] = useState(initialDates.dateTo);
  const [orgParam, setOrgParam] = useState<string>('');

  const [organization, setOrganization] = useState<CatalogOrganization | null>(null);
  const [items, setItems] = useState<CatalogSurfaceItem[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [mediaTypes, setMediaTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedMediaType, setSelectedMediaType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);

  // Selected Cart & Configurator state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includePrintAndInstall, setIncludePrintAndInstall] = useState<boolean>(true);
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const [detailItem, setDetailItem] = useState<CatalogSurfaceItem | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);

  // View Mode: Cards vs Map
  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards');
  // Quick Presets: null | 'SHOPPING' | 'TRANSIT' | 'TRAFFIC'
  const [activePreset, setActivePreset] = useState<string | null>(null);
  // Share selection state
  const [copiedShare, setCopiedShare] = useState(false);

  // Checkout Form
  const [companyId, setCompanyId] = useState('');
  const [dic, setDic] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [note, setNote] = useState('');
  const [aresLoading, setAresLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Created Offer Result
  const [createdOffer, setCreatedOffer] = useState<{
    id: string;
    title: string;
    portalUrl: string | null;
    subtotal: string | null;
    totalWithTax: string | null;
    printInstallTotal: number;
    monthsCount: number;
    surfaceCount: number;
    dateFrom: string;
    dateTo: string;
  } | null>(null);

  // Initialize filters & selection from URL params (?city=...&mediaType=...&vyber=...&view=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get('city');
    const mediaParam = params.get('mediaType');
    const orgQ = params.get('org');
    const viewParam = params.get('view');
    const vyberParam = params.get('vyber') || params.get('ids');

    if (cityParam) setSelectedCity(cityParam);
    if (mediaParam) setSelectedMediaType(mediaParam);
    if (orgQ) setOrgParam(orgQ);
    if (viewParam === 'map') setViewMode('map');
    if (vyberParam) {
      const ids = vyberParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) setSelectedIds(ids);
    }
  }, []);

  const handleShareOffer = async () => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (selectedIds.length > 0) {
        url.searchParams.set('vyber', selectedIds.join(','));
      } else {
        url.searchParams.delete('vyber');
      }
      if (viewMode === 'map') {
        url.searchParams.set('view', 'map');
      } else {
        url.searchParams.delete('view');
      }
      await navigator.clipboard.writeText(url.toString());
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      // Fallback
    }
  };

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set('dateFrom', dateFrom);
      q.set('dateTo', dateTo);
      if (orgParam) q.set('org', orgParam);

      const res = await fetch(`/api/client/catalog?${q.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Katalog ploch se nepodařilo načíst.');
      }
      setOrganization(data.organization || null);
      setItems(data.items || []);
      setCities(data.cities || []);
      setMediaTypes(data.mediaTypes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání katalogu.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, orgParam]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const monthsCount = useMemo(() => {
    const d1 = new Date(`${dateFrom}T00:00:00.000Z`);
    const d2 = new Date(`${dateTo}T23:59:59.999Z`);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 < d1) return 1;
    const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    return Math.max(1, Math.round(days / 30));
  }, [dateFrom, dateTo]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (onlyAvailable && !item.isAvailable) return false;
      if (
        selectedCity &&
        item.city.trim().toLowerCase() !== selectedCity.trim().toLowerCase()
      ) {
        return false;
      }
      if (selectedMediaType && item.mediaType !== selectedMediaType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${item.carrierCode} ${item.surfaceName} ${item.carrierName} ${item.city} ${item.street} ${item.directionDescription}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Quick presets filter
      if (activePreset === 'SHOPPING') {
        const text = `${item.carrierCode} ${item.surfaceName} ${item.carrierName} ${item.street} ${item.directionDescription}`.toLowerCase();
        if (!/kaufland|avion|futurum|tesco|lidl|albert|billa|globus|baumax|oc\b|obchodn/i.test(text)) {
          return false;
        }
      } else if (activePreset === 'TRANSIT') {
        const text = `${item.carrierCode} ${item.surfaceName} ${item.carrierName} ${item.street} ${item.directionDescription}`.toLowerCase();
        if (!/mhd|zast[aá]vk|autobus|tramvaj|n[aá]dra[žz]|stanice/i.test(text)) {
          return false;
        }
      } else if (activePreset === 'TRAFFIC') {
        const text = `${item.carrierCode} ${item.surfaceName} ${item.carrierName} ${item.street} ${item.directionDescription}`.toLowerCase();
        if (!/rudn[aá]|m[ií]steck[aá]|plze[ňn]sk[aá]|v[yý][šs]kovick[aá]|t[řr][ií]d|k[řr][ií][žz]ovatk|most|okruh|fr\./i.test(text)) {
          return false;
        }
      }

      return true;
    });
  }, [items, onlyAvailable, selectedCity, selectedMediaType, searchQuery, activePreset]);

  const selectedSurfaces = useMemo(() => {
    const set = new Set(selectedIds);
    return items.filter((i) => set.has(i.surfaceId));
  }, [items, selectedIds]);

  const pricingSummary = useMemo(() => {
    const baseMonthlyRentSum = selectedSurfaces.reduce((acc, s) => acc + s.monthlyPrice, 0);
    const totalBaseRent = baseMonthlyRentSum * monthsCount;

    // Volume discount tiers:
    // 5+ surfaces: 10% discount on total rent
    // 3-4 surfaces: 5% discount on total rent
    // 1-2 surfaces: 0% discount
    const surfaceCount = selectedSurfaces.length;
    const discountPercent = surfaceCount >= 5 ? 0.1 : surfaceCount >= 3 ? 0.05 : 0;
    const discountAmount = Math.round(totalBaseRent * discountPercent);
    const discountedRent = totalBaseRent - discountAmount;

    const printInstallSum = includePrintAndInstall
      ? selectedSurfaces.reduce((acc, s) => acc + s.printInstallPrice, 0)
      : 0;

    const totalWithoutVat = discountedRent + printInstallSum;
    const totalWithVat = Math.round(totalWithoutVat * 1.21);

    // Cumulative estimated impressions per day and for total campaign
    const dailyImpressions = selectedSurfaces.reduce((sum, s) => {
      const type = (s.mediaType || s.carrierType || '').toUpperCase();
      if (type.includes('BILLBOARD') || type.includes('BIGBOARD')) return sum + 12000;
      if (type.includes('HORIZON') || type.includes('TOWER')) return sum + 10500;
      if (type.includes('POSTER') || type.includes('LIGHT') || type.includes('CLP') || type.includes('CLV')) return sum + 7500;
      if (type.includes('BENCH')) return sum + 4000;
      return sum + 5000;
    }, 0);
    const totalCampaignImpressions = dailyImpressions * monthsCount * 30;

    return {
      monthlyRentSum: baseMonthlyRentSum,
      totalRent: totalBaseRent,
      discountPercent,
      discountAmount,
      discountedRent,
      printInstallSum,
      totalWithoutVat,
      totalWithVat,
      dailyImpressions,
      totalCampaignImpressions,
    };
  }, [selectedSurfaces, monthsCount, includePrintAndInstall]);

  const toggleSurface = (surfaceId: string) => {
    setSelectedIds((prev) =>
      prev.includes(surfaceId) ? prev.filter((id) => id !== surfaceId) : [...prev, surfaceId]
    );
  };

  const handleLookupAres = async (icoInput?: string) => {
    const clean = (icoInput ?? companyId).replace(/\s+/g, '').trim();
    if (!/^\d{8}$/.test(clean)) return;
    setAresLoading(true);
    try {
      const res = await fetch(`/api/client/catalog?aresIco=${encodeURIComponent(clean)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.company) {
        if (data.company.companyName) setCompanyName(data.company.companyName);
        if (data.company.dic) setDic(data.company.dic);
        if (data.company.address) setBillingAddress(data.company.address);
        if (data.company.city) setBillingCity(data.company.city);
      }
    } catch {
      // Ignore ARES error
    } finally {
      setAresLoading(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setSubmitError('Vyberte prosím alespoň jednu reklamní plochu v katalogu.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/client/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: organization?.id || orgParam || undefined,
          dateFrom,
          dateTo,
          surfaceIds: selectedIds,
          includePrintAndInstall,
          companyName,
          companyId,
          dic,
          billingAddress,
          billingCity,
          contactName,
          contactEmail,
          contactPhone,
          campaignName,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.offer) {
        throw new Error(data.error || 'Vytvoření nabídky selhalo.');
      }
      setCreatedOffer(data.offer);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Chyba při odesílání rezervace.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdOffer) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto rounded-3xl border border-emerald-500/40 bg-slate-900/95 p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-10 h-10 shrink-0" />
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                Poptávka a předběžná rezervace přijata
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                Vaše nabídka je připravena!
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            Děkujeme! Váš výběr <strong>{createdOffer.surfaceCount} reklamních ploch</strong> na termín{' '}
            <strong>
              {new Date(createdOffer.dateFrom).toLocaleDateString('cs-CZ')} –{' '}
              {new Date(createdOffer.dateTo).toLocaleDateString('cs-CZ')}
            </strong>{' '}
            byl automaticky zapsán do systému <strong>{organization?.name || 'SeePOINT'}</strong>. Náš
            obchodní tým nyní zkontroluje harmonogram výlepů a pošle Vám finální potvrzení rezervace.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs">
            <div>
              <span className="text-slate-400 block">Počet vybraných ploch</span>
              <strong className="text-lg font-black text-white">
                {createdOffer.surfaceCount} ks ({createdOffer.monthsCount} měs.)
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">Pronájem ploch (bez DPH)</span>
              <strong className="text-lg font-black text-emerald-400">
                {Number(createdOffer.subtotal || 0).toLocaleString('cs-CZ')} Kč
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">
                {createdOffer.printInstallTotal > 0
                  ? 'Odhad výroby a instalace'
                  : 'Celkem vč. DPH'}
              </span>
              <strong className="text-lg font-black text-sky-300">
                {createdOffer.printInstallTotal > 0
                  ? `+ ${createdOffer.printInstallTotal.toLocaleString('cs-CZ')} Kč`
                  : `${Number(createdOffer.totalWithTax || 0).toLocaleString('cs-CZ')} Kč`}
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {createdOffer.portalUrl && (
              <a
                href={createdOffer.portalUrl}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3.5 text-sm shadow-lg transition"
              >
                <span>📄 Otevřít detail mé nabídky s mapou a PDF</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setCreatedOffer(null);
                setSelectedIds([]);
                void loadCatalog();
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-3.5 text-xs transition cursor-pointer"
            >
              <span>Zpět do katalogu ploch</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* TOP HERO & BRAND HEADER */}
      <header className="border-b border-slate-800/80 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Online Katalog & Samoobslužný konfigurátor kampaně</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {organization?.name || 'SeePOINT'} — Katalog reklamních ploch
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                Vyberte si volné reklamní nosiče na mapě či v přehledu, zvolte termín kampaně a sestavte si okamžitou kalkulaci s nezávaznou rezervací.
              </p>
            </div>

            {organization && (organization.phone || organization.email) && (
              <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    Potřebujete poradit s výběrem?
                  </span>
                  <div className="flex flex-wrap items-center gap-3 font-bold text-slate-200">
                    {organization.phone && (
                      <a
                        href={`tel:${organization.phone}`}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{organization.phone}</span>
                      </a>
                    )}
                    {organization.email && (
                      <a
                        href={`mailto:${organization.email}`}
                        className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{organization.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CAMPAIGN DATES & FILTERS BAR */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* Date From */}
              <div className="md:col-span-3">
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Začátek kampaně (OD)</span>
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-bold text-white"
                />
              </div>

              {/* Date To */}
              <div className="md:col-span-3">
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  <span>Konec kampaně (DO · {monthsCount} měs.)</span>
                </label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-bold text-white"
                />
              </div>

              {/* Quick Duration Buttons */}
              <div className="md:col-span-3">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">
                  Rychlá délka pronájmu:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '1 měs.', m: 1 },
                    { label: '3 měs.', m: 3 },
                    { label: '6 měs.', m: 6 },
                    { label: '12 měs.', m: 12 },
                  ].map((preset) => (
                    <button
                      key={preset.m}
                      type="button"
                      onClick={() => setDateTo(addMonthsToDateStr(dateFrom, preset.m))}
                      className={`rounded-xl py-2 text-xs font-extrabold border transition cursor-pointer ${
                        monthsCount === preset.m
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input */}
              <div className="md:col-span-3">
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Search className="w-3.5 h-3.5 text-purple-400" />
                  <span>Hledat ulici, město nebo kód</span>
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Např. Hlavní tř., Frýdek, BB-01…"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Quick Strategy Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-bold text-amber-400 mr-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rychlé filtry & balíčky:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setActivePreset(null);
                  setSelectedCity('');
                  setSelectedMediaType('');
                  setSearchQuery('');
                }}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  activePreset === null && !selectedMediaType && !searchQuery
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                🌟 Všechny lokality
              </button>
              <button
                type="button"
                onClick={() => setActivePreset(activePreset === 'SHOPPING' ? null : 'SHOPPING')}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  activePreset === 'SHOPPING'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
                title="Plochy u nákupních center Kaufland, OC Futurum, Avion Shopping Park, Tesco, Lidl..."
              >
                🛒 Nákupní centra & Supermarkety
              </button>
              <button
                type="button"
                onClick={() => setActivePreset(activePreset === 'TRANSIT' ? null : 'TRANSIT')}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  activePreset === 'TRANSIT'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
                title="Plochy a lavičky u zastávek MHD, autobusových a vlakových nádraží s vysokým pohybem pěších"
              >
                🚌 Zastávky MHD & Nádraží
              </button>
              <button
                type="button"
                onClick={() => setActivePreset(activePreset === 'TRAFFIC' ? null : 'TRAFFIC')}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  activePreset === 'TRAFFIC'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
                title="Plochy na hlavních tazích, okruzích a frekventovaných křižovatkách"
              >
                🚗 Dopravní tahy & Křižovatky
              </button>
            </div>

            {/* City & MediaType Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>Město:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCity('')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    selectedCity === ''
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  Všechna města
                </button>
                {cities.map((city) => {
                  const hasFreeInCity = items.some(
                    (i) =>
                      i.city.trim().toLowerCase() === city.trim().toLowerCase() &&
                      (!selectedMediaType || i.mediaType === selectedMediaType) &&
                      i.isAvailable
                  );
                  const active = selectedCity.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setSelectedCity(active ? '' : city)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                      }`}
                      title={
                        hasFreeInCity
                          ? `${city} – volné plochy k dispozici`
                          : `${city} – zobrazit plochy`
                      }
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          hasFreeInCity ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <span>{city}</span>
                      {active && hasFreeInCity && (
                        <span className="text-[10px] font-semibold text-sky-100/90">
                          · volné plochy
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>🟢 Zobrazit pouze volné ve zvoleném termínu</span>
              </label>
            </div>

            {mediaTypes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-purple-400" />
                  <span>Typ plochy:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMediaType('')}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    selectedMediaType === ''
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  Všechny formáty
                </button>
                {mediaTypes.map((mt) => {
                  const meta = MEDIA_TYPE_LABELS[mt] || { label: mt, icon: '📍' };
                  const active = selectedMediaType === mt;
                  return (
                    <button
                      key={mt}
                      type="button"
                      onClick={() => setSelectedMediaType(active ? '' : mt)}
                      className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT: INVENTORY GRID (LEFT 8 COLS) + STICKY OFFER BUILDER CART (RIGHT 4 COLS) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {error && (
          <div className="rounded-2xl border border-rose-800 bg-rose-950/70 p-4 text-xs font-bold text-rose-200 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 8 COLUMNS: SURFACE CARDS */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-emerald-300">
                  <span>🟢 Volné plochy k dispozici</span>
                </span>
                {selectedCity && (
                  <span className="text-slate-400">
                    Město: <strong className="text-sky-300">{selectedCity}</strong>
                  </span>
                )}
                {selectedMediaType && (
                  <span className="text-slate-400">
                    Formát:{' '}
                    <strong className="text-purple-300">
                      {MEDIA_TYPE_LABELS[selectedMediaType]?.label || selectedMediaType}
                    </strong>
                  </span>
                )}
                {activePreset && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                    <span>
                      {activePreset === 'SHOPPING'
                        ? '🛒 Nákupní centra'
                        : activePreset === 'TRANSIT'
                          ? '🚌 Zastávky MHD'
                          : '🚗 Dopravní tahy'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivePreset(null)}
                      className="ml-1 text-amber-400 hover:text-white cursor-pointer"
                      title="Zrušit tento balíček"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Switcher: Cards vs Map */}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-2xl shadow-md">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer ${
                      viewMode === 'cards'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Karty ({filteredItems.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer ${
                      viewMode === 'map'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>
                      Mapa ({filteredItems.filter((i) => typeof i.latitude === 'number' && typeof i.longitude === 'number').length})
                    </span>
                  </button>
                </div>

                {filteredItems.some((i) => i.isAvailable) && (
                  <button
                    type="button"
                    onClick={() => {
                      const batchSize =
                        selectedMediaType === 'PROMO_BENCH'
                          ? 6
                          : selectedMediaType === 'PROMO_HORIZON'
                            ? 10
                            : 6;
                      const availIds = filteredItems
                        .filter((i) => i.isAvailable)
                        .slice(0, batchSize)
                        .map((i) => i.surfaceId);
                      setSelectedIds((prev) => Array.from(new Set([...prev, ...availIds])));
                    }}
                    className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    + Balíček volných ({Math.min(6, filteredItems.filter((i) => i.isAvailable).length)})
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-slate-300">
                  Načítám volné reklamní plochy a systémový ceník…
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-3">
                <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-300">
                  Žádné plochy neodpovídají zvolenému filtru
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Zkuste zrušit filtr města nebo vybrat jiný formát reklamního nosiče.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCity('');
                    setSelectedMediaType('');
                    setSearchQuery('');
                    setActivePreset(null);
                    setOnlyAvailable(false);
                  }}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  Zobrazit všechny plochy
                </button>
              </div>
            ) : viewMode === 'map' ? (
              <CatalogInteractiveMap
                items={filteredItems}
                selectedIds={selectedIds}
                onToggleSurface={toggleSurface}
                onOpenDetail={(item) => {
                  setDetailItem(item);
                  setDetailPhotoIndex(0);
                }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.surfaceId);
                  const mediaMeta = MEDIA_TYPE_LABELS[item.mediaType] || MEDIA_TYPE_LABELS.OTHER;
                  const showPhoto = item.photoUrl && !failedPhotos[item.surfaceId];
                  const campaignTotalPrice = item.monthlyPrice * monthsCount;

                  return (
                    <div
                      key={item.surfaceId}
                      className={`group rounded-2xl border overflow-hidden transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-slate-900 ring-2 ring-emerald-500/30 shadow-lg'
                          : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        {/* Photo / Visual Header */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setDetailItem(item);
                            setDetailPhotoIndex(0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setDetailItem(item);
                              setDetailPhotoIndex(0);
                            }
                          }}
                          title="Zobrazit detail, fotografie a okolí nosiče"
                          className="relative h-44 bg-slate-950 overflow-hidden border-b border-slate-800/80 cursor-zoom-in"
                        >
                          {showPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photoUrl!}
                              alt={`${item.carrierCode} ${item.surfaceName}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              onError={() =>
                                setFailedPhotos((prev) => ({ ...prev, [item.surfaceId]: true }))
                              }
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/60 p-4 text-center">
                              <span className="text-3xl mb-1">{mediaMeta.icon}</span>
                              <span className="text-xs font-black text-slate-200">
                                {mediaMeta.label}
                              </span>
                              <span className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                {item.city}
                                {item.street ? ` · ${item.street}` : ''}
                              </span>
                            </div>
                          )}

                          {/* Top badges over photo */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                            <span className="rounded-lg bg-slate-950/90 backdrop-blur-xs border border-slate-700 px-2.5 py-1 text-[11px] font-black text-white">
                              {item.carrierCode}
                            </span>

                            <span
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold backdrop-blur-xs border ${
                                item.isAvailable
                                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80'
                                  : 'bg-amber-950/90 text-amber-300 border-amber-700/80'
                              }`}
                            >
                              {item.isAvailable
                                ? '🟢 Volná plocha'
                                : item.occupiedUntil
                                  ? `🟡 Obsazeno do ${new Date(item.occupiedUntil).toLocaleDateString('cs-CZ')}`
                                  : '🟡 Aktuálně obsazeno'}
                            </span>
                          </div>

                          {/* Bottom format & Street View link over photo */}
                          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2">
                            <span className="rounded-md bg-slate-950/85 px-2 py-0.5 text-[10px] font-bold text-slate-200 border border-slate-800">
                              {mediaMeta.icon} {item.size}
                            </span>
                            {typeof item.latitude === 'number' &&
                              typeof item.longitude === 'number' && (
                                <a
                                  href={`https://www.google.com/maps?q=&layer=c&cbll=${item.latitude},${item.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-950/90 hover:bg-sky-950 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-sky-300 transition"
                                  title="Zobrazit přesné místo na Google Street View"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Street View</span>
                                </a>
                              )}
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 space-y-2.5">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-400">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {item.city}
                                  {item.street ? ` · ${item.street}` : ''}
                                </span>
                              </div>
                              {item.minQuantity && item.minQuantity > 1 && (
                                <span className="rounded-md bg-indigo-950/80 border border-indigo-700/60 px-2 py-0.5 text-[10px] font-bold text-indigo-200 shrink-0">
                                  Ceník od {item.minQuantity} ks
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-black text-white mt-1 line-clamp-1">
                              {item.surfaceName || item.carrierName}
                            </h3>
                          </div>

                          {item.directionDescription && (
                            <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 p-2.5 space-y-1">
                              <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-300">
                                <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                                <span>Popis lokality & nosiče</span>
                              </div>
                              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                                {item.directionDescription}
                              </p>
                            </div>
                          )}

                          {!item.isAvailable && item.nextAvailableFrom && (
                            <div className="rounded-xl bg-amber-950/40 border border-amber-800/50 p-2 flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-amber-200">
                                Volné od{' '}
                                <strong>
                                  {new Date(item.nextAvailableFrom).toLocaleDateString('cs-CZ')}
                                </strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDateFrom(item.nextAvailableFrom!);
                                  setDateTo(addMonthsToDateStr(item.nextAvailableFrom!, monthsCount));
                                }}
                                className="text-amber-300 hover:text-white font-bold underline cursor-pointer shrink-0"
                              >
                                Posunout můj termín
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Price & Action Footer */}
                      <div className="p-4 pt-3 border-t border-slate-800/80 bg-slate-950/50 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-white">
                            {item.monthlyPrice.toLocaleString('cs-CZ')} Kč{' '}
                            <span className="text-[11px] font-semibold text-slate-400">
                              / měsíc
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Za {monthsCount} měs.:{' '}
                            <strong className="text-emerald-300">
                              {campaignTotalPrice.toLocaleString('cs-CZ')} Kč
                            </strong>{' '}
                            bez DPH
                          </div>
                          {item.printInstallPrice > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              + výroba a instalace {item.printInstallPrice.toLocaleString('cs-CZ')}{' '}
                              Kč / ks
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!item.isAvailable && !item.nextAvailableFrom}
                          onClick={() => toggleSurface(item.surfaceId)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition shrink-0 ${
                            !item.isAvailable && !item.nextAvailableFrom
                              ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                              : isSelected
                                ? 'bg-emerald-500 text-slate-950 shadow-md cursor-pointer'
                                : 'bg-slate-800 hover:bg-emerald-600 text-white border border-slate-700 cursor-pointer'
                          }`}
                        >
                          {!item.isAvailable && !item.nextAvailableFrom ? (
                            <span>Nedostupné</span>
                          ) : isSelected ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Vybráno</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              <span>Vybrat plochu</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DETAIL MODAL: photos, map and surroundings */}
          {detailItem && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
              onClick={() => setDetailItem(null)}
            >
              <div
                className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="absolute top-3 right-3 z-10 rounded-full bg-slate-950/90 border border-slate-700 px-3 py-1 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                >
                  ✕ Zavřít
                </button>

                {(() => {
                  const photos = detailItem.photoUrls ?? [];
                  const hasPhotos = photos.length > 0;
                  const currentIdx = Math.min(detailPhotoIndex, Math.max(photos.length - 1, 0));
                  const hasCoords =
                    typeof detailItem.latitude === 'number' &&
                    typeof detailItem.longitude === 'number';
                  return (
                    <div className="space-y-4 p-4 sm:p-6">
                      <div className="pr-20">
                        <div className="text-xs font-extrabold text-sky-400">
                          {detailItem.city}
                          {detailItem.street ? ` · ${detailItem.street}` : ''}
                        </div>
                        <h3 className="text-lg font-black text-white">
                          {detailItem.carrierCode} · {detailItem.surfaceName || detailItem.carrierName}
                        </h3>
                        <p className="text-xs text-slate-400">{detailItem.size}</p>
                      </div>

                      {hasPhotos ? (
                        <div className="space-y-2">
                          <div className="relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photos[currentIdx]}
                              alt={`${detailItem.carrierCode} fotografie ${currentIdx + 1}`}
                              className="w-full max-h-[55vh] object-contain"
                            />
                            {photos.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetailPhotoIndex((currentIdx - 1 + photos.length) % photos.length)
                                  }
                                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/80 border border-slate-700 w-9 h-9 text-white font-black cursor-pointer hover:bg-slate-800"
                                  aria-label="Předchozí fotografie"
                                >
                                  ‹
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDetailPhotoIndex((currentIdx + 1) % photos.length)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/80 border border-slate-700 w-9 h-9 text-white font-black cursor-pointer hover:bg-slate-800"
                                  aria-label="Další fotografie"
                                >
                                  ›
                                </button>
                              </>
                            )}
                          </div>
                          {photos.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto">
                              {photos.map((url, idx) => (
                                <button
                                  key={url}
                                  type="button"
                                  onClick={() => setDetailPhotoIndex(idx)}
                                  className={`shrink-0 overflow-hidden rounded-lg border-2 cursor-pointer ${
                                    idx === currentIdx ? 'border-emerald-400' : 'border-slate-800'
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`${url}&thumbnail=1`}
                                    alt={`Náhled ${idx + 1}`}
                                    className="h-14 w-20 object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center text-xs text-slate-400">
                          Fotografie nosiče zatím není k dispozici – podívejte se na mapu a Street View níže.
                        </div>
                      )}

                      {detailItem.directionDescription && (
                        <p className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 text-xs text-slate-300 leading-relaxed">
                          {detailItem.directionDescription}
                        </p>
                      )}

                      {hasCoords && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Okolí nosiče
                          </div>
                          <iframe
                            title={`Mapa ${detailItem.carrierCode}`}
                            src={`https://www.google.com/maps?q=${detailItem.latitude},${detailItem.longitude}&z=17&output=embed`}
                            className="w-full h-72 rounded-2xl border border-slate-800"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                          <a
                            href={`https://www.google.com/maps?q=&layer=c&cbll=${detailItem.latitude},${detailItem.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-extrabold text-white"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Otevřít Street View (pohled do okolí)</span>
                          </a>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
                        <div>
                          <div className="text-sm font-black text-white">
                            {detailItem.monthlyPrice.toLocaleString('cs-CZ')} Kč / měsíc
                          </div>
                          <div className="text-[11px] text-slate-400">bez DPH</div>
                        </div>
                        {(detailItem.isAvailable || detailItem.nextAvailableFrom) && (
                          <button
                            type="button"
                            onClick={() => {
                              toggleSurface(detailItem.surfaceId);
                              setDetailItem(null);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                          >
                            {selectedIds.includes(detailItem.surfaceId)
                              ? 'Odebrat z nabídky'
                              : 'Přidat do nabídky'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* RIGHT 4 COLUMNS: STICKY SELF-SERVICE OFFER CONFIGURATOR */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-black text-white">Moje sestavená nabídka</h2>
                </div>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-black text-emerald-300">
                  {selectedSurfaces.length} ploch
                </span>
              </div>

              {selectedSurfaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center space-y-2">
                  <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-300">
                    Zatím nemáte vybranou žádnou plochu
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Klikněte na tlačítko <strong>„+ Vybrat plochu“</strong> u nosičů vlevo. Zde se
                    Vám okamžitě spočítá cena kampaně a můžete si plochy nezávazně rezervovat.
                  </p>
                </div>
              ) : (
                <>
                  {/* Selected surfaces list */}
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                    {selectedSurfaces.map((s) => (
                      <div
                        key={s.surfaceId}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">
                            {s.carrierCode} · {s.city}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {s.monthlyPrice.toLocaleString('cs-CZ')} Kč/měs. × {monthsCount} měs. ={' '}
                            <strong className="text-emerald-300">
                              {(s.monthlyPrice * monthsCount).toLocaleString('cs-CZ')} Kč
                            </strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSurface(s.surfaceId)}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                          title="Odebrat z výběru"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Share Selection URL button */}
                  <button
                    type="button"
                    onClick={handleShareOffer}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 hover:bg-slate-800 py-2 px-3 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    {copiedShare ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-extrabold">Odkaz na výběr zkopírován!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4 text-sky-400" />
                        <span>Sdílet tento výběr (zkopírovat odkaz)</span>
                      </>
                    )}
                  </button>

                  {/* Estimated Reach & Impressions */}
                  <div className="rounded-2xl border border-sky-800/50 bg-sky-950/30 p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-extrabold text-sky-300">
                      <Users className="w-4 h-4 text-sky-400" />
                      <span>Odhadovaný dosah kampaně</span>
                    </div>
                    <div className="flex items-baseline justify-between text-slate-300 pt-0.5">
                      <span>Denní frekvence očí:</span>
                      <strong className="text-white font-extrabold">
                        ~{pricingSummary.dailyImpressions.toLocaleString('cs-CZ')} kontaktů / den
                      </strong>
                    </div>
                    <div className="flex items-baseline justify-between text-slate-400 text-[11px]">
                      <span>Celkem za {monthsCount} měs.:</span>
                      <span className="text-sky-300 font-bold">
                        ~{pricingSummary.totalCampaignImpressions.toLocaleString('cs-CZ')} zhlédnutí
                      </span>
                    </div>
                  </div>

                  {/* Volume Discount Progress Banner */}
                  <div className="rounded-2xl border p-3 text-xs space-y-1 transition bg-slate-950/80 border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold flex items-center gap-1 text-slate-200">
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                        Množstevní sleva
                      </span>
                      {pricingSummary.discountPercent > 0 && (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                          -{(pricingSummary.discountPercent * 100).toFixed(0)} %
                        </span>
                      )}
                    </div>
                    {selectedSurfaces.length < 3 ? (
                      <p className="text-[11px] text-slate-400">
                        💡 Přidejte ještě{' '}
                        <strong className="text-emerald-300">{3 - selectedSurfaces.length}</strong>{' '}
                        {3 - selectedSurfaces.length === 1 ? 'plochu' : 'plochy'} a odemknete{' '}
                        <strong className="text-emerald-300">slevu 5 %</strong> na celou kampaň!
                      </p>
                    ) : selectedSurfaces.length < 5 ? (
                      <p className="text-[11px] text-slate-300">
                        🎉 Skvělé, máte slevu 5 %! Přidejte ještě{' '}
                        <strong className="text-emerald-300">{5 - selectedSurfaces.length}</strong>{' '}
                        {5 - selectedSurfaces.length === 1 ? 'plochu' : 'plochy'} pro maximální{' '}
                        <strong className="text-emerald-300">slevu 10 %</strong>!
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-400 font-bold">
                        🔥 Maximální množstevní sleva 10 % uplatněna na celou kampaň!
                      </p>
                    )}
                  </div>

                  {/* Optional Print & Installation Checkbox */}
                  <label className="flex items-start gap-2.5 rounded-2xl border border-amber-800/50 bg-amber-950/25 p-3 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includePrintAndInstall}
                      onChange={(e) => setIncludePrintAndInstall(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-500"
                    />
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-amber-300 flex items-center gap-1">
                        <Printer className="w-3.5 h-3.5" />
                        <span>Včetně tisku a odborné instalace</span>
                      </span>
                      <span className="text-[11px] text-slate-300 block">
                        Zajistíme výrobu plachet/plakátů a výlep na vybrané nosiče (+{' '}
                        {pricingSummary.printInstallSum.toLocaleString('cs-CZ')} Kč bez DPH).
                      </span>
                    </div>
                  </label>

                  {/* Price Totals Box */}
                  <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>
                        Základní nájem ({selectedSurfaces.length} ploch × {monthsCount} měs.):
                      </span>
                      <span className={pricingSummary.discountAmount > 0 ? 'line-through text-slate-500' : 'text-slate-200 font-bold'}>
                        {pricingSummary.totalRent.toLocaleString('cs-CZ')} Kč
                      </span>
                    </div>
                    {pricingSummary.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Množstevní sleva ({(pricingSummary.discountPercent * 100).toFixed(0)} %):</span>
                        <span>- {pricingSummary.discountAmount.toLocaleString('cs-CZ')} Kč</span>
                      </div>
                    )}
                    {includePrintAndInstall && (
                      <div className="flex justify-between text-slate-400">
                        <span>Tisk a instalace (orientačně):</span>
                        <strong className="text-amber-300">
                          {pricingSummary.printInstallSum.toLocaleString('cs-CZ')} Kč
                        </strong>
                      </div>
                    )}
                    <div className="border-t border-slate-800 pt-2 flex justify-between items-baseline">
                      <span className="font-bold text-white">Celkem bez DPH:</span>
                      <strong className="text-lg font-black text-emerald-400">
                        {pricingSummary.totalWithoutVat.toLocaleString('cs-CZ')} Kč
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Celkem vč. DPH (21 %):</span>
                      <span>{pricingSummary.totalWithVat.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                  </div>
                </>
              )}

              {/* Checkout Form */}
              <form onSubmit={handleSubmitOrder} className="space-y-3 pt-2 border-t border-slate-800">
                <div className="text-xs font-extrabold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  <span>Kam máme poslat nabídku a rezervaci?</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    IČO firmy (automaticky načte údaje z ARES)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={companyId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCompanyId(val);
                        if (/^\d{8}$/.test(val.replace(/\s+/g, ''))) {
                          void handleLookupAres(val);
                        }
                      }}
                      placeholder="Např. 12345678"
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => void handleLookupAres()}
                      disabled={aresLoading}
                      className="shrink-0 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-[11px] font-bold text-sky-300 cursor-pointer"
                    >
                      {aresLoading ? 'Načítám…' : 'ARES'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Název firmy / organizace *
                  </label>
                  <input
                    required
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Název společnosti s.r.o."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-semibold text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Kontaktní osoba *
                    </label>
                    <input
                      required
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Jan Novák"
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Telefon *
                    </label>
                    <input
                      required
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+420 777 ..."
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Váš e-mail (pro zaslání nabídky s mapou) *
                  </label>
                  <input
                    required
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="jan.novak@firma.cz"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Poznámka ke kampani (nepovinné)
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Např. propagace nové prodejny, požadavek na grafický návrh…"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white"
                  />
                </div>

                {submitError && (
                  <div className="rounded-xl bg-rose-950/80 border border-rose-800 p-2.5 text-xs font-semibold text-rose-200">
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || selectedSurfaces.length === 0}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black py-3.5 px-4 text-xs shadow-lg transition cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Vytvářím nabídku a předběžnou rezervaci…</span>
                    </>
                  ) : (
                    <>
                      <span>Nezávazně rezervovat a vytvořit nabídku</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Nezávazná poptávka – finální rezervaci Vám potvrdí obchodník.</span>
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
