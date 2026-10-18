'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Layers,
  Clock,
  MapPin,
  Search,
  Filter,
  Download,
  Share2,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Building2,
  X,
  Maximize2,
  Image as ImageIcon,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  CampaignPhotoAlbum,
  type InternalPointWithPhotos,
} from '@/components/election-removal/CampaignPhotoAlbum';
import { PhotoAlbumShareModal } from './PhotoAlbumShareModal';

export interface UnifiedAlbumItem {
  id: string;
  source: 'FIELD_WORK' | 'NAVIGATION';
  sourceLabel: string;
  title: string;
  displayTitle?: string;
  displaySubtitle?: string | null;
  displayBadge?: string | null;
  clientName?: string | null;
  createdAt: string | Date;
  year?: number;
  month?: number;
  quarter?: number;
  periodLabel?: string;
  photosCount: number;
  pointsCount: number;
  coverPhotoUrl?: string | null;
  albumSlug: string;
  publicShareUrl: string;
  downloadZipUrl: string;
  points: InternalPointWithPhotos[];
  latestPhotoAt?: string | Date | null;
}

export interface RecentPhotoItem {
  id: string;
  url: string;
  fileName?: string | null;
  type: string;
  createdAt: string | Date;
  workerName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceTitle: string;
  clientName?: string | null;
  pointLabel?: string | null;
  carrierCode?: string | null;
}

interface UnifiedPhotoDocumentationViewProps {
  albums: UnifiedAlbumItem[];
  recentPhotos: RecentPhotoItem[];
  initialAlbumId?: string | null;
  initialSource?: string | null;
}

export function UnifiedPhotoDocumentationView({
  albums,
  recentPhotos,
  initialAlbumId,
  initialSource,
}: UnifiedPhotoDocumentationViewProps) {
  const router = useRouter();
  const [albumItems, setAlbumItems] = useState<UnifiedAlbumItem[]>(albums);
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);

  useEffect(() => {
    setAlbumItems(albums);
  }, [albums]);

  const [activeTab, setActiveTab] = useState<'ALBUMS' | 'FEED' | 'MAP'>('ALBUMS');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'FIELD_WORK' | 'NAVIGATION'>(
    initialSource === 'FIELD_WORK'
      ? 'FIELD_WORK'
      : initialSource === 'NAVIGATION'
      ? 'NAVIGATION'
      : 'ALL'
  );
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [groupBy, setGroupBy] = useState<'PERIOD' | 'CLIENT' | 'NONE'>('PERIOD');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(initialAlbumId || null);
  const [lightboxPhoto, setLightboxPhoto] = useState<RecentPhotoItem | null>(null);
  const [sharingAlbum, setSharingAlbum] = useState<UnifiedAlbumItem | null>(null);

  // Available filter options dynamically extracted from albums
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    albumItems.forEach((a) => {
      if (a.year) {
        years.add(a.year);
      } else {
        const y = new Date(a.createdAt).getFullYear();
        if (y) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [albumItems]);

  const availableClients = useMemo(() => {
    const clientMap = new Map<string, number>();
    albumItems.forEach((a) => {
      const client = a.clientName?.trim();
      if (client) {
        clientMap.set(client, (clientMap.get(client) || 0) + 1);
      }
    });
    return Array.from(clientMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'cs'))
      .map(([name, count]) => ({ name, count }));
  }, [albumItems]);

  const periodOptions = [
    { value: 'ALL', label: 'Všechna období' },
    { value: 'Q1', label: '1. čtvrtletí (Q1)' },
    { value: 'Q2', label: '2. čtvrtletí (Q2)' },
    { value: 'Q3', label: '3. čtvrtletí (Q3)' },
    { value: 'Q4', label: '4. čtvrtletí (Q4)' },
  ];

  // Filtered albums list
  const filteredAlbums = useMemo(() => {
    return albumItems.filter((a) => {
      if (sourceFilter !== 'ALL' && a.source !== sourceFilter) return false;

      // Year filter
      if (selectedYear !== 'ALL') {
        const albumYear = a.year || new Date(a.createdAt).getFullYear();
        if (albumYear.toString() !== selectedYear) return false;
      }

      // Period filter (quarter)
      if (selectedPeriod !== 'ALL') {
        const albumQuarter = a.quarter || Math.ceil((a.month || (new Date(a.createdAt).getMonth() + 1)) / 3);
        if (selectedPeriod === 'Q1' && albumQuarter !== 1) return false;
        if (selectedPeriod === 'Q2' && albumQuarter !== 2) return false;
        if (selectedPeriod === 'Q3' && albumQuarter !== 3) return false;
        if (selectedPeriod === 'Q4' && albumQuarter !== 4) return false;
      }

      // Client filter
      if (selectedClient !== 'ALL') {
        if (a.clientName?.trim() !== selectedClient) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLocaleLowerCase('cs');
        const matchTitle = (a.displayTitle || a.title).toLocaleLowerCase('cs').includes(q);
        const matchRawTitle = a.title.toLocaleLowerCase('cs').includes(q);
        const matchClient = a.clientName?.toLocaleLowerCase('cs').includes(q);
        const matchBadge = a.displayBadge?.toLocaleLowerCase('cs').includes(q);
        if (!matchTitle && !matchRawTitle && !matchClient && !matchBadge) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.latestPhotoAt ? new Date(a.latestPhotoAt).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.latestPhotoAt ? new Date(b.latestPhotoAt).getTime() : new Date(b.createdAt).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.photosCount - a.photosCount;
    });
  }, [albumItems, sourceFilter, selectedYear, selectedPeriod, selectedClient, searchQuery]);

  // Grouped albums for sections
  interface AlbumGroup {
    key: string;
    title: string;
    iconType: 'period' | 'client';
    totalPhotos: number;
    totalAlbums: number;
    albums: UnifiedAlbumItem[];
  }

  const groupedAlbums = useMemo((): AlbumGroup[] => {
    if (groupBy === 'NONE') {
      return [
        {
          key: 'all',
          title: 'Všechna fotoalba',
          iconType: 'period',
          totalPhotos: filteredAlbums.reduce((sum, a) => sum + a.photosCount, 0),
          totalAlbums: filteredAlbums.length,
          albums: filteredAlbums,
        },
      ];
    }

    if (groupBy === 'PERIOD') {
      const groupsMap = new Map<string, UnifiedAlbumItem[]>();

      filteredAlbums.forEach((a) => {
        const y = a.year || new Date(a.createdAt).getFullYear();
        const q = a.quarter || Math.ceil((a.month || (new Date(a.createdAt).getMonth() + 1)) / 3);
        const key = a.periodLabel || `${q}. čtvrtletí ${y}`;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, []);
        }
        groupsMap.get(key)!.push(a);
      });

      return Array.from(groupsMap.entries())
        .sort((a, b) => {
          // Sort periods by latest photo capture date in that period DESC
          const maxA = Math.max(...a[1].map((i) => i.latestPhotoAt ? new Date(i.latestPhotoAt).getTime() : new Date(i.createdAt).getTime()));
          const maxB = Math.max(...b[1].map((i) => i.latestPhotoAt ? new Date(i.latestPhotoAt).getTime() : new Date(i.createdAt).getTime()));
          return maxB - maxA;
        })
        .map(([periodTitle, items]) => {
          const sortedItems = [...items].sort((a, b) => {
            const timeA = a.latestPhotoAt ? new Date(a.latestPhotoAt).getTime() : new Date(a.createdAt).getTime();
            const timeB = b.latestPhotoAt ? new Date(b.latestPhotoAt).getTime() : new Date(b.createdAt).getTime();
            if (timeB !== timeA) return timeB - timeA;
            return b.photosCount - a.photosCount;
          });
          return {
            key: periodTitle,
            title: periodTitle,
            iconType: 'period',
            totalPhotos: sortedItems.reduce((sum, a) => sum + a.photosCount, 0),
            totalAlbums: sortedItems.length,
            albums: sortedItems,
          };
        });
    }

    if (groupBy === 'CLIENT') {
      const groupsMap = new Map<string, UnifiedAlbumItem[]>();

      filteredAlbums.forEach((a) => {
        const key = a.clientName?.trim() || 'Ostatní zakázky / Interní';
        if (!groupsMap.has(key)) {
          groupsMap.set(key, []);
        }
        groupsMap.get(key)!.push(a);
      });

      return Array.from(groupsMap.entries())
        .sort((a, b) => {
          // Sort clients by latest photo capture date in that group DESC
          const maxA = Math.max(...a[1].map((i) => i.latestPhotoAt ? new Date(i.latestPhotoAt).getTime() : new Date(i.createdAt).getTime()));
          const maxB = Math.max(...b[1].map((i) => i.latestPhotoAt ? new Date(i.latestPhotoAt).getTime() : new Date(i.createdAt).getTime()));
          return maxB - maxA;
        })
        .map(([clientTitle, items]) => {
          const sortedItems = [...items].sort((a, b) => {
            const timeA = a.latestPhotoAt ? new Date(a.latestPhotoAt).getTime() : new Date(a.createdAt).getTime();
            const timeB = b.latestPhotoAt ? new Date(b.latestPhotoAt).getTime() : new Date(b.createdAt).getTime();
            if (timeB !== timeA) return timeB - timeA;
            return b.photosCount - a.photosCount;
          });
          return {
            key: clientTitle,
            title: clientTitle,
            iconType: 'client',
            totalPhotos: sortedItems.reduce((sum, a) => sum + a.photosCount, 0),
            totalAlbums: sortedItems.length,
            albums: sortedItems,
          };
        });
    }

    return [];
  }, [filteredAlbums, groupBy]);

  // Selected album object
  const activeAlbum = useMemo(() => {
    if (!selectedAlbumId) return null;
    return albumItems.find((a) => a.id === selectedAlbumId) || null;
  }, [albumItems, selectedAlbumId]);

  // Filtered recent photos for live feed and map
  const filteredRecentPhotos = useMemo(() => {
    return recentPhotos.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLocaleLowerCase('cs');
        const matchSource = p.sourceTitle.toLocaleLowerCase('cs').includes(q);
        const matchClient = p.clientName?.toLocaleLowerCase('cs').includes(q);
        const matchWorker = p.workerName?.toLocaleLowerCase('cs').includes(q);
        const matchPoint = p.pointLabel?.toLocaleLowerCase('cs').includes(q);
        const matchCarrier = p.carrierCode?.toLocaleLowerCase('cs').includes(q);
        if (!matchSource && !matchClient && !matchWorker && !matchPoint && !matchCarrier) return false;
      }
      return true;
    });
  }, [recentPhotos, searchQuery]);

  const totalPhotosCount = useMemo(() => {
    return albumItems.reduce((sum, a) => sum + a.photosCount, 0);
  }, [albumItems]);

  const uniqueClientsCount = useMemo(() => {
    const clients = new Set<string>();
    albumItems.forEach((a) => {
      if (a.clientName) clients.add(a.clientName.trim());
    });
    return clients.size;
  }, [albumItems]);

  const handleDeleteAlbum = async (album: UnifiedAlbumItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const confirmed = window.confirm(
      `Opravdu chcete smazat album „${album.displayTitle || album.title}“?\n\nFotografie zůstanou bezpečně uloženy v systému a na disku, odstraní se pouze toto album a jeho veřejný odkaz.`
    );

    if (!confirmed) return;

    try {
      setDeletingAlbumId(album.id);
      const clientParam = album.clientName ? `&client=${encodeURIComponent(album.clientName)}` : '';
      const url = `/api/fotodokumentace/albums/${encodeURIComponent(album.id)}?source=${encodeURIComponent(album.source)}${clientParam}`;

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se smazat album.');
      }

      setAlbumItems((prev) => prev.filter((a) => a.id !== album.id));
      if (selectedAlbumId === album.id) {
        setSelectedAlbumId(null);
      }
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání alba.');
    } finally {
      setDeletingAlbumId(null);
    }
  };

  const handlePhotosUpdated = (campaignId: string, updatedPoints: InternalPointWithPhotos[]) => {
    setAlbumItems((prev) =>
      prev.map((album) => {
        if (album.id !== campaignId) return album;

        const allPhotos = updatedPoints.flatMap((pt) => pt.photos || []);
        const photosCount = allPhotos.length;

        let latestPhotoAt = album.latestPhotoAt;
        if (allPhotos.length > 0) {
          const sortedDates = allPhotos
            .map((p) => new Date(p.createdAt).getTime())
            .filter((t) => !isNaN(t))
            .sort((a, b) => b - a);
          if (sortedDates.length > 0) {
            latestPhotoAt = new Date(sortedDates[0]).toISOString();
          }
        } else {
          latestPhotoAt = null;
        }

        const coverPhotoUrl = allPhotos[0]?.url || null;

        return {
          ...album,
          points: updatedPoints,
          photosCount,
          latestPhotoAt,
          coverPhotoUrl,
        };
      })
    );
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Leaflet map reference
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== 'MAP') return;

    let isCancelled = false;

    async function initMap() {
      const L = (await import('leaflet')).default;

      if (!document.getElementById('leaflet-css-fotodokumentace')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-fotodokumentace';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (isCancelled || !mapContainerRef.current) return;

      // Clean existing map instance if any
      const existingContainer = mapContainerRef.current as HTMLElement & { _leaflet_id?: number };
      if (existingContainer._leaflet_id) {
        existingContainer._leaflet_id = undefined;
        existingContainer.innerHTML = '';
      }

      const map = L.map(mapContainerRef.current).setView([49.8175, 15.473], 7);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const bounds: [number, number][] = [];

      filteredRecentPhotos.forEach((photo) => {
        if (typeof photo.latitude === 'number' && typeof photo.longitude === 'number') {
          bounds.push([photo.latitude, photo.longitude]);

          const marker = L.circleMarker([photo.latitude, photo.longitude], {
            radius: 8,
            fillColor: '#0284c7',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85,
          }).addTo(map);

          const popupContent = `
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; max-width: 220px;">
              <img src="${photo.id ? `/api/photos/${encodeURIComponent(photo.id)}/thumbnail` : photo.url}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;" loading="lazy" />
              <strong style="color: #0f172a; display: block;">${photo.sourceTitle}</strong>
              <div style="color: #475569; font-size: 11px;">
                ${photo.pointLabel ? `Bod: ${photo.pointLabel}<br>` : ''}
                ${photo.workerName ? `Montér: ${photo.workerName}<br>` : ''}
                ${photo.createdAt ? `Čas: ${formatDate(photo.createdAt)}` : ''}
              </div>
            </div>
          `;
          marker.bindPopup(popupContent);
        }
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }

    initMap();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, filteredRecentPhotos]);

  // Render individual album card
  const renderAlbumCard = (album: UnifiedAlbumItem) => (
    <div
      key={album.id}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:shadow-md hover:border-sky-300 transition flex flex-col justify-between"
    >
      <div className="space-y-3">
        {/* Cover Image or Placeholder */}
        <div
          onClick={() => setSelectedAlbumId(album.id)}
          className="relative h-40 w-full overflow-hidden rounded-xl bg-slate-100 cursor-pointer"
        >
          {album.coverPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={album.coverPhotoUrl}
              alt={album.displayTitle || album.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Camera className="w-12 h-12 stroke-[1.2]" />
            </div>
          )}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <span className="rounded-lg bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">
              {album.sourceLabel}
            </span>
          </div>
          <div className="absolute bottom-2.5 right-2.5 rounded-lg bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 text-[11px] font-bold text-white shadow-xs flex items-center gap-1">
            <Camera className="w-3 h-3 text-sky-400" />
            <span>{album.photosCount} fotek</span>
          </div>
        </div>

        {/* Title and Badges (Proposal 2: Clean headline, period badge) */}
        <div>
          <h3
            onClick={() => setSelectedAlbumId(album.id)}
            className="font-bold text-slate-900 text-sm group-hover:text-sky-700 transition cursor-pointer line-clamp-1"
            title={album.title}
          >
            {album.displayTitle || album.title}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {album.displayBadge && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-100">
                <Calendar className="w-3 h-3 text-sky-600" />
                {album.displayBadge}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
              {album.pointsCount} {album.pointsCount === 1 ? 'bod' : album.pointsCount < 5 ? 'body' : 'bodů'}
            </span>
            {album.latestPhotoAt ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200" title={`Poslední pořízená fotka: ${formatDate(album.latestPhotoAt)}`}>
                <Camera className="w-3 h-3 text-emerald-600" />
                Pořízeno: {new Date(album.latestPhotoAt).toLocaleDateString('cs-CZ')}
              </span>
            ) : album.createdAt ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200" title={`Vytvořeno ${formatDate(album.createdAt)}`}>
                <Clock className="w-3 h-3 text-slate-400" />
                Vytvořeno: {new Date(album.createdAt).toLocaleDateString('cs-CZ')}
              </span>
            ) : null}
            {album.clientName && !album.displayTitle?.toLowerCase().includes(album.clientName.toLowerCase().slice(0, 5)) && (
              <span className="text-[11px] text-slate-400 truncate max-w-[150px]" title={album.clientName}>
                {album.clientName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setSelectedAlbumId(album.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
        >
          <span>Prohlédnout</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setSharingAlbum(album)}
          title="Sdílet fotoalbum pro klienta (odkaz, WhatsApp, e-mail)"
          className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition"
        >
          <Share2 className="w-4 h-4 text-sky-600" />
        </button>

        <a
          href={album.downloadZipUrl}
          title="Stáhnout ZIP archiv všech fotografií"
          className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition"
        >
          <Download className="w-4 h-4" />
        </a>

        <button
          type="button"
          onClick={(e) => handleDeleteAlbum(album, e)}
          disabled={deletingAlbumId === album.id}
          title="Smazat album (fotografie zůstanou bezpečně zachovány)"
          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition disabled:opacity-50"
        >
          {deletingAlbumId === album.id ? (
            <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Metrics */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
              <Camera className="w-3.5 h-3.5" />
              Centrální modul
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
            Fotodokumentace
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Všechny fotografie realizací, terénních prací, deinstalací a navigačních sítí na jednom místě.
          </p>
        </div>

        {/* Global Key Metrics */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-xs text-center">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Celkem fotek</div>
            <div className="text-lg font-black text-slate-900">{totalPhotosCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-xs text-center">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Alba zakázek</div>
            <div className="text-lg font-black text-slate-900">{albumItems.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-xs text-center">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Klienti</div>
            <div className="text-lg font-black text-slate-900">{uniqueClientsCount}</div>
          </div>
        </div>
      </header>

      {/* Main View Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ALBUMS');
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'ALBUMS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Alba zakázek & kampaní</span>
            <span className="rounded-full bg-slate-800 text-sky-400 px-1.5 py-0.2 text-[10px]">
              {filteredAlbums.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('FEED');
              setSelectedAlbumId(null);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'FEED'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Poslední fotky z terénu</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('MAP');
              setSelectedAlbumId(null);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'MAP'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Mapa realizací</span>
          </button>
        </div>

        {/* Global Source Filter */}
        <div className="flex items-center gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 pl-1">Zdroj:</span>
          {(['ALL', 'FIELD_WORK', 'NAVIGATION'] as const).map((sourceKey) => (
            <button
              key={sourceKey}
              type="button"
              onClick={() => setSourceFilter(sourceKey)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                sourceFilter === sourceKey
                  ? 'bg-sky-50 text-sky-700 border border-sky-300 font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {sourceKey === 'ALL'
                ? 'Vše'
                : sourceKey === 'FIELD_WORK'
                ? 'Terénní práce'
                : 'Navigace VO'}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER TOOLBAR FOR ALBUMS (Period, Year, Client, Grouping) */}
      {activeTab === 'ALBUMS' && !activeAlbum && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat zakázku, klienta, lokalitu, kód..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Seskupení / Rozdělení přepínač */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 self-start sm:self-auto shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Rozdělit:
              </span>
              <button
                type="button"
                onClick={() => setGroupBy('PERIOD')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  groupBy === 'PERIOD'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3 h-3" />
                Měsíc & Rok
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('CLIENT')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  groupBy === 'CLIENT'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-3 h-3" />
                Zakázky / Klienti
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('NONE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  groupBy === 'NONE'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Vše
              </button>
            </div>
          </div>

          {/* Dropdowns for Year, Period, Client, Reset */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filtrovat:</span>
            </div>

            {/* Rok */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">Všechny roky</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr.toString()}>
                  Rok {yr}
                </option>
              ))}
            </select>

            {/* Období / Čtvrtletí */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Klient / Zakázka */}
            {availableClients.length > 0 && (
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 max-w-[200px] truncate"
              >
                <option value="ALL">Všichni klienti ({availableClients.length})</option>
                {availableClients.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>
            )}

            {/* Reset button if any filter active */}
            {(selectedYear !== 'ALL' ||
              selectedPeriod !== 'ALL' ||
              selectedClient !== 'ALL' ||
              searchQuery ||
              sourceFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear('ALL');
                  setSelectedPeriod('ALL');
                  setSelectedClient('ALL');
                  setSearchQuery('');
                  setSourceFilter('ALL');
                }}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-600 font-semibold transition"
              >
                <X className="w-3 h-3" />
                Vymazat filtry
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEW 1: ALBUMS LIST OR SELECTED ALBUM DETAIL */}
      {activeTab === 'ALBUMS' && (
        <>
          {activeAlbum ? (
            /* Detailed view of the selected album with back button */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedAlbumId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Zpět na přehled všech alb</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Zdroj: <strong className="text-slate-800">{activeAlbum.sourceLabel}</strong>
                  </span>
                  {activeAlbum.source === 'FIELD_WORK' && (
                    <Link
                      href={`/election-removal/${activeAlbum.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-sky-700 underline"
                    >
                      Detail zakázky →
                    </Link>
                  )}
                  {activeAlbum.source === 'NAVIGATION' && (
                    <Link
                      href="/navigation/documentation"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-sky-700 underline"
                    >
                      Správa reportů →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setSharingAlbum(activeAlbum)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold transition shadow-xs"
                    title="Sdílet fotoalbum pro klienta (odkaz, WhatsApp, e-mail)"
                  >
                    <Share2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Sdílet album</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlbum(activeAlbum)}
                    disabled={deletingAlbumId === activeAlbum.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition disabled:opacity-50"
                  >
                    {deletingAlbumId === activeAlbum.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Smazat album</span>
                  </button>
                </div>
              </div>

              {/* Render the full interactive CampaignPhotoAlbum */}
              <CampaignPhotoAlbum
                campaignId={activeAlbum.id}
                albumSlug={activeAlbum.albumSlug}
                campaignName={activeAlbum.displayTitle || activeAlbum.title}
                clientName={activeAlbum.clientName}
                points={activeAlbum.points}
                publicShareUrl={activeAlbum.publicShareUrl}
                downloadZipUrl={activeAlbum.downloadZipUrl}
                createdAt={activeAlbum.createdAt}
                onPhotosUpdated={handlePhotosUpdated}
              />
            </div>
          ) : (
            /* Album Grid Cards grouped into sections */
            <div className="space-y-6">
              {filteredAlbums.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-white space-y-3">
                  <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Nebylo nalezeno žádné fotoalbum.</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Zkuste upravit nebo zrušit filtry období, roku či klienta.
                  </p>
                  {(selectedYear !== 'ALL' ||
                    selectedPeriod !== 'ALL' ||
                    selectedClient !== 'ALL' ||
                    searchQuery ||
                    sourceFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedYear('ALL');
                        setSelectedPeriod('ALL');
                        setSelectedClient('ALL');
                        setSearchQuery('');
                        setSourceFilter('ALL');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      Zrušit všechny filtry
                    </button>
                  )}
                </div>
              ) : (
                groupedAlbums.map((group) => (
                  <section key={group.key} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
                          {group.iconType === 'period' ? (
                            <Calendar className="w-4 h-4" />
                          ) : (
                            <Building2 className="w-4 h-4" />
                          )}
                        </div>
                        <h2 className="text-sm font-bold text-slate-900">{group.title}</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {group.totalAlbums} {group.totalAlbums === 1 ? 'album' : group.totalAlbums < 5 ? 'alba' : 'alb'}
                        </span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {group.totalPhotos} fotek
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.albums.map((album) => renderAlbumCard(album))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: LIVE FEED (RECENT PHOTOS) */}
      {activeTab === 'FEED' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Poslední pořízené fotografie v terénu ({filteredRecentPhotos.length})
            </h2>
            <span className="text-xs text-slate-500">Seřazeno od nejnovějších</span>
          </div>

          {filteredRecentPhotos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-white space-y-2">
              <Camera className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Zatím nebyly nahrány žádné fotografie.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredRecentPhotos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setLightboxPhoto(photo)}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.id ? `/api/photos/${encodeURIComponent(photo.id)}/thumbnail` : photo.url}
                      alt={photo.fileName || photo.sourceTitle}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    />
                    <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
                      {(photo.type === 'CONTROL' || photo.type === 'CHECK') && (
                        <span className="rounded-md bg-emerald-600/90 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          Kontrola
                        </span>
                      )}
                      {photo.type === 'INSTALLATION' && (
                        <span className="rounded-md bg-blue-600/90 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          Instalace
                        </span>
                      )}
                      {photo.type === 'DAMAGE' && (
                        <span className="rounded-md bg-rose-600/90 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          Závada
                        </span>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Maximize2 className="w-5 h-5 text-white drop-shadow-md" />
                    </div>
                  </div>

                  <div className="p-2 space-y-1 text-left">
                    <p className="text-[11px] font-bold text-slate-900 truncate" title={photo.sourceTitle}>
                      {photo.sourceTitle}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {photo.pointLabel || photo.clientName || 'Terénní záznam'}
                    </p>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5 border-t border-slate-100">
                      <span>{photo.workerName || 'Montér'}</span>
                      <span>{formatDate(photo.createdAt).split(' ')[0]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MAP OF PHOTOS */}
      {activeTab === 'MAP' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Interaktivní GPS mapa pořízených fotografií
            </h2>
            <span className="text-xs text-slate-500">
              Zobrazeno {filteredRecentPhotos.filter((p) => p.latitude && p.longitude).length} bodů s GPS
            </span>
          </div>

          <div
            ref={mapContainerRef}
            className="w-full h-[580px] rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-slate-100 z-0"
          />
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX FOR FEED */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-xs"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 text-white hover:bg-white/40 transition"
            >
              <X className="w-6 h-6" />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.fileName || ''}
              onError={(e) => {
                if (lightboxPhoto.id) {
                  const fallback = `/api/photos/${encodeURIComponent(lightboxPhoto.id)}/thumbnail`;
                  if (!e.currentTarget.src.endsWith(fallback)) {
                    e.currentTarget.src = fallback;
                  }
                }
              }}
              style={
                lightboxPhoto.id
                  ? {
                      backgroundImage: `url(/api/photos/${encodeURIComponent(lightboxPhoto.id)}/thumbnail)`,
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }
                  : undefined
              }
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />

            <div className="mt-3 w-full bg-slate-900/80 backdrop-blur-md rounded-xl p-3 text-white text-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-bold">{lightboxPhoto.sourceTitle}</strong>
                  {(lightboxPhoto.type === 'CONTROL' || lightboxPhoto.type === 'CHECK') && (
                    <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Kontrola
                    </span>
                  )}
                  {lightboxPhoto.type === 'INSTALLATION' && (
                    <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Instalace
                    </span>
                  )}
                  {lightboxPhoto.type === 'DAMAGE' && (
                    <span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Závada
                    </span>
                  )}
                </div>
                <span className="text-slate-300">
                  {lightboxPhoto.pointLabel} • {lightboxPhoto.clientName || 'Bez klienta'}
                </span>
              </div>
              <div className="text-right text-slate-300 text-[11px] space-y-0.5">
                <div>Montér: {lightboxPhoto.workerName || 'Neuvedeno'}</div>
                <div>Čas: {formatDate(lightboxPhoto.createdAt)}</div>
                {lightboxPhoto.latitude && lightboxPhoto.longitude && (
                  <div>
                    GPS: {lightboxPhoto.latitude.toFixed(5)}, {lightboxPhoto.longitude.toFixed(5)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Album Share Modal */}
      <PhotoAlbumShareModal
        isOpen={!!sharingAlbum}
        onClose={() => setSharingAlbum(null)}
        album={
          sharingAlbum
            ? {
                title: sharingAlbum.displayTitle || sharingAlbum.title,
                clientName: sharingAlbum.clientName,
                photosCount: sharingAlbum.photosCount,
                publicShareUrl: sharingAlbum.publicShareUrl,
                sourceLabel: sharingAlbum.sourceLabel,
              }
            : null
        }
      />
    </div>
  );
}
