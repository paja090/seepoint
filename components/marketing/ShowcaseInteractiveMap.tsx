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
  const [activeCity, setActiveCity] = useState<string>('Ostrava');
  const [mapInstance, setMapInstance] = useState<import('leaflet').Map | null>(null);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setLModule(leaflet.default || leaflet);
    });
  }, []);

  const cities = [
    { name: 'Ostrava', center: [49.8355, 18.2535] as [number, number], zoom: 12, count: 20 },
    { name: 'Opava', center: [49.9385, 17.9025] as [number, number], zoom: 13, count: 3 },
    { name: 'Havířov', center: [49.7795, 18.4350] as [number, number], zoom: 13, count: 3 },
    { name: 'Frýdek-Místek', center: [49.6820, 18.3450] as [number, number], zoom: 13, count: 3 },
    { name: 'Karviná', center: [49.8550, 18.5420] as [number, number], zoom: 13, count: 3 },
    { name: 'Olomouc', center: [49.5890, 17.2550] as [number, number], zoom: 13, count: 2 },
    { name: 'Brno', center: [49.1910, 16.6110] as [number, number], zoom: 12, count: 2 },
  ];

  const handleCityJump = (city: typeof cities[0]) => {
    setActiveCity(city.name);
    if (mapInstance) {
      mapInstance.flyTo(city.center, city.zoom, { duration: 1.2 });
    }
  };

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
    setMapInstance(map);

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

    // Real Network of 36 Carriers across Ostrava, Opava, Havířov, Frýdek-Místek, Karviná, Olomouc, Brno
    const markers = [
      // === 1. OSTRAVA - PORUBA & SVINOV ===
      { lat: 49.8282, lng: 18.1638, title: 'City Poster (CLP) Poruba Hlavní třída u Oblouku', type: 'CITY POSTER', price: '6 800 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-POR-01', city: 'Ostrava' },
      { lat: 49.8248, lng: 18.1722, title: 'Lavička MHD Kubánská × Francouzská (Poruba)', type: 'LAVIČKY / MOBILIÁŘ', price: '3 200 Kč / měsíc', status: 'Volné k pronájmu', color: '#10b981', code: 'PL-POR-04', city: 'Ostrava' },
      { lat: 49.8315, lng: 18.1610, title: 'Billboard Opavská u VŠB-TUO (Směr Poruba)', type: 'BILLBOARD 5.1×2.4', price: '12 900 Kč / měsíc', status: 'Rezervováno', color: '#6366f1', code: 'BB-VSB-01', city: 'Ostrava' },
      { lat: 49.8335, lng: 18.1652, title: 'Navigační tabule VO 17. listopadu u Alšova náměstí', type: 'NAVIGACE VO', price: '1 950 Kč / měsíc', status: 'Volný sloupec VO', color: '#f97316', code: 'NAV-POR-22', city: 'Ostrava' },
      { lat: 49.8210, lng: 18.2090, title: 'City Poster Svinov Mosty (MHD & Vlakový Terminál)', type: 'CITY POSTER', price: '8 900 Kč / měsíc', status: 'Obsazeno (Kaufland)', color: '#38bdf8', code: 'CP-SVIN-01', city: 'Ostrava' },
      { lat: 49.8245, lng: 18.2045, title: 'Billboard Opavská u nádraží Svinov', type: 'BILLBOARD 5.1×2.4', price: '11 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-SVIN-02', city: 'Ostrava' },

      // === 2. OSTRAVA - CENTRUM & MARIÁNSKÉ HORY & VÍTKOVICE ===
      { lat: 49.8425, lng: 18.2890, title: 'Promo Tower Sokolská třída u Nové Radnice', type: 'PROMO TOWER', price: '26 000 Kč / měsíc', status: 'Rezervováno', color: '#a855f7', code: 'TOW-SOK-03', city: 'Ostrava' },
      { lat: 49.8360, lng: 18.2855, title: 'City Poster Nádražní × Stodolní', type: 'CITY POSTER', price: '7 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-STOD-04', city: 'Ostrava' },
      { lat: 49.8325, lng: 18.2880, title: 'City Poster 28. října u Forum Nová Karolina', type: 'CITY POSTER', price: '8 200 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-KARO-08', city: 'Ostrava' },
      { lat: 49.8385, lng: 18.2825, title: 'City Poster Českobratrská u Konzervatoře', type: 'CITY POSTER', price: '5 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-CESK-09', city: 'Ostrava' },
      { lat: 49.8400, lng: 18.2865, title: 'Lavička MHD Důl Jindřich (Centrum)', type: 'LAVIČKY / MOBILIÁŘ', price: '3 800 Kč / měsíc', status: 'Obsazeno', color: '#10b981', code: 'PL-JIND-02', city: 'Ostrava' },
      { lat: 49.8415, lng: 18.3020, title: 'Billboard Bohumínská u Bazalů (Slezská Ostrava)', type: 'BILLBOARD 5.1×2.4', price: '10 800 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-BAZ-03', city: 'Ostrava' },
      { lat: 49.8290, lng: 18.2450, title: 'Navigační tabule VO 28. října × Novoveská', type: 'NAVIGACE VO', price: '1 800 Kč / měsíc', status: 'Aktivní licence', color: '#f97316', code: 'NAV-MAR-05', city: 'Ostrava' },
      { lat: 49.8278, lng: 18.2560, title: 'Promo Tower Mariánské Hory u OC Futurum', type: 'PROMO TOWER', price: '24 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#a855f7', code: 'TOW-FUT-01', city: 'Ostrava' },
      { lat: 49.8145, lng: 18.2675, title: 'Lavička MHD Vítkovice Mírové náměstí', type: 'LAVIČKY / MOBILIÁŘ', price: '2 800 Kč / měsíc', status: 'Volné k pronájmu', color: '#10b981', code: 'PL-VITK-11', city: 'Ostrava' },
      { lat: 49.8190, lng: 18.2795, title: 'City Poster Ruská u Dolních Vítkovic (DOV)', type: 'CITY POSTER', price: '7 800 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-DOV-01', city: 'Ostrava' },
      { lat: 49.8080, lng: 18.2610, title: 'Promo Tower Rudná × Závodní', type: 'PROMO TOWER', price: '22 500 Kč / měsíc', status: 'Volné od 1.10.', color: '#a855f7', code: 'TOW-RUDN-02', city: 'Ostrava' },

      // === 3. OSTRAVA - JIH, HRABŮVKA, DUBINA ===
      { lat: 49.7895, lng: 18.2545, title: 'Promo Tower Místecká × Dr. Martínka (Hrabůvka)', type: 'PROMO TOWER', price: '24 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#a855f7', code: 'TOW-MIST-01', city: 'Ostrava' },
      { lat: 49.7940, lng: 18.2320, title: 'Billboard Výškovická u OC Kotva (Směr Centrum)', type: 'BILLBOARD 5.1×2.4', price: '11 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-RUDN-04', city: 'Ostrava' },
      { lat: 49.7985, lng: 18.2215, title: 'Bigboard Avion Shopping Park Plzeňská', type: 'BIGBOARD 9.6×3.6', price: '38 000 Kč / měsíc', status: 'Obsazeno (Škoda Auto)', color: '#6366f1', code: 'BIG-D1-01', city: 'Ostrava' },

      // === 4. OPAVA ===
      { lat: 49.9325, lng: 17.8845, title: 'Navigační tabule VO Olomoucká u Slezské nemocnice', type: 'NAVIGACE VO', price: '1 950 Kč / měsíc', status: 'Volný sloupec VO', color: '#f97316', code: 'NAV-OPAV-14', city: 'Opava' },
      { lat: 49.9388, lng: 17.9025, title: 'City Poster Horní náměstí u Divadla (Opava Centrum)', type: 'CITY POSTER', price: '6 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-OPAV-01', city: 'Opava' },
      { lat: 49.9310, lng: 17.9250, title: 'Billboard Těšínská (Směr Ostrava I/11, Opava)', type: 'BILLBOARD 5.1×2.4', price: '9 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-OPAV-03', city: 'Opava' },

      // === 5. HAVÍŘOV ===
      { lat: 49.7795, lng: 18.4380, title: 'Promo Tower Hlavní třída u Magistrátu (Havířov)', type: 'PROMO TOWER', price: '19 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#a855f7', code: 'TOW-HAV-01', city: 'Havířov' },
      { lat: 49.7910, lng: 18.4210, title: 'Billboard Dělnická u Vlakového nádraží (Havířov)', type: 'BILLBOARD 5.1×2.4', price: '9 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-HAV-04', city: 'Havířov' },
      { lat: 49.7760, lng: 18.4460, title: 'City Poster Národní třída u OC Elán (Havířov)', type: 'CITY POSTER', price: '5 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-HAV-07', city: 'Havířov' },

      // === 6. FRÝDEK-MÍSTEK ===
      { lat: 49.6740, lng: 18.3450, title: 'Promo Tower Hlavní třída × Místecké náměstí', type: 'PROMO TOWER', price: '21 000 Kč / měsíc', status: 'Volné k pronájmu', color: '#a855f7', code: 'TOW-FM-01', city: 'Frýdek-Místek' },
      { lat: 49.6820, lng: 18.3380, title: 'City Poster Na Příkopě u OC Frýda', type: 'CITY POSTER', price: '6 400 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-FM-03', city: 'Frýdek-Místek' },
      { lat: 49.6910, lng: 18.3510, title: 'Billboard Ostravská u výjezdu na D56 (Směr Ostrava)', type: 'BILLBOARD 5.1×2.4', price: '11 200 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-FM-09', city: 'Frýdek-Místek' },

      // === 7. KARVINÁ ===
      { lat: 49.8480, lng: 18.5290, title: 'Billboard Ostravská (Hlavní tah I/59, Karviná)', type: 'BILLBOARD 5.1×2.4', price: '8 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BB-KAR-01', city: 'Karviná' },
      { lat: 49.8550, lng: 18.5420, title: 'City Poster Fryštátská / Masarykovo náměstí', type: 'CITY POSTER', price: '5 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-KAR-02', city: 'Karviná' },
      { lat: 49.8590, lng: 18.5520, title: 'Lavička MHD Třída 17. listopadu u Nemocnice Karviná-Ráj', type: 'LAVIČKY / MOBILIÁŘ', price: '2 900 Kč / měsíc', status: 'Volné k pronájmu', color: '#10b981', code: 'PL-KAR-05', city: 'Karviná' },

      // === 8. OLOMOUC ===
      { lat: 49.5820, lng: 17.2790, title: 'Bigboard Rolsberská (Východní tangent Olomouc)', type: 'BIGBOARD 9.6×3.6', price: '28 000 Kč / měsíc', status: 'Volné k pronájmu', color: '#6366f1', code: 'BIG-OLO-01', city: 'Olomouc' },
      { lat: 49.5890, lng: 17.2420, title: 'City Poster Wolkerova u Výstaviště Flora Olomouc', type: 'CITY POSTER', price: '7 200 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-OLO-04', city: 'Olomouc' },

      // === 9. BRNO ===
      { lat: 49.1720, lng: 16.5980, title: 'Promo Tower Vídeňská (Jižní přivaděč D1, Brno)', type: 'PROMO TOWER', price: '29 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#a855f7', code: 'TOW-BRN-01', city: 'Brno' },
      { lat: 49.1910, lng: 16.6210, title: 'City Poster Křenová u Hlavního nádraží (Brno)', type: 'CITY POSTER', price: '8 500 Kč / měsíc', status: 'Volné k pronájmu', color: '#38bdf8', code: 'CP-BRN-06', city: 'Brno' },
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
      setMapInstance(null);
    };
  }, [LModule, mapContainer]);

  return (
    <div className="relative w-full h-[470px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={setMapContainer} className="w-full h-full z-10" />

      {/* Top Quick City Switcher Pills */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 overflow-x-auto max-w-[calc(100%-80px)] p-1.5 rounded-xl bg-slate-950/85 border border-slate-800/90 backdrop-blur-md shadow-xl text-xs">
        {cities.map((city) => (
          <button
            key={city.name}
            type="button"
            onClick={() => handleCityJump(city)}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition whitespace-nowrap cursor-pointer ${
              activeCity === city.name
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {city.name}
          </button>
        ))}
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-20 bg-slate-950/95 p-3.5 rounded-xl border border-slate-800 backdrop-blur-md shadow-2xl text-xs font-bold text-slate-200 space-y-2">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
          <span className="text-xs uppercase tracking-wider font-black text-purple-300">Živá síť nosičů na mapě (36 nosičů v 7 městech)</span>
          <span className="text-xs text-emerald-400 font-extrabold flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            27 volných
          </span>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap pt-0.5 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-purple-500" /> Promo Tower (7)</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-sky-400" /> City Poster (9)</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-indigo-500" /> Billboard & Bigboard (9)</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-emerald-500" /> Lavičky (6)</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800"><span className="size-2 rounded-full bg-orange-500" /> Navigace VO (5)</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-950/60 border border-rose-900/60 text-rose-300"><span className="size-2 rounded-full bg-rose-500" /> Regulované zóny (12)</span>
        </div>
      </div>
    </div>
  );
}
