'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  GalleryHorizontalEnd,
  Plus,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  Settings,
  FileText,
  User,
  ExternalLink,
  Search,
  Sparkles,
  Layers,
  Phone,
  HelpCircle,
  X,
  Truck,
  Building2,
} from 'lucide-react';
import Link from 'next/link';

export type CityGalleryProjectData = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  city: string | null;
  locality: string | null;
  address: string | null;
  description: string | null;
  frameCount: number;
  permitStatus: string | null;
  permitNumber: string | null;
  permitValidFrom: string | null;
  permitValidTo: string | null;
  permitNote: string | null;
  cityOfficialContact: string | null;
  organizerName: string | null;
  artistName: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { offers: number };
};

export type FleetData = {
  totalFleet: number;
  occupiedFrames: number;
  availableFrames: number;
  maintenanceCount: number;
};

export function CityGalleryModuleClient({
  initialProjects,
  initialFleet,
}: {
  initialProjects: CityGalleryProjectData[];
  initialFleet: FleetData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [projects, setProjects] = useState<CityGalleryProjectData[]>(initialProjects);
  const [fleet, setFleet] = useState<FleetData>(initialFleet);
  const [activeTab, setActiveTab] = useState<'exhibitions' | 'permits' | 'timeline' | 'map'>('exhibitions');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isFleetModalOpen, setIsFleetModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form states for new project
  const [formTitle, setFormTitle] = useState('');
  const [formCity, setFormCity] = useState('Ostrava');
  const [formLocality, setFormLocality] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formFrameCount, setFormFrameCount] = useState(6);
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'PLANNED' | 'ACTIVE'>('ACTIVE');
  const [formPermitStatus, setFormPermitStatus] = useState('APPROVED');
  const [formPermitNumber, setFormPermitNumber] = useState('');
  const [formPermitValidFrom, setFormPermitValidFrom] = useState('');
  const [formPermitValidTo, setFormPermitValidTo] = useState('');
  const [formCityOfficialContact, setFormCityOfficialContact] = useState('');
  const [formOrganizerName, setFormOrganizerName] = useState('');
  const [formArtistName, setFormArtistName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Fleet settings form
  const [newTotalFleet, setNewTotalFleet] = useState(fleet.totalFleet);
  const [newMaintenanceCount, setNewMaintenanceCount] = useState(fleet.maintenanceCount);

  // Filter unique cities
  const cities = Array.from(new Set(projects.map((p) => p.city).filter(Boolean))) as string[];

  const filteredProjects = projects.filter((p) => {
    const matchesCity = selectedCity === 'ALL' || p.city === selectedCity;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      p.title.toLowerCase().includes(q) ||
      (p.city && p.city.toLowerCase().includes(q)) ||
      (p.locality && p.locality.toLowerCase().includes(q)) ||
      (p.artistName && p.artistName.toLowerCase().includes(q)) ||
      (p.organizerName && p.organizerName.toLowerCase().includes(q));
    return matchesCity && matchesQuery;
  });

  // Calculate expiring permits (< 30 days)
  const now = new Date();
  const expiringProjects = projects.filter((p) => {
    if (!p.permitValidTo || (p.status !== 'ACTIVE' && p.status !== 'PLANNED')) return false;
    const diffDays = Math.ceil((new Date(p.permitValidTo).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      const res = await fetch('/api/city-gallery/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          city: formCity,
          locality: formLocality,
          address: formAddress,
          frameCount: formFrameCount,
          status: formStatus,
          permitStatus: formPermitStatus,
          permitNumber: formPermitNumber,
          permitValidFrom: formPermitValidFrom,
          permitValidTo: formPermitValidTo,
          cityOfficialContact: formCityOfficialContact,
          organizerName: formOrganizerName,
          artistName: formArtistName,
          description: formDescription,
          dateFrom: formPermitValidFrom,
          dateTo: formPermitValidTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vytvoření projektu selhalo.');

      setIsNewModalOpen(false);
      resetForm();
      refreshData();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  }

  async function handleUpdateFleet(e: React.FormEvent) {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      const res = await fetch('/api/city-gallery/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalFrames: Number(newTotalFleet),
          maintenanceCount: Number(newMaintenanceCount),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Úprava fondu selhala.');

      setIsFleetModalOpen(false);
      refreshData();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  }

  async function refreshData() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/city-gallery/projects');
        const data = await res.json();
        if (data.projects) setProjects(data.projects);
        if (data.fleet) setFleet(data.fleet);
      } catch (e) {}
      router.refresh();
    });
  }

  function resetForm() {
    setFormTitle('');
    setFormCity('Ostrava');
    setFormLocality('');
    setFormAddress('');
    setFormFrameCount(6);
    setFormStatus('ACTIVE');
    setFormPermitStatus('APPROVED');
    setFormPermitNumber('');
    setFormPermitValidFrom('');
    setFormPermitValidTo('');
    setFormCityOfficialContact('');
    setFormOrganizerName('');
    setFormArtistName('');
    setFormDescription('');
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-fuchsia-950/60 p-5 sm:p-7 text-slate-100 shadow-xl overflow-hidden relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 shrink-0 shadow-inner">
              <GalleryHorizontalEnd size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-fuchsia-500/20 px-2.5 py-0.5 text-[10px] font-black text-fuchsia-300 uppercase tracking-widest border border-fuchsia-500/30">
                  Městská Galerie & Výstavy ČR 🏛️
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                Galerie VENKU <span className="text-fuchsia-400">City Gallery</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Správa alokace nosičů, záborů veřejného prostranství a dálkové logistiky po celé ČR
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsFleetModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition shadow-sm"
            >
              <Settings size={15} />
              <span>Správa fondu nosičů</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:from-fuchsia-500 hover:to-pink-500 transition active:scale-95"
            >
              <Plus size={16} />
              <span>Nová výstava / Výjezd</span>
            </button>
          </div>
        </div>

        {/* Fleet Inventory Cards Grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 backdrop-blur-xs">
            <span className="text-[11px] text-slate-400 font-bold block">Celkový fond nosičů</span>
            <div className="mt-1 flex items-baseline gap-2">
              <strong className="text-2xl font-black text-white">{fleet.totalFleet}</strong>
              <span className="text-xs text-slate-500">ks (120×180 cm)</span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 backdrop-blur-xs">
            <span className="text-[11px] text-emerald-300 font-bold block">Volné nosiče skladem</span>
            <div className="mt-1 flex items-baseline gap-2">
              <strong className="text-2xl font-black text-emerald-400">{fleet.availableFrames}</strong>
              <span className="text-xs text-emerald-500">ks připraveno</span>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/30 bg-purple-950/40 p-3.5 backdrop-blur-xs">
            <span className="text-[11px] text-purple-300 font-bold block">Aktivně v ulicích po ČR</span>
            <div className="mt-1 flex items-baseline gap-2">
              <strong className="text-2xl font-black text-purple-300">{fleet.occupiedFrames}</strong>
              <span className="text-xs text-purple-400">ks na výstavách</span>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/40 p-3.5 backdrop-blur-xs">
            <span className="text-[11px] text-amber-300 font-bold block">V servisu / údržbě</span>
            <div className="mt-1 flex items-baseline gap-2">
              <strong className="text-2xl font-black text-amber-400">{fleet.maintenanceCount}</strong>
              <span className="text-xs text-amber-500">ks oprava</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Permits Warning Banner */}
      {expiringProjects.length > 0 && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/80 p-4 text-rose-200 shadow-md">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-white">
                ⚠️ Pozor: Končí platnost {expiringProjects.length} úředních záborů měst!
              </h4>
              <p className="text-xs text-rose-200">
                Brzy vyprší zábor veřejného prostranství. Podajte žádost o prodloužení na město, nebo naplánujte odvoz nosičů:
              </p>
              <div className="mt-2 flex flex-wrap gap-2 pt-1">
                {expiringProjects.map((p) => {
                  const diffDays = Math.ceil((new Date(p.permitValidTo!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <span key={p.id} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-900/90 border border-rose-700/60 px-2.5 py-1 text-[11px] font-black text-rose-100">
                      <span>{p.title} ({p.city})</span>
                      <span className="rounded-md bg-rose-950 px-1.5 py-0.5 text-[10px] text-rose-300">za {diffDays} dní</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('exhibitions')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'exhibitions' ? 'bg-slate-900 text-white shadow-sm font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <GalleryHorizontalEnd size={16} />
            <span>Výstavy ({projects.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('permits')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'permits' ? 'bg-slate-900 text-white shadow-sm font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText size={16} />
            <span>Zábory & Povolení měst</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'timeline' ? 'bg-slate-900 text-white shadow-sm font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar size={16} />
            <span>Kapacita & Časová osa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'map' ? 'bg-slate-900 text-white shadow-sm font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MapPin size={16} />
            <span>Mapa po ČR</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat město, výstavy, umělce..."
              className="input pl-9 py-1.5 text-xs bg-white border-slate-300 rounded-xl"
            />
          </div>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="input py-1.5 text-xs bg-white border-slate-300 rounded-xl w-32"
          >
            <option value="ALL">Všechna města</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: EXHIBITIONS GRID */}
      {activeTab === 'exhibitions' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              <GalleryHorizontalEnd size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Nenalezena žádná výstava</p>
              <p className="text-xs text-slate-400 mt-1">Zkuste upravit vyhledávání nebo založit novou výpravu.</p>
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isExpiring =
                p.permitValidTo &&
                Math.ceil((new Date(p.permitValidTo).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 30;

              return (
                <div
                  key={p.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-md bg-fuchsia-50 px-2 py-0.5 text-[10px] font-black text-fuchsia-700 uppercase">
                          <MapPin size={11} /> {p.city || 'ČR'} {p.locality ? `· ${p.locality}` : ''}
                        </span>
                        <h3 className="font-bold text-slate-900 text-lg leading-snug mt-1">{p.title}</h3>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'PLANNED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status === 'ACTIVE' ? 'Aktivní v ulicích' : p.status === 'PLANNED' ? 'Plánováno' : 'Koncept'}
                      </span>
                    </div>

                    {p.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{p.description}</p>}

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Alokované stojany:</span>
                        <b className="font-bold text-slate-900">{p.frameCount} ks nosičů City Gallery</b>
                      </div>

                      {p.artistName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Autor / Umělec:</span>
                          <span className="font-semibold text-slate-800">{p.artistName}</span>
                        </div>
                      )}

                      {p.organizerName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Pořadatel / Obvod:</span>
                          <span className="font-semibold text-slate-800">{p.organizerName}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-400">Zábor veřejného prostranství:</span>
                        <span
                          className={`font-bold rounded-md px-1.5 py-0.5 text-[11px] ${
                            isExpiring
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : p.permitStatus === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {p.permitValidTo ? `Platné do ${new Date(p.permitValidTo).toLocaleDateString('cs-CZ')}` : 'Schvaluje se'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/offers/new/city-gallery`}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                    >
                      <FileText size={14} />
                      <span>Nabídka ({p._count?.offers ?? 0})</span>
                    </Link>

                    <a
                      href={`https://galerievenku.cz`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-fuchsia-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-fuchsia-500 transition"
                    >
                      <Sparkles size={14} />
                      <span>QR Náhled ↗</span>
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: PERMITS & MUNICIPAL APPROVALS TABLE */}
      {activeTab === 'permits' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText size={18} className="text-fuchsia-600" />
                <span>Přehled úředních záborů a povolení měst</span>
              </h3>
              <p className="text-xs text-slate-500">Právní stav a lhůty záborů veřejného prostranství po celé ČR</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Výstava / Název</th>
                  <th className="py-3 px-4">Město & Lokalita</th>
                  <th className="py-3 px-4">Číslo jednací povolení</th>
                  <th className="py-3 px-4">Platnost záboru (Od - Do)</th>
                  <th className="py-3 px-4">Kontakt na úředníka</th>
                  <th className="py-3 px-4">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {projects.map((p) => {
                  const validTo = p.permitValidTo ? new Date(p.permitValidTo) : null;
                  const diffDays = validTo ? Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.title}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {p.city || 'Ostrava'} {p.locality ? `· ${p.locality}` : ''}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{p.permitNumber || 'Vřízení/Rozhodnutí v procesu'}</td>
                      <td className="py-3.5 px-4 font-semibold">
                        {p.permitValidFrom ? new Date(p.permitValidFrom).toLocaleDateString('cs-CZ') : '—'} až{' '}
                        {validTo ? validTo.toLocaleDateString('cs-CZ') : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.cityOfficialContact ? (
                          <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                            <Phone size={12} className="text-slate-400" /> {p.cityOfficialContact}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {diffDays !== null && diffDays <= 14 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-[10px] font-black text-rose-800">
                            🚨 Končí za {diffDays} dní!
                          </span>
                        ) : p.permitStatus === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                            <CheckCircle2 size={12} /> Schváleno
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                            <Clock size={12} /> V řízení
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TIMELINE & CAPACITY */}
      {activeTab === 'timeline' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calendar size={18} className="text-fuchsia-600" />
                <span>Časová osa alokace nosičů City Gallery</span>
              </h3>
              <p className="text-xs text-slate-500">Ganttův přehled obsazenosti nosičů po měsících</p>
            </div>
            <span className="text-xs font-black text-fuchsia-700 bg-fuchsia-50 px-3 py-1 rounded-full border border-fuchsia-200">
              Celkem {fleet.totalFleet} ks nosičů
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {projects.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{p.title} ({p.city})</span>
                  <span className="font-black text-fuchsia-700">{p.frameCount} ks nosičů</span>
                </div>
                {/* Visual timeline bar */}
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${p.status === 'ACTIVE' ? 'bg-gradient-to-r from-fuchsia-500 to-emerald-500' : 'bg-slate-400'}`}
                    style={{ width: `${Math.min(100, Math.max(20, p.frameCount * 4))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Platnost záboru: {p.permitValidTo ? new Date(p.permitValidTo).toLocaleDateString('cs-CZ') : 'Neurčeno'}</span>
                  <span className="font-bold uppercase text-[10px] text-slate-700">{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CITIES MAP */}
      {activeTab === 'map' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs text-center space-y-4">
          <MapPin size={36} className="mx-auto text-fuchsia-600 animate-bounce" />
          <h3 className="font-bold text-slate-900 text-base">Mapa nosičů Galerie VENKU po celé ČR</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Zobrazení všech aktivních stanovišť nosičů City Gallery v České republice (Ostrava, Praha, Brno, Olomouc, Plzeň...).
          </p>

          <div className="grid gap-3 sm:grid-cols-3 pt-4 max-w-3xl mx-auto">
            {cities.map((city) => {
              const cityProjects = projects.filter((p) => p.city === city);
              const cityFrames = cityProjects.reduce((acc, p) => acc + p.frameCount, 0);

              return (
                <div key={city} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-2xs">
                  <strong className="text-slate-900 font-black text-sm block">{city}</strong>
                  <div className="text-xs text-slate-500 mt-1">
                    Výstavy: <b className="text-slate-900 font-bold">{cityProjects.length}</b> · Stojany:{' '}
                    <b className="text-fuchsia-700 font-bold">{cityFrames} ks</b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW PROJECT */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-lg bg-white shadow-2xl rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-fuchsia-600" />
                  <span>Nová výstava / Výjezd Galerie VENKU</span>
                </h3>
                <p className="text-xs text-slate-500">Zadejte lokalitu, zábor prostranství a alokaci nosičů</p>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                ⚠️ {modalError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Název výstavy *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="např. Ostrava v proměnách času"
                  className="input h-10 text-xs w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Město *</label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="např. Ostrava, Praha, Plzeň"
                    className="input h-10 text-xs w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Lokalita / Prostranství</label>
                  <input
                    type="text"
                    value={formLocality}
                    onChange={(e) => setFormLocality(e.target.value)}
                    placeholder="např. Masarykovo náměstí"
                    className="input h-10 text-xs w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Počet nosičů (ks) *</label>
                  <input
                    type="number"
                    min={1}
                    max={fleet.totalFleet}
                    required
                    value={formFrameCount}
                    onChange={(e) => setFormFrameCount(Number(e.target.value))}
                    className="input h-10 text-xs w-full font-bold text-fuchsia-700"
                  />
                  <span className="text-[10px] text-slate-400">Dostupné na skladě: {fleet.availableFrames} ks</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stav výpravy</label>
                  <select
                    value={formStatus}
                    onChange={(e: any) => setFormStatus(e.target.value)}
                    className="input h-10 text-xs w-full"
                  >
                    <option value="ACTIVE">Aktivní v ulicích</option>
                    <option value="PLANNED">Plánováno</option>
                    <option value="DRAFT">Koncept</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <span className="font-black text-slate-900 block text-xs">📜 Úřední zábor & Povolení města:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Číslo jednací záboru</label>
                    <input
                      type="text"
                      value={formPermitNumber}
                      onChange={(e) => setFormPermitNumber(e.target.value)}
                      placeholder="Č.j. MAG/1234/2026"
                      className="input h-9 text-xs w-full"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Kontakt na úředníka</label>
                    <input
                      type="text"
                      value={formCityOfficialContact}
                      onChange={(e) => setFormCityOfficialContact(e.target.value)}
                      placeholder="Jan Novák, tel: 777..."
                      className="input h-9 text-xs w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Platnost záboru OD</label>
                    <input
                      type="date"
                      value={formPermitValidFrom}
                      onChange={(e) => setFormPermitValidFrom(e.target.value)}
                      className="input h-9 text-xs w-full"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Platnost záboru DO</label>
                    <input
                      type="date"
                      value={formPermitValidTo}
                      onChange={(e) => setFormPermitValidTo(e.target.value)}
                      className="input h-9 text-xs w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Autor / Umělec</label>
                  <input
                    type="text"
                    value={formArtistName}
                    onChange={(e) => setFormArtistName(e.target.value)}
                    placeholder="Jméno umělce"
                    className="input h-9 text-xs w-full"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Pořadatel / Obvod</label>
                  <input
                    type="text"
                    value={formOrganizerName}
                    onChange={(e) => setFormOrganizerName(e.target.value)}
                    placeholder="Městský obvod Ostrava-Jih"
                    className="input h-9 text-xs w-full"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-xl bg-fuchsia-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-fuchsia-500 disabled:opacity-50"
                >
                  {modalLoading ? 'Ukládám...' : 'Vytvořit výpravu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FLEET SETTINGS */}
      {isFleetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-md bg-white shadow-2xl rounded-3xl p-6 relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-fuchsia-600" />
                  <span>Správa celkového fondu nosičů</span>
                </h3>
                <p className="text-xs text-slate-500">Úprava celkového počtu nosičů City Gallery Galerie VENKU</p>
              </div>
              <button onClick={() => setIsFleetModalOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                ⚠️ {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateFleet} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Celkový počet nosičů City Gallery (ks) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newTotalFleet}
                  onChange={(e) => setNewTotalFleet(Number(e.target.value))}
                  className="input h-10 text-xs w-full font-bold text-lg text-fuchsia-700"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Zadejte celkový počet fyzických nosičů, které vlastní Galerie VENKU.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nosiče v údržbě / servisu (ks)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newMaintenanceCount}
                  onChange={(e) => setNewMaintenanceCount(Number(e.target.value))}
                  className="input h-10 text-xs w-full font-bold text-amber-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFleetModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {modalLoading ? 'Ukládám...' : 'Uložit fond nosičů'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
