import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { QrCameraScanner } from '@/components/qr/QrCameraScanner';

export const dynamic = 'force-dynamic';

export default async function QrScanPage() {
  await requirePageAccess('carriers');

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">📱 Skener QR Kódů Nosičů</h1>
          <p className="mt-1 text-sm text-slate-500 font-semibold">
            Naskenujte QR štítek na nosiči, sloupu VO nebo lavičce pro bleskový zápis fotky a servisu z terénu.
          </p>
        </div>

        <QrCameraScanner />
      </div>
    </AppShell>
  );
}
