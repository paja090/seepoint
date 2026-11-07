import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, company, phone, surfaceCount, analyticsEvents } = body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Zadejte prosím své jméno.' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Zadejte platnou e-mailovou adresu.' }, { status: 400 });
    }

    if (!company || typeof company !== 'string' || company.trim().length < 2) {
      return NextResponse.json({ error: 'Zadejte název vaší společnosti.' }, { status: 400 });
    }

    // Save lead safely into Prisma database
    let leadId = `lead-${Date.now()}`;
    try {
      const db = prisma as unknown as { demoLead?: { create: (args: Record<string, unknown>) => Promise<{ id: string }> } };
      if (db.demoLead) {
        const lead = await db.demoLead.create({
          data: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            company: company.trim(),
            phone: typeof phone === 'string' ? phone.trim() : null,
            surfaceCount: typeof surfaceCount === 'string' ? surfaceCount.trim() : null,
            source: 'WEBSITE_DEMO_MODAL',
          },
        });
        leadId = lead.id;
      }
    } catch (dbErr) {
      console.warn('Fallback lead storage (Prisma not migrated or table missing):', dbErr);
    }

    // Log analytics event server-side
    if (Array.isArray(analyticsEvents)) {
      console.log('[Analytics Event]', { type: 'demo_form_submitted', email: email.trim(), company: company.trim(), events: analyticsEvents });
    }

    // Notify sales so the "we will contact you within 24 hours" promise can be kept
    try {
      const notifyTo = process.env.LEAD_NOTIFICATION_EMAIL || 'info@seepoint.cz';
      await sendTransactionalEmail({
        to: notifyTo,
        subject: `Nová poptávka dema: ${company.trim()}`,
        template: 'demo-lead-notification',
        idempotencyKey: `demo-lead-${leadId}`,
        message: [
          'Z webu přišla nová žádost o ukázku SeePoint OS.',
          '',
          `Jméno: ${name.trim()}`,
          `Firma: ${company.trim()}`,
          `E-mail: ${email.trim()}`,
          `Telefon: ${typeof phone === 'string' && phone.trim() ? phone.trim() : '—'}`,
          `Počet ploch: ${typeof surfaceCount === 'string' && surfaceCount.trim() ? surfaceCount.trim() : '—'}`,
          '',
          'Ozvěte se prosím do 24 hodin. Všechny poptávky najdete v administraci na /admin/leads.',
        ].join('\n'),
      });
    } catch (mailErr) {
      console.warn('Demo lead notification email failed:', mailErr);
    }

    return NextResponse.json({
      success: true,
      leadId,
      message: 'Děkujeme! Vaše žádost o ukázku SeePoint OS byla přijata. Náš tým vás bude kontaktovat během 24 hodin.',
    });
  } catch (error) {
    console.error('Error submitting demo lead:', error);
    return NextResponse.json(
      { error: 'Došlo k chybě při odesílání formuláře. Zkuste to prosím znovu nebo nás kontaktujte přímo.' },
      { status: 500 }
    );
  }
}
