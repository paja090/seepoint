import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { requirePlannerManager } from '@/lib/field-planning/service';
import {
  analyzeOrganizationFieldTelemetry,
  applyFieldTelemetryCalibration,
  addCustomActivityToProfile,
  deleteCustomActivityFromProfile,
} from '@/lib/field-planning/ai-telemetry';

export const runtime = 'nodejs';

/**
 * GET /api/field-planning/telemetry
 * Vrací telemetrickou analýzu reálných časů všech terénních prací organizace a AI doporučení.
 */
export async function GET() {
  const user = await requireApiAccess('work', 'workRoute');
  if (isApiDenied(user)) return user;

  enterTenantContext({
    organizationId: user.organizationId!,
    userId: user.id,
    source: 'session',
  });

  try {
    requirePlannerManager(user);
    const report = await analyzeOrganizationFieldTelemetry(user.organizationId);
    return NextResponse.json({ success: true, report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chyba při analýze telemetrie.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/field-planning/telemetry
 * Aplikuje AI kalibrované normy časů do profilu organizace nebo spravuje vlastní činnosti.
 */
export async function POST(req: Request) {
  const user = await requireApiAccess('work', 'workRoute');
  if (isApiDenied(user)) return user;

  enterTenantContext({
    organizationId: user.organizationId!,
    userId: user.id,
    source: 'session',
  });

  try {
    requirePlannerManager(user);
    const body = await req.json();

    if (body.action === 'addCustomActivity') {
      const { label, defaultMinutes, category } = body;
      if (!label || typeof label !== 'string' || !label.trim()) {
        return NextResponse.json({ error: 'Zadejte název činnosti.' }, { status: 400 });
      }
      const mins = Number(defaultMinutes);
      if (!Number.isFinite(mins) || mins < 1 || mins > 480) {
        return NextResponse.json({ error: 'Zadejte platný čas v minutách (1-480).' }, { status: 400 });
      }
      const updatedProfile = await addCustomActivityToProfile(
        { label: label.trim(), defaultMinutes: Math.round(mins), category: typeof category === 'string' ? category.trim() : undefined },
        user,
        user.organizationId
      );
      return NextResponse.json({ success: true, updatedProfile });
    }

    if (body.action === 'deleteCustomActivity') {
      const { key } = body;
      if (!key || typeof key !== 'string') {
        return NextResponse.json({ error: 'Chybí klíč činnosti.' }, { status: 400 });
      }
      const updatedProfile = await deleteCustomActivityFromProfile(key, user, user.organizationId);
      return NextResponse.json({ success: true, updatedProfile });
    }

    const calibration = body.calibration as Record<string, number>;

    if (!calibration || typeof calibration !== 'object') {
      return NextResponse.json(
        { error: 'Chybí platná kalibrační data.' },
        { status: 400 }
      );
    }

    const updatedProfile = await applyFieldTelemetryCalibration(
      calibration,
      user,
      user.organizationId
    );

    return NextResponse.json({ success: true, updatedProfile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chyba při aplikaci kalibrace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
