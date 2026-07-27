import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { attachPointInstallationPhoto } from '@/lib/navigation/navigation-service';

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('navigationProjects');
  if (isApiDenied(authResult)) return authResult;

  try {
    const body = await req.json();
    const { navigationPointId, photoUrl, photoType, note } = body;

    if (!navigationPointId || !photoUrl) {
      return NextResponse.json(
        { error: 'Chybí povinné údaje: navigationPointId, photoUrl.' },
        { status: 400 }
      );
    }

    const photo = await attachPointInstallationPhoto(navigationPointId, photoUrl, photoType, note);
    return NextResponse.json({ success: true, photo });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při nahrávání fotografie realizace.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
