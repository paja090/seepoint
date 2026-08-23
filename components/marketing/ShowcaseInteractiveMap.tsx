'use client';

import { useEffect, useState } from 'react';

export function ShowcaseInteractiveMap() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative min-h-[380px] w-full rounded-2xl bg-slate-950 flex items-center justify-center border border-slate-800">
        <span className="text-xs text-purple-400 font-bold animate-pulse">Načítám živou interaktivní Google / Dark mapu sítě...</span>
      </div>
    );
  }

  return <ShowcaseLeafletMapInner />;
}

function ShowcaseLeafletMapInner() {
  const [LModule, setLModule] = useState<typeof import('leaflet') | null>(null);
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setLModule(leaflet.default || leaflet);
    });
  }, []);

  useEffect(() => {
    if (!LModule || !mapContainer) return;

    // Load Leaflet CSS dynamically if not present
    if (!document.getElementById('leaflet-css-showcase')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-showcase';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const L = LModule;

    // Initialize Map centered around Ostrava
    const map = L.map(mapContainer, {
      center: [49.8355, 18.2535],
      zoom: 11,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    // Add CartoDB Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Custom Icon Generator
    const createCustomPin = (color: string, label: string) =>
      L.divIcon({
        className: 'custom-showcase-pin',
        html: `
          <div style="background-color: ${color};" class="size-6 rounded-full border-2 border-white shadow-xl flex items-center justify-center font-bold text-[10px] text-white animate-bounce">
            ${label}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

    // Sample Nosiče
    const markers = [
      {
        lat: 49.8155,
        lng: 18.2635,
        title: 'Promo Tower Místecká (4 strany A,B,C,D)',
        type: 'PROMO TOWER',
        price: '24 900 Kč / měsíc',
        status: 'Volné od 1.9.',
        color: '#a855f7',
        code: 'TOW-MIST-01',
      },
      {
        lat: 49.8355,
        lng: 18.2885,
        title: 'City Poster (CLP) 28. října u Pošty',
        type: 'CITY POSTER',
        price: '6 800 Kč / měsíc',
        status: 'Rezervováno',
        color: '#38bdf8',
        code: 'CP-OSTR-012',
      },
      {
        lat: 49.9385,
        lng: 17.8985,
        title: 'Navigační tabule VO Olomoucká #142',
        type: 'NAVIGACE VO',
        price: '1 950 Kč / měsíc',
        status: 'Volný sloupec VO',
        color: '#f97316',
        code: 'NAV-OPAV-14',
      },
      {
        lat: 49.8275,
        lng: 18.1635,
        title: 'City Poster Lavičky Poruba Hlavní',
        type: 'LAVIČKY / MOBILIÁŘ',
        price: '3 500 Kč / měsíc',
        status: 'Volno dnes',
        color: '#10b981',
        code: 'BENCH-POR-08',
      },
    ];

    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: createCustomPin(m.color, '📍') }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;" class="space-y-1">
          <span style="font-size: 10px; font-weight: 800; color: ${m.color}; text-transform: uppercase;">${m.type} · ${m.code}</span>
          <h4 style="font-size: 13px; font-weight: 800; margin: 2px 0; color: #0f172a;">${m.title}</h4>
          <div style="font-size: 11px; font-weight: 600; color: #047857;">${m.status}</div>
          <div style="font-size: 12px; font-weight: 800; color: #4338ca; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px;">${m.price}</div>
        </div>
      `);
    });

    // Add Translucent Polygon for Heritage Zone (Moravská Ostrava)
    const heritageZoneCoords: [number, number][] = [
      [49.8385, 18.2865],
      [49.8395, 18.2965],
      [49.8325, 18.2985],
      [49.8315, 18.2855],
    ];
    const polygon = L.polygon(heritageZoneCoords, {
      color: '#ef4444',
      fillColor: '#f87171',
      fillOpacity: 0.25,
      weight: 2,
      dashArray: '4, 4',
    }).addTo(map);
    polygon.bindTooltip('Památková zóna Moravská Ostrava (Nařízení č. 2/2020)', { sticky: true });

    return () => {
      map.remove();
    };
  }, [LModule, mapContainer]);

  return (
    <div className="relative w-full h-[400px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={setMapContainer} className="w-full h-full z-10" />

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-20 bg-slate-950/90 p-3 rounded-xl border border-slate-800 backdrop-blur-md shadow-xl text-[11px] font-bold text-slate-300 space-y-1.5 hidden sm:block">
        <div className="text-[10px] uppercase font-black text-slate-400">Živá síť nosičů na mapě</div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-purple-500" /> Promo Tower</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sky-400" /> City Poster</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-orange-500" /> Navigace VO</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> Lavičky</span>
          <span className="flex items-center gap-1.5 text-rose-400"><span className="size-2.5 rounded-full bg-rose-500" /> Památková zóna</span>
        </div>
      </div>
    </div>
  );
}
