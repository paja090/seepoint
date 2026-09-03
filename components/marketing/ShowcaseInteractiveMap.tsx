'use client';

import { useEffect, useState } from 'react';
import { OSTRAVA_RESTRICTED_ZONES_GEOJSON } from '@/lib/maps/ostrava-restricted-zones-data';

export function ShowcaseInteractiveMap() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative min-h-[420px] w-full rounded-2xl bg-slate-950 flex items-center justify-center border border-slate-800">
        <span className="text-xs text-purple-400 font-bold animate-pulse">Načítám živou interaktivní mapu sítě...</span>
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

    // Initialize Map centered around Ostrava region
    const map = L.map(mapContainer, {
      center: [49.8355, 18.2535],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    // High-quality dark canvas tile layer (Esri Dark Gray Canvas - fast CDN, no watermark, no API key required)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri &copy; OpenStreetMap contributors',
      maxZoom: 16,
    }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 16,
    }).addTo(map);

    // Custom Icon Generator
    const createCustomPin = (color: string, label: string) =>
      L.divIcon({
        className: 'custom-showcase-pin',
        html: `
          <div style="background-color: ${color};" class="size-6 rounded-full border-2 border-white shadow-xl flex items-center justify-center font-bold text-[10px] text-white transition hover:scale-125">
            ${label}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

    // Dense Real Network of 24 Carriers across Ostrava, Opava, Havířov, Poruba
    const markers = [
      // 1. Promo Towers & Bigboards
      { lat: 49.8155, lng: 18.2635, title: 'Promo Tower Místecká (4 strany A,B,C,D)', type: 'PROMO TOWER', price: '24 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#a855f7', code: 'TOW-MIST-01' },
      { lat: 49.8295, lng: 18.2255, title: 'Promo Tower Rudná × Závodní', type: 'PROMO TOWER', price: '22 500 Kč / měsíc', status: 'Volné od 1.10.', color: '#a855f7', code: 'TOW-RUDN-02' },
      { lat: 49.8455, lng: 18.2915, title: 'Promo Tower Sokolská třída (Centrum)', type: 'PROMO TOWER', price: '26 000 Kč / měsíc', status: 'Rezervováno', color: '#a855f7', code: 'TOW-SOK-03' },
      { lat: 49.7895, lng: 18.2545, title: 'Bigboard D1 Exit 354 Ostrava-Jih', type: 'BIGBOARD 9.6×3.6', price: '38 000 Kč / měsíc', status: 'Obsazeno (Škoda Auto)', color: '#ec4899', code: 'BIG-D1-01' },

      // 2. City Postery (CLP) - Centrum, Poruba, Svinov
      { lat: 49.8355, lng: 18.2885, title: 'City Poster (CLP) 28. října u Pošty', type: 'CITY POSTER', price: '6 800 Kč / měsíc', status: 'Rezervováno', color: '#38bdf8', code: 'CP-OSTR-012' },
      { lat: 49.8315, lng: 18.2755, title: 'City Poster Nádražní × Stodolní', type: 'CITY POSTER', price: '7 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-N очередной-04' },
      { lat: 49.8275, lng: 18.1635, title: 'City Poster Poruba Hlavní třída', type: 'CITY POSTER', price: '6 200 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-POR-18' },
      { lat: 49.8345, lng: 18.1875, title: 'City Poster Svinov Mosty (MHD Terminál)', type: 'CITY POSTER', price: '8 900 Kč / měsíc', status: 'Obsazeno (Kaufland)', color: '#38bdf8', code: 'CP-SVIN-01' },
      { lat: 49.8395, lng: 18.2795, title: 'City Poster Českobratrská u Konzervatoře', type: 'CITY POSTER', price: '5 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-CESK-09' },

      // 3. Reklamní Lavičky MHD
      { lat: 49.8245, lng: 18.1725, title: 'Lavička MHD Kubánská 4A (Poruba)', type: 'LAVIČKY / MOBILIÁŘ', price: '3 200 Kč / měsíc', status: 'Volné k pronájmu', color: '#10b981', code: 'PL-OP24' },
      { lat: 49.8185, lng: 18.2415, title: 'Lavička MHD Hrabůvka Poliklinika', type: 'LAVIČKY / MOBILIÁŘ', price: '2 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#10b981', code: 'PL-HRAB-07' },
      { lat: 49.8415, lng: 18.2835, title: 'Lavička MHD Důl Jindřich (Centrum)', type: 'LAVIČKY / MOBILIÁŘ', price: '3 800 Kč / měsíc', status: 'Obsazeno', color: '#10b981', code: 'PL-JIND-02' },
      { lat: 49.8285, lng: 18.2615, title: 'Lavička MHD Vítkovice Mírové náměstí', type: 'LAVIČKY / MOBILIÁŘ', price: '2 800 Kč / měsíc', status: 'Volné k pronájmu', color: '#10b981', code: 'PL-VITK-11' },

      // 4. Billboardy Euroformát (5.1 × 2.4 m)
      { lat: 49.8215, lng: 18.2125, title: 'Billboard Rudná u OC Kotva (Směr Centrum)', type: 'BILLBOARD 5.1×2.4', price: '11 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-RUDN-04' },
      { lat: 49.8425, lng: 18.2235, title: 'Billboard Opavská u VŠB-TUO', type: 'BILLBOARD 5.1×2.4', price: '12 900 Kč / měsíc', status: 'Rezervováno', color: '#6366f1', code: 'BB-VSB-01' },
      { lat: 49.7945, lng: 18.2685, title: 'Billboard Místecká × Prodloužená Mostní', type: 'BILLBOARD 5.1×2.4', price: '14 200 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-MIST-09' },
      { lat: 49.8515, lng: 18.2985, title: 'Billboard Bohumínská u Bazalů', type: 'BILLBOARD 5.1×2.4', price: '10 800 Kč / měsíc', status: 'Obsazeno', color: '#6366f1', code: 'BB-BAZ-03' },

      // 5. Navigační desky na sloupech VO (Veřejné osvětlení)
      { lat: 49.8375, lng: 18.2615, title: 'Navigační tabule VO Mariánské Hory', type: 'NAVIGACE VO', price: '1 800 Kč / měsíc', status: 'Aktivní licence', color: '#f97316', code: 'NAV-MAR-05' },
      { lat: 49.8165, lng: 18.1585, title: 'Navigační tabule VO 17. listopadu (Poruba)', type: 'NAVIGACE VO', price: '1 950 Kč / měsíc', status: 'Volný sloupec VO', color: '#f97316', code: 'NAV-POR-22' },
      { lat: 49.8055, lng: 18.2485, title: 'Navigační tabule VO Výškovická (Jih)', type: 'NAVIGACE VO', price: '1 750 Kč / měsíc', status: 'Volný sloupec VO', color: '#f97316', code: 'NAV-VYSK-18' },
      { lat: 49.9385, lng: 17.8985, title: 'Navigační tabule VO Olomoucká #142 (Opava)', type: 'NAVIGACE VO', price: '1 950 Kč / měsíc', status: 'Volný sloupec VO', color: '#f97316', code: 'NAV-OPAV-14' },

      // 6. Havířov & Karviná Region
      { lat: 49.7785, lng: 18.4385, title: 'Promo Tower Hlavní třída (Havířov)', type: 'PROMO TOWER', price: '19 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#a855f7', code: 'TOW-HAV-01' },
      { lat: 49.7845, lng: 18.4215, title: 'Billboard Dělnická u Nádraží (Havířov)', type: 'BILLBOARD 5.1×2.4', price: '9 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-HAV-04' },
      { lat: 49.8545, lng: 18.5415, title: 'City Poster Ostravská (Karviná Centrum)', type: 'CITY POSTER', price: '5 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-KAR-02' },
    ];

    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: createCustomPin(m.color, '📍') }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;" class="space-y-1">
          <span style="font-size: 10px; font-weight: 800; color: ${m.color}; text-transform: uppercase;">${m.type} · ${m.code}</span>
          <h4 style="font-size: 13px; font-weight: 800; margin: 2px 0; color: #0f172a;">${m.title}</h4>
          <div style="font-size: 11px; font-weight: 600; color: ${m.status.includes('Obsazeno') ? '#dc2626' : '#047857'};">${m.status}</div>
          <div style="font-size: 12px; font-weight: 800; color: #4338ca; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px;">${m.price}</div>
        </div>
      `);
    });

    // Render all 12 official Ostrava restricted advertising / heritage zones from GeoJSON
    try {
      L.geoJSON(OSTRAVA_RESTRICTED_ZONES_GEOJSON, {
        style: {
          color: '#ef4444',
          fillColor: '#f87171',
          fillOpacity: 0.22,
          weight: 2,
          dashArray: '5, 5',
        },
        onEachFeature: (feature: { properties?: { CISLO?: string; ID?: string } }, layer: import('leaflet').Layer) => {
          const num = feature.properties?.CISLO || feature.properties?.ID || '';
          layer.bindTooltip(`Zóna zákazu šíření reklamy č. ${num} (Nařízení města č. 2/2020 a č. 11/2019)`, {
            sticky: true,
          });
        },
      }).addTo(map);
    } catch {
      // Ignore if geometry fails
    }

    return () => {
      map.remove();
    };
  }, [LModule, mapContainer]);

  return (
    <div className="relative w-full h-[450px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={setMapContainer} className="w-full h-full z-10" />

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-20 bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 backdrop-blur-md shadow-2xl text-[11px] font-bold text-slate-300 space-y-1.5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-1.5">
          <span className="text-[11px] uppercase tracking-wider font-black text-purple-400">Živá síť nosičů na mapě (24 nosičů)</span>
          <span className="text-[11px] text-emerald-400 font-extrabold flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            18 volných
          </span>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap pt-0.5 text-[11px]">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-purple-500" /> Promo Tower (5)</span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-sky-400" /> City Poster (6)</span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-indigo-500" /> Billboard (5)</span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-emerald-500" /> Lavičky (4)</span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-orange-500" /> Navigace VO (4)</span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-900/60 text-rose-300"><span className="size-2 rounded-full bg-rose-500" /> Památková zóna</span>
        </div>
      </div>
    </div>
  );
}
