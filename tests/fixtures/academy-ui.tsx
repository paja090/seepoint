import React from 'react';
import { createRoot } from 'react-dom/client';
import { AcademyCatalog } from '../../components/academy/AcademyCatalog';
import { AcademyFeedbackForm } from '../../components/academy/AcademyFeedbackForm';
import { academyPilots } from '../../lib/academy/content';
const lessons = academyPilots.map(p => ({ slug: p.slug, title: p.title, summary: p.summary, category: p.category.title, durationMinutes: p.durationMinutes, status: 'MEDIA_PENDING' as const, version: 1 }));
createRoot(document.getElementById('root')!).render(<div className="min-h-screen bg-slate-50 p-4 md:p-8"><p className="mb-4 text-sm text-slate-500">Izolované ověření komponent Akademie · syntetický obsah</p><AcademyCatalog lessons={lessons} query="" preview canManage /><div className="mx-auto max-w-4xl"><AcademyFeedbackForm revisionId="fixture-revision" steps={[{ id: 'gps', title: 'Zkontrolovat GPS' }]} /></div></div>);
