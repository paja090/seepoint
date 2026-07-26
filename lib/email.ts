import 'server-only';

export function ensureEmailConfigured() {
  if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY && !process.env.EMAIL_WEBHOOK_URL) {
    throw new Error('Odesílání e-mailů není nakonfigurováno.');
  }
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

async function sendEmail(input: { to: string; subject: string; html: string; webhookBody: Record<string, string> }) {
  ensureEmailConfigured();

  if (process.env.RESEND_API_KEY) {
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error('Chybí odesílací adresa EMAIL_FROM.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(`E-mail se nepodařilo odeslat přes Resend: ${result?.message ?? response.statusText}`);
    }
    return;
  }

  const response = await fetch(process.env.EMAIL_WEBHOOK_URL!, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.EMAIL_WEBHOOK_SECRET ?? ''}`,
    },
    body: JSON.stringify({ to: input.to, ...input.webhookBody }),
  });
  if (!response.ok) throw new Error('E-mail se nepodařilo odeslat přes webhook.');
}

export async function sendActivationEmail(email: string, url: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[DEV] Aktivační URL pro ${email}: ${url}`);
    return;
  }
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: email,
    subject: 'Aktivace účtu SeePoint',
    html: `<h1>Vítejte v SeePoint</h1><p>Pro nastavení hesla a aktivaci účtu použijte následující odkaz:</p><p><a href="${safeUrl}">Aktivovat účet</a></p><p>Pokud jste účet neočekávali, tento e-mail ignorujte.</p>`,
    webhookBody: { template: 'activation', activationUrl: url },
  });
}

export async function sendPasswordResetEmail(email: string, url: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[DEV] URL pro obnovu hesla ${email}: ${url}`);
    return;
  }
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: email,
    subject: 'Obnovení hesla SeePoint',
    html: `<h1>Obnovení hesla</h1><p>Pro nastavení nového hesla použijte následující odkaz:</p><p><a href="${safeUrl}">Nastavit nové heslo</a></p><p>Pokud jste o změnu nežádali, tento e-mail ignorujte.</p>`,
    webhookBody: { template: 'password-reset', resetUrl: url },
  });
}
