import 'server-only';
import { formatCzechBusinessSalutation } from '@/lib/czech-salutation';

export function ensureEmailConfigured() {
  const googleConfigured = Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
  if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY && !process.env.EMAIL_WEBHOOK_URL && !googleConfigured) {
    throw new Error('Odesílání e-mailů není nakonfigurováno.');
  }
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  message: string;
  template: string;
}) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[DEV] E-mail "${input.subject}" pro ${input.to}`);
    return;
  }

  const html = input.message
    .split(/\r?\n/)
    .map((line) => line ? `<p>${escapeHtml(line)}</p>` : '<br>')
    .join('');

  await sendEmail({
    to: input.to,
    subject: input.subject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1e293b;max-width:680px">${html}</div>`,
    webhookBody: {
      template: input.template,
      subject: input.subject,
      message: input.message,
    },
  });
}

export async function sendOfferEmail(input: {
  to: string;
  subject?: string | null;
  contactName: string;
  campaignName: string;
  clientMessage?: string | null;
  validUntil?: string | null;
  publicUrl: string;
  locationSelection: boolean;
  logoUrl: string;
  salespersonName: string;
  salespersonEmail: string;
  salespersonPhone?: string | null;
  salespersonRole?: string | null;
  salespersonPhotoUrl?: string | null;
}) {
  const subject = input.subject?.trim() || `Nabídka SeePOINT – ${input.campaignName}`;
  const safeSalutation = escapeHtml(formatCzechBusinessSalutation(input.contactName));
  const safeCampaign = escapeHtml(input.campaignName);
  const clientMessage = (input.clientMessage || 'Připravili jsme pro Vás novou nabídku.')
    .trim()
    .replace(/^Dobrý den,\s*[^,\n]+,\s*/i, '');
  const safeMessage = escapeHtml(clientMessage);
  const safeUrl = escapeHtml(input.publicUrl);
  const safeLogoUrl = escapeHtml(input.logoUrl);
  const safeSalespersonName = escapeHtml(input.salespersonName);
  const safeSalespersonEmail = escapeHtml(input.salespersonEmail);
  const safeSalespersonPhone = input.salespersonPhone ? escapeHtml(input.salespersonPhone) : '';
  const safeSalespersonRole = escapeHtml(input.salespersonRole || 'Obchodní kontakt SeePOINT');
  const initials = input.salespersonName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const salespersonAvatar = input.salespersonPhotoUrl
    ? `<img src="${escapeHtml(input.salespersonPhotoUrl)}" width="64" height="64" alt="${safeSalespersonName}" style="display:block;width:64px;height:64px;border-radius:999px;object-fit:cover;border:2px solid #bae6fd">`
    : `<div style="width:64px;height:64px;border-radius:999px;background:#0f172a;color:#ffffff;font-size:20px;font-weight:700;line-height:64px;text-align:center">${escapeHtml(initials || 'SP')}</div>`;
  const validity = input.validUntil
    ? `<p style="margin:0 0 20px;color:#475569">Nabídka je platná do <strong>${escapeHtml(input.validUntil)}</strong>.</p>`
    : '';
  const phaseNote = input.locationSelection
    ? '<p style="margin:0 0 20px;padding:12px 16px;border-radius:10px;background:#fff7ed;color:#9a3412"><strong>Nezávazná fáze bez cen:</strong> nejprve si vyberete vhodné navigační body. Přesnou cenovou nabídku obdržíte až po jejich odsouhlasení.</p>'
    : '';

  await sendEmail({
    to: input.to,
    subject,
    html: `<div style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a">
      <div style="max-width:640px;margin:0 auto;border-radius:16px;background:#ffffff;padding:32px;box-shadow:0 1px 3px rgba(15,23,42,.12)">
        <img src="${safeLogoUrl}" width="190" alt="SeePOINT – Outdoor reklama" style="display:block;width:190px;max-width:100%;height:auto;margin:0 0 22px">
        <h1 style="margin:0 0 20px;font-size:26px;line-height:1.25">${safeCampaign}</h1>
        <p style="margin:0 0 16px">Dobrý den, ${safeSalutation},</p>
        <p style="margin:0 0 20px;white-space:pre-line;color:#334155">${safeMessage}</p>
        ${phaseNote}
        ${validity}
        <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;border-radius:10px;background:#0f172a;padding:13px 20px;color:#ffffff;text-decoration:none;font-weight:700">Otevřít nabídku</a></p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b">Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:<br><a href="${safeUrl}" style="color:#0369a1;word-break:break-all">${safeUrl}</a></p>
        <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e2e8f0">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:16px;vertical-align:middle">${salespersonAvatar}</td>
            <td style="vertical-align:middle">
              <p style="margin:0 0 3px;font-size:16px;font-weight:700;color:#0f172a">${safeSalespersonName}</p>
              <p style="margin:0 0 6px;font-size:12px;color:#64748b">${safeSalespersonRole}</p>
              <p style="margin:0;font-size:13px"><a href="mailto:${safeSalespersonEmail}" style="color:#0369a1;text-decoration:none">${safeSalespersonEmail}</a>${safeSalespersonPhone ? ` &nbsp;·&nbsp; <a href="tel:${safeSalespersonPhone.replace(/\s/g, '')}" style="color:#0369a1;text-decoration:none">${safeSalespersonPhone}</a>` : ''}</p>
            </td>
          </tr></table>
        </div>
      </div>
    </div>`,
    webhookBody: {
      template: 'offer',
      subject,
      message: input.clientMessage || '',
      offerUrl: input.publicUrl,
    },
  });
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

  if (process.env.EMAIL_WEBHOOK_URL) {
    const response = await fetch(process.env.EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.EMAIL_WEBHOOK_SECRET ?? ''}`,
      },
      body: JSON.stringify({ to: input.to, ...input.webhookBody }),
    });
    if (!response.ok) throw new Error('E-mail se nepodařilo odeslat přes webhook.');
    return;
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenResponse.json() as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Google OAuth pro e-mail selhal: ${tokenData.error_description || tokenResponse.statusText}`);
  }

  const from = process.env.EMAIL_FROM || 'SeePOINT';
  const mime = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    input.html,
  ].join('\r\n');
  const raw = Buffer.from(mime).toString('base64url');
  const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenData.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!gmailResponse.ok) {
    const result = await gmailResponse.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(`E-mail se nepodařilo odeslat přes Gmail: ${result?.error?.message || gmailResponse.statusText}`);
  }
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
