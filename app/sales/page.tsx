import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CheckCircle,
  Eye,
  Inbox,
  MailCheck,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  TrendingUp,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PipelineBoard } from '@/components/sales/PipelineBoard';
import { StatusPill } from '@/components/sales/ui';
import { Button, Card, PageHeader, StatCard } from '@/components/ui';
import {
  dealsByStage,
  formatCzk,
  pipelineDeals,
  salesActivity,
  upcomingEndings,
  type SalesActivity,
} from '@/lib/mock-sales-data';

export const metadata = { title: 'Sales dashboard | SeePOINT' };

const activityIcon: Record<SalesActivity['type'], React.ReactNode> = {
  approve: <CheckCircle className="text-emerald-600" size={16} />,
  view: <Eye className="text-indigo-600" size={16} />,
  message: <MessageSquare className="text-sky-600" size={16} />,
  enquiry: <Inbox className="text-amber-600" size={16} />,
  send: <MailCheck className="text-slate-500" size={16} />,
};

export default function SalesDashboardPage() {
  const pipelineValue = pipelineDeals
    .filter((deal) => deal.stage !== 'EXPIRED')
    .reduce((sum, deal) => sum + deal.value, 0);
  const enquiries = dealsByStage('ENQUIRY');
  const sentAndViewed = dealsByStage('SENT').length + dealsByStage('VIEWED').length;
  const approved = dealsByStage('APPROVED');
  const approvedValue = approved.reduce((sum, deal) => sum + deal.value, 0);

  return (
    <AppShell>
      <PageHeader
        title="Sales dashboard"
        description="Přehled obchodního trychtýře od poptávky po schválenou kampaň. Ukázková data pro prezentaci workflow."
        actions={
          <Button href="/sales/new">
            <Plus aria-hidden className="mr-1.5" size={16} />
            Nový návrh kampaně
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description={`${pipelineDeals.length} aktivních příležitostí`}
          icon={<TrendingUp size={20} />}
          label="Hodnota pipeline"
          tone="blue"
          value={formatCzk(pipelineValue)}
        />
        <StatCard
          description="Čekají na zpracování"
          icon={<Inbox size={20} />}
          label="Nové poptávky"
          tone="orange"
          value={enquiries.length}
        />
        <StatCard
          description="Odeslané + zobrazené"
          icon={<Send size={20} />}
          label="U klienta"
          tone="purple"
          value={sentAndViewed}
        />
        <StatCard
          description={`${formatCzk(approvedValue)} k převodu`}
          icon={<CheckCircle2 size={20} />}
          label="Schválené nabídky"
          tone="green"
          value={approved.length}
        />
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Obchodní trychtýř</h2>
          <Link className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-900" href="/sales/new">
            Vytvořit nabídku
            <ArrowUpRight aria-hidden size={15} />
          </Link>
        </div>
        <PipelineBoard />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="!p-0">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
                <CalendarClock aria-hidden className="text-amber-600" size={18} />
                Blížící se konce kampaní
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">Příležitosti k obnovení a navazující nabídce.</p>
            </div>
            <Button href="/occupancy" variant="ghost">Obsazenost</Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {upcomingEndings.map((ending) => (
              <li className="flex items-center justify-between gap-4 p-4" key={ending.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{ending.client}</p>
                  <p className="truncate text-xs text-slate-500">{ending.campaign} · {ending.surfaces} ploch</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Konec {ending.endsOn}</p>
                    <p className="text-sm font-semibold text-slate-800">Obnova {formatCzk(ending.renewalValue)}</p>
                  </div>
                  <StatusPill
                    label={`${ending.daysLeft} dní`}
                    tone={ending.daysLeft <= 7 ? 'red' : ending.daysLeft <= 14 ? 'amber' : 'slate'}
                  />
                  <Link
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    href="/sales/new"
                  >
                    <RefreshCw aria-hidden size={13} />
                    Obnovit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="!p-0">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Poslední aktivita</h2>
            <p className="mt-0.5 text-sm text-slate-500">Interakce klientů a tým.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {salesActivity.map((activity) => (
              <li className="flex items-start gap-3 p-4" key={activity.id}>
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                  {activityIcon[activity.type]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-slate-800">{activity.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{activity.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
