import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getNavigationOrderDetail } from '@/lib/navigation/navigation-service';
import { transitionNavigationOrderStatus, NavigationWorkflowError } from '@/lib/navigation/workflow-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAccess('offers', 'navigation');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;
  const id = (await params).id;

  try {
    const order = await getNavigationOrderDetail(id, user);
    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při načítání detailu navigační zakázky.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAccess('offers', 'navigation');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;
  const id = (await params).id;

  try {
    const body = await req.json();
    if (!body.status) {
      return NextResponse.json({ error: 'Cílový stav zakázky je povinný.' }, { status: 400 });
    }

    const updated = await transitionNavigationOrderStatus(id, body.status, user.id, user.name);
    return NextResponse.json({ success: true, order: updated });
  } catch (err: unknown) {
    if (err instanceof NavigationWorkflowError) {
      let resolution: { type: string; label: string; tab?: string; url?: string } | undefined;
      if (err.code === 'MISSING_INSTALLATION_PHOTO') {
        resolution = {
          type: 'TAB_SWITCH',
          tab: 'photos',
          label: 'Přejít na nahrání fotografií',
        };
      } else if (err.code === 'MISSING_INVOICE') {
        resolution = {
          type: 'TAB_SWITCH',
          tab: 'billing',
          label: 'Přejít na správu fakturace',
        };
      } else if (err.code === 'PENDING_DEINSTALLATION') {
        resolution = {
          type: 'TAB_SWITCH',
          tab: 'installation',
          label: 'Zkontrolovat deinstalační úkoly',
        };
      }
      return NextResponse.json(
        {
          error: err.message,
          errorType: err.code,
          resolution,
        },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : 'Chyba při změně stavu navigační zakázky.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
