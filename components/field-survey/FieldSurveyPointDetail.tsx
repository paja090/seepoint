'use client';

import { useState } from 'react';
import type { SurveyPointItem } from './FieldSurveyMapView';

export function FieldSurveyPointDetail({
  point,
  userRole,
  onClose,
  onPointUpdated,
}: {
  point: SurveyPointItem;
  userRole: string;
  onClose: () => void;
  onPointUpdated: (updatedPoint: SurveyPointItem) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'parcel' | 'owner' | 'contact' | 'ai' | 'convert'>('overview');
  const [isLookingUpParcel, setIsLookingUpParcel] = useState(false);
  const [parcelMessage, setParcelMessage] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // Owner form state
  const [ownerName, setOwnerName] = useState(point.ownerData?.ownerName ?? '');
  const [ownerType, setOwnerType] = useState(point.ownerData?.ownerType ?? 'UNKNOWN');
  const [isSavingOwner, setIsSavingOwner] = useState(false);

  // Contact form state
  const [contactCompany, setContactCompany] = useState(point.contactData?.company ?? '');
  const [contactPerson, setContactPerson] = useState(point.contactData?.contactPerson ?? '');
  const [contactPhone, setContactPhone] = useState(point.contactData?.phone ?? '');
  const [contactEmail, setContactEmail] = useState(point.contactData?.email ?? '');
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Carrier conversion state
  const [carrierCode, setCarrierCode] = useState(`CAR-${point.surfaceType}-${point.id.slice(-5).toUpperCase()}`);
  const [carrierName, setCarrierName] = useState(`Nosič ${point.address || point.surfaceType}`);
  const [carrierCity, setCarrierCity] = useState(point.parcelData?.municipality || 'Ostrava');
  const [carrierType, setCarrierType] = useState('BILLBOARD');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<string | null>(null);

  const canConvert = userRole === 'ADMIN' || userRole === 'MANAGER';

  // Vyhledání parcely
  async function handleParcelLookup() {
    setIsLookingUpParcel(true);
    setParcelMessage('');
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/parcel-lookup`, {
        method: 'POST',
      });
      const data = await res.json() as { success: boolean; message: string; parcel?: SurveyPointItem['parcelData'] };
      setParcelMessage(data.message || (data.success ? 'Parcela byla zjištěna.' : 'Zjišťování selhalo.'));
      if (data.success && data.parcel) {
        onPointUpdated({ ...point, parcelData: data.parcel, status: 'PARCEL_FOUND' });
      }
    } catch {
      setParcelMessage('Chyba při komunikaci se serverem.');
    } finally {
      setIsLookingUpParcel(false);
    }
  }

  // Spuštění AI analýzy
  async function handleAiAnalyze() {
    setIsAiAnalyzing(true);
    setAiMessage('');
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/ai-analyze`, {
        method: 'POST',
      });
      const data = await res.json() as { success: boolean; message: string; analysis?: SurveyPointItem['aiAnalysis'] };
      setAiMessage(data.message || (data.success ? 'AI analýza hotova.' : 'AI analýza selhala.'));
      if (data.success && data.analysis) {
        onPointUpdated({ ...point, aiAnalysis: data.analysis });
      }
    } catch {
      setAiMessage('Chyba při spouštění AI analýzy.');
    } finally {
      setIsAiAnalyzing(false);
    }
  }

  // Uložení vlastníka
  async function handleSaveOwner(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingOwner(true);
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/owner`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName, ownerType }),
      });
      const data = await res.json() as { success: boolean; owner?: SurveyPointItem['ownerData'] };
      if (data.success && data.owner) {
        onPointUpdated({ ...point, ownerData: data.owner, status: 'OWNER_FOUND' });
      }
    } finally {
      setIsSavingOwner(false);
    }
  }

  // Uložení kontaktu
  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingContact(true);
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: contactCompany,
          contactPerson,
          phone: contactPhone,
          email: contactEmail,
        }),
      });
      const data = await res.json() as { success: boolean; contact?: SurveyPointItem['contactData'] };
      if (data.success && data.contact) {
        onPointUpdated({ ...point, contactData: data.contact, status: 'CONTACT_FOUND' });
      }
    } finally {
      setIsSavingContact(false);
    }
  }

  // Převod na nosič
  async function handleConvertToCarrier(e: React.FormEvent) {
    e.preventDefault();
    setIsConverting(true);
    setConversionResult(null);
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/convert-to-carrier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: carrierCode,
          name: carrierName,
          city: carrierCity,
          type: carrierType,
        }),
      });
      const data = await res.json() as { success: boolean; message: string };
      setConversionResult(data.message || (data.success ? 'Nosič byl vytvořen.' : 'Chyba převodu.'));
      if (data.success) {
        onPointUpdated({ ...point, status: 'CONVERTED' });
      }
    } catch {
      setConversionResult('Chyba při komunikaci se serverem.');
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
      {/* Záhlaví detailu */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-slate-900">{point.surfaceType}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {point.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Zaznamenal {point.createdBy?.name} · {new Date(point.createdAt).toLocaleDateString('cs-CZ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 text-lg font-bold px-2 py-1 rounded-lg"
          aria-label="Zavřít detail"
        >
          ✕
        </button>
      </div>

      {/* Navigační taby */}
      <div className="flex gap-1 border-b border-slate-100 pb-2 overflow-x-auto text-xs font-medium">
        {[
          { id: 'overview', label: 'Přehled & Foto' },
          { id: 'parcel', label: 'Parcela' },
          { id: 'owner', label: 'Vlastník' },
          { id: 'contact', label: 'Kontakt' },
          { id: 'ai', label: 'AI Analýza' },
          ...(canConvert ? [{ id: 'convert', label: 'Převod na nosič' }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === tab.id
                ? 'bg-sky-950 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PŘEHLED & FOTO */}
      {activeTab === 'overview' && (
        <div className="space-y-4 text-sm">
          {/* Fotogalerie */}
          {point.photos?.length > 0 ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={point.photos[0].url}
                alt="Fotografie bodu"
                className="w-full h-48 rounded-xl object-cover border border-slate-200"
              />
              {point.photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {point.photos.slice(1).map((photo, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={photo.id || i}
                      src={photo.url}
                      alt={`Foto ${i + 2}`}
                      className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-32 rounded-xl bg-slate-50 border border-dashed border-slate-200 grid place-items-center text-xs text-slate-400">
              Bez fotografií
            </div>
          )}

          {/* GPS a Adresa */}
          <div className="rounded-xl bg-slate-50 p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">GPS poloha:</span>
              <div className="flex gap-2">
                <a
                  href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  Google Maps ↗
                </a>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=17/${point.latitude}/${point.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  OSM ↗
                </a>
              </div>
            </div>
            <div className="font-mono text-slate-900">
              {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
              {point.gpsAccuracyMeters ? ` (±${Math.round(point.gpsAccuracyMeters)} m)` : ''}
            </div>
            {point.address && (
              <div>
                <span className="font-semibold text-slate-700">Adresa:</span>
                <p className="text-slate-900 mt-0.5">{point.address}</p>
              </div>
            )}
            {point.note && (
              <div>
                <span className="font-semibold text-slate-700">Poznámka z terénu:</span>
                <p className="text-slate-900 mt-0.5 italic">{point.note}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PARCELA */}
      {activeTab === 'parcel' && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <strong>Geodatová vrstva:</strong> AI parcelní čísla nevymýšlí. Parcela pochází výhradně z katastrálního zdroje nebo ručního zadání.
          </div>

          {point.parcelData?.parcelNumber ? (
            <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-xs">
              <div><span className="font-semibold text-slate-700">Parcelní číslo:</span> <strong className="text-slate-900">{point.parcelData.parcelNumber}</strong></div>
              {point.parcelData.cadastralArea && <div><span className="font-semibold text-slate-700">Katastrální území:</span> {point.parcelData.cadastralArea}</div>}
              {point.parcelData.municipality && <div><span className="font-semibold text-slate-700">Obec:</span> {point.parcelData.municipality}</div>}
              <div><span className="font-semibold text-slate-700">Ověření:</span> <span className="font-bold text-sky-700">{point.parcelData.confidence}</span></div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">K tomuto bodu zatím nejsou přiřazena parcelní data.</p>
          )}

          <button
            type="button"
            onClick={() => void handleParcelLookup()}
            disabled={isLookingUpParcel}
            className="w-full btn btn-primary text-xs py-2.5"
          >
            {isLookingUpParcel ? 'Zjišťuji parcelu…' : '🔍 Vyhledat parcelu pro GPS'}
          </button>

          {parcelMessage && (
            <p className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-lg">{parcelMessage}</p>
          )}
        </div>
      )}

      {/* TAB 3: VLASTNÍK */}
      {activeTab === 'owner' && (
        <form onSubmit={handleSaveOwner} className="space-y-3 text-xs">
          <p className="text-slate-500">Vlastník pozemku nebo objektu, na kterém plocha stojí.</p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jméno / Název vlastníka</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Např. Statutární město Ostrava, Dopravní podnik..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Typ vlastníka</label>
            <select
              value={ownerType}
              onChange={(e) => setOwnerType(e.target.value)}
              className="input w-full"
            >
              <option value="UNKNOWN">Neznámý</option>
              <option value="MUNICIPALITY">Město / Obec</option>
              <option value="STATE">Stát / ŘSD / SŽ</option>
              <option value="COMPANY">Firma / S.R.O. / A.S.</option>
              <option value="INDIVIDUAL">Soukromá osoba</option>
            </select>
          </div>
          <button type="submit" disabled={isSavingOwner} className="btn btn-primary w-full py-2">
            {isSavingOwner ? 'Ukládám…' : 'Uložit vlastníka'}
          </button>
        </form>
      )}

      {/* TAB 4: KONTAKT */}
      {activeTab === 'contact' && (
        <form onSubmit={handleSaveContact} className="space-y-3 text-xs">
          <p className="text-slate-500">Kontaktní údaje pro obchodní jednání o pronájmu plochy.</p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Společnost</label>
            <input
              type="text"
              value={contactCompany}
              onChange={(e) => setContactCompany(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kontaktní osoba</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="input w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
          <button type="submit" disabled={isSavingContact} className="btn btn-primary w-full py-2">
            {isSavingContact ? 'Ukládám…' : 'Uložit kontakt'}
          </button>
        </form>
      )}

      {/* TAB 5: AI ANALÝZA */}
      {activeTab === 'ai' && (
        <div className="space-y-3 text-xs">
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-sky-900">
            <strong>AI asistent:</strong> Analyzuje fyzické parametry z fotografie (viditelnost, překážky, okolí). Výsledky jsou návrhy určené k potvrzení.
          </div>

          {point.aiAnalysis ? (
            <div className="rounded-xl bg-slate-50 p-3 space-y-1.5">
              <div><span className="font-semibold text-slate-700">Stav:</span> <strong>{point.aiAnalysis.status}</strong></div>
              {point.aiAnalysis.suggestedType && (
                <div><span className="font-semibold text-slate-700">Návrh typu:</span> {point.aiAnalysis.suggestedType}</div>
              )}
              {point.aiAnalysis.isUsable !== null && point.aiAnalysis.isUsable !== undefined && (
                <div><span className="font-semibold text-slate-700">Využitelné pro reklamu:</span> {point.aiAnalysis.isUsable ? 'Ano' : 'Ne'}</div>
              )}
            </div>
          ) : (
            <p className="text-slate-500">AI analýza pro tento bod ještě nebyla spuštěna.</p>
          )}

          <button
            type="button"
            onClick={() => void handleAiAnalyze()}
            disabled={isAiAnalyzing || point.photos?.length === 0}
            className="w-full btn btn-primary py-2.5 disabled:opacity-50"
          >
            {isAiAnalyzing ? 'Analyzuji fotografii…' : '🤖 Spustit AI analýzu'}
          </button>

          {aiMessage && (
            <p className="text-slate-600 bg-slate-100 p-2.5 rounded-lg">{aiMessage}</p>
          )}
        </div>
      )}

      {/* TAB 6: PŘEVOD NA SKUTEČNÝ NOSIČ */}
      {activeTab === 'convert' && canConvert && (
        <form onSubmit={handleConvertToCarrier} className="space-y-3 text-xs">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-900">
            <strong>Převod na nosič (pouze ADMIN/MANAGER):</strong>
            <p className="mt-1">
              Vytvoří plnohodnotný reklamní nosič v evidenci agentury s ověřenou GPS polohou a propojí ho s tímto bodem.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kód nosiče *</label>
            <input
              type="text"
              required
              value={carrierCode}
              onChange={(e) => setCarrierCode(e.target.value)}
              className="input w-full font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Název nosiče *</label>
            <input
              type="text"
              required
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Město *</label>
              <input
                type="text"
                required
                value={carrierCity}
                onChange={(e) => setCarrierCity(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Typ nosiče *</label>
              <select
                value={carrierType}
                onChange={(e) => setCarrierType(e.target.value)}
                className="input w-full"
              >
                <option value="BILLBOARD">Billboard</option>
                <option value="BIGBOARD">Bigboard</option>
                <option value="CITYLIGHT">Citylight</option>
                <option value="BANNER">Banner</option>
                <option value="PROMO_TOWER">Promo Tower</option>
                <option value="PROMO_BENCH">Lavička</option>
                <option value="OTHER">Ostatní</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isConverting || point.status === 'CONVERTED'}
            className="w-full btn btn-primary py-2.5 font-bold disabled:opacity-50"
          >
            {isConverting
              ? 'Převádím na nosič…'
              : point.status === 'CONVERTED'
              ? 'Již převedeno na nosič'
              : '⚡ Potvrdit převod na nosič'}
          </button>

          {conversionResult && (
            <p className="text-slate-800 bg-slate-100 p-2.5 rounded-lg font-semibold">{conversionResult}</p>
          )}
        </form>
      )}
    </div>
  );
}
