'use client';

import type { WorkOrderStatus, WorkPriority } from '@prisma/client';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { workPriorityLabels, workPriorityStyles, workStatusLabels, workStatusStyles } from '@/lib/work';
import { CG_PROJECT, extractCgStops } from '@/lib/work-projects';

type RouteCarrier = {
  id: string;
  code: string;
  name: string;
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type RouteOrder = {
  id: string;
  title: string;
  clientName: string;
  requestedBy?: string | null;
  description: string;
  locationNote?: string | null;
  mediaLabel?: string | null;
  scheduledAt: string;
  status: WorkOrderStatus;
  priority: WorkPriority;
  workers: string[];
  carrier?: RouteCarrier | null;
};

type WorkRoutePlannerProps = {
  defaultDate: string;
  initialOrders: RouteOrder[];
};

type ProjectFilter = 'ALL' | 'CG';

function localDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function hasCoordinates(carrier?: RouteCarrier | null): carrier is RouteCarrier & { latitude: number; longitude: number } {
  return Boolean(carrier && Number.isFinite(carrier.latitude) && Number.isFinite(carrier.longitude));
}

function destinationFor(order: RouteOrder) {
  if (hasCoordinates(order.carrier)) return `${order.carrier.latitude},${order.carrier.longitude}`;
  return [order.carrier?.address, order.carrier?.city, order.locationNote, order.clientName]
    .filter(Boolean)
    .join(', ');
}

function navigationUrl(order: RouteOrder, project: ProjectFilter) {
  const cgDestination = project === 'CG' ? extractCgStops(order.description).at(-1) : undefined;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cgDestination || destinationFor(order))}`;
}

function routeUrl(stops: string[], returnToBase: boolean) {
  const routeStops = stops.filter(Boolean);
  if (routeStops.length < 2) return undefined;
  const origin = routeStops[0];
  const destination = returnToBase ? origin : routeStops.at(-1);
  const waypoints = (returnToBase ? routeStops.slice(1) : routeStops.slice(1, -1)).slice(0, 9);
  const query = new URLSearchParams({ api: '1', origin, destination: destination || '' });
  if (waypoints.length) query.set('waypoints', waypoints.join('|'));
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

function changeDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat('en-CA').format(date);
}

export function WorkRoutePlanner({ defaultDate, initialOrders }: WorkRoutePlannerProps) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [worker, setWorker] = useState('ALL');
  const [project, setProject] = useState<ProjectFilter>('CG');
  const [returnToBase, setReturnToBase] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);

  const workers = useMemo(() => [...new Set(initialOrders.flatMap((order) => order.workers))]
    .sort((left, right) => left.localeCompare(right, 'cs')), [initialOrders]);
  const dayOrders = useMemo(() => initialOrders
    .filter((order) => localDate(order.scheduledAt) === selectedDate)
    .filter((order) => worker === 'ALL' || order.workers.includes(worker))
    .filter((order) => project === 'ALL' || (order.mediaLabel === CG_PROJECT.code && order.requestedBy === CG_PROJECT.requester))
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()), [initialOrders, selectedDate, worker, project]);
  const routeStops = useMemo(() => {
    if (project === 'CG') {
      const taskStops = dayOrders.flatMap((order) => extractCgStops(order.description));
      return [CG_PROJECT.baseAddress, ...taskStops]
        .filter((stop, index, all) => stop !== all[index - 1]);
    }
    return dayOrders.map(destinationFor).filter(Boolean);
  }, [dayOrders, project]);
  const locatedOrders = useMemo(() => dayOrders.filter((order) => hasCoordinates(order.carrier)), [dayOrders]);
  const fullRouteUrl = routeUrl(routeStops, project === 'CG' && returnToBase);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      const L = await import('leaflet');
      if (cancelled || !mapElementRef.current || mapRef.current) return;
      const map = L.map(mapElementRef.current, {
        center: [49.8209, 18.2625],
        zoom: 11,
        scrollWheelZoom: true,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      leafletRef.current = L;
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    }

    void initializeMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    locatedOrders.forEach((order) => {
      if (!hasCoordinates(order.carrier)) return;
      const orderIndex = dayOrders.findIndex((item) => item.id === order.id) + 1;
      const marker = L.circleMarker([order.carrier.latitude, order.carrier.longitude], {
        radius: 13,
        color: '#ffffff',
        weight: 3,
        fillColor: order.priority === 'URGENT' ? '#dc2626' : '#0369a1',
        fillOpacity: 1,
      });
      const tooltip = document.createElement('span');
      tooltip.textContent = `${orderIndex}. ${order.title}`;
      marker.bindTooltip(tooltip, { direction: 'top' }).addTo(layer);
      bounds.extend([order.carrier.latitude, order.carrier.longitude]);
    });

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    else map.setView([49.8209, 18.2625], 11);
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [dayOrders, locatedOrders, mapReady]);

  const formattedDate = new Intl.DateTimeFormat('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${selectedDate}T12:00:00`));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Pracovní výjezd</p>
          <h1 className="text-3xl font-bold">Denní trasa</h1>
          <p className="mt-2 text-slate-600">Více převozů a výstav lze spojit do jednoho výjezdu.</p>
        </div>
        <Link className="text-sm font-semibold text-sky-700 hover:text-sky-900" href="/work">← Zpět na plán práce</Link>
      </header>

      <section className="card grid gap-3 md:grid-cols-2 xl:grid-cols-[auto_auto_1fr_1fr_auto] xl:items-end">
        <div className="flex gap-2">
          <button className="rounded-xl border bg-white px-3 py-2 font-medium" onClick={() => setSelectedDate((value) => changeDate(value, -1))} type="button" aria-label="Předchozí den">←</button>
          <button className="rounded-xl border bg-white px-3 py-2 font-medium" onClick={() => setSelectedDate(new Intl.DateTimeFormat('en-CA').format(new Date()))} type="button">Dnes</button>
          <button className="rounded-xl border bg-white px-3 py-2 font-medium" onClick={() => setSelectedDate((value) => changeDate(value, 1))} type="button" aria-label="Další den">→</button>
        </div>
        <label className="text-sm font-medium">Datum<input className="input mt-1" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <label className="text-sm font-medium">Projekt<select className="input mt-1" value={project} onChange={(event) => setProject(event.target.value as ProjectFilter)}><option value="CG">Galerie venku CG</option><option value="ALL">Všechny pracovní úkoly</option></select></label>
        <label className="text-sm font-medium">Pracovník<select className="input mt-1" value={worker} onChange={(event) => setWorker(event.target.value)}><option value="ALL">Všichni pracovníci</option>{workers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        {fullRouteUrl && <a className="rounded-xl bg-sky-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-sky-800" href={fullRouteUrl} rel="noreferrer" target="_blank">Otevřít trasu v Google Maps ↗</a>}
      </section>

      {project === 'CG' && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Projekt {CG_PROJECT.code}</p>
              <h2 className="text-xl font-bold">{CG_PROJECT.name}</h2>
              <p className="mt-1 text-sm text-slate-700">Zadává {CG_PROJECT.requester} · základna {CG_PROJECT.baseName}, {CG_PROJECT.baseAddress}</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input checked={returnToBase} onChange={(event) => setReturnToBase(event.target.checked)} type="checkbox" />
              Na konci návrat do Ostravy
            </label>
          </div>
          {routeStops.length > 1 ? (
            <>
              <ol className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {routeStops.map((stop, index) => <li className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm" key={`${stop}-${index}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-700 font-bold text-white">{index + 1}</span><span>{stop}</span></li>)}
                {returnToBase && <li className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-700 font-bold text-white">{routeStops.length + 1}</span><span>{CG_PROJECT.baseAddress} · návrat</span></li>}
              </ol>
              <p className="mt-3 text-xs text-slate-600">Google Maps po otevření dopočítá kilometráž a dobu jízdy podle aktuální dopravy. Zastávky jsou načtené z popisu úkolů; před odjezdem je zkontrolujte.</p>
            </>
          ) : <p className="mt-4 text-sm text-amber-800">Pro tento den nebyla v úkolech nalezena žádná zastávka projektu CG.</p>}
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div ref={mapElementRef} className="absolute inset-0" role="region" aria-label={`Mapa pracovních úkolů pro ${formattedDate}`} />
          {locatedOrders.length === 0 && <div className="pointer-events-none absolute inset-x-4 top-4 z-[500] rounded-xl bg-white/95 p-3 text-center text-sm shadow">Přesné GPS body nejsou u těchto úkolů uloženy. Textové zastávky jsou připravené pro Google Maps.</div>}
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Úkoly výjezdu</p><h2 className="text-xl font-bold capitalize">{formattedDate}</h2></div><span className="text-sm font-semibold text-slate-500">{dayOrders.length} úkolů</span></div>
          {dayOrders.length === 0 ? <div className="card text-center"><p className="font-semibold">Na tento den není naplánovaná žádná práce.</p><p className="mt-1 text-sm text-slate-500">Vyberte jiný den, projekt nebo pracovníka.</p></div> : <ol className="space-y-3">{dayOrders.map((order, index) => {
            const located = hasCoordinates(order.carrier);
            const cgStops = project === 'CG' ? extractCgStops(order.description) : [];
            return <li className={`rounded-2xl border bg-white p-4 shadow-sm ${order.priority === 'URGENT' ? 'border-red-300' : 'border-slate-200'}`} key={order.id}>
              <div className="flex items-start gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-bold text-white ${order.priority === 'URGENT' ? 'bg-red-600' : 'bg-sky-700'}`}>{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${workStatusStyles[order.status]}`}>{workStatusLabels[order.status]}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${workPriorityStyles[order.priority]}`}>{workPriorityLabels[order.priority]}</span><span className="ml-auto text-xs font-semibold text-slate-500">{new Date(order.scheduledAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' })}</span></div>
                  <Link className="mt-2 block font-bold hover:text-sky-700" href={`/work/${order.id}`}>{order.title}</Link>
                  <p className="mt-1 text-sm text-slate-600">{order.clientName}</p>
                  <p className="mt-1 text-xs text-slate-500">{order.workers.join(', ') || 'Nepřiřazený pracovník'}</p>
                  {cgStops.length > 0 ? <p className="mt-2 text-sm font-medium text-slate-700">{cgStops.join(' → ')}</p> : <p className="mt-2 text-sm text-slate-700">{order.carrier ? `${order.carrier.code} · ${order.carrier.address || order.carrier.city}` : order.locationNote || 'Místo není upřesněno'}</p>}
                  {!located && <p className="mt-1 text-xs font-medium text-amber-700">Navigace použije textové místo z pracovního zadání.</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold"><a className="text-sky-700 hover:text-sky-900" href={navigationUrl(order, project)} rel="noreferrer" target="_blank">Navigovat ↗</a><Link className="text-slate-600 hover:text-slate-900" href={`/work/${order.id}`}>Otevřít zadání</Link>{order.carrier && <Link className="text-slate-600 hover:text-slate-900" href={`/carriers/${order.carrier.id}`}>Detail nosiče</Link>}</div>
                </div>
              </div>
            </li>;
          })}</ol>}
        </div>
      </section>
    </div>
  );
}
