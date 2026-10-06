'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OfferView } from '@/lib/offers/view-model';
import { NavigationSignVisualizer } from '@/components/navigation-documentation/NavigationSignVisualizer';
import { compressImageFile } from '@/lib/image-compress';
import { isRestrictedHighwayOr1stClassRoad, isOstravaRestrictedZone } from '@/lib/ai-offers/navigation-constraints';
import {
  CARRIER_PIN_COLORS,
  detectCarrierCategory,
  getPointPinColor,
  getPointPinVisual,
} from '@/lib/offers/navigation-carrier-types';
import type {
  ClientOption,
  DraftPoint,
  DraftTarget,
  NavigationWorkflowStep,
  PresentationSettings,
  CatalogRates,
} from './types';
import { TARGET_COLORS } from './types';
import { NavigationOfferStepHeader } from './NavigationOfferStepHeader';
import { NavigationOfferBasicsStep } from './NavigationOfferBasicsStep';
import { NavigationTargetsStep } from './NavigationTargetsStep';
import { NavigationMapStep } from './NavigationMapStep';
import { NavigationPricingStep } from './NavigationPricingStep';
import { NavigationOfferReviewStep } from './NavigationOfferReviewStep';
import { NavigationCommandBar } from './NavigationCommandBar';

export interface NavigationOfferCockpitProps {
  clients: ClientOption[];
  initialOffer?: OfferView;
  initialClientId?: string;
  organizationId?: string;
  initialMode?: 'LOCATION_SELECTION' | 'PRICED_QUOTE';
}

export function NavigationOfferCockpit({
  clients: initialClients,
  initialOffer,
  initialClientId,
  organizationId,
  initialMode,
}: NavigationOfferCockpitProps) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>(initialClients);

  // 1. Core Offer Basics
  const [clientId, setClientId] = useState(initialOffer?.clientId ?? initialClientId ?? '');
  const [title, setTitle] = useState(initialOffer?.title ?? 'Navigační kampaň');
  const [campaignName, setCampaignName] = useState(initialOffer?.campaignName ?? 'Navigační značení');
  const [city, setCity] = useState(initialOffer?.navigation?.city ?? 'Ostrava');
  const [validUntil, setValidUntil] = useState(initialOffer?.validUntil ?? '');
  const [dateFrom, setDateFrom] = useState((initialOffer?.campaignStrategy as Record<string, unknown> | null)?.dateFrom as string ?? '');
  const [dateTo, setDateTo] = useState((initialOffer?.campaignStrategy as Record<string, unknown> | null)?.dateTo as string ?? '');

  // 2. Proposal Mode (Fáze 1 vs Fáze 2)
  const defaultMode: 'LOCATION_SELECTION' | 'PRICED_QUOTE' =
    initialMode ||
    (initialOffer?.navigation?.proposalMode === 'PRICED_QUOTE' ? 'PRICED_QUOTE' : 'LOCATION_SELECTION');
  const [proposalMode, setProposalMode] = useState<'LOCATION_SELECTION' | 'PRICED_QUOTE'>(defaultMode);

  // 3. Workflow Steps
  const initialStep: NavigationWorkflowStep =
    initialMode === 'PRICED_QUOTE'
      ? 'PRICING_OR_REVIEW'
      : initialOffer?.navigation?.targets && initialOffer.navigation.targets.length > 0
      ? 'TARGETS'
      : 'BASICS';
  const [currentStep, setCurrentStep] = useState<NavigationWorkflowStep>(initialStep);

  // 4. Targets Setup
  const [targets, setTargets] = useState<DraftTarget[]>(() => {
    if (initialOffer?.navigation?.targets && initialOffer.navigation.targets.length > 0) {
      return initialOffer.navigation.targets.map((t, idx) => ({
        id: t.id || `target-${idx + 1}`,
        stableKey: t.stableKey || undefined,
        name: t.name || `Prodejna ${idx + 1}`,
        address: t.address || '',
        latitude: t.latitude || 49.8346,
        longitude: t.longitude || 18.282,
        note: t.note || '',
        photoUrl: t.photoUrl || null,
        color: (t as { color?: string }).color || TARGET_COLORS[idx % TARGET_COLORS.length],
      }));
    }
    if (initialOffer?.navigation?.targetName) {
      return [
        {
          id: 'target-1',
          stableKey: 'target-1',
          name: initialOffer.navigation.targetName,
          address: initialOffer.navigation.targetAddress || '',
          latitude: initialOffer.navigation.targetLatitude || 49.8346,
          longitude: initialOffer.navigation.targetLongitude || 18.282,
          note: initialOffer.navigation.targetNote || '',
          photoUrl: initialOffer.navigation.targetPhotoUrl || null,
          color: TARGET_COLORS[0],
        },
      ];
    }
    return [
      {
        id: 'target-1',
        stableKey: 'target-1',
        name: 'Prodejna 1',
        address: '',
        latitude: 49.8346,
        longitude: 18.282,
        color: TARGET_COLORS[0],
      },
    ];
  });

  // 5. Points Setup
  const [points, setPoints] = useState<DraftPoint[]>(() => {
    if (initialOffer?.navigation?.points && initialOffer.navigation.points.length > 0) {
      return initialOffer.navigation.points.map((p, idx) => ({
        id: p.id || `point-${idx + 1}`,
        stableKey: p.stableKey || undefined,
        label: p.label || `Navigační bod ${idx + 1}`,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address || '',
        navigationType: p.navigationType || 'Směrová tabule',
        variant: p.variant || (initialOffer.navigation?.city === 'Havířov' ? 'Havířov – atyp s horním půlkruhem' : '670 × 900 mm'),
        orientation: p.orientation || '',
        quantity: String(p.quantity || 1),
        unitPrice: String(p.unitPrice || '0'),
        framePrice: String(p.framePrice || '0'),
        productionPrice: String(p.productionPrice || '0'),
        installationPrice: String(p.installationPrice || '0'),
        removalPrice: String(p.removalPrice || '0'),
        internalNote: p.internalNote || '',
        clientNote: p.clientNote || '',
        targetId: p.targetId || p.navigationTargetId || targets[0]?.id,
        targetLatitude: p.targetLatitude != null ? p.targetLatitude : undefined,
        targetLongitude: p.targetLongitude != null ? p.targetLongitude : undefined,
        calculatedDistanceMeters: p.calculatedDistanceMeters || undefined,
        manualDistanceValue: p.manualDistanceValue != null ? String(p.manualDistanceValue) : '',
        manualDistanceUnit: p.manualDistanceUnit === 'KILOMETERS' ? 'KILOMETERS' : 'METERS',
        distanceSource: p.distanceSource === 'MANUAL' ? 'MANUAL' : 'CALCULATED',
        arrowDirectionEnum: (p.arrowDirectionEnum as DraftPoint['arrowDirectionEnum']) || 'STRAIGHT',
        routePolyline: p.routePolyline || undefined,
        pillarNumber: p.pillarNumber || '',
        pillarType: p.pillarType || '',
        sitePhotoId: p.sitePhotoId || undefined,
        sitePhotoUrl: p.sitePhotoUrl || undefined,
        visualizedPhotoUrl: p.visualizedPhotoUrl || undefined,
        color: p.color || undefined,
        isSelectedByClient: p.isSelectedByClient !== false,
      }));
    }
    return [];
  });

  // 6. Presentation Settings & Notes
  const rawPres = (initialOffer?.campaignStrategy as Record<string, unknown> | null)?.presentationSettings as Record<string, unknown> | null;
  const [presentationSettings, setPresentationSettings] = useState<PresentationSettings>({
    cityConfirmed: rawPres?.cityConfirmed === true,
    showGraphicProofBadge: rawPres?.showGraphicProofBadge !== false,
    showReferences: rawPres?.showReferences !== false,
    showRealizations: rawPres?.showRealizations !== false,
    showPartnershipGuarantee: rawPres?.showPartnershipGuarantee !== false,
    showAboutCompany: rawPres?.showAboutCompany !== false,
  });

  const [graphicArtworkUrl, setGraphicArtworkUrl] = useState(initialOffer?.navigation?.graphicArtworkUrl ?? '');
  const [includeGraphicProof, setIncludeGraphicProof] = useState(initialOffer?.navigation?.includeGraphicProof !== false);
  const [internalNote, setInternalNote] = useState(initialOffer?.internalNote ?? '');
  const [clientMessage, setClientMessage] = useState(initialOffer?.clientMessage ?? '');

  // 7. UI & Interaction state
  const [mode, setMode] = useState<'target' | 'point'>('point');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [recalculatingRoutes, setRecalculatingRoutes] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeVisualizerPointId, setActiveVisualizerPointId] = useState<string | null>(null);

  // Catalog default rates
  const [catalogDefaults, setCatalogDefaults] = useState<CatalogRates>({
    rentalPrice: '',
    framePrice: '',
    productionPrice: '',
    installationPrice: '',
    removalPrice: '',
  });

  // Load catalog price rules
  useEffect(() => {
    async function loadCatalog() {
      try {
        const resRules = await fetch('/api/offer-price-rules');
        let rental = '', frame = '', prod = '', inst = '', rem = '';
        if (resRules.ok) {
          const rules = await resRules.json() as Record<string, unknown>;
          if (rules.navigationAnnualRental != null) rental = String(rules.navigationAnnualRental);
          if (rules.navigationFrameProduction != null) frame = String(rules.navigationFrameProduction);
          if (rules.navigationSignProduction != null) prod = String(rules.navigationSignProduction);
          if (rules.navigationInstallation != null) inst = String(rules.navigationInstallation);
          if (rules.navigationRemoval != null) rem = String(rules.navigationRemoval);
        }
        setCatalogDefaults({
          rentalPrice: rental || '8000',
          framePrice: frame || '3500',
          productionPrice: prod || '2200',
          installationPrice: inst || '1500',
          removalPrice: rem || '800',
        });
      } catch {
        setCatalogDefaults({
          rentalPrice: '8000',
          framePrice: '3500',
          productionPrice: '2200',
          installationPrice: '1500',
          removalPrice: '800',
        });
      }
    }
    void loadCatalog();
  }, []);

  const selectedClient = clients.find((c) => c.id === clientId);

  // Apply catalog rates to all points
  function applyCatalogRatesToAllPoints() {
    setPoints((curr) =>
      curr.map((p) => ({
        ...p,
        unitPrice: catalogDefaults.rentalPrice,
        framePrice: catalogDefaults.framePrice,
        productionPrice: catalogDefaults.productionPrice,
        installationPrice: catalogDefaults.installationPrice,
        removalPrice: catalogDefaults.removalPrice,
      }))
    );
    setMessage('✓ Ceníkové sazby byly načteny pro všechny navigační body.');
    setHasUnsavedChanges(true);
  }

  // Reverse geocoding helper
  async function reverseGeocodeLocation(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!res.ok) return '';
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data[0].label || '';
      if (data?.label) return String(data.label);
      return '';
    } catch {
      return '';
    }
  }

  // Google Routes calculation
  async function fetchRouteInfo(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): Promise<{ calculatedDistanceMeters?: number; routePolyline?: string; routeDistanceMeters?: number }> {
    try {
      const res = await fetch('/api/navigation-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originLat: fromLat, originLng: fromLng, destLat: toLat, destLng: toLng }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && typeof data.distanceMeters === 'number') {
          const rounded = Math.max(50, Math.round(data.distanceMeters / 50) * 50);
          return {
            calculatedDistanceMeters: rounded,
            routeDistanceMeters: rounded,
            routePolyline: data.polyline || undefined,
          };
        }
      }
    } catch {
      /* fallback */
    }
    return {};
  }

  // Recalculate routes for all points
  async function recalculateAllRoutes(targetList = targets) {
    setRecalculatingRoutes(true);
    setMessage('Přepočítávám trasy ze všech bodů k cílovým prodejnám...');
    try {
      const updated = await Promise.all(
        points.map(async (p) => {
          const ptTarget = targetList.find((t) => t.id === p.targetId) || targetList[0];
          if (!ptTarget?.latitude || !ptTarget?.longitude) return p;
          const info = await fetchRouteInfo(p.latitude, p.longitude, ptTarget.latitude, ptTarget.longitude);
          return { ...p, ...info };
        })
      );
      setPoints(updated);
      setMessage('✓ Všechny trasy a vzdálenosti byly úspěšně přepočítány.');
      setHasUnsavedChanges(true);
    } catch {
      setMessage('Chyba při přepočtu tras.');
    } finally {
      setRecalculatingRoutes(false);
    }
  }

  // Add point on map click or button
  async function handleMapClick(lat: number, lng: number, passedAddress?: string) {
    if (mode === 'target') {
      const active = targets[0];
      if (active) {
        setTargets(targets.map((t) => (t.id === active.id ? { ...t, latitude: lat, longitude: lng, address: passedAddress || t.address } : t)));
        setMode('point');
      }
      return;
    }

    let addr = passedAddress;
    if (!addr) {
      addr = await reverseGeocodeLocation(lat, lng);
    }

    const streetPart = addr ? addr.split(',')[0]?.trim() : '';
    const isHeritage = isOstravaRestrictedZone(lat, lng, addr || '');
    const isHighway = isRestrictedHighwayOr1stClassRoad(addr || '');

    const nextIdx = points.length + 1;
    let autoLabel = `Navigační bod #${nextIdx}`;
    if (isHeritage) autoLabel = `⚠️ Památková zóna (${streetPart || 'centrum'})`;
    else if (isHighway) autoLabel = `⚠️ I. třída (${streetPart || 'hlavní tah'})`;
    else if (streetPart && !/č\.p\.|ostrava|česko/i.test(streetPart)) autoLabel = `Příjezd na ${streetPart}`;

    const defaultVariant = city === 'Havířov' ? 'Havířov – atyp s horním půlkruhem' : '670 × 900 mm';
    const ptTarget = targets[0];

    const newPoint: DraftPoint = {
      id: `point-${Date.now()}`,
      label: autoLabel,
      latitude: lat,
      longitude: lng,
      address: addr,
      navigationType: 'Směrová tabule',
      variant: defaultVariant,
      quantity: '1',
      unitPrice: catalogDefaults.rentalPrice || '0',
      framePrice: catalogDefaults.framePrice || '0',
      productionPrice: catalogDefaults.productionPrice || '0',
      installationPrice: catalogDefaults.installationPrice || '0',
      removalPrice: catalogDefaults.removalPrice || '0',
      targetId: ptTarget?.id,
      targetLatitude: ptTarget?.latitude,
      targetLongitude: ptTarget?.longitude,
      arrowDirectionEnum: 'STRAIGHT',
      isSelectedByClient: true,
    };

    if (ptTarget?.latitude && ptTarget?.longitude) {
      const routeInfo = await fetchRouteInfo(lat, lng, ptTarget.latitude, ptTarget.longitude);
      Object.assign(newPoint, routeInfo);
    }

    setPoints((curr) => [...curr, newPoint]);
    setHasUnsavedChanges(true);
  }

  function handleAddPoint() {
    const refLat = points[points.length - 1]?.latitude || targets[0]?.latitude || 49.8346;
    const refLng = points[points.length - 1]?.longitude || targets[0]?.longitude || 18.282;
    void handleMapClick(refLat + 0.001, refLng + 0.001);
  }

  async function handlePointMove(
    id: string,
    lat: number,
    lng: number,
    _dist?: number,
    _poly?: string,
    passedAddress?: string
  ) {
    let freshAddress = passedAddress;
    if (!freshAddress) {
      freshAddress = await reverseGeocodeLocation(lat, lng);
    }

    const currentPoint = points.find((p) => p.id === id);
    const ptTarget = targets.find((t) => t.id === currentPoint?.targetId) || targets[0];

    let routeInfo = {};
    if (ptTarget?.latitude && ptTarget?.longitude) {
      routeInfo = await fetchRouteInfo(lat, lng, ptTarget.latitude, ptTarget.longitude);
    }

    setPoints((curr) =>
      curr.map((p) =>
        p.id === id
          ? {
              ...p,
              latitude: lat,
              longitude: lng,
              ...(freshAddress ? { address: freshAddress } : {}),
              ...routeInfo,
            }
          : p
      )
    );
    setHasUnsavedChanges(true);
  }

  async function handleUploadSitePhoto(pointId: string, file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage('Fotografie musí být JPG, PNG nebo WebP do 5 MB.');
      return;
    }
    const persisted = initialOffer?.navigation?.points.some((p) => p.id === pointId);
    if (!persisted) {
      setMessage('Nejprve nabídku uložte jako koncept. Poté lze nahrát fotografie.');
      return;
    }

    try {
      const form = new FormData();
      form.set('file', file);
      form.set('navigationPointId', pointId);
      form.set('type', 'LOCATION');
      const res = await fetch('/api/photos', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.id || !data.url) throw new Error(data.error || 'Nahrání selhalo');

      setPoints((curr) =>
        curr.map((p) => (p.id === pointId ? { ...p, sitePhotoId: data.id, sitePhotoUrl: data.url } : p))
      );
      setMessage('✓ Fotografie sloupu byla úspěšně nahrána.');
      setHasUnsavedChanges(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Chyba při nahrávání fotografie.');
    }
  }

  // Canonical save method
  async function handleSave() {
    const primaryTarget = targets[0];
    if (!primaryTarget || !primaryTarget.latitude || !primaryTarget.longitude) {
      setMessage('Nejprve označte alespoň jedno cílové místo (prodejnu) v mapě.');
      setCurrentStep('TARGETS');
      return;
    }
    if (!primaryTarget.name.trim()) {
      setMessage('Zadejte název cílového místa / prodejny.');
      setCurrentStep('TARGETS');
      return;
    }
    if (points.length === 0) {
      setMessage('Přidejte alespoň jeden navigační bod trasy.');
      setCurrentStep('MAP_POINTS');
      return;
    }

    // Price validation strictly for PRICED_QUOTE mode
    if (
      proposalMode === 'PRICED_QUOTE' &&
      points.some((p) =>
        [p.unitPrice, p.framePrice, p.productionPrice, p.installationPrice, p.removalPrice].some(
          (price) => price.trim() === '' || !Number.isFinite(Number(price)) || Number(price) < 0
        )
      )
    ) {
      setMessage('Doplňte vlastní ceny u všech bodů. Pokud se položka neúčtuje, zadejte výslovně 0.');
      setCurrentStep('PRICING_OR_REVIEW');
      return;
    }

    setSaving(true);
    setMessage('');

    const body = {
      clientId,
      title,
      campaignName,
      validUntil,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      contactPerson: selectedClient?.contactPerson,
      contactEmail: selectedClient?.email,
      contactPhone: selectedClient?.phone,
      city,
      targetName: primaryTarget.name,
      targetAddress: primaryTarget.address,
      targetLatitude: primaryTarget.latitude,
      targetLongitude: primaryTarget.longitude,
      targetNote: primaryTarget.note || '',
      targetPhotoUrl: primaryTarget.photoUrl || null,
      targets: targets.map((t) => ({
        id: t.id,
        name: t.name,
        address: t.address,
        latitude: t.latitude,
        longitude: t.longitude,
        note: t.note,
        photoUrl: t.photoUrl,
        color: t.color,
      })),
      internalNote,
      clientMessage,
      proposalMode,
      graphicArtworkUrl,
      includeGraphicProof,
      presentationSettings: {
        cityConfirmed: Boolean(city.trim()),
        showGraphicProofBadge: presentationSettings.showGraphicProofBadge,
        showReferences: presentationSettings.showReferences,
        showRealizations: presentationSettings.showRealizations,
        showPartnershipGuarantee: presentationSettings.showPartnershipGuarantee,
        showAboutCompany: presentationSettings.showAboutCompany,
      },
      points: points.map((p) => {
        const effectiveTargetId = p.targetId || targets[0]?.id;
        const ptTarget = targets.find((t) => t.id === effectiveTargetId) || targets[0];
        return {
          ...p,
          targetId: effectiveTargetId,
          navigationTargetId: effectiveTargetId,
          targetLatitude: ptTarget?.latitude,
          targetLongitude: ptTarget?.longitude,
        };
      }),
    };

    try {
      const res = await fetch(
        initialOffer?.id ? `/api/offers/navigation/${initialOffer.id}` : '/api/offers/navigation',
        {
          method: initialOffer?.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json() as { id?: string; error?: string; token?: string };
      if (!res.ok || !data.id) {
        throw new Error(data.error || 'Uložení navigační nabídky selhalo.');
      }

      setHasUnsavedChanges(false);
      setMessage('✓ Navigační nabídka byla úspěšně uložena.');

      if (!initialOffer?.id && data.id) {
        router.push(`/offers/${data.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Chyba při ukládání nabídky.');
    } finally {
      setSaving(false);
    }
  }

  // Step transitions
  const stepOrder: NavigationWorkflowStep[] = ['BASICS', 'TARGETS', 'MAP_POINTS', 'PRICING_OR_REVIEW'];
  const currentIndex = stepOrder.indexOf(currentStep);

  function handleNextStep() {
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  }

  function handlePrevStep() {
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Step Header & Prominent Mode Selector */}
      <NavigationOfferStepHeader
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        proposalMode={proposalMode}
        onProposalModeChange={(newMode) => {
          setProposalMode(newMode);
          setHasUnsavedChanges(true);
        }}
        targetCount={targets.length}
        pointCount={points.length}
        hasSelectionSubmitted={initialOffer?.navigation?.selectionSubmitted === true}
      />

      {/* Step 1: Basics */}
      {currentStep === 'BASICS' && (
        <NavigationOfferBasicsStep
          clients={clients}
          selectedClientId={clientId}
          onClientChange={(id) => {
            setClientId(id);
            setHasUnsavedChanges(true);
          }}
          campaignName={campaignName}
          onCampaignNameChange={(name) => {
            setCampaignName(name);
            setTitle(name);
            setHasUnsavedChanges(true);
          }}
          city={city}
          onCityChange={(c) => {
            setCity(c);
            setHasUnsavedChanges(true);
          }}
          validUntil={validUntil}
          onValidUntilChange={(val) => {
            setValidUntil(val);
            setHasUnsavedChanges(true);
          }}
          dateFrom={dateFrom}
          onDateFromChange={(val) => {
            setDateFrom(val);
            setHasUnsavedChanges(true);
          }}
          dateTo={dateTo}
          onDateToChange={(val) => {
            setDateTo(val);
            setHasUnsavedChanges(true);
          }}
          onClientCreated={(created) => {
            setClients((curr) => [...curr, created]);
          }}
        />
      )}

      {/* Step 2: Targets */}
      {currentStep === 'TARGETS' && (
        <NavigationTargetsStep
          targets={targets}
          onTargetsChange={(nextTargets) => {
            setTargets(nextTargets);
            setHasUnsavedChanges(true);
          }}
          selectedClient={selectedClient}
          points={points}
          onContinueToMap={() => setCurrentStep('MAP_POINTS')}
        />
      )}

      {/* Step 3: Map & Points */}
      {currentStep === 'MAP_POINTS' && (
        <NavigationMapStep
          points={points}
          targets={targets}
          onPointsChange={(nextPoints) => {
            setPoints(nextPoints);
            setHasUnsavedChanges(true);
          }}
          onTargetsChange={(nextTargets) => {
            setTargets(nextTargets);
            setHasUnsavedChanges(true);
          }}
          mode={mode}
          onModeChange={setMode}
          onAddPoint={handleAddPoint}
          onMapClick={handleMapClick}
          onPointMove={handlePointMove}
          onRecalculateRoutes={recalculateAllRoutes}
          recalculatingRoutes={recalculatingRoutes}
          proposalMode={proposalMode}
          onOpenVisualizer={(ptId) => setActiveVisualizerPointId(ptId)}
          onUploadSitePhoto={handleUploadSitePhoto}
        />
      )}

      {/* Step 4: Pricing (PRICED_QUOTE) OR Review (LOCATION_SELECTION) */}
      {currentStep === 'PRICING_OR_REVIEW' && (
        <>
          {proposalMode === 'PRICED_QUOTE' ? (
            <NavigationPricingStep
              points={points}
              onPointsChange={(nextPoints) => {
                setPoints(nextPoints);
                setHasUnsavedChanges(true);
              }}
              onApplyCatalogRates={applyCatalogRatesToAllPoints}
              hasSelectionSubmitted={initialOffer?.navigation?.selectionSubmitted === true}
            />
          ) : (
            <NavigationOfferReviewStep
              selectedClient={selectedClient}
              campaignName={campaignName}
              city={city}
              validUntil={validUntil}
              dateFrom={dateFrom}
              dateTo={dateTo}
              targets={targets}
              points={points}
              presentationSettings={presentationSettings}
              onPresentationSettingsChange={(pres) => {
                setPresentationSettings(pres);
                setHasUnsavedChanges(true);
              }}
              graphicArtworkUrl={graphicArtworkUrl}
              onGraphicArtworkUrlChange={(url) => {
                setGraphicArtworkUrl(url);
                setHasUnsavedChanges(true);
              }}
              includeGraphicProof={includeGraphicProof}
              onIncludeGraphicProofChange={(val) => {
                setIncludeGraphicProof(val);
                setHasUnsavedChanges(true);
              }}
              internalNote={internalNote}
              onInternalNoteChange={(note) => {
                setInternalNote(note);
                setHasUnsavedChanges(true);
              }}
              clientMessage={clientMessage}
              onClientMessageChange={(msg) => {
                setClientMessage(msg);
                setHasUnsavedChanges(true);
              }}
              savedOfferId={initialOffer?.id}
              portalToken={initialOffer?.portalToken}
            />
          )}
        </>
      )}

      {/* Sticky Bottom Command Bar */}
      <NavigationCommandBar
        currentStep={currentStep}
        onPrevStep={handlePrevStep}
        onNextStep={handleNextStep}
        onSave={handleSave}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        message={message}
        isLastStep={currentStep === 'PRICING_OR_REVIEW'}
      />

      {/* AI Visualizer Modal */}
      {activeVisualizerPointId && (
        <NavigationSignVisualizer
          pointLabel={points.find((p) => p.id === activeVisualizerPointId)?.label || 'Bod'}
          initialSignText={campaignName || selectedClient?.name || 'Navigace'}
          distanceText={points.find((p) => p.id === activeVisualizerPointId)?.calculatedDistanceMeters ? `${points.find((p) => p.id === activeVisualizerPointId)?.calculatedDistanceMeters} m` : '350 m'}
          arrowDirectionEnum={points.find((p) => p.id === activeVisualizerPointId)?.arrowDirectionEnum || 'STRAIGHT'}
          orientation={points.find((p) => p.id === activeVisualizerPointId)?.orientation || 'Jednostranná'}
          initialPhotoUrl={points.find((p) => p.id === activeVisualizerPointId)?.sitePhotoUrl || null}
          onClose={() => setActiveVisualizerPointId(null)}
          onSaveVisualization={(dataUrl: string) => {
            setPoints((curr) =>
              curr.map((p) => (p.id === activeVisualizerPointId ? { ...p, visualizedPhotoUrl: dataUrl } : p))
            );
            setActiveVisualizerPointId(null);
            setHasUnsavedChanges(true);
          }}
        />
      )}
    </div>
  );
}
