import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OfferActions } from '@/components/offers/OfferActions';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, PageHeader } from '@/components/ui';
import { requirePageAccess } from '@/lib/page-auth';
import { getOffer } from '@/lib/offers/service';
import { OfferValidationError } from '@/lib/offers/domain';
import type { OfferView } from '@/lib/offers/view-model';
import { toProposalOffer } from '@/lib/offers/presentation';

export const dynamic = 'force-dynamic';
export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) { const user = await requirePageAccess('offers'); let offer: OfferView; try { offer = await getOffer(user, (await params).id) as OfferView; } catch (error) { if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') notFound(); throw error; } return <AppShell><PageHeader title={offer.campaignName} description={`${offer.client.name} · vytvořil ${offer.createdBy.name}`} actions={<StatusBadge value={offer.status as never} />} /><Card className="mb-6"><OfferActions offerId={offer.id!} status={offer.status} converted={Boolean(offer.converted)} canConvert={user.role === 'ADMIN' || user.role === 'MANAGER'} /></Card><div className="space-y-6"><OfferProposal offer={toProposalOffer(offer)} variant="internal" /><aside className="grid gap-5 lg:grid-cols-2"><Card><h2 className="font-semibold">Interní informace</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">Interní poznámka</dt><dd className="mt-1 whitespace-pre-wrap">{offer.internalNote || 'Bez interní poznámky'}</dd></div><div><dt className="text-slate-500">Veřejný token</dt><dd>{offer.hasPublicLink ? 'Aktivní – pro změnu jej rotujte' : 'Nevytvořen'}</dd></div><div><dt className="text-slate-500">Poslední změna</dt><dd>{new Date(offer.updatedAt).toLocaleString('cs-CZ')}</dd></div></dl></Card><Card><h2 className="font-semibold">Historie</h2><ol className="mt-4 space-y-4">{offer.events?.map((event) => <li className="border-l-2 border-slate-200 pl-3 text-sm" key={event.id}><b>{event.type}</b><p className="text-slate-500">{event.actorName || 'Systém'} · {new Date(event.createdAt).toLocaleString('cs-CZ')}</p>{event.message && <p className="mt-1 whitespace-pre-wrap">{event.message}</p>}</li>)}</ol></Card></aside></div></AppShell>; }
