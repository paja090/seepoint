import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { getCommercialCenterData } from '@/lib/ai-orchestrator';
import type { CommercialPriority } from '@/lib/ai-orchestrator/contracts/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const money = (value: number | undefined) =>
  value != null
    ? new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value)
    : '—';

const dateStr = (d: Date | string | undefined | null) =>
  d ? new Date(d).toLocaleDateString('cs-CZ') : '—';

const priorityBadge: Record<CommercialPriority, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-800', label: 'Kritická' },
  URGENT: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Urgentní' },
  HIGH: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Vysoká' },
  MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Střední' },
  LOW: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Nízká' },
};

function PriorityBadge({ priority }: { priority: CommercialPriority }) {
  const style = priorityBadge[priority] ?? priorityBadge.MEDIUM;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function SectionHeading({ emoji, title, count }: { emoji: string; title: string; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
      <span>{emoji}</span> {title}
      {count != null && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{count}</span>
      )}
    </h2>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{text}</p>;
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    green: 'bg-green-50 text-green-700 ring-green-200',
  };
  return (
    <div className={`flex flex-col items-center rounded-xl p-4 ring-1 ${tones[tone] ?? tones.blue}`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="mt-1 text-xs font-medium">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CommercialCenterPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccess(user.role, 'commercial')) redirect('/dashboard');

  const data = await getCommercialCenterData(user.organizationId!);

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-950">AI Obchodní centrum</h1>
        <p className="mt-1 text-sm text-slate-500">
          Centrální přehled obchodního procesu — od poptávky přes nabídku až po realizaci.
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 1. Potřebuje moji pozornost */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionHeading emoji="🔔" title="Potřebuje moji pozornost" count={data.attentionItems.length} />
        {data.attentionItems.length === 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
            <EmptyRow text="Žádné urgentní položky — vše pod kontrolou." />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.attentionItems.map((item) => (
              <Link
                key={item.id}
                href={item.link}
                className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <PriorityBadge priority={item.priority} />
                  <span className="text-xs text-slate-400">{dateStr(item.createdAt)}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-sky-700">{item.title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">{item.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Nové poptávky (AI Mailbox) */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionHeading emoji="📨" title="Nové poptávky (AI Mailbox)" count={data.inboxRequests.length} />
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {data.inboxRequests.length === 0 ? (
            <EmptyRow text="Žádné nové poptávky." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Předmět</th>
                    <th className="px-4 py-3">Od</th>
                    <th className="px-4 py-3">Klient</th>
                    <th className="px-4 py-3">Přijato</th>
                    <th className="px-4 py-3">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.inboxRequests.map((msg) => (
                    <tr key={msg.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link href={`/ai-inbox`} className="hover:text-sky-700">{msg.subject}</Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{msg.fromName || msg.fromEmail}</td>
                      <td className="px-4 py-3 text-slate-600">{msg.clientName || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{dateStr(msg.receivedAt)}</td>
                      <td className="px-4 py-3">
                        {msg.requiresReview ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Ke kontrole</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Zpracováno</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Příležitosti (Sales Radar) */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionHeading emoji="🎯" title="Příležitosti (Sales Radar)" count={data.radarOpportunities.length} />
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {data.radarOpportunities.length === 0 ? (
            <EmptyRow text="Zatím žádné příležitosti." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Firma</th>
                    <th className="px-4 py-3">Příležitost</th>
                    <th className="px-4 py-3">Město</th>
                    <th className="px-4 py-3">Skóre</th>
                    <th className="px-4 py-3">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.radarOpportunities.map((opp) => (
                    <tr key={opp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{opp.companyName}</td>
                      <td className="px-4 py-3 text-slate-600">{opp.title}</td>
                      <td className="px-4 py-3 text-slate-500">{opp.city || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          opp.score >= 80 ? 'bg-green-100 text-green-800' :
                          opp.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {opp.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{opp.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 4. Připraveno k nabídce */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionHeading emoji="✅" title="Připraveno k nabídce" count={data.offers.drafts.length} />
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {data.offers.drafts.length === 0 ? (
            <EmptyRow text="Žádné koncepty nabídek." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.offers.drafts.map((draft) => (
                <Link
                  key={draft.id}
                  href={`/offers/${draft.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{draft.title}</p>
                    <p className="truncate text-xs text-slate-500">{draft.clientName || 'Bez klienta'} · {dateStr(draft.createdAt)}</p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-slate-700">{money(draft.totalPrice)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 5. Nabídky — Draft / Sent / Accepted */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionHeading emoji="📄" title="Nabídky" />
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {/* Koncepty */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">Koncepty <span className="text-slate-400">({data.offers.drafts.length})</span></h3>
            </div>
            {data.offers.drafts.length === 0 ? (
              <EmptyRow text="Žádné koncepty." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.offers.drafts.map((o) => (
                  <li key={o.id} className="px-4 py-3">
                    <Link href={`/offers/${o.id}`} className="text-sm font-medium text-slate-800 hover:text-sky-700">{o.title}</Link>
                    <p className="text-xs text-slate-500">{o.clientName || '—'} · {money(o.totalPrice)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Odeslané */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">Odeslané <span className="text-slate-400">({data.offers.sent.length})</span></h3>
            </div>
            {data.offers.sent.length === 0 ? (
              <EmptyRow text="Žádné odeslané nabídky." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.offers.sent.map((o) => (
                  <li key={o.id} className="px-4 py-3">
                    <Link href={`/offers/${o.id}`} className="text-sm font-medium text-slate-800 hover:text-sky-700">{o.title}</Link>
                    <p className="text-xs text-slate-500">
                      {o.clientName || '—'} · {money(o.totalPrice)}
                      {o.validUntil && <> · platnost do {dateStr(o.validUntil)}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Přijaté */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">Přijaté <span className="text-slate-400">({data.offers.accepted.length})</span></h3>
            </div>
            {data.offers.accepted.length === 0 ? (
              <EmptyRow text="Žádné přijaté nabídky." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.offers.accepted.map((o) => (
                  <li key={o.id} className="px-4 py-3">
                    <Link href={`/offers/${o.id}`} className="text-sm font-medium text-slate-800 hover:text-sky-700">{o.title}</Link>
                    <p className="text-xs text-slate-500">
                      {o.clientName || '—'} · {money(o.totalPrice)}
                      {o.hasCrmOrder && <span className="ml-1 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">Objednávka</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 6. Realizace */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionHeading emoji="🔧" title="Realizace" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Aktivní" value={data.realizations.active} tone="blue" />
          <StatBox label="Riziko" value={data.realizations.risk} tone="amber" />
          <StatBox label="Blokované" value={data.realizations.blocked} tone="red" />
          <StatBox label="K fakturaci" value={data.realizations.readyForBilling} tone="green" />
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* 7. Next Best Action */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionHeading emoji="💡" title="Doporučené akce" count={data.nextBestActions.length} />
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {data.nextBestActions.length === 0 ? (
            <EmptyRow text="Žádná doporučená akce." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.nextBestActions.slice(0, 10).map((nba) => (
                <li key={nba.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="mt-0.5">
                    <PriorityBadge priority={nba.priority as CommercialPriority} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{nba.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{nba.description}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {nba.targetEntityType} · {nba.actionType}
                      {nba.dueAt && <> · do {dateStr(nba.dueAt)}</>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
