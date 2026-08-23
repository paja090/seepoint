import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SeePointOSSaaSPage } from '@/components/marketing/SeePointOSSaaSPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SeePoint OS | Operační systém pro venkovní reklamu',
  description:
    'SeePoint OS propojuje reklamní plochy, klienty, nabídky, kampaně, realizace, fotodokumentaci a AI v jednom systému pro správu venkovní reklamu.',
};

export default async function OSPage() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.has('seepoint_session');

  return <SeePointOSSaaSPage isLoggedIn={isLoggedIn} />;
}
