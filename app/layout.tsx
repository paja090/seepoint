import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'SeePOINT Outdoor Reklama',
  description: 'Interní systém pro správu reklamních nosičů, montáží, vozidel a nabídek SeePOINT',
  manifest: '/manifest.json',
  icons: {
    icon: '/seepoint-app-icon.svg',
    apple: '/seepoint-app-icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SeePOINT',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-slate-950 text-slate-950 antialiased selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
