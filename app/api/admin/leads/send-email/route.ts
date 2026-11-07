import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/organization';
import { sendTransactionalEmail } from '@/lib/email';
import { B2B_EMAIL_TEMPLATES, renderB2bOutreachEmailHtml, type B2bEmailTemplateId } from '@/lib/b2b-email-templates';

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = (await request.json().catch(() => null)) as {
      to?: unknown;
      subject?: unknown;
      message?: unknown;
      templateId?: unknown;
      ctaLabel?: unknown;
      ctaUrl?: unknown;
    } | null;

    const to = typeof body?.to === 'string' ? body.to.trim() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const templateId = (typeof body?.templateId === 'string' ? body.templateId : 'NAVIGATION_VO') as B2bEmailTemplateId;
    const templateDef = B2B_EMAIL_TEMPLATES[templateId] ?? B2B_EMAIL_TEMPLATES.NAVIGATION_VO;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: 'Zadejte platnou e-mailovou adresu příjemce.' }, { status: 400 });
    }
    if (subject.length < 3 || message.length < 10) {
      return NextResponse.json({ error: 'Vyplňte předmět a text e-mailu.' }, { status: 400 });
    }

    const ctaLabel = typeof body?.ctaLabel === 'string' && body.ctaLabel.trim() ? body.ctaLabel.trim() : templateDef.ctaLabel;
    const ctaUrl = typeof body?.ctaUrl === 'string' && body.ctaUrl.trim() ? body.ctaUrl.trim() : templateDef.ctaUrl;

    const customHtml = renderB2bOutreachEmailHtml({
      segmentBadge: templateDef.segmentBadge,
      subject,
      message,
      highlights: templateDef.highlights,
      ctaLabel,
      ctaUrl,
    });

    const delivery = await sendTransactionalEmail({
      to,
      subject,
      message,
      customHtml,
      template: `b2b-outreach-${templateDef.id.toLowerCase()}`,
      organizationId: 'org_seepoint_default',
      metadata: {
        b2bTemplate: templateDef.id,
      },
    });

    if (delivery.status === 'skipped') {
      return NextResponse.json({
        ok: true,
        warning: 'E-mailový poskytovatel je v testovacím režimu (zpráva byla zalogována).',
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Profesionální e-mail byl úspěšně odeslán na ${to}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Odeslání e-mailu selhalo.' },
      { status: 500 }
    );
  }
}
