import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { FieldWorkDesk } from '@/components/election-removal/FieldWorkDesk';
export const dynamic = 'force-dynamic';
export default async function FieldActionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await checkElectionRemovalPageAccess(); const { id } = await params;
  const campaign = await prisma.electionCampaign.findFirst({ where: { id, organizationId: user.organization!.id }, include: { points: { include: { steps: { orderBy: { sequence: 'asc' } }, photos: { select: { id: true } } }, orderBy: { createdAt: 'asc' } }, fieldPlans: { orderBy: { createdAt: 'desc' } } } });
  if (!campaign) notFound();
  return <AppShell><div className="mx-auto max-w-6xl space-y-5">
    <Link href="/election-removal">← Terénní práce</Link>
    <h1 className="text-2xl font-bold">{campaign.name}</h1><p>{campaign.clientName} {campaign.description}</p>
    <Link href="/my-route">Moje trasa</Link>
    <div className="flex flex-wrap gap-3">{campaign.fieldPlans.map(p => <div className="rounded border p-2" key={p.id}>Výjezd {p.date} / v{p.version} · {p.status} {['APPROVED','ACTIVE'].includes(p.status) && <Link className="underline" href={`/election-removal/${id}/plan?parentPlanId=${p.id}`}>Revize tohoto výjezdu</Link>}</div>)}</div>
    {['ADMIN','MANAGER'].includes(user.role) && <FieldWorkDesk campaignId={id} points={campaign.points} />}
  </div></AppShell>;
}
