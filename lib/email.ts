import 'server-only';

export function ensureEmailConfigured() {
  if (process.env.NODE_ENV === 'production' && !process.env.EMAIL_WEBHOOK_URL) throw new Error('Odesílání e-mailů není nakonfigurováno.');
}

export async function sendActivationEmail(email: string, url: string) {
  if (process.env.NODE_ENV === 'production') {
    ensureEmailConfigured();
    const response = await fetch(process.env.EMAIL_WEBHOOK_URL!, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.EMAIL_WEBHOOK_SECRET ?? ''}` }, body: JSON.stringify({ to: email, template: 'activation', activationUrl: url }) });
    if (!response.ok) throw new Error('Aktivační e-mail se nepodařilo odeslat.');
  } else console.info(`[DEV] Aktivační URL pro ${email}: ${url}`);
}

export async function sendPasswordResetEmail(email: string, url: string) {
  if (process.env.NODE_ENV === 'production') {
    ensureEmailConfigured();
    const response = await fetch(process.env.EMAIL_WEBHOOK_URL!, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.EMAIL_WEBHOOK_SECRET ?? ''}` }, body: JSON.stringify({ to: email, template: 'password-reset', resetUrl: url }) });
    if (!response.ok) throw new Error('E-mail pro obnovu hesla se nepodařilo odeslat.');
  } else console.info(`[DEV] URL pro obnovu hesla ${email}: ${url}`);
}
