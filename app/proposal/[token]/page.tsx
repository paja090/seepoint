import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reklamní nabídka | SeePOINT', robots: { index: false, follow: false } };
export default async function LegacyPublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  redirect(`/offer/${encodeURIComponent((await params).token)}`);
}
