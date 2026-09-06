import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SeePointOSSaaSPage } from '@/components/marketing/SeePointOSSaaSPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SeePoint OS | Operační systém pro venkovní reklamu',
  description:
    'SeePoint OS propojuje reklamní plochy, klienty, nabídky, kampaně, realizace, fotodokumentaci a AI v jednom systému pro správu venkovní reklamy.',
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
      'SeePoint OS propojuje reklamní plochy, klienty, nabídky, kampaně, realizace, fotodokumentaci a AI v jednom systému pro správu venkovní reklamy.',
    url: 'https://os.seepoint.cz',
    siteName: 'SeePoint OS',
    locale: 'cs_CZ',
    type: 'website',
    images: [
      {
        url: '/images/hero_showcase.jpg',
        width: 1200,
        height: 630,
        alt: 'SeePoint OS – Operační systém pro venkovní reklamu',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SeePoint OS | Operační systém pro venkovní reklamu',
    description:
      'SeePoint OS propojuje reklamní plochy, klienty, nabídky, kampaně, realizace, fotodokumentaci a AI v jednom systému pro správu venkovní reklamy.',
    images: ['/images/hero_showcase.jpg'],
  },
};

export default async function Page() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.has('seepoint_session');

  return <SeePointOSSaaSPage isLoggedIn={isLoggedIn} />;
}
