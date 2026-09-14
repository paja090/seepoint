'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Camera, Compass, Crosshair, MapPin, Plus, Save, Search, Trash2, Image as ImageIcon, UserPlus, X, RefreshCw, Upload, ArrowUp, ArrowDown, GripVertical, Zap } from 'lucide-react';
import type { OfferView } from '@/lib/offers/view-model';
import { canDownloadInstallationSheet } from '@/lib/offers/navigation-document-access';
import { GoogleNavigationOfferMap } from './GoogleNavigationOfferMap';
import { NavigationSignVisualizer } from '@/components/navigation-documentation/NavigationSignVisualizer';
import { compressImageFile } from '@/lib/image-compress';
import { isRestrictedHighwayOr1stClassRoad, isOstravaRestrictedZone } from '@/lib/ai-offers/navigation-constraints';

type ClientOption = {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
};

type DraftPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address: string;
  navigationType: string;
  variant: string;
  orientation: string;
  quantity: string;
  unitPrice: string;
  framePrice: string;
  installationPrice: string;
  removalPrice: string;
  productionPrice: string;
  internalNote: string;
  clientNote: string;
  realDistanceText?: string;
  visualizedPhotoUrl?: string;
  sitePhotoId?: string;
  sitePhotoUrl?: string;
  isSelectedByClient?: boolean;
  carrierId?: string | null;

  // New structured fields
  arrowDirectionEnum:
    | 'LEFT'
    | 'RIGHT'
    | 'STRAIGHT'
    | 'SLANTED_LEFT'
    | 'SLANTED_RIGHT'
    | 'U_TURN'
    | 'TWO_WAY'
    | 'ROUNDABOUT_1'
    | 'ROUNDABOUT_2'
    | 'ROUNDABOUT_3'
    | 'ROUNDABOUT_4'
    | 'ROUNDABOUT_5'
    | 'ROUNDABOUT';
  pillarNumber: string;
  pillarType: string;
  manualDistanceValue: string;
  manualDistanceUnit: 'METERS' | 'KILOMETERS';
  distanceSource: 'CALCULATED' | 'MANUAL';
  routePolyline?: string;
  calculatedDistanceMeters?: number;

  // Multiple targets linkage
  targetId?: string;
  targetLatitude?: number;
  targetLongitude?: number;
};

export type NavigationTargetItem = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  note?: string;
  photoUrl?: string | null;
  color?: string;
};

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `point-${Date.now()}-${Math.random()}`;

export function NavigationOfferForm({
  clients,
  initialClientId,
  initialOffer,
}: {
  clients: ClientOption[];
  initialClientId?: string;
  initialOffer?: OfferView;
}) {
  const router = useRouter();
  const navigation = initialOffer?.navigation;

  const [clientList, setClientList] = useState<ClientOption[]>(clients);
  const [clientId, setClientId] = useState(initialOffer?.clientId ?? initialClientId ?? clients[0]?.id ?? '');
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientIco, setNewClientIco] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState('');

  async function handleCreateClient() {
    if (!newClientName.trim()) {
      setClientError('Zadejte název klienta / firmy.');
      return;
    }
    setCreatingClient(true);
    setClientError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName.trim(),
          contactPerson: newClientContact.trim() || undefined,
          email: newClientEmail.trim() || undefined,
          phone: newClientPhone.trim() || undefined,
          companyId: newClientIco.trim() || undefined,
        }),
      });
      const data = (await res.json()) as ClientOption & { error?: string };
      if (!res.ok) {
        setClientError(data.error || 'Klienta se nepodařilo vytvořit.');
        return;
      }
      setClientList((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
      setClientId(data.id);
      setShowClientModal(false);
      setNewClientName('');
      setNewClientContact('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientIco('');
    } catch {
      setClientError('Chyba při komunikaci se serverem.');
    } finally {
      setCreatingClient(false);
    }
  }

  const [title, setTitle] = useState(initialOffer?.title ?? 'Navigační nabídka');
  const [campaignName, setCampaignName] = useState(initialOffer?.campaignName ?? '');
  const [validUntil, setValidUntil] = useState(initialOffer?.validUntil ?? '');

  const initialStrategy = initialOffer?.campaignStrategy as { dateFrom?: string; dateTo?: string } | null | undefined;
  const [dateFrom, setDateFrom] = useState(initialStrategy?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(initialStrategy?.dateTo ?? '');

  const campaignDurationDays = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    const from = new Date(dateFrom).getTime();
    const to = new Date(dateTo).getTime();
    if (isNaN(from) || isNaN(to) || to < from) return null;
    return Math.round((to - from) / 86400000);
  }, [dateFrom, dateTo]);

  const TARGET_COLORS = ['#be123c', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];

  const initialTargets: NavigationTargetItem[] = useMemo(() => {
    const rawTargets = (initialOffer?.navigation as unknown as Record<string, unknown>)?.targets;
    if (Array.isArray(rawTargets) && rawTargets.length > 0) {
      return rawTargets.map((t: Record<string, unknown>, idx: number) => ({
        id: String(t.id || `target-${idx + 1}`),
        name: String(t.name || `Prodejna ${idx + 1}`),
        address: String(t.address || ''),
        latitude: Number(t.latitude || 0),
        longitude: Number(t.longitude || 0),
        note: t.note ? String(t.note) : '',
        photoUrl: typeof t.photoUrl === 'string' ? t.photoUrl : null,
        color: typeof t.color === 'string' ? t.color : TARGET_COLORS[idx % TARGET_COLORS.length],
      }));
    }
    if (navigation?.targetName || (navigation && navigation.targetLatitude)) {
      return [{
        id: 'target-1',
        name: navigation.targetName || 'Hlavní prodejna',
        address: navigation.targetAddress || '',
        latitude: navigation.targetLatitude || 0,
        longitude: navigation.targetLongitude || 0,
        note: navigation.targetNote || '',
        photoUrl: typeof (navigation as unknown as Record<string, unknown>).targetPhotoUrl === 'string'
          ? String((navigation as unknown as Record<string, unknown>).targetPhotoUrl)
          : null,
        color: TARGET_COLORS[0],
      }];
    }
    return [];
  }, [navigation, initialOffer]);

  const [targets, setTargets] = useState<NavigationTargetItem[]>(initialTargets);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => initialTargets[0]?.id || 'target-1');

  const activeTarget = targets.find((t) => t.id === selectedTargetId) || targets[0] || null;

  function updateActiveTarget(changes: Partial<NavigationTargetItem>) {
    if (!activeTarget) return;
    setTargets((current) =>
      current.map((t) => (t.id === activeTarget.id ? { ...t, ...changes } : t))
    );
  }

  function handleAddTarget() {
    const nextIdx = targets.length + 1;
    const newT: NavigationTargetItem = {
      id: `target-${Date.now()}`,
      name: `Prodejna ${nextIdx}`,
      address: '',
      latitude: activeTarget ? activeTarget.latitude + 0.008 : 49.82,
      longitude: activeTarget ? activeTarget.longitude + 0.008 : 15.48,
      note: '',
      photoUrl: null,
      color: TARGET_COLORS[targets.length % TARGET_COLORS.length],
    };
    setTargets((prev) => [...prev, newT]);
    setSelectedTargetId(newT.id);
  }

  function handleRemoveTarget(id: string) {
    if (targets.length <= 1) return;
    const remaining = targets.filter((t) => t.id !== id);
    setTargets(remaining);
    if (selectedTargetId === id) {
      setSelectedTargetId(remaining[0].id);
    }
    setPoints((pts) =>
      pts.map((p) => (p.targetId === id ? { ...p, targetId: remaining[0].id } : p))
    );
  }

  const [internalNote, setInternalNote] = useState(initialOffer?.internalNote ?? '');
  const [clientMessage, setClientMessage] = useState(initialOffer?.clientMessage ?? '');

  const [points, setPoints] = useState<DraftPoint[]>(
    () =>
      navigation?.points.map((point: Record<string, unknown>) => {
        const rawFrame = Number(point.framePrice || 0);
        const rawProd = Number(point.productionPrice || 0);

        let framePrice = rawFrame > 0 ? String(rawFrame) : '1960';
        let productionPrice = '600';

        if (rawProd > 0) {
          if (rawProd === rawFrame || (rawProd >= 1800 && rawFrame === 0)) {
            framePrice = '1960';
            productionPrice = '600';
          } else {
            productionPrice = String(rawProd);
          }
        }

        return {
          id: String(point.id),
          label: String(point.label),
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          carrierId: (point.carrierId as string) ?? null,
          address: String(point.address ?? ''),
          navigationType: String(point.navigationType ?? 'Směrová tabule'),
          variant: String(point.variant ?? '120x80 cm'),
          orientation: String(point.orientation ?? ''),
          quantity: String(point.quantity ?? 1),
          unitPrice: String(point.unitPrice ?? 12000),
          framePrice,
          productionPrice,
          installationPrice: String(point.installationPrice ?? 800),
          removalPrice: String(point.removalPrice ?? 600),
          internalNote: String(point.internalNote ?? ''),
          clientNote: String(point.clientNote ?? ''),
          arrowDirectionEnum: (point.arrowDirectionEnum as DraftPoint['arrowDirectionEnum']) || 'STRAIGHT',
          pillarNumber: String(point.pillarNumber ?? ''),
          pillarType: String(point.pillarType ?? ''),
          manualDistanceValue: point.manualDistanceValue ? String(point.manualDistanceValue) : '',
          manualDistanceUnit: (point.manualDistanceUnit as DraftPoint['manualDistanceUnit']) || 'METERS',
          distanceSource: (point.distanceSource as DraftPoint['distanceSource']) || 'CALCULATED',
          routePolyline: (point.routePolyline as string) ?? undefined,
          calculatedDistanceMeters: (point.calculatedDistanceMeters as number) ?? undefined,
          visualizedPhotoUrl: typeof point.visualizedPhotoUrl === 'string' ? point.visualizedPhotoUrl : undefined,
          sitePhotoId: typeof point.sitePhotoId === 'string' ? point.sitePhotoId : undefined,
          sitePhotoUrl: typeof point.sitePhotoUrl === 'string' ? point.sitePhotoUrl : undefined,
          isSelectedByClient: point.isSelectedByClient !== false,
          targetId: typeof point.targetId === 'string' ? point.targetId : undefined,
          targetLatitude: typeof point.targetLatitude === 'number' ? point.targetLatitude : undefined,
          targetLongitude: typeof point.targetLongitude === 'number' ? point.targetLongitude : undefined,
        };
      }) ?? [],
  );

  const initialNav = initialOffer?.navigation as unknown as Record<string, unknown> | undefined;
  const detectedInitialCity: 'Ostrava' | 'Havířov' =
    initialNav?.city === 'Havířov' ||
    (activeTarget?.address && activeTarget.address.toLowerCase().includes('havířov')) ||
    (initialOffer?.title && initialOffer.title.toLowerCase().includes('havířov'))
      ? 'Havířov'
      : 'Ostrava';

  const [city, setCity] = useState<'Ostrava' | 'Havířov'>(detectedInitialCity);

  function handleCityChange(newCity: 'Ostrava' | 'Havířov') {
    setCity(newCity);
    const newDefaultVariant = newCity === 'Havířov' ? 'Havířov – atyp s horním půlkruhem' : '670 × 900 mm';
    setPoints((current) =>
      current.map((p) => {
        const isOldDefault =
          !p.variant ||
          p.variant === '670x900 mm' ||
          p.variant === '670 × 900 mm' ||
          p.variant === '120x80 cm' ||
          p.variant.includes('půlkruh');
        return isOldDefault ? { ...p, variant: newDefaultVariant } : p;
      })
    );
  }

  const [mode, setMode] = useState<'target' | 'point'>(activeTarget ? 'point' : 'target');
  const [proposalMode, setProposalMode] = useState<'LOCATION_SELECTION' | 'PRICED_QUOTE'>(
    (initialOffer?.navigation as unknown as Record<string, unknown>)?.proposalMode === 'PRICED_QUOTE' ? 'PRICED_QUOTE' : 'LOCATION_SELECTION'
  );
  const [graphicArtworkUrl, setGraphicArtworkUrl] = useState<string | null>(
    typeof (initialOffer?.navigation as unknown as Record<string, unknown>)?.graphicArtworkUrl === 'string'
      ? String((initialOffer?.navigation as unknown as Record<string, unknown>)?.graphicArtworkUrl)
      : null
  );
  const [includeGraphicProof, setIncludeGraphicProof] = useState<boolean>(
    (initialOffer?.navigation as unknown as Record<string, unknown>)?.includeGraphicProof !== false
  );
  const [results, setResults] = useState<Array<{ latitude: number; longitude: number; label: string }>>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Active point selected for sign visualization overlay
  const [activeVisualizerPointId, setActiveVisualizerPointId] = useState<string | null>(null);

  // Default price list items fetched from Settings
  const [catalogDefaults, setCatalogDefaults] = useState({
    rentalPrice: '12000',
    framePrice: '1960',
    productionPrice: '600',
    installationPrice: '800',
    removalPrice: '600',
  });

  useEffect(() => {
    async function loadPriceCatalog() {
      try {
        let rental = '12000';
        let frame = '1960';
        let production = '600';
        let installation = '800';
        let removal = '600';

        // 1. Check Offer Price Rules catalog first
        const resRules = await fetch('/api/offer-price-rules');
        if (resRules.ok) {
          const rules = (await resRules.json()) as Array<{ code?: string; category: string; mediaType?: string; unitPrice?: number }>;
          const rRental = rules.find((r) => r.category === 'RENTAL' && (r.mediaType === 'NAVIGATION_SIGN' || !r.mediaType))?.unitPrice;
          const rFrame = rules.find((r) => r.code?.includes('FRAME') || (r.category === 'PRODUCTION' && r.mediaType === 'NAVIGATION_FRAME'))?.unitPrice;
          const rProd = rules.find((r) => (r.category === 'PRODUCTION' || r.category === 'PRINT') && (r.mediaType === 'NAVIGATION_SIGN' || !r.mediaType))?.unitPrice;
          const rInst = rules.find((r) => r.category === 'INSTALLATION' && (r.mediaType === 'NAVIGATION_SIGN' || !r.mediaType))?.unitPrice;
          const rRem = rules.find((r) => r.category === 'REMOVAL' && (r.mediaType === 'NAVIGATION_SIGN' || !r.mediaType))?.unitPrice;

          if (rRental !== undefined) rental = String(rRental);
          if (rFrame !== undefined) frame = String(rFrame);
          if (rProd !== undefined && rProd < 1800) production = String(rProd);
          if (rInst !== undefined) installation = String(rInst);
          if (rRem !== undefined) removal = String(rRem);
        }

        // 2. Fallback to Price List Items
        const resItems = await fetch('/api/price-list-items');
        if (resItems.ok) {
          const items = (await resItems.json()) as Array<{ carrierType?: string; mediaType?: string; rentalPrice?: number; productionPrice?: number }>;
          const navItem = items.find((i) => i.carrierType === 'NAVIGATION' || i.mediaType === 'NAVIGATION_SIGN');
          if (navItem) {
            if (navItem.rentalPrice) rental = String(navItem.rentalPrice);
            if (navItem.productionPrice && navItem.productionPrice < 1800 && String(navItem.productionPrice) !== frame) {
              production = String(navItem.productionPrice);
            }
          }
        }

        setCatalogDefaults({ rentalPrice: rental, framePrice: frame, productionPrice: production, installationPrice: installation, removalPrice: removal });
      } catch {
        /* fallback to defaults */
      }
    }
    void loadPriceCatalog();
  }, []);

  const selectedClient = clientList.find((client) => client.id === clientId);

  // Financial summary breakdown
  const totals = useMemo(() => {
    let rental = 0;
    let frame = 0;
    let production = 0;
    let installation = 0;
    let removal = 0;

    for (const p of points) {
      const q = Number(p.quantity || 0);
      rental += q * Number(p.unitPrice || 0);
      frame += q * Number(p.framePrice || 0);
      production += q * Number(p.productionPrice || 0);
      installation += q * Number(p.installationPrice || 0);
      removal += q * Number(p.removalPrice || 0);
    }

    const subtotal = rental + frame + production + installation + removal;
    const tax = subtotal * 0.21;
    const totalWithTax = subtotal + tax;

    return { rental, frame, production, installation, removal, subtotal, tax, totalWithTax };
  }, [points]);

  async function computeClientDirections(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<{ calculatedDistanceMeters?: number; routePolyline?: string }> {
    return new Promise((resolve) => {
      try {
        const googleMaps = window.google?.maps;
        if (!googleMaps) return resolve({});

        const gAny = googleMaps as unknown as {
          DirectionsService: new () => {
            route: (
              req: Record<string, unknown>,
              cb: (res: unknown, status: string) => void
            ) => void;
          };
          TravelMode: { DRIVING: string };
        };

        if (!gAny.DirectionsService) return resolve({});

        const ds = new gAny.DirectionsService();
        ds.route(
          {
            origin: { lat: originLat, lng: originLng },
            destination: { lat: destLat, lng: destLng },
            travelMode: gAny.TravelMode.DRIVING || 'DRIVING',
          },
          (result: unknown, status: string) => {
            if (status === 'OK' && result) {
              const resObj = result as {
                routes: Array<{
                  legs: Array<{ distance?: { value: number } }>;
                  overview_polyline?: string | { points?: string };
                }>;
              };
              const route = resObj.routes[0];
              const distMeters = route?.legs[0]?.distance?.value;
              const rawPolyline = route?.overview_polyline;
              const polyStr = typeof rawPolyline === 'string' ? rawPolyline : rawPolyline?.points;

              if (distMeters && polyStr) {
                return resolve({
                  calculatedDistanceMeters: distMeters,
                  routePolyline: polyStr,
                });
              }
            }
            resolve({});
          }
        );
      } catch {
        resolve({});
      }
    });
  }

  async function handleUploadDesktopPhoto(pointId: string, file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type.toLowerCase()) && !/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)) {
      setMessage('Fotografie sloupu musí být ve formátu JPG, PNG nebo WebP.');
      return;
    }
    setMessage('⏳ Zpracovávám a nahrávám fotografii sloupu...');
    try {
      const compressedFile = await compressImageFile(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('type', 'SURVEY');
      const res = await fetch('/api/mobile-photos/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.photo?.url) {
          updatePoint(pointId, { sitePhotoUrl: data.photo.url, sitePhotoId: data.photo.id });
          setMessage('✓ Fotografie sloupu byla úspěšně nahrána a připojena k bodu.');
        } else {
          setMessage('Fotografii se nepodařilo uložit.');
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setMessage(errJson.error || 'Chyba při nahrávání fotografie.');
      }
    } catch {
      setMessage('Chyba při nahrávání fotografie.');
    }
  }

  async function fetchRouteInfo(
    originLat: number,
    originLng: number,
    destLat?: number,
    destLng?: number
  ): Promise<{ calculatedDistanceMeters?: number; routePolyline?: string }> {
    if (!destLat || !destLng) return {};

    // 1. Try server Routes API route
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { latitude: originLat, longitude: originLng },
          destination: { latitude: destLat, longitude: destLng },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { status: string; distanceMeters: number; polyline: string };
        if (data.status === 'OK' && data.distanceMeters > 0) {
          return {
            calculatedDistanceMeters: data.distanceMeters,
            routePolyline: data.polyline,
          };
        }
      }
    } catch {
      /* ignore */
    }

    // 2. Client-side browser DirectionsService fallback
    const clientResult = await computeClientDirections(originLat, originLng, destLat, destLng);
    return clientResult;
  }

  async function reverseGeocodeLocation(lat: number, lng: number): Promise<string | undefined> {
    try {
      const googleMaps = window.google?.maps;
      if (googleMaps?.Geocoder) {
        const geocoder = new googleMaps.Geocoder();
        const res = await new Promise<{ results: Array<{ formatted_address: string }> | null; status: string }>((resolve) => {
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            resolve({ results: results as Array<{ formatted_address: string }> | null, status });
          });
        });
        if (res.status === 'OK' && res.results?.[0]?.formatted_address) {
          return res.results[0].formatted_address;
        }
      }
    } catch {
      /* fallback */
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'Accept-Language': 'cs,en' },
      });
      if (res.ok) {
        const data = (await res.json()) as { display_name?: string; address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; suburb?: string } };
        if (data.address) {
          const road = data.address.road || '';
          const houseNum = data.address.house_number || '';
          const city = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
          const streetPart = [road, houseNum].filter(Boolean).join(' ');
          const full = [streetPart, city].filter(Boolean).join(', ');
          if (full) return full;
        }
        if (data.display_name) return data.display_name;
      }
    } catch {
      /* fallback */
    }

    return undefined;
  }

  const [recalculatingRoutes, setRecalculatingRoutes] = useState(false);

  async function recalculateAllRoutes(targetList?: NavigationTargetItem[]) {
    const effectiveTargets = targetList || targets;
    if (effectiveTargets.length === 0 || points.length === 0) return;
    setRecalculatingRoutes(true);
    try {
      const updated = await Promise.all(
        points.map(async (p) => {
          const ptTarget = effectiveTargets.find((t) => t.id === p.targetId) || effectiveTargets[0];
          if (!ptTarget || !ptTarget.latitude || !ptTarget.longitude) return p;
          const routeInfo = await fetchRouteInfo(p.latitude, p.longitude, ptTarget.latitude, ptTarget.longitude);
          return {
            ...p,
            targetLatitude: ptTarget.latitude,
            targetLongitude: ptTarget.longitude,
            ...routeInfo,
          };
        })
      );
      setPoints(updated);
    } finally {
      setRecalculatingRoutes(false);
    }
  }

  async function mapClick(latitude: number, longitude: number, address?: string) {
    if (mode === 'target') {
      if (activeTarget) {
        const updatedTarget = { ...activeTarget, latitude, longitude, address: address || activeTarget.address };
        const updatedTargets = targets.map((t) => (t.id === activeTarget.id ? updatedTarget : t));
        setTargets(updatedTargets);
        setMode('point');
        void recalculateAllRoutes(updatedTargets);
      } else {
        const newTarget: NavigationTargetItem = {
          id: 'target-1',
          name: 'Hlavní prodejna',
          address: address || '',
          latitude,
          longitude,
          color: TARGET_COLORS[0],
        };
        const updatedTargets = [newTarget];
        setTargets(updatedTargets);
        setSelectedTargetId(newTarget.id);
        setMode('point');
        void recalculateAllRoutes(updatedTargets);
      }
      return;
    }

    const ptTarget = (activeTarget && activeTarget.latitude && activeTarget.longitude) ? activeTarget : (targets[0] || null);
    const routeInfo = ptTarget ? await fetchRouteInfo(latitude, longitude, ptTarget.latitude, ptTarget.longitude) : {};

    setPoints((current) => [
      ...current,
      {
        id: newId(),
        label: `Navigační bod ${current.length + 1}`,
        latitude,
        longitude,
        address: address || '',
        navigationType: 'Směrová tabule',
        variant: city === 'Havířov' ? 'Havířov – atyp s horním půlkruhem' : '670 × 900 mm',
        orientation: 'Obousměrný (A/B)',
        quantity: '1',
        unitPrice: catalogDefaults.rentalPrice,
        framePrice: catalogDefaults.framePrice,
        productionPrice: catalogDefaults.productionPrice,
        installationPrice: catalogDefaults.installationPrice,
        removalPrice: catalogDefaults.removalPrice,
        internalNote: '',
        clientNote: '',
        arrowDirectionEnum: 'STRAIGHT',
        pillarNumber: '',
        pillarType: 'Sloup VO',
        manualDistanceValue: '',
        manualDistanceUnit: 'METERS',
        distanceSource: 'CALCULATED',
        targetId: ptTarget?.id,
        targetLatitude: ptTarget?.latitude,
        targetLongitude: ptTarget?.longitude,
        ...routeInfo,
      },
    ]);
  }

  async function handleAddPoint() {
    setMode('point');
    const ptTarget = (activeTarget && activeTarget.latitude && activeTarget.longitude) ? activeTarget : (targets[0] || null);
    const offsetIndex = points.length + 1;
    const lat = ptTarget ? ptTarget.latitude + 0.0015 * (offsetIndex % 2 === 0 ? 1 : -1) : 49.82;
    const lng = ptTarget ? ptTarget.longitude + 0.0015 * (offsetIndex > 2 ? 1 : -1) : 15.48;

    const routeInfo = ptTarget ? await fetchRouteInfo(lat, lng, ptTarget.latitude, ptTarget.longitude) : {};

    setPoints((current) => [
      ...current,
      {
        id: newId(),
        label: `Navigační bod ${current.length + 1}`,
        latitude: lat,
        longitude: lng,
        address: '',
        navigationType: 'Směrová tabule',
        variant: city === 'Havířov' ? 'Havířov – atyp s horním půlkruhem' : '670 × 900 mm',
        orientation: 'Obousměrný (A/B)',
        quantity: '1',
        unitPrice: catalogDefaults.rentalPrice,
        framePrice: catalogDefaults.framePrice,
        productionPrice: catalogDefaults.productionPrice,
        installationPrice: catalogDefaults.installationPrice,
        removalPrice: catalogDefaults.removalPrice,
        internalNote: '',
        clientNote: '',
        arrowDirectionEnum: 'STRAIGHT',
        pillarNumber: '',
        pillarType: 'Sloup VO',
        manualDistanceValue: '',
        manualDistanceUnit: 'METERS',
        distanceSource: 'CALCULATED',
        targetId: ptTarget?.id,
        targetLatitude: ptTarget?.latitude,
        targetLongitude: ptTarget?.longitude,
        ...routeInfo,
      },
    ]);
  }

  function updatePoint(id: string, changes: Partial<DraftPoint>) {
    setPoints((current) => current.map((point) => (point.id === id ? { ...point, ...changes } : point)));
  }

  function applyCatalogRatesToPoint(pointId: string) {
    updatePoint(pointId, {
      unitPrice: catalogDefaults.rentalPrice,
      framePrice: catalogDefaults.framePrice,
      productionPrice: catalogDefaults.productionPrice,
      installationPrice: catalogDefaults.installationPrice,
      removalPrice: catalogDefaults.removalPrice,
    });
    setMessage('✓ Aktuální ceníkové sazby byly načteny k navigačnímu bodu.');
  }

  function applyCatalogRatesToAllPoints() {
    setPoints((current) =>
      current.map((p) => ({
        ...p,
        unitPrice: catalogDefaults.rentalPrice,
        framePrice: catalogDefaults.framePrice,
        productionPrice: catalogDefaults.productionPrice,
        installationPrice: catalogDefaults.installationPrice,
        removalPrice: catalogDefaults.removalPrice,
      }))
    );
    setMessage('✓ Aktuální ceníkové sazby byly načteny pro všechny navigační body.');
  }

  function movePoint(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= points.length || toIndex < 0 || toIndex >= points.length || fromIndex === toIndex) {
      return;
    }
    setPoints((current) => {
      const updated = [...current];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated.map((p, idx) => ({
        ...p,
        label: p.label.startsWith('Navigační bod ') ? `Navigační bod ${idx + 1}` : p.label,
      }));
    });
  }

  async function uploadSitePhoto(point: DraftPoint, file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setMessage('Fotografie sloupu musí být JPG, PNG nebo WebP do 4 MB.');
      return;
    }
    const persisted = initialOffer?.navigation?.points.some((candidate) => candidate.id === point.id);
    if (!persisted) {
      setMessage('Nejprve nabídku uložte. Potom lze k bodu nahrát fotografii sloupu.');
      return;
    }
    const form = new FormData();
    form.set('file', file);
    form.set('navigationPointId', point.id);
    form.set('type', 'LOCATION');
    form.set('note', `Terénní fotografie návrhového bodu ${point.label}`);
    const response = await fetch('/api/photos', { method: 'POST', body: form });
    const data = await response.json() as { id?: string; url?: string; error?: string };
    if (!response.ok || !data.id || !data.url) return setMessage(data.error ?? 'Fotografii sloupu se nepodařilo uložit.');
    updatePoint(point.id, { sitePhotoId: data.id, sitePhotoUrl: data.url });
    setMessage('Fotografie sloupu byla uložena. Nyní ověřte polohu a typ konstrukce.');
  }

  async function geocode() {
    if (!activeTarget || !activeTarget.address.trim()) return;
    setMessage('');
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(activeTarget.address)}`);
    const data = (await response.json()) as Array<{ latitude: number; longitude: number; label: string }> | { error?: string };
    if (!response.ok) return setMessage((data as { error?: string }).error ?? 'Adresu se nepodařilo najít.');
    setResults(data as Array<{ latitude: number; longitude: number; label: string }>);
  }

  async function save() {
    const primaryTarget = targets[0];
    if (!primaryTarget || !primaryTarget.latitude || !primaryTarget.longitude) {
      return setMessage('Nejprve označte alespoň jedno cílové místo (prodejnu) v mapě.');
    }
    if (!primaryTarget.name.trim()) {
      return setMessage('Zadejte název cílového místa / prodejny.');
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
      points: points.map((p) => {
        const ptTarget = targets.find((t) => t.id === p.targetId) || targets[0];
        return {
          ...p,
          targetId: p.targetId || targets[0]?.id,
          targetLatitude: ptTarget?.latitude,
          targetLongitude: ptTarget?.longitude,
        };
      }),
    };

    const response = await fetch(initialOffer?.id ? `/api/offers/navigation/${initialOffer.id}` : '/api/offers/navigation', {
      method: initialOffer?.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as { id?: string; error?: string };
    setSaving(false);

    if (!response.ok) return setMessage(data.error ?? 'Nabídku se nepodařilo uložit.');
    router.push(`/offers/${data.id}`);
    router.refresh();
  }

  async function uploadDataUrl(dataUrl: string): Promise<string | null> {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `VISUALIZATION_${Date.now()}.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'SURVEY');

      const uploadRes = await fetch('/api/mobile-photos/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        return data.photo?.url || null;
      }
    } catch (err) {
      console.error('Upload visualization error:', err);
    }
    return null;
  }

  const activePointForVisualizer = points.find((p) => p.id === activeVisualizerPointId);

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* Left Sidebar Form */}
      <aside className="space-y-4">
        <section className="card space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Zadání nabídky navigace</h2>
          <Field label="Klient">
            <div className="flex items-center gap-2">
              <select className="input flex-1" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clientList.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary text-xs py-2 px-2.5 whitespace-nowrap flex items-center gap-1 shrink-0"
                onClick={() => setShowClientModal(true)}
                title="Vytvořit nového klienta"
              >
                <UserPlus size={14} /> Nový
              </button>
            </div>
          </Field>

          <Field label="Název nabídky">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field label="Název kampaně / prodejny">
            <input className="input" placeholder="Např. Navigace Koupelny Ostrava" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </Field>

          <Field label="Město navigačního systému">
            <select
              className="input font-bold text-sky-900 bg-sky-50/50 border-sky-300"
              value={city}
              onChange={(e) => handleCityChange(e.target.value as 'Ostrava' | 'Havířov')}
            >
              <option value="Ostrava">🏙️ Ostrava (standardní rozměr 670 × 900 mm)</option>
              <option value="Havířov">🏙️ Havířov (atypický tvar s horním půlkruhem)</option>
            </select>
          </Field>

          <Field label="Platnost nabídky do">
            <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>

          {/* Termín kampaně */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                <span>📅</span> Termín kampaně
              </span>
              {campaignDurationDays !== null ? (
                <span className="text-[11px] font-bold text-sky-800 bg-sky-200/80 border border-sky-300 px-2.5 py-0.5 rounded-lg">
                  {campaignDurationDays} dní (~{Math.max(1, Math.round(campaignDurationDays / 30.5))} měs.)
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-md">
                  Standardně 1 rok (365 dní)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Začátek kampaně (od)">
                <input
                  className="input text-xs font-medium"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </Field>
              <Field label="Konec kampaně (do)">
                <input
                  className="input text-xs font-medium"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Nastavený termín se automaticky propíše do klientského náhledu i klientského portálu kampaně (živý odpočet dní, trvání pronájmu).
            </p>
          </div>
        </section>

        {/* Proposal Mode Toggle Banner */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-xs space-y-3">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
              <span>⚡</span> Režim a fáze nabídky
            </h3>
            <p className="text-xs text-amber-900/80 leading-relaxed font-medium">
              Ve Fázi 1 se klientovi zobrazí návrh trasy bez cen a klient si v odkazu sám zvolí preferované pozice bodů.
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <button
              type="button"
              onClick={() => setProposalMode('LOCATION_SELECTION')}
              className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-black transition cursor-pointer text-left flex items-center justify-between border ${
                proposalMode === 'LOCATION_SELECTION'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
              }`}
            >
              <span>Fáze 1: Návrh rozmístění ZDARMA</span>
              {proposalMode === 'LOCATION_SELECTION' && <span>✓</span>}
            </button>
            <button
              type="button"
              onClick={() => setProposalMode('PRICED_QUOTE')}
              className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-black transition cursor-pointer text-left flex items-center justify-between border ${
                proposalMode === 'PRICED_QUOTE'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Fáze 2: Cenová nabídka s rozpočtem</span>
              {proposalMode === 'PRICED_QUOTE' && <span>✓</span>}
            </button>
          </div>
        </div>

        {/* AI Graphic Artwork Motiv Uploader & Proof Toggle */}
        <section className="card space-y-3 border-2 border-sky-200 bg-sky-50/40">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-sky-950">
              🎨 Grafický motiv cedule (AI / ChatGPT)
            </h2>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-sky-900">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                checked={includeGraphicProof}
                onChange={(e) => setIncludeGraphicProof(e.target.checked)}
              />
              <span>Zobrazit v nabídce</span>
            </label>
          </div>

          <p className="text-xs text-slate-600 font-medium">
            Vložte fotku vizuálu / náhledu grafiky cedule (vygenerovanou z AI / ChatGPT / Midjourney nebo z grafického studia), kterou uvidí klient v nabídce i PDF ke schválení.
          </p>

          <label className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-400 bg-white p-3 text-xs font-bold text-sky-900 hover:bg-sky-50 cursor-pointer transition">
            <Upload size={16} />
            {graphicArtworkUrl ? '✓ Změnit fotku AI grafiky' : 'Nahrát AI grafiku cedule'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setGraphicArtworkUrl(ev.target?.result as string);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>

          {graphicArtworkUrl && (
            <div className="relative mt-2 overflow-hidden rounded-xl border border-sky-300 bg-slate-900 p-2">
              <img src={graphicArtworkUrl} alt="AI Grafický motiv cedule" className="h-32 w-full object-contain" />
              <button
                type="button"
                className="absolute top-2 right-2 rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-xs hover:bg-rose-700"
                onClick={() => setGraphicArtworkUrl(null)}
              >
                Odstranit
              </button>
            </div>
          )}

          {/* Client Uploaded Artwork Download Link if available */}
          {typeof (initialOffer?.navigation as unknown as Record<string, unknown>)?.clientArtworkUrl === 'string' && (
            <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-950 space-y-2">
              <div className="flex items-center justify-between">
                <span>📁 Klient nahrál vlastní grafické podklady:</span>
                <span className="text-[10px] text-emerald-700 font-mono">
                  {String((initialOffer?.navigation as unknown as Record<string, unknown>)?.clientArtworkFileName || 'podklady.png')}
                </span>
              </div>
              <a
                href={String((initialOffer?.navigation as unknown as Record<string, unknown>)?.clientArtworkUrl)}
                download={String((initialOffer?.navigation as unknown as Record<string, unknown>)?.clientArtworkFileName || 'podklady.png')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                📥 Stáhnout podklady od klienta
              </a>
            </div>
          )}
        </section>

        {/* Target Stores / Destinations (Multiple branches supported) */}
        <section className="card space-y-3 border-2 border-sky-200 bg-sky-50/40">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-sky-900">
              <Crosshair size={18} className="text-sky-600" />
              Cílové provozovny ({targets.length})
            </h2>
            <button
              type="button"
              onClick={handleAddTarget}
              className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-sky-700 transition cursor-pointer"
              title="Přidat další pobočku / prodejnu do nabídky"
            >
              <Plus size={13} /> + Přidat pobočku
            </button>
          </div>

          {/* Store Tabs Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {targets.map((t, idx) => {
              const isSelected = t.id === (activeTarget?.id || targets[0]?.id);
              const pointsCountForStore = points.filter((p) => (p.targetId || targets[0]?.id) === t.id).length;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTargetId(t.id)}
                  style={{ borderColor: isSelected ? t.color || '#be123c' : undefined }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-white shadow-xs text-slate-900 border-2'
                      : 'bg-slate-100/80 text-slate-600 border-slate-200 hover:bg-slate-200/60'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: t.color || (idx === 0 ? '#be123c' : '#2563eb') }}
                  />
                  <span>{t.name || `Pobočka ${idx + 1}`}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                    {pointsCountForStore} bodů
                  </span>
                </button>
              );
            })}
          </div>

          {activeTarget ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeTarget.color || '#be123c' }} />
                  Editace pobočky #{targets.findIndex((t) => t.id === activeTarget.id) + 1}
                </span>
                {targets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTarget(activeTarget.id)}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 transition cursor-pointer"
                    title="Odstranit tuto pobočku z nabídky"
                  >
                    Odstranit pobočku
                  </button>
                )}
              </div>

              <Field label="Název provozovny">
                <input
                  className="input"
                  placeholder="Např. Showroom SeePOINT Brno"
                  value={activeTarget.name}
                  onChange={(e) => updateActiveTarget({ name: e.target.value })}
                />
              </Field>

              <Field label="Adresa provozovny">
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Ulice, č.p., Město"
                    value={activeTarget.address}
                    onChange={(e) => updateActiveTarget({ address: e.target.value })}
                  />
                  <button
                    aria-label="Vyhledat adresu"
                    className="rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-50 cursor-pointer"
                    onClick={() => void geocode()}
                    type="button"
                  >
                    <Search size={16} />
                  </button>
                </div>
              </Field>

              {results.map((result) => (
                <button
                  className="block w-full rounded-lg bg-white p-2.5 text-left text-xs font-semibold hover:bg-sky-100 border border-sky-200 transition cursor-pointer"
                  key={`${result.latitude}-${result.longitude}`}
                  onClick={() => {
                    updateActiveTarget({
                      latitude: result.latitude,
                      longitude: result.longitude,
                      address: result.label,
                    });
                    setResults([]);
                    setMode('point');
                    void recalculateAllRoutes(
                      targets.map((t) =>
                        t.id === activeTarget.id
                          ? { ...t, latitude: result.latitude, longitude: result.longitude, address: result.label }
                          : t
                      )
                    );
                  }}
                  type="button"
                >
                  📍 {result.label}
                </button>
              ))}

              <Field label="Poznámka k příjezdu pro klienta">
                <textarea
                  className="input min-h-16 text-xs"
                  placeholder="Instrukce k příjezdu, parkoviště…"
                  value={activeTarget.note || ''}
                  onChange={(e) => updateActiveTarget({ note: e.target.value })}
                />
              </Field>

              <div className="rounded-xl border border-sky-200 bg-white p-3 space-y-3">
                <div>
                  <p className="text-xs font-bold text-slate-900">Fotografie této provozovny</p>
                  <p className="mt-1 text-[11px] text-slate-500">Zobrazí se klientovi v hlavičce nabídky.</p>
                </div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sky-400 px-3 py-2.5 text-xs font-bold text-sky-800 hover:bg-sky-50">
                  <Upload size={15} />
                  {activeTarget.photoUrl ? 'Změnit fotografii provozovny' : 'Nahrát fotografii provozovny'}
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                        setMessage('Fotografie provozovny musí být ve formátu JPG, PNG nebo WebP.');
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setMessage('Fotografie provozovny může mít maximálně 5 MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        updateActiveTarget({ photoUrl: String(reader.result) });
                        setMessage('');
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {activeTarget.photoUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200">
                    <img alt="Fotografie cílové provozovny" className="h-36 w-full object-cover" src={activeTarget.photoUrl} />
                    <button
                      className="absolute right-2 top-2 rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                      onClick={() => updateActiveTarget({ photoUrl: null })}
                      type="button"
                    >
                      Odstranit
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 cursor-pointer"
                  onClick={() => setMode('target')}
                  type="button"
                >
                  <MapPin size={15} /> Zaměřit tuto prodejnu na mapě
                </button>
                {activeTarget.latitude && activeTarget.longitude ? (
                  <span className="text-[11px] font-mono text-slate-500">
                    {activeTarget.latitude.toFixed(4)}, {activeTarget.longitude.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-rose-600">⚠️ Není v mapě</span>
                )}
              </div>
            </div>
          ) : null}
        </section>

        {/* Financial Calculation Summary Card */}
        <section className="card space-y-3 bg-slate-900 text-white">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Calculator size={18} className="text-sky-400" />
            <h2 className="text-base font-bold text-white">Rozpad kalkulace nabídky</h2>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Pronájem bodů (rok):</span>
              <strong className="text-white">
                {totals.rental.toLocaleString('cs-CZ')} Kč
                <span className="text-[10px] text-sky-400 font-normal ml-1">({Math.round(totals.rental / 12).toLocaleString('cs-CZ')} Kč/měs)</span>
              </strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Výroba rámu D-FLEX:</span>
              <strong className="text-white">{totals.frame.toLocaleString('cs-CZ')} Kč</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>UV tisk na Dibond:</span>
              <strong className="text-white">{totals.production.toLocaleString('cs-CZ')} Kč</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Montáž / Instalace:</span>
              <strong className="text-white">{totals.installation.toLocaleString('cs-CZ')} Kč</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Demontáž / Deinstalace:</span>
              <strong className="text-white">{totals.removal.toLocaleString('cs-CZ')} Kč</strong>
            </div>

            <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm text-sky-400">
              <span>Celkem bez DPH:</span>
              <span>{totals.subtotal.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>DPH 21 %:</span>
              <span>{totals.tax.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div className="border-t border-slate-700 pt-2 flex justify-between font-black text-base text-white">
              <span>Celkem s DPH:</span>
              <span className="text-emerald-400">{totals.totalWithTax.toLocaleString('cs-CZ')} Kč</span>
            </div>
          </div>
        </section>

        <section className="card space-y-3">
          <Field label="Interní poznámka">
            <textarea className="input min-h-16 text-xs" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
          </Field>
          <Field label="Úvodní zpráva klientovi">
            <textarea className="input min-h-20 text-xs" placeholder="Vážený kliente, navrhujeme tyto navigační trasy k vaší provozovně…" value={clientMessage} onChange={(e) => setClientMessage(e.target.value)} />
          </Field>
        </section>

        <button className="btn-primary inline-flex w-full items-center justify-center gap-2 shadow-md" disabled={saving} onClick={() => void save()} type="button">
          <Save size={17} />
          {saving ? 'Ukládám nabídku…' : 'Uložit nabídku navigace'}
        </button>

        {initialOffer?.id && canDownloadInstallationSheet(initialOffer) && (
          <a
            href={`/api/proposals/${initialOffer.id}/installation-sheet`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-950 hover:bg-amber-100 transition shadow-xs cursor-pointer"
          >
            📋 Stáhnout Montážní list pro techniky (PDF)
          </a>
        )}

        {initialOffer?.id && (
          <a
            href={`/mobile-surveys/${initialOffer.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-950 hover:bg-emerald-100 transition shadow-xs cursor-pointer"
          >
            📍 Otevřít v Mobilním Průzkumu lokalit
          </a>
        )}

        {message && <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 border border-amber-200" role="alert">{message}</p>}
      </aside>

      {/* Main Interactive Map & Navigation Points */}
      <main className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition flex items-center gap-1.5"
              onClick={handleAddPoint}
              type="button"
            >
              <Plus size={15} /> + Přidat navigační bod
            </button>
            <button
              className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'target' ? 'bg-rose-600 text-white shadow-xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setMode('target')}
              type="button"
            >
              <Crosshair size={15} /> Zaměřit cíl ({activeTarget?.name || 'Prodejnu'})
            </button>

            {targets.length > 0 && points.length > 0 && (
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
                onClick={() => void recalculateAllRoutes()}
                disabled={recalculatingRoutes}
                type="button"
                title="Přepočítat jízdní trasy pro všechny body k jejich cílovým prodejnám přes Google Routes API"
              >
                <RefreshCw size={14} className={recalculatingRoutes ? 'animate-spin text-sky-600' : ''} />
                {recalculatingRoutes ? 'Přepočítávám trasy...' : 'Přepočítat reálné trasy'}
              </button>
            )}
          </div>

          <span className="text-xs font-semibold text-slate-500">
            {points.length} bodů · {targets.length} {targets.length === 1 ? 'prodejna' : targets.length < 5 ? 'prodejny' : 'prodejen'} 🎯
          </span>
        </div>

        <GoogleNavigationOfferMap
          mode={mode}
          targets={targets.map((t) => ({
            latitude: t.latitude,
            longitude: t.longitude,
            label: t.name,
            address: t.address,
            color: t.color,
          }))}
          target={activeTarget ? {
            latitude: activeTarget.latitude,
            longitude: activeTarget.longitude,
            label: activeTarget.name || 'Cíl navigace',
            address: activeTarget.address,
            color: activeTarget.color,
          } : undefined}
          onTargetSelect={(place) => {
            if (activeTarget) {
              const updatedTarget = {
                ...activeTarget,
                latitude: place.latitude,
                longitude: place.longitude,
                name: activeTarget.name || place.label,
                address: place.address || activeTarget.address,
              };
              const updatedTargets = targets.map((t) => (t.id === activeTarget.id ? updatedTarget : t));
              setTargets(updatedTargets);
              setMode('point');
              void recalculateAllRoutes(updatedTargets);
            }
          }}
          onMapClick={mapClick}
          onPointMove={async (id: string, latitude: number, longitude: number, _dist?: number, _poly?: string, passedAddress?: string) => {
            updatePoint(id, { latitude, longitude });

            let freshAddress = passedAddress;
            const currentPoint = points.find((p) => p.id === id);
            if (!freshAddress || freshAddress === currentPoint?.address) {
              freshAddress = await reverseGeocodeLocation(latitude, longitude);
            }

            const streetPart = freshAddress ? freshAddress.split(',')[0]?.trim() : '';
            const isHighway = isRestrictedHighwayOr1stClassRoad(freshAddress || '');
            const isHeritage = isOstravaRestrictedZone(latitude, longitude, freshAddress || '');

            let newLabel = currentPoint?.label || `Bod ${id}`;
            if (isHeritage) {
              newLabel = `⚠️ Bod v Památkové zóně (${streetPart || 'centrum'})`;
            } else if (isHighway) {
              newLabel = `⚠️ Bod na I. třídě (${streetPart || 'hlavní tah'})`;
            } else if (streetPart && !/č\.p\.|ostrava|česko/i.test(streetPart)) {
              newLabel = `Příjezdový bod na ${streetPart}`;
            }

            const addrObj = freshAddress ? { address: freshAddress, label: newLabel } : { label: newLabel };
            updatePoint(id, { latitude, longitude, ...addrObj });

            const ptTarget = targets.find((t) => t.id === currentPoint?.targetId) || targets[0];
            if (ptTarget && ptTarget.latitude && ptTarget.longitude) {
              const routeInfo = await fetchRouteInfo(latitude, longitude, ptTarget.latitude, ptTarget.longitude);
              updatePoint(id, { latitude, longitude, ...addrObj, ...routeInfo });
            }
          }}
          points={points}
        />

        {/* Itemized Points Editor & Photo Visualizer Trigger */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <h2 className="text-xl font-bold text-slate-900">Vytipované navigační body na trase ({points.length})</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {points.length > 0 && (
                <button
                  type="button"
                  onClick={applyCatalogRatesToAllPoints}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs hover:bg-amber-100 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Aplikovat výchozí ceníkové ceny na všechny body"
                >
                  <Zap size={14} className="text-amber-600 fill-amber-500" />
                  <span>⚡ Načíst ceníkové sazby pro všechny body</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 cursor-pointer font-bold"
                onClick={handleAddPoint}
              >
                <Plus size={14} /> Přidat navigační bod
              </button>
            </div>
          </div>

          {points.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">Zatím nebyly přidány žádné navigační body.</p>
              <p className="text-xs mt-1">Klikněte tlačítkem myši do mapy výše pro umístění prvního navigačního bodu na trase.</p>
            </div>
          ) : (
            points.map((point, index) => (
              <div className="card space-y-4 border border-slate-200 bg-white p-5 shadow-sm" key={point.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Reordering Controls (Up / Down & Selector) */}
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => movePoint(index, index - 1)}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 transition cursor-pointer"
                        title="Posunout bod výše v pořadí"
                      >
                        <ArrowUp size={14} />
                      </button>

                      <span className="flex h-6 px-2.5 items-center justify-center rounded-md bg-sky-100 font-mono text-xs font-black text-sky-900">
                        #{index + 1}
                      </span>

                      <button
                        type="button"
                        disabled={index === points.length - 1}
                        onClick={() => movePoint(index, index + 1)}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 transition cursor-pointer"
                        title="Posunout bod níže v pořadí"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    {points.length > 1 && (
                      <select
                        value={index}
                        onChange={(e) => movePoint(index, Number(e.target.value))}
                        className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 cursor-pointer hover:border-slate-300 transition"
                        title="Změnit pořadí bodu v trase"
                      >
                        {points.map((_, posIdx) => (
                          <option key={posIdx} value={posIdx}>
                            Pořadí #{posIdx + 1}
                          </option>
                        ))}
                      </select>
                    )}

                    <h3 className="font-extrabold text-slate-900 text-sm ml-1">{point.label}</h3>

                    {point.realDistanceText && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                        <Compass size={13} /> {point.realDistanceText}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyCatalogRatesToPoint(point.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer"
                      title="Načíst aktuální ceníkové sazby z Nastavení"
                    >
                      <Zap size={13} className="text-amber-600 fill-amber-500" /> Načíst ceník
                    </button>

                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100 transition"
                      onClick={() => setActiveVisualizerPointId(point.id)}
                      type="button"
                    >
                      <ImageIcon size={15} /> Foto-vizualizátor cedule
                    </button>

                    <button
                      aria-label={`Odstranit ${point.label}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                      onClick={() => setPoints((current) => current.filter((row) => row.id !== point.id))}
                      type="button"
                    >
                      <Trash2 size={15} /> Smazat bod
                    </button>
                  </div>
                </div>

                {/* Render preview of generated sign visualization if available */}
                <div className={`rounded-xl border p-3 ${point.sitePhotoUrl ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/60'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    {point.sitePhotoUrl ? <img alt={`Reálný sloup pro ${point.label}`} className="h-20 w-28 rounded-lg border object-cover" src={point.sitePhotoUrl} /> : <div className="grid h-20 w-28 place-items-center rounded-lg border border-dashed border-amber-300 text-amber-700"><ImageIcon size={22} /></div>}
                    <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-900">Reálná fotografie sloupu – povinné terénní ověření</p><p className="mt-1 text-[11px] text-slate-600">AI bod je pouze návrh. Vyfoťte vhodný sloup a podle skutečnosti upravte bod i typ konstrukce.</p></div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50"><Upload size={14} />{point.sitePhotoUrl ? 'Nahradit fotografii sloupu' : 'Nahrát fotografii sloupu'}<input accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUploadDesktopPhoto(point.id, file); event.target.value = ''; }} /></label>
                  </div>
                </div>

                {point.visualizedPhotoUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                    <img alt="Vizualizace" className="h-16 w-24 object-cover rounded-lg border" src={point.visualizedPhotoUrl} />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">✓ Vygenerována grafická vizualizace cedule</p>
                      <p className="text-[11px] text-emerald-700">Tento snímek se zobrazí klientovi v fotodokumentaci i v nabídce.</p>
                    </div>
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100">
                  <Upload size={14} />
                  {point.visualizedPhotoUrl ? 'Nahradit hotovou vizualizaci' : 'Nahrát hotovou vizualizaci'}
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                        setMessage('Vizualizace musí být JPG, PNG nebo WebP do 5 MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => updatePoint(point.id, { visualizedPhotoUrl: String(reader.result) });
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {targets.length > 1 && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-sky-950 mb-1 flex items-center justify-between">
                        <span>🎯 Cílová pobočka pro tento bod</span>
                        <span className="text-[10px] text-slate-500 font-normal">Trasa se počítá k této pobočce</span>
                      </label>
                      <select
                        className="input font-bold text-sky-900 border-sky-300 bg-sky-50/70"
                        value={point.targetId || targets[0]?.id}
                        onChange={async (e) => {
                          const newTid = e.target.value;
                          const chosenT = targets.find((t) => t.id === newTid) || targets[0];
                          updatePoint(point.id, {
                            targetId: newTid,
                            targetLatitude: chosenT?.latitude,
                            targetLongitude: chosenT?.longitude,
                          });
                          if (chosenT && chosenT.latitude && chosenT.longitude) {
                            const routeInfo = await fetchRouteInfo(point.latitude, point.longitude, chosenT.latitude, chosenT.longitude);
                            updatePoint(point.id, {
                              targetId: newTid,
                              targetLatitude: chosenT.latitude,
                              targetLongitude: chosenT.longitude,
                              ...routeInfo,
                            });
                          }
                        }}
                      >
                        {targets.map((t, tIdx) => (
                          <option key={t.id} value={t.id}>
                            🏬 #{tIdx + 1} {t.name} {t.address ? `(${t.address})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <Field label="Označení bodu">
                    <input className="input" value={point.label} onChange={(e) => updatePoint(point.id, { label: e.target.value })} />
                  </Field>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Směrová šipka (Enum)</label>
                    <select
                      className="input font-bold text-sky-800"
                      value={point.arrowDirectionEnum || 'STRAIGHT'}
                      onChange={(e) => updatePoint(point.id, { arrowDirectionEnum: e.target.value as DraftPoint['arrowDirectionEnum'] })}
                    >
                      <option value="STRAIGHT">⬆ Rovně (STRAIGHT)</option>
                      <option value="LEFT">⬅ Vlevo (LEFT)</option>
                      <option value="RIGHT">➔ Vpravo (RIGHT)</option>
                      <option value="SLANTED_LEFT">↖ Šikmo vlevo (SLANTED_LEFT)</option>
                      <option value="SLANTED_RIGHT">↗ Šikmo vpravo (SLANTED_RIGHT)</option>
                      <option value="U_TURN">↩ Otočení (U_TURN)</option>
                      <option value="TWO_WAY">↔ Obousměrný (TWO_WAY)</option>
                      <option value="ROUNDABOUT_1">🔄 Kruhový objezd – 1. výjezd (ROUNDABOUT_1)</option>
                      <option value="ROUNDABOUT_2">🔄 Kruhový objezd – 2. výjezd (ROUNDABOUT_2)</option>
                      <option value="ROUNDABOUT_3">🔄 Kruhový objezd – 3. výjezd (ROUNDABOUT_3)</option>
                      <option value="ROUNDABOUT_4">🔄 Kruhový objezd – 4. výjezd (ROUNDABOUT_4)</option>
                      <option value="ROUNDABOUT_5">🔄 Kruhový objezd – 5. výjezd (ROUNDABOUT_5)</option>
                      <option value="ROUNDABOUT">🔄 Kruhový objezd – obecně (ROUNDABOUT)</option>
                    </select>
                  </div>

                  <Field label="Číslo sloupu (pillarNumber)">
                    <input className="input" placeholder="např. VO #142" value={point.pillarNumber || ''} onChange={(e) => updatePoint(point.id, { pillarNumber: e.target.value })} />
                  </Field>

                  <Field label="Typ sloupu / konstrukcí">
                    <input className="input" placeholder="např. Sloup veřejného osvětlení" value={point.pillarType || ''} onChange={(e) => updatePoint(point.id, { pillarType: e.target.value })} />
                  </Field>

                  <Field label="Typ navigačního nosiče">
                    <input className="input" value={point.navigationType} onChange={(e) => updatePoint(point.id, { navigationType: e.target.value })} />
                  </Field>

                  <Field label="Rozměr / varianta">
                    <div className="space-y-1.5">
                      <input className="input" value={point.variant} onChange={(e) => updatePoint(point.id, { variant: e.target.value })} />
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => updatePoint(point.id, { variant: '670 × 900 mm' })}
                          className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-sky-100 hover:border-sky-300"
                        >
                          670 × 900 mm (Ostrava)
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePoint(point.id, { variant: 'Havířov – atyp s horním půlkruhem' })}
                          className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-sky-100 hover:border-sky-300"
                        >
                          Havířov – půlkruh
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePoint(point.id, { variant: '120 × 80 cm' })}
                          className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-sky-100 hover:border-sky-300"
                        >
                          120 × 80 cm
                        </button>
                      </div>
                    </div>
                  </Field>

                  {/* Distance Source & Values */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Zdroj zobrazované vzdálenosti</label>
                    <select
                      className="input"
                      value={point.distanceSource || 'CALCULATED'}
                      onChange={(e) => updatePoint(point.id, { distanceSource: e.target.value as DraftPoint['distanceSource'] })}
                    >
                      <option value="CALCULATED">⚡ Automaticky z Google Routes API</option>
                      <option value="MANUAL">✏️ Ručně nastavená vzdálenost</option>
                    </select>
                  </div>

                  {point.distanceSource === 'MANUAL' ? (
                    <div>
                      <label className="block text-xs font-bold text-amber-800 mb-1">Ruční hodnota a jednotka</label>
                      <div className="flex gap-1">
                        <input
                          className="input flex-1"
                          type="number"
                          placeholder="250"
                          value={point.manualDistanceValue || ''}
                          onChange={(e) => updatePoint(point.id, { manualDistanceValue: e.target.value })}
                        />
                        <select
                          className="input w-20 text-xs font-bold"
                          value={point.manualDistanceUnit || 'METERS'}
                          onChange={(e) => updatePoint(point.id, { manualDistanceUnit: e.target.value as DraftPoint['manualDistanceUnit'] })}
                        >
                          <option value="METERS">m</option>
                          <option value="KILOMETERS">km</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">Vypočtená trasování z Google</label>
                      <div className="input bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-between">
                        <span>{point.calculatedDistanceMeters ? `${point.calculatedDistanceMeters} m` : 'Nepočítáno'}</span>
                        <span className="text-[10px] text-slate-400">Routes API</span>
                      </div>
                    </div>
                  )}

                  <Field label="Počet ks">
                    <input className="input" min="0.01" step="0.01" type="number" value={point.quantity} onChange={(e) => updatePoint(point.id, { quantity: e.target.value })} />
                  </Field>

                  <Field label="Pronájem nosiče (Cena/ks/rok)">
                    <div className="space-y-1">
                      <input className="input font-bold text-sky-900" min="0" step="0.01" type="number" value={point.unitPrice} onChange={(e) => updatePoint(point.id, { unitPrice: e.target.value })} />
                      {Number(point.unitPrice) > 0 && (
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                          <span>📅 {Number(point.unitPrice).toLocaleString('cs-CZ')} Kč / rok</span>
                          <span className="text-sky-700 font-bold">🗓️ {Math.round(Number(point.unitPrice) / 12).toLocaleString('cs-CZ')} Kč / měs</span>
                        </div>
                      )}
                    </div>
                  </Field>

                  <Field label="Výroba rámu – Rám D-FLEX (Cena/ks)">
                    <input className="input font-bold" min="0" step="0.01" type="number" value={point.framePrice} onChange={(e) => updatePoint(point.id, { framePrice: e.target.value })} />
                  </Field>

                  <Field label="UV tisk na Dibond (Cena/ks)">
                    <input className="input font-bold" min="0" step="0.01" type="number" value={point.productionPrice} onChange={(e) => updatePoint(point.id, { productionPrice: e.target.value })} />
                  </Field>

                  <Field label="Montáž / Instalace (Cena/ks)">
                    <input className="input" min="0" step="0.01" type="number" value={point.installationPrice} onChange={(e) => updatePoint(point.id, { installationPrice: e.target.value })} />
                  </Field>

                  <Field label="Demontáž / Deinstalace (Cena/ks)">
                    <input className="input" min="0" step="0.01" type="number" value={point.removalPrice} onChange={(e) => updatePoint(point.id, { removalPrice: e.target.value })} />
                  </Field>

                  <Field label="Adresa / Popis umístění">
                    <input className="input" placeholder="Ulice, křižovatka, sloup č. …" value={point.address} onChange={(e) => updatePoint(point.id, { address: e.target.value })} />
                  </Field>

                  <Field label="Poznámka pro klienta v nabídce">
                    <input className="input" placeholder="Vytipovaná křižovatka 350m před odbočkou…" value={point.clientNote} onChange={(e) => updatePoint(point.id, { clientNote: e.target.value })} />
                  </Field>

                  <Field label="Interní poznámka (skrytá)">
                    <input className="input" value={point.internalNote} onChange={(e) => updatePoint(point.id, { internalNote: e.target.value })} />
                  </Field>

                  {/* Desktop Photo & Visualizer Action Card */}
                  <div className="col-span-full border-t border-slate-200 pt-3 mt-1">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        {point.sitePhotoUrl ? (
                          <div className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-300 bg-slate-200 shrink-0">
                            <img src={point.sitePhotoUrl} alt="Fotka sloupu" className="w-full h-full object-cover" />
                            <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer transition">
                              Změnit
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) handleUploadDesktopPhoto(point.id, e.target.files[0]);
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="w-20 h-20 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-100/50 flex flex-col items-center justify-center text-sky-700 cursor-pointer shrink-0 transition text-center p-1">
                            <Upload size={18} />
                            <span className="text-[10px] font-bold mt-1">Nahrát fotku sloupu</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleUploadDesktopPhoto(point.id, e.target.files[0]);
                              }}
                            />
                          </label>
                        )}

                        <div>
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Camera size={14} className="text-sky-600" /> Reálná fotka sloupu / křižovatky
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {point.sitePhotoUrl
                              ? '✓ Fotka sloupu je nahraná. Nahoře kliknutím na tlačítko "Foto-vizualizátor cedule" se ihned načte jako pozadí.'
                              : 'Nahrajte fotku sloupu z počítače nebo z terénního průzkumu pro tvorbu vizualizace navigační tabule.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Visualizer Modal Dialog */}
      {activePointForVisualizer && (
        <NavigationSignVisualizer
          initialSignText={targets.find((t) => t.id === activePointForVisualizer.targetId)?.name || targets[0]?.name || activePointForVisualizer.label}
          subText={activePointForVisualizer.navigationType || 'Směrová tabule'}
          distanceText={activePointForVisualizer.realDistanceText || (activePointForVisualizer.calculatedDistanceMeters ? (activePointForVisualizer.calculatedDistanceMeters >= 1000 ? `${(activePointForVisualizer.calculatedDistanceMeters / 1000).toFixed(1)} km` : `${activePointForVisualizer.calculatedDistanceMeters} m`) : '1,1 km')}
          arrowDirectionEnum={activePointForVisualizer.arrowDirectionEnum}
          orientation={activePointForVisualizer.orientation}
          pointLabel={activePointForVisualizer.label}
          initialPhotoUrl={activePointForVisualizer.sitePhotoUrl}
          onClose={() => setActiveVisualizerPointId(null)}
          onSaveVisualization={async (dataUrl) => {
            const pointId = activePointForVisualizer.id;
            setActiveVisualizerPointId(null);
            setMessage('⏳ Ukládám vytvořenou vizualizaci cedule...');
            const uploadedUrl = await uploadDataUrl(dataUrl);
            if (uploadedUrl) {
              updatePoint(pointId, { visualizedPhotoUrl: uploadedUrl });
              setMessage('✓ Vizualizace cedule byla úspěšně nahrána a připojena k bodu.');
            } else {
              updatePoint(pointId, { visualizedPhotoUrl: dataUrl });
              setMessage('✓ Vizualizace byla připojena k bodu.');
            }
          }}
        />
      )}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="card max-w-md w-full space-y-4 shadow-2xl bg-white border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus size={18} className="text-sky-600" /> Rychlé vytvoření nového klienta
              </h3>
              <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setShowClientModal(false)}>
                <X size={18} />
              </button>
            </div>

            {clientError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 font-medium">
                {clientError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Název klienta / firmy *</label>
                <input
                  className="input w-full"
                  placeholder="Např. Decathlon Ostrava s.r.o."
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">IČO</label>
                  <input
                    className="input w-full"
                    placeholder="12345678"
                    value={newClientIco}
                    onChange={(e) => setNewClientIco(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Kontaktní osoba</label>
                  <input
                    className="input w-full"
                    placeholder="Jan Novák"
                    value={newClientContact}
                    onChange={(e) => setNewClientContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">E-mail</label>
                  <input
                    className="input w-full"
                    type="email"
                    placeholder="jan.novak@firma.cz"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Telefon</label>
                  <input
                    className="input w-full"
                    placeholder="+420 777 123 456"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowClientModal(false)}>
                Zrušit
              </button>
              <button
                type="button"
                className="btn btn-primary text-xs flex items-center gap-1.5"
                disabled={creatingClient}
                onClick={handleCreateClient}
              >
                {creatingClient ? 'Ukládám...' : 'Vytvořit a vybrat klienta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span className="mb-1 block text-xs font-bold text-slate-800">{label}</span>
      {children}
    </label>
  );
}
