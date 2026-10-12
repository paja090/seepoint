'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import type { MyRouteDTO, MyRouteStop } from '@/lib/field-planning/contracts';

export type GoogleMapType = 'roadmap' | 'hybrid';

const GOOGLE_MAP_LAYERS: Record<GoogleMapType, { url: string; maxZoom: number; label: string }> = {
  roadmap: { url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', maxZoom: 20, label: 'Google Mapa' },
  hybrid: { url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', maxZoom: 20, label: 'Satelitní' },
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

export function MyRouteMap({
  route,
  routes,
  height = 'h-[400px]',
}: {
  route?: MyRouteDTO['routes'][number];
  routes?: MyRouteDTO['routes'];
  height?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const layerInstance = useRef<TileLayer | null>(null);
  const [mapType, setMapType] = useState<GoogleMapType>('hybrid');

  useEffect(() => {
    let disposed = false;
    const allRoutes = routes && routes.length > 0 ? routes : route ? [route] : [];
    if (allRoutes.length === 0) return;

    void import('leaflet').then((L) => {
      if (disposed || !mapRef.current) return;

      const m = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([49.8, 15.5], 7);
      
      mapInstance.current = m;

      layerInstance.current = L.tileLayer(GOOGLE_MAP_LAYERS[mapType].url, {
        maxZoom: GOOGLE_MAP_LAYERS[mapType].maxZoom,
        subdomains: ['0', '1', '2', '3'],
      }).addTo(m);

      const bounds = L.latLngBounds([]);
      const ROUTE_COLORS = ['#0284c7', '#059669', '#7c3aed', '#d97706', '#db2777', '#475569'];

      allRoutes.forEach((r, routeIndex) => {
        const routeColor = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
        const stopPoints: [number, number][] = [];

        r.stops.forEach((stop: MyRouteStop, i: number) => {
          if (!stop.location) return;
          const pt: [number, number] = [stop.location.latitude, stop.location.longitude];
          stopPoints.push(pt);
          
          let color = allRoutes.length > 1 ? routeColor : '#0ea5e9';
          if (stop.status === 'DONE') color = '#10b981';
          else if (stop.status === 'IN_PROGRESS') color = '#3b82f6';
          else if (stop.status === 'ISSUE') color = '#ef4444';
          else if (stop.status === 'CANCELLED') color = '#ef4444';

          const isDone = stop.status === 'DONE';
          const isIssue = stop.status === 'ISSUE';
          const stopNumber = i + 1;
          
          const iconHtml = `
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              background-color: ${color};
              color: white;
              border-radius: 12px;
              font-weight: 900;
              font-size: 14px;
              border: 2px solid white;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, ${isIssue ? '0.35' : '0.15'});
              opacity: ${isDone ? 0.75 : 1};
              cursor: pointer;
            ">
              ${stopNumber}
              ${isDone ? `
                <span style="
                  position: absolute;
                  top: -5px;
                  right: -5px;
                  width: 15px;
                  height: 15px;
                  border-radius: 9999px;
                  background-color: #059669;
                  color: white;
                  font-size: 10px;
                  font-weight: 900;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 1.5px solid white;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                ">✓</span>
              ` : isIssue ? `
                <span style="
                  position: absolute;
                  top: -5px;
                  right: -5px;
                  width: 15px;
                  height: 15px;
                  border-radius: 9999px;
                  background-color: #dc2626;
                  color: white;
                  font-size: 10px;
                  font-weight: 900;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 1.5px solid white;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                ">!</span>
              ` : ''}
            </div>
          `;

          const marker = L.marker(pt, {
            icon: L.divIcon({ className: '', html: iconHtml, iconSize: [32, 32], iconAnchor: [16, 16] })
          });

          marker.on('click', () => {
            const el = document.getElementById(`stop-${stop.jobId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-4', 'ring-sky-400');
              setTimeout(() => el.classList.remove('ring-4', 'ring-sky-400'), 2000);
            }
          });
          
          const crewLabel = r.crewName ? `<span style="color: ${routeColor}; font-weight: bold;">Posádka: ${escapeHtml(r.crewName)}</span><br/>` : '';
          const tooltipHtml = `
            <div style="font-weight: bold; font-family: sans-serif; font-size: 12px; color: ${isIssue ? '#dc2626' : '#0f172a'};">
              ${isIssue ? '⚠️ ' : ''}#${stopNumber}. ${escapeHtml(stop.title)}
            </div>
            ${crewLabel}
            <div style="font-size: 11px; color: ${isIssue ? '#b91c1c' : '#64748b'}; font-family: sans-serif; margin-top: 2px;">
              ${escapeHtml(stop.issueType || stop.clientName || stop.workType)}
            </div>
          `;
          
          marker.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -16] }).addTo(m);
          bounds.extend(pt);
        });

        if (stopPoints.length > 1) {
          L.polyline(stopPoints, {
            color: routeColor,
            weight: 3,
            opacity: 0.6,
            dashArray: '5 7',
          }).addTo(m);
        }

        // Live vehicle location marker (simple pulsing blue location dot)
        if (r.liveLocation) {
          const livePt: [number, number] = [r.liveLocation.latitude, r.liveLocation.longitude];
          const isRecent = r.liveLocation.isRecent;
          const speedKmH = r.liveLocation.speed != null ? Math.round(r.liveLocation.speed * 3.6) : null;
          const speedText = speedKmH != null && speedKmH > 2 ? `${speedKmH} km/h` : 'Stojí na místě';
          const ageMs = Date.now() - new Date(r.liveLocation.updatedAt).getTime();
          const ageSeconds = Math.max(0, Math.round(ageMs / 1000));
          const ageText = ageSeconds < 60 ? `před ${ageSeconds} s` : `před ${Math.round(ageSeconds / 60)} min`;
          const crewLabel = r.crewName || `Posádka ${routeIndex + 1}`;

          const vehicleIconHtml = `
            <div style="
              position: relative;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
            ">
              <span style="
                position: absolute;
                inset: -5px;
                border-radius: 50%;
                background: ${isRecent ? 'rgba(2, 132, 199, 0.35)' : 'rgba(245, 158, 11, 0.3)'};
                animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></span>
              <span style="
                position: relative;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #0284c7;
                border: 2.5px solid white;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
              "></span>
            </div>
          `;

          const vehicleMarker = L.marker(livePt, {
            zIndexOffset: 1000,
            icon: L.divIcon({ className: '', html: vehicleIconHtml, iconSize: [24, 24], iconAnchor: [12, 12] }),
          });

          const vehicleTooltipHtml = `
            <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; line-height: 1.4;">
              <strong style="font-size: 12px; color: #0284c7;">📍 Moje aktuální poloha</strong><br/>
              <span style="color: #0f172a; font-weight: 700;">${escapeHtml(crewLabel)}</span><br/>
              ${r.vehicleName ? `<span style="color: #475569;">Vozidlo: ${escapeHtml(r.vehicleName)}</span><br/>` : ''}
              <span style="color: #0369a1; font-weight: 700;">Rychlost: ${speedText}</span> · 
              <span style="color: ${isRecent ? '#15803d' : '#b45309'}; font-weight: 600;">Signál: ${ageText}</span>
              ${r.liveLocation.workerName ? `<br/><span style="color: #64748b; font-size: 10px;">Vysílá: ${escapeHtml(r.liveLocation.workerName)}</span>` : ''}
            </div>
          `;

          vehicleMarker.bindTooltip(vehicleTooltipHtml, { direction: 'top', offset: [0, -12] }).addTo(m);
          bounds.extend(livePt);
        }
      });

      if (bounds.isValid()) {
        m.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    });

    return () => {
      disposed = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
      layerInstance.current = null;
    };
  }, [route, routes]);

  useEffect(() => {
    if (!mapInstance.current || !layerInstance.current) return;
    layerInstance.current.setUrl(GOOGLE_MAP_LAYERS[mapType].url);
  }, [mapType]);

  return (
    <div className={`relative w-full overflow-hidden rounded-3xl border border-slate-200 shadow-sm ${height}`}>
      <div ref={mapRef} className="h-full w-full" />
      
      {/* Map controls over the map */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
        <div className="flex overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-slate-900/10">
          {(Object.entries(GOOGLE_MAP_LAYERS) as [GoogleMapType, { label: string }][]).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setMapType(key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                mapType === key
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
