import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { roleLabel } from '@/lib/rbac';
import { Phone, Mail, UserCheck, ShieldCheck, Wrench, Briefcase, Search, Sparkles, MapPin } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const user = await requirePageAccess('team');

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: {
      user: true,
      photos: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [
      { role: 'asc' },
      { firstName: 'asc' },
    ],
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/40">
                <Sparkles size={14} />
                <span>Tým SeePOINT & Kontakty v terénu</span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white">
                Kontakty & Telefonní Seznam Týmu
              </h1>
              <p className="mt-1 text-sm text-slate-300 max-w-2xl">
                Rychlé telefonní spojení na kolegy v terénu, obchodníky a vedení. Kliknutím na telefon v mobilu ihned vytočíte hovor.
              </p>
            </div>
            
            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-4 text-center">
              <span className="block text-2xl font-black text-emerald-400">{employees.length}</span>
              <span className="text-xs text-slate-300 font-semibold">Aktivních členů týmu</span>
            </div>
          </div>
        </header>

        {/* Team Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((emp) => {
            const fullName = `${emp.firstName} ${emp.lastName}`.trim();
            const photoUrl = emp.photos[0]?.url;
            const initials = `${emp.firstName[0] ?? ''}${emp.lastName[0] ?? ''}`.toUpperCase();
            const displayRole = roleLabel(emp.role);
            const positionsList = emp.positions.length ? emp.positions : (emp.position ? [emp.position] : []);

            return (
              <div
                key={emp.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-slate-300"
              >
                <div>
                  {/* Top Avatar & Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="relative">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={fullName}
                          className="h-16 w-16 rounded-2xl object-cover border-2 border-slate-100 shadow-sm"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-lg font-black text-white shadow-sm border border-slate-800">
                          {initials}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white" title="Aktivní člen týmu" />
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">
                      <ShieldCheck size={12} className="text-emerald-600" />
                      <span>{displayRole}</span>
                    </span>
                  </div>

                  {/* Name & Positions */}
                  <div className="mt-4">
                    <h3 className="text-lg font-bold text-slate-950 group-hover:text-emerald-700 transition">
                      {fullName}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {positionsList.length > 0 ? positionsList.join(' · ') : 'Člen týmu SeePOINT'}
                    </p>
                  </div>

                  {/* Responsibilities & Skills Note */}
                  {emp.note && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100">
                      <p className="font-bold text-slate-800 mb-0.5">Zodpovědnost & Dovednosti:</p>
                      <p className="line-clamp-3 font-normal">{emp.note}</p>
                    </div>
                  )}
                </div>

                {/* Contact Actions (Call & Email) */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  {emp.phone ? (
                    <a
                      href={`tel:${emp.phone.replace(/\s/g, '')}`}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition"
                    >
                      <Phone size={15} />
                      <span>Volat: {emp.phone}</span>
                    </a>
                  ) : (
                    <span className="block text-center text-xs text-slate-400 py-2">Telefon neuveden</span>
                  )}

                  {emp.email && (
                    <a
                      href={`mailto:${emp.email}`}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Mail size={14} className="text-slate-400" />
                      <span className="truncate">{emp.email}</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
