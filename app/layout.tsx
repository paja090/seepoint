import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata = { title: 'SeePoint MVP', description: 'Správa reklamních nosičů na mapě' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="cs"><body>{children}</body></html>;
}
