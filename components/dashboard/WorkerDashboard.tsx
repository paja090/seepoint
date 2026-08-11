import Link from 'next/link';
import { Calendar, Car, CheckCircle2, Clock, MapPin, PhoneCall, Route, ShieldCheck, Truck, Wallet } from 'lucide-react';
import { Button, Card, StatCard } from '@/components/ui';

interface WorkerDashboardProps {
  workerName: string;
  assignedTasksCount: number;
  completedEntriesCount: number;
  monthlyEarnings: number;
  assignedVehicle: {
    id: string;
    name: string;
    registrationNumber: string | null;
    status: string;
  } | null;
  upcomingTasks: Array<{
    id: string;
    title: string;
    clientName: string;
    scheduledAt: Date;
    status: string;
    priority: string;
  }>;
}

export function WorkerDashboard({
  workerName,
  assignedTasksCount,
  completedEntriesCount,
  monthlyEarnings,
  assignedVehicle,
  upcomingTasks,
}: WorkerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/40">
              <ShieldCheck size={14} />
              <span>Pracovník v terénu</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white">
              Vítejte, {workerName}! 👋
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Váš osobní přehled terénních prací, naplánovaných výjezdů a služebního vozidla.
            </p>
          </div>

          <Link
            href="/my-tasks"
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition"
          >
            <Route size={18} />
            <span>🚀 Otevřít Moje Úkoly ({assignedTasksCount})</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Route size={20} />}
          label="Čekající úkoly"
          tone="orange"
          value={assignedTasksCount}
          description="Přidělené pracovní zakázky v terénu."
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Odvedená práce"
          tone="green"
          value={`${completedEntriesCount} ks`}
          description="Dokončené výjezdy tento měsíc."
        />
        <StatCard
          icon={<Wallet size={20} />}
          label="Moje odměna"
          tone="blue"
          value={`${monthlyEarnings.toLocaleString('cs-CZ')} Kč`}
          description="Vypočítané vyúčtování tento měsíc."
        />
        <StatCard
          icon={<Car size={20} />}
          label="Služební vozidlo"
          tone={assignedVehicle ? 'green' : 'slate'}
          value={assignedVehicle ? assignedVehicle.name : 'Nepřiřazeno'}
          description={assignedVehicle?.registrationNumber ? `SPZ: ${assignedVehicle.registrationNumber}` : 'Rezervujte si vůz v modulu Auta.'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Tasks Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
              <Calendar size={20} className="text-emerald-600" />
              <span>Nejbližší terénní zakázky</span>
            </h2>
            <Link href="/my-tasks" className="text-xs font-bold text-emerald-600 hover:underline">
              Zobrazit všechny ({assignedTasksCount})
            </Link>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
              <h3 className="text-base font-bold text-slate-900">Všechny úkoly máte hotové!</h3>
              <p className="mt-1 text-sm text-slate-500">Nemáte žádné nevyřízené terénní zakázky.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {new Date(task.scheduledAt).toLocaleDateString('cs-CZ')}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${task.priority === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {task.priority === 'URGENT' ? '🔥 URGENTNÍ' : 'Běžná priorita'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{task.title}</h3>
                    <p className="text-xs text-slate-500 font-medium">Klient: <b>{task.clientName}</b></p>
                  </div>

                  <Link
                    href="/my-tasks"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
                  >
                    <span>Detail úkolu</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Column (Vehicle & Quick Contacts) */}
        <div className="space-y-6">
          {/* Vehicle Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Truck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Moje vozidlo</h3>
                <p className="text-xs text-slate-500">Přiřazení a stav autoparku</p>
              </div>
            </div>

            {assignedVehicle ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-xs text-slate-500">Model vozidla</p>
                  <p className="text-base font-black text-slate-900">{assignedVehicle.name}</p>
                  {assignedVehicle.registrationNumber && (
                    <p className="mt-1 inline-block rounded-lg bg-yellow-300 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-950 border border-yellow-400">
                      {assignedVehicle.registrationNumber}
                    </p>
                  )}
                </div>
                <Link
                  href="/vehicles"
                  className="block text-center rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-200 transition"
                >
                  Správa vozidla & Rezervace
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-slate-500 mb-3">Aktuálně nemáte rezervované žádné auto.</p>
                <Link
                  href="/vehicles"
                  className="inline-block rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 transition"
                >
                  Rezervovat vůz
                </Link>
              </div>
            )}
          </div>

          {/* Manager Direct Call Box */}
          <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                <PhoneCall size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Dispečink & Vedoucí</h3>
                <p className="text-xs text-slate-600">Rychlá pomoc v terénu</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              V případě problémů na nosiči nebo nejasností kontaktujte dispečera.
            </p>

            <a
              href="tel:+420700000000"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-500 transition active:scale-95"
            >
              <PhoneCall size={16} />
              <span>Zavolat dispečink</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
