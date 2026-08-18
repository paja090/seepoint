import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { statusLabel } from '@/lib/internal-format';
import { ProfileForms } from '@/components/ProfileForms';
import { EmployeeRates } from '@/components/EmployeeRates';
import {
  User,
  ShieldCheck,
  Briefcase,
  Phone,
  Mail,
  CalendarCheck,
  ClipboardList,
  Car,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const now = new Date();
  const employee = user.employee
    ? await prisma.employee.findUnique({
        where: { id: user.employee.id },
        include: {
          assignedTasks: true,
          vehicleReservations: true,
          settlements: true,
          rates: {
            where: {
              isActive: true,
              validFrom: { lte: now },
              OR: [{ validTo: null }, { validTo: { gte: now } }],
            },
            orderBy: { validFrom: 'desc' },
          },
          photos: {
            where: { isPrimary: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
    : null;

  const profilePhotoUrl = employee?.photos[0]?.url || null;

  const initials = employee
    ? `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase()
    : (user.name || user.email || 'U')[0].toUpperCase();

  const fullName = employee ? `${employee.firstName} ${employee.lastName}` : user.name || 'Uživatel';

  return (
    <AppShell allowPasswordChange>
      <div className="space-y-6">
        {/* Temporary Password Warning Banner */}
        {user.mustChangePassword && (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5 font-medium text-amber-950 shadow-sm flex items-center gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={24} />
            <div>
              <p className="font-extrabold text-base">⚠️ Změna hesla vyžadována</p>
              <p className="text-xs text-amber-900 mt-0.5">
                Přihlašujete se dočasným heslem. Než budete pokračovat, prosím změňte si heslo v sekci Zabezpečení níže.
              </p>
            </div>
          </div>
        )}

        {/* HERO PROFILE CARD */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-6 md:p-8 text-white shadow-xl">
          {/* Subtle background glow */}
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* User Avatar Badge */}
            <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-3xl font-black text-slate-950 shadow-lg ring-4 ring-white/10">
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>

            {/* Profile Info Summary */}
            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">{fullName}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-extrabold text-emerald-300 border border-emerald-400/30">
                  <ShieldCheck size={14} />
                  {roleLabel(user.role)}
                </span>
              </div>

              <p className="text-sm font-medium text-slate-300 flex items-center justify-center md:justify-start gap-2">
                <Briefcase size={16} className="text-sky-400" />
                {employee?.position || 'Člen týmu SeePOINT'}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-300 border-t border-white/10">
                <span className="flex items-center gap-1.5">
                  <Mail size={14} className="text-slate-400" />
                  {user.email}
                </span>

                {employee?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" />
                    {employee.phone}
                  </span>
                )}

                {employee && (
                  <span className="flex items-center gap-1.5">
                    <User size={14} className="text-slate-400" />
                    {statusLabel(employee.employmentType)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* QUICK STATS & DASHBOARD LINKS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/my-tasks"
            className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition"
          >
            <div className="flex items-center justify-between text-slate-500 group-hover:text-sky-600 transition">
              <span className="text-xs font-bold uppercase tracking-wider">Moje úkoly</span>
              <ClipboardList size={22} />
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">{employee?.assignedTasks.length ?? 0}</p>
            <span className="mt-1 block text-xs text-slate-400 group-hover:underline">Zobrazit pracovní úkoly →</span>
          </Link>

          <Link
            href="/my-work-entries"
            className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition"
          >
            <div className="flex items-center justify-between text-slate-500 group-hover:text-emerald-600 transition">
              <span className="text-xs font-bold uppercase tracking-wider">Odvedená práce</span>
              <CalendarCheck size={22} />
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">Přehled</p>
            <span className="mt-1 block text-xs text-slate-400 group-hover:underline">Moje výkazy práce →</span>
          </Link>

          <Link
            href="/vehicles"
            className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition"
          >
            <div className="flex items-center justify-between text-slate-500 group-hover:text-amber-600 transition">
              <span className="text-xs font-bold uppercase tracking-wider">Rezervace vozidel</span>
              <Car size={22} />
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">{employee?.vehicleReservations.length ?? 0}</p>
            <span className="mt-1 block text-xs text-slate-400 group-hover:underline">Správa rezervačního systému →</span>
          </Link>

          <Link
            href="/my-settlements"
            className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-purple-300 transition"
          >
            <div className="flex items-center justify-between text-slate-500 group-hover:text-purple-600 transition">
              <span className="text-xs font-bold uppercase tracking-wider">Vyúčtování</span>
              <FileText size={22} />
            </div>
            <p className="mt-2 text-3xl font-black text-slate-900">{employee?.settlements.length ?? 0}</p>
            <span className="mt-1 block text-xs text-slate-400 group-hover:underline">Zobrazit výplatní pásky →</span>
          </Link>
        </div>

        {/* ACTIVE FINANCIAL RATES CARD */}
        {employee && employee.rates.length > 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900">💰 Moje schválené finanční sazby</h3>
            <EmployeeRates
              employeeId={employee.id}
              editable={false}
              rates={employee.rates.map((r) => ({
                id: r.id,
                name: r.name,
                type: r.type,
                amount: r.amount.toString(),
                currency: r.currency,
                unit: r.unit,
                workType: r.workType,
                validFrom: r.validFrom.toISOString().slice(0, 10),
                validTo: r.validTo?.toISOString().slice(0, 10) ?? null,
                isActive: r.isActive,
              }))}
            />
          </div>
        )}

        {/* EDIT PROFILE & CHANGE PASSWORD FORMS */}
        {employee ? (
          <ProfileForms
            firstName={employee.firstName}
            lastName={employee.lastName}
            phone={employee.phone ?? ''}
            email={user.email}
            currentPhotoUrl={profilePhotoUrl}
          />
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500 italic">
              Tento účet nemá propojený zaměstnanecký profil v evidenci osob.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
