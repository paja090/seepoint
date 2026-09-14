import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getPipelineIntelligence, getMyAttentionItems } from '@/lib/ai-crm/crm-intelligence-service';
import { detectCrmDuplicates } from '@/lib/ai-crm/duplicate-detector';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const user = authResult;
  const { searchParams } = new URL(req.url);
  const myOnly = searchParams.get('myOnly') === 'true';

  try {
    const [pipeline, duplicates] = await Promise.all([
      getPipelineIntelligence(user.organizationId, myOnly ? user.id : undefined),
      detectCrmDuplicates(user.organizationId),
    ]);

    return NextResponse.json({
      ok: true,
      pipeline,
      duplicates,
    });
  } catch (error) {
    console.error('CRM Intelligence API error:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst CRM Intelligence data.' },
      { status: 500 }
    );
  }
}
