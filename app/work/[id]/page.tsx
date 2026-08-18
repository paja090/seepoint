import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { WorkOrderActions } from '@/components/WorkOrderActions';
import { WorkOrderEditForm } from '@/components/WorkOrderEditForm';
import { WorkOrderAcknowledgeButton } from '@/components/WorkOrderAcknowledgeButton';
import { prisma, ensureWorkOrderSchema } from '@/lib/db';
import {
  formatWorkDate,
  formatWorkPrice,
  workPriorityLabels,
  workPriorityStyles,
  workStatusLabels,
  workStatusStyles,
  workTypeLabels,
} from '@/lib/work';
import {
  FolderPlus,
  FileText,
  MapPin,
  Phone,
  Clock,
  UserCheck,
  ArrowLeft,
  Share2,
  Copy,
  Briefcase,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function dateTimeInput(value?: Date | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(value)
    .replace(' ', 'T');
}

function dateInput(value?: Date | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('work');
  const { id } = await params;
  await ensureWorkOrderSchema();

  const [order, clients, carriers] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        client: true,
        assignments: true,
        workTasks: { include: { assignedTo: true } },
        items: { include: { carrier: true, surface: true } },
      },
    }),
    prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.advertisingCarrier.findMany({
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, city: true },
    }),
  ]);

  if (!order) notFound();

  const isOverdue = Boolean(
    order.deadlineAt && order.deadlineAt < new Date() && !['DONE', 'CANCELLED'].includes(order.status)
  );
  const awaitsInvoice = order.ftdSent && !order.invoiced && order.status !== 'CANCELLED';

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Back Navigation & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <Link
            className="flex items-center gap-1.5 text-xs font-black text-slate-700 hover:text-sky-600 transition"
            href="/work"
          >
            <ArrowLeft size={16} /> Zpět na plán práce a zakázky
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/work?carrierCode=${order.items[0]?.carrier?.code || ''}&clientName=${encodeURIComponent(order.clientName)}`}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <Copy size={14} /> Duplikovat zakázku
            </Link>
          </div>
        </div>

        {/* Invoice Alert Banner */}
        {awaitsInvoice && (
          <section className="rounded-2xl border border-emerald-400 bg-emerald-50 p-4 shadow-sm" role="status">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-800">
              <CheckCircle2 size={16} className="text-emerald-600" /> Upozornění pro zadavatele
            </div>
            <h2 className="mt-1 text-lg font-black text-emerald-950">
              Fotodokumentace je nahrána – zakázka čeká na fakturu!
            </h2>
            <p className="mt-0.5 text-xs text-emerald-800 font-medium">
              Zadavatel ({order.requestedBy || 'neuveden'}) může po zkontrolování fotek z Disku zakázku vyfakturovat.
            </p>
          </section>
        )}

        {/* Main Card Header */}
        <header className={`card ${isOverdue ? 'border-red-400 ring-2 ring-red-100 bg-red-50/10' : ''}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-black ${
                    workStatusStyles[order.status] || 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {workStatusLabels[order.status] || order.status}
                </span>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-black ring-1 ${
                    workPriorityStyles[order.priority] || 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {workPriorityLabels[order.priority] || order.priority}
                </span>
                {isOverdue && (
                  <span className="rounded-full bg-red-600 px-3 py-0.5 text-xs font-black text-white">
                    ⚠️ Po termínu
                  </span>
                )}
                <span className="text-xs font-extrabold text-slate-600">
                  {workTypeLabels[order.workType] || order.workType}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-slate-950 tracking-tight">{order.title}</h1>

              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-700">
                <span>👤 Klient: <strong>{order.client?.name || order.clientName}</strong></span>
                <span>· Zadal/a: <strong>{order.requestedBy || 'Neuvedeno'}</strong></span>
                {order.estimatedHours && (
                  <span className="text-sky-700">
                    · ⏱️ Doba trvání: <strong>{order.estimatedHours.toString()} hod</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="text-left md:text-right space-y-1 shrink-0">
              <div className="rounded-2xl bg-slate-100 px-4 py-2.5">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Datum práce</p>
                <strong className="text-base font-black text-slate-900">{formatWorkDate(order.scheduledAt)}</strong>
              </div>
              <p className="text-xl font-black text-emerald-950">
                {formatWorkPrice(order.price?.toString())}
              </p>
            </div>
          </div>
        </header>

        {/* Grid Section */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main Left Content */}
          <div className="space-y-6">
            {/* Action Buttons for Field Workers & Managers */}
            <div className="flex flex-wrap gap-3">
              {order.ftdUrl ? (
                <a
                  href={order.ftdUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-500 transition transform hover:-translate-y-0.5"
                >
                  <FolderPlus size={18} />
                  <span>Otevřít složku s fotkami na Google Disku ↗</span>
                </a>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 flex items-center gap-2">
                  <FolderPlus size={16} className="text-slate-400" />
                  <span>Fotodokumentace není vyžadována (porada / vnitřní úkol)</span>
                </div>
              )}

              {order.pdfUrl && (
                <a
                  href={order.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-sky-500 transition transform hover:-translate-y-0.5"
                >
                  <FileText size={18} />
                  <span>Stáhnout PDF podklady / přílohu ↗</span>
                </a>
              )}
            </div>

            {/* Task Description */}
            <section className="card space-y-2">
              <h2 className="text-lg font-black text-slate-950">Podrobné zadání úkolu</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-800 font-medium leading-relaxed">
                {order.description}
              </p>

              {order.locationNote && (
                <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <MapPin size={16} className="text-amber-600" /> Místo plnění / Lokace / Pokyny:
                  </span>
                  <p className="text-sm font-bold text-amber-950">{order.locationNote}</p>
                </div>
              )}
            </section>

            {/* Carrier & Media Items */}
            <section className="card space-y-3">
              <h2 className="text-lg font-black text-slate-950">Nosiče a média</h2>
              {order.items.length === 0 ? (
                <p className="text-xs text-slate-500 font-medium">Úkol není spojený s konkrétním reklamním nosičem.</p>
              ) : (
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-2 bg-slate-50" key={item.id}>
                      <div className="flex items-center justify-between">
                        <p className="font-extrabold text-sm text-slate-900">
                          {item.carrier?.name || item.surface?.name || item.description || 'Položka práce'}
                        </p>
                        <span className="text-xs font-bold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-md">
                          {item.quantity} ks
                        </span>
                      </div>

                      {item.carrier && (
                        <p className="text-xs font-semibold text-slate-600">
                          Nosič: <strong>{item.carrier.code}</strong> · Město: <strong>{item.carrier.city}</strong>
                        </p>
                      )}

                      {item.carrier && (
                        <div className="flex gap-4 text-xs font-bold pt-1">
                          <Link className="text-sky-700 hover:underline" href={`/carriers/${item.carrier.id}`}>
                            Detail nosiče ↗
                          </Link>
                          {item.carrier.latitude !== null && item.carrier.longitude !== null && (
                            <Link className="text-sky-700 hover:underline" href={`/map?carrier=${item.carrier.id}`}>
                              Zobrazit na mapě 🗺️
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {order.mediaLabel && (
                <p className="text-xs font-bold text-slate-700 pt-2 border-t border-slate-200">
                  Typ média: <strong>{order.mediaLabel}</strong>
                  {order.quantity ? ` · Počet: ${order.quantity} ks` : ''}
                </p>
              )}
            </section>

            {/* Terms and Deadlines */}
            <section className="card space-y-3">
              <h2 className="text-lg font-black text-slate-950">Termíny zakázky</h2>
              <dl className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                  <dt className="uppercase font-bold text-slate-500 text-[10px]">Dokončit nejpozději do</dt>
                  <dd className={`mt-0.5 text-sm font-black ${isOverdue ? 'text-rose-700' : 'text-slate-900'}`}>
                    {order.deadlineAt ? formatWorkDate(order.deadlineAt) : 'Neuvedeno'}
                  </dd>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                  <dt className="uppercase font-bold text-slate-500 text-[10px]">Platnost kampaně</dt>
                  <dd className="mt-0.5 text-sm font-black text-slate-900">
                    {order.campaignDateFrom
                      ? `${formatWorkDate(order.campaignDateFrom)} – ${
                          order.campaignDateTo ? formatWorkDate(order.campaignDateTo) : 'bez konce'
                        }`
                      : 'Neuvedeno'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          {/* Right Sidebar Controls */}
          <aside className="space-y-6">
            <WorkOrderActions
              id={order.id}
              title={order.title}
              status={order.status}
              priority={order.priority}
              price={order.price?.toString() ?? null}
              ftdSent={order.ftdSent}
              invoiced={order.invoiced}
              requestedBy={order.requestedBy}
            />

            {/* Assigned Workers Card */}
            <section className="card space-y-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-600" />
                Přiřazení pracovníci
              </h2>
              <p className="text-xs font-bold text-slate-900 bg-slate-100 p-3 rounded-xl">
                {order.assignments.map((assignment) => assignment.workerName).join(', ') || 'Zatím nepřiřazeni'}
              </p>
              <WorkOrderAcknowledgeButton
                workOrderId={order.id}
                initialAcknowledged={order.assignments.some((a) => Boolean(a.acknowledgedAt))}
                initialAcknowledgedAt={order.assignments
                  .find((a) => Boolean(a.acknowledgedAt))
                  ?.acknowledgedAt?.toISOString()}
              />
            </section>

            {/* Client Phone Contact (Clickable in mobile app) */}
            <section className="card space-y-2">
              <h2 className="text-base font-black text-slate-900">Kontakt na zákazníka / místě</h2>
              <p className="text-xs font-bold text-slate-800">{order.contactName || 'Jméno neuvedeno'}</p>
              {order.contactPhone ? (
                <a
                  href={`tel:${order.contactPhone}`}
                  className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs font-black text-emerald-900 hover:bg-emerald-100 transition shadow-2xs"
                >
                  <Phone size={16} className="text-emerald-600 shrink-0" />
                  <span>{order.contactPhone} (Zavolat na mobil)</span>
                </a>
              ) : (
                <p className="text-xs text-slate-500">Telefon neuveden.</p>
              )}
            </section>
          </aside>
        </div>

        {/* Edit Form Accordion at bottom */}
        <WorkOrderEditForm
          clients={clients.map((client) => ({ id: client.id, label: client.name }))}
          carriers={carriers.map((carrier) => ({
            id: carrier.id,
            code: carrier.code,
            label: `${carrier.city} · ${carrier.name}`,
          }))}
          order={{
            id: order.id,
            title: order.title,
            description: order.description,
            scheduledAt: dateTimeInput(order.scheduledAt),
            deadlineAt: dateTimeInput(order.deadlineAt),
            campaignDateFrom: dateInput(order.campaignDateFrom),
            campaignDateTo: dateInput(order.campaignDateTo),
            workType: order.workType,
            priority: order.priority,
            price: order.price?.toString() ?? '',
            clientId: order.clientId ?? '',
            clientName: order.clientName,
            requestedBy: order.requestedBy ?? '',
            workerNames: order.assignments.map((assignment) => assignment.workerName).join(', '),
            carrierCode: order.items[0]?.carrier?.code ?? '',
            mediaLabel: order.mediaLabel ?? '',
            quantity: order.quantity?.toString() ?? '',
            contactName: order.contactName ?? '',
            contactPhone: order.contactPhone ?? '',
            locationNote: order.locationNote ?? '',
            referenceUrl: order.referenceUrl ?? '',
            ftdUrl: order.ftdUrl ?? '',
          }}
        />
      </div>
    </AppShell>
  );
}
