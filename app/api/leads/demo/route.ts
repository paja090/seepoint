import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, company, phone, surfaceCount, ico, dic, partnerRole, city, source, analyticsEvents } = body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Zadejte prosím své jméno.' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Zadejte platnou e-mailovou adresu.' }, { status: 400 });
    }

    if (!company || typeof company !== 'string' || company.trim().length < 2) {
      return NextResponse.json({ error: 'Zadejte název vaší společnosti.' }, { status: 400 });
    }

    const cleanIco = typeof ico === 'string' && /^\d{8}$/.test(ico.trim()) ? ico.trim() : null;
    const cleanDic = typeof dic === 'string' && dic.trim() ? dic.trim() : null;
    const cleanCity = typeof city === 'string' && city.trim() ? city.trim() : null;
    const cleanRole = typeof partnerRole === 'string' && partnerRole.trim() ? partnerRole.trim() : null;
    const cleanSource =
      typeof source === 'string' && source.trim() === 'B2B_PARTNER_NETWORK'
        ? 'B2B_PARTNER_NETWORK'
        : 'WEBSITE_DEMO_MODAL';

    const formattedCompany = cleanIco
      ? `${company.trim()} (IČO: ${cleanIco}${cleanCity ? `, ${cleanCity}` : ''})`
      : company.trim();

    const formattedSurfaceCount = [
      typeof surfaceCount === 'string' && surfaceCount.trim() ? surfaceCount.trim() : null,
      cleanRole,
    ]
      .filter(Boolean)
      .join(' · ') || null;

    // Save lead safely into Prisma database
    let leadId = `lead-${Date.now()}`;
    try {
      const db = prisma as unknown as { demoLead?: { create: (args: Record<string, unknown>) => Promise<{ id: string }> } };
      if (db.demoLead) {
        const lead = await db.demoLead.create({
          data: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            company: formattedCompany,
            phone: typeof phone === 'string' ? phone.trim() : null,
            surfaceCount: formattedSurfaceCount,
            source: cleanSource,
          },
        });
        leadId = lead.id;
      }
    } catch (dbErr) {
      console.warn('Fallback lead storage (Prisma not migrated or table missing):', dbErr);
    }

    // Log analytics event server-side
    if (Array.isArray(analyticsEvents)) {
      console.log('[Analytics Event]', { type: 'demo_form_submitted', email: email.trim(), company: formattedCompany, events: analyticsEvents });
    }

    // Notify sales so the "we will contact you within 24 hours" promise can be kept
    try {
      const notifyTo = process.env.LEAD_NOTIFICATION_EMAIL || 'info@seepoint.cz';
      await sendTransactionalEmail({
        to: notifyTo,
        subject: cleanSource === 'B2B_PARTNER_NETWORK'
          ? `Nová B2B registrace do sítě: ${formattedCompany}`
          : `Nová poptávka dema: ${company.trim()}`,
        template: 'demo-lead-notification',
        idempotencyKey: `demo-lead-${leadId}`,
        message: [
          cleanSource === 'B2B_PARTNER_NETWORK'
            ? 'Přišla nová B2B registrace partnerské firmy přes /join-network.'
            : 'Z webu přišla nová žádost o ukázku SeePoint OS.',
          '',
          `Jméno: ${name.trim()}`,
          `Firma: ${formattedCompany}`,
          cleanDic ? `DIČ: ${cleanDic}` : null,
          cleanRole ? `Role v B2B síti: ${cleanRole}` : null,
          `E-mail: ${email.trim()}`,
          `Telefon: ${typeof phone === 'string' && phone.trim() ? phone.trim() : '—'}`,
          `Počet ploch / kapacity: ${typeof surfaceCount === 'string' && surfaceCount.trim() ? surfaceCount.trim() : '—'}`,
          '',
          'Ozvěte se prosím do 24 hodin. Všechny poptávky a 1-klik založení účtu najdete v administraci na /admin/leads.',
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
      });
    } catch (mailErr) {
      console.warn('Demo lead notification email failed:', mailErr);
    }

    return NextResponse.json({
      success: true,
      leadId,
      message:
        cleanSource === 'B2B_PARTNER_NETWORK'
          ? 'Děkujeme! Vaše B2B registrace do sítě SeePoint byla přijata. Připravíme váš partnerský účet a pošleme vám aktivační odkaz.'
          : 'Děkujeme! Vaše žádost o ukázku SeePoint OS byla přijata. Náš tým vás bude kontaktovat během 24 hodin.',
    });
  } catch (error) {
    console.error('Error submitting demo lead:', error);
    return NextResponse.json(
      { error: 'Došlo k chybě při odesílání formuláře. Zkuste to prosím znovu nebo nás kontaktujte přímo.' },
      { status: 500 }
    );
  }
}
