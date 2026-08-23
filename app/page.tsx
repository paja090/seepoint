import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SeePointOSSaaSPage } from '@/components/marketing/SeePointOSSaaSPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SeePoint OS | Operační systém pro venkovní reklamu',
  description:
    'SeePoint OS propojuje reklamní plochy, klienty, nabídky, kampaně, realizace, fotodokumentaci a AI v jednom systému pro správu venkovní reklamu.',
  keywords: [
    'SeePoint OS',
    'outdoor reklama',
    'OOH software',
    'správa billboardů',
    'city poster software',
    'navigační reklama',
    'CRM pro reklamní agentury',
    'AI v OOH',
  ],
  openGraph: {
    title: 'SeePoint OS | Operační systém pro venkovní reklamu',
    description:
      'Od první obchodní příležitosti až po hotovou kampaň. V jednom systému.',
    url: 'https://os.seepoint.cz',
    siteName: 'SeePoint OS',
    locale: 'cs_CZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SeePoint OS | Operační systém pro venkovní reklamu',
    description:
      'Reklamní plochy, klienti, nabídky, kampaně, realizace a AI v jednom systému.',
  },
};

export default async function Page() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.has('seepoint_session');

  return <SeePointOSSaaSPage isLoggedIn={isLoggedIn} />;
}
