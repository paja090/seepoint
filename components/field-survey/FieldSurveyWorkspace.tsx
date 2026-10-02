'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FieldSurveyMapView, type SurveyPointItem } from './FieldSurveyMapView';
import { FieldSurveyPointDetail } from './FieldSurveyPointDetail';

export function FieldSurveyWorkspace({
  survey,
  initialPoints,
  userRole,
}: {
  survey: { id: string; name: string; description?: string | null; status: string };
  initialPoints: SurveyPointItem[];
  userRole: string;
}) {
  const [points, setPoints] = useState<SurveyPointItem[]>(initialPoints);
  const [selectedPointId, setSelectedPointId] = useState<string | undefined>(initialPoints[0]?.id);

  const selectedPoint = points.find((p) => p.id === selectedPointId);

  function handlePointUpdated(updated: SurveyPointItem) {
    setPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handlePointDeleted(pointId: string) {
    setPoints((prev) => prev.filter((p) => p.id !== pointId));
    if (selectedPointId === pointId) {
      setSelectedPointId(undefined);
    }
  }

  return (
    <div className="space-y-4">
      {/* Horní lišta s akcemi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{survey.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {survey.status}
            </span>
          </div>
          {survey.description && (
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">{survey.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mobilní odkaz */}
          <Link
            href={`/mobile-field-survey/${survey.id}`}
            target="_blank"
            className="btn bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold py-2"
          >
            📱 Otevřít mobilní focení
          </Link>

          {/* Exporty */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <span className="text-xs font-semibold text-slate-600 px-2">Export:</span>
            <a
              href={`/api/field-survey/${survey.id}/export?format=xlsx`}
              download
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-xs transition"
              title="Stáhnout jako Excel tabulku"
            >
              📊 XLSX
            </a>
            <a
              href={`/api/field-survey/${survey.id}/export?format=geojson`}
              download
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-xs transition"
              title="Stáhnout jako GeoJSON pro GIS"
            >
              🌐 GeoJSON
            </a>
            <a
              href={`/api/field-survey/${survey.id}/export?format=kml`}
              download
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-xs transition"
              title="Stáhnout jako KML pro Google Earth"
            >
              📍 KML
            </a>
          </div>
        </div>
      </div>

      {/* Grid: Mapa + Panel detailu / seznam bodů */}
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        {/* Mapa */}
        <div className="space-y-4">
          <FieldSurveyMapView
            points={points}
            selectedPointId={selectedPointId}
            onSelectPoint={(p) => setSelectedPointId(p.id)}
          />
        </div>

        {/* Postranní panel */}
        <div className="space-y-4">
          {selectedPoint ? (
            <FieldSurveyPointDetail
              point={selectedPoint}
              userRole={userRole}
              onClose={() => setSelectedPointId(undefined)}
              onPointUpdated={handlePointUpdated}
              onPointDeleted={handlePointDeleted}
            />
          ) : (
            <div className="card text-center py-10 space-y-2">
              <span className="text-3xl">📍</span>
              <p className="text-sm font-semibold text-slate-700">Vyberte bod na mapě</p>
              <p className="text-xs text-slate-500">Kliknutím na marker zobrazíte detail, parcelu, vlastníka a AI analýzu.</p>
            </div>
          )}

          {/* Rychlý seznam bodů pod detailem */}
          <div className="card space-y-2 max-h-72 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Všechny body ({points.length})
            </h3>
            {points.length === 0 ? (
              <p className="text-xs text-slate-400">Zatím žádné body.</p>
            ) : (
              <ul className="space-y-1.5">
                {points.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPointId(p.id)}
                      className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition ${
                        p.id === selectedPointId
                          ? 'bg-sky-50 border border-sky-200 text-sky-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="truncate flex-1 mr-2">
                        <span className="font-bold">{p.surfaceType}</span>
                        {p.address && <span className="text-slate-500 ml-1.5 truncate">· {p.address}</span>}
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 flex-none">
                        {p.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
