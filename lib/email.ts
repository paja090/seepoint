import 'server-only';
import crypto from 'node:crypto';
import { formatCzechBusinessSalutation } from '@/lib/czech-salutation';
import { isValidEmailAddress, isValidEmailIdempotencyKey, skippedEmailEnvironment } from '@/lib/email-policy';

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type EmailDeliveryResult =
  | { status: 'sent'; provider: 'resend' | 'webhook' | 'gmail'; messageId?: string }
  | { status: 'skipped'; provider: 'preview' | 'development' };

const EMAIL_TIMEOUT_MS = 15_000;
function skippedEmailProvider(): 'preview' | 'development' | null {
  return skippedEmailEnvironment(process.env);
}

function validateEmailAddress(value: string, label = 'E-mail') {
  if (!isValidEmailAddress(value)) {
    throw new Error(`${label} nemá platný formát.`);
  }
}

function validateEmailInput(input: { to: string; bcc?: string[]; subject: string; html: string; idempotencyKey?: string }) {
  validateEmailAddress(input.to, 'E-mail příjemce');
  input.bcc?.forEach((address) => validateEmailAddress(address, 'E-mail skryté kopie'));
  if (!input.subject.trim() || input.subject.length > 200 || /[\r\n]/.test(input.subject)) {
    throw new Error('Předmět e-mailu musí mít 1 až 200 znaků a nesmí obsahovat nový řádek.');
  }
  if (!input.html || Buffer.byteLength(input.html, 'utf8') > 500_000) {
    throw new Error('Obsah e-mailu je prázdný nebo příliš velký.');
  }
  if (input.idempotencyKey && !isValidEmailIdempotencyKey(input.idempotencyKey)) {
    throw new Error('Interní klíč e-mailu nemá platný formát.');
  }
}

type GoogleMailCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

function googleMailCredentials(): GoogleMailCredentials | null {
  const dedicated = {
    clientId: process.env.GOOGLE_GMAIL_CLIENT_ID,
    clientSecret: process.env.GOOGLE_GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_GMAIL_REFRESH_TOKEN,
  };
  if (dedicated.clientId && dedicated.clientSecret && dedicated.refreshToken) {
    return {
      clientId: dedicated.clientId,
      clientSecret: dedicated.clientSecret,
      refreshToken: dedicated.refreshToken,
    };
  }

  if (process.env.GOOGLE_GMAIL_SEND_ENABLED === 'true') {
    const legacy = {
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    };
    if (legacy.clientId && legacy.clientSecret && legacy.refreshToken) {
      return {
        clientId: legacy.clientId,
        clientSecret: legacy.clientSecret,
        refreshToken: legacy.refreshToken,
      };
    }
  }
  return null;
}

export function ensureEmailConfigured() {
  if (skippedEmailProvider()) return;
  const googleConfigured = Boolean(googleMailCredentials());
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
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
}): Promise<EmailDeliveryResult> {

  const html = input.message
    .split(/\r?\n/)
    .map((line) => line ? `<p>${escapeHtml(line)}</p>` : '<br>')
    .join('');

  return sendEmail({
    to: input.to,
    subject: input.subject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1e293b;max-width:680px">${html}</div>`,
    webhookBody: {
      template: input.template,
      subject: input.subject,
      message: input.message,
    },
    attachments: input.attachments,
    idempotencyKey: input.idempotencyKey,
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
  idempotencyKey?: string;
}): Promise<EmailDeliveryResult> {
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

  const bccEmails = Array.from(
    new Set([input.salespersonEmail, process.env.EMAIL_BCC || 'info@seepoint.cz'].filter(Boolean))
  );

  return sendEmail({
    to: input.to,
    bcc: bccEmails,
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
    idempotencyKey: input.idempotencyKey,
  });
}

async function sendEmail(input: {
  to: string;
  bcc?: string | string[];
  subject: string;
  html: string;
  webhookBody: Record<string, unknown>;
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
}): Promise<EmailDeliveryResult> {
  const attachments = input.attachments ?? [];
  const attachmentBytes = attachments.reduce((sum, attachment) => sum + attachment.content.byteLength, 0);
  if (attachmentBytes > 20 * 1024 * 1024) throw new Error('Přílohy e-mailu překračují bezpečný limit 20 MB.');
  for (const attachment of attachments) {
    if (!attachment.filename || attachment.filename.length > 180 || /[\r\n]/.test(attachment.filename)) {
      throw new Error('Název přílohy není platný.');
    }
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(attachment.contentType)) {
      throw new Error('Typ přílohy není platný.');
    }
  }
  const defaultFrom = 'SeePOINT <info@seepoint.cz>';
  const from = process.env.EMAIL_FROM || defaultFrom;
  if (from.length > 320 || /[\r\n]/.test(from)) throw new Error('Adresa odesílatele není platná.');
  const bccList = Array.isArray(input.bcc)
    ? input.bcc.filter(Boolean)
    : input.bcc
    ? [input.bcc]
    : [process.env.EMAIL_BCC || 'info@seepoint.cz'].filter(Boolean);
  validateEmailInput({ to: input.to, bcc: bccList, subject: input.subject, html: input.html, idempotencyKey: input.idempotencyKey });

  const skippedProvider = skippedEmailProvider();
  if (skippedProvider) {
    console.info(`[email] Delivery skipped in ${skippedProvider} environment`, { template: input.webhookBody.template });
    return { status: 'skipped', provider: skippedProvider };
  }
  ensureEmailConfigured();

  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      body: JSON.stringify({
        from,
        to: [input.to],
        ...(bccList.length > 0 ? { bcc: bccList } : {}),
        subject: input.subject,
        html: input.html,
        ...(attachments.length > 0 ? { attachments: attachments.map((attachment) => ({ filename: attachment.filename, content: attachment.content.toString('base64') })) } : {}),
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { message?: string } | null;
      console.warn('[email] Resend rejected the message', {
        status: response.status,
        message: result?.message ?? response.statusText,
      });
      throw new Error('E-mail se nepodařilo odeslat. Zkuste to prosím znovu.');
    }
    const result = await response.json().catch(() => null) as { id?: string } | null;
    return { status: 'sent', provider: 'resend', messageId: result?.id };
  }

  if (process.env.EMAIL_WEBHOOK_URL) {
    const webhookUrl = new URL(process.env.EMAIL_WEBHOOK_URL);
    if (webhookUrl.protocol !== 'https:') throw new Error('E-mailový webhook musí používat HTTPS.');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.EMAIL_WEBHOOK_SECRET ?? ''}`,
      },
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      body: JSON.stringify({
        to: input.to,
        bcc: bccList,
        ...input.webhookBody,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        ...(attachments.length > 0 ? { attachments: attachments.map((attachment) => ({ filename: attachment.filename, contentType: attachment.contentType, contentBase64: attachment.content.toString('base64') })) } : {}),
      }),
    });
    if (!response.ok) throw new Error('E-mail se nepodařilo odeslat přes webhook.');
    const result = await response.json().catch(() => null) as { id?: string; messageId?: string } | null;
    return { status: 'sent', provider: 'webhook', messageId: result?.messageId || result?.id };
  }

  const googleCredentials = googleMailCredentials();
  if (!googleCredentials) {
    throw new Error('Odesílání e-mailů není nakonfigurováno.');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    body: new URLSearchParams({
      client_id: googleCredentials.clientId,
      client_secret: googleCredentials.clientSecret,
      refresh_token: googleCredentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenResponse.json() as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenData.access_token) {
    console.warn('[email] Google OAuth failed', { status: tokenResponse.status, message: tokenData.error_description || tokenResponse.statusText });
    throw new Error('E-mailovou službu se nepodařilo ověřit.');
  }

  const mimeLines = [
    `From: ${from}`,
    `To: ${input.to}`,
    ...(bccList.length > 0 ? [`Bcc: ${bccList.join(', ')}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,
    ...(input.idempotencyKey ? [`X-SeePoint-Idempotency-Key: ${input.idempotencyKey}`] : []),
    'MIME-Version: 1.0',
  ];
  if (attachments.length === 0) {
    mimeLines.push('Content-Type: text/html; charset=UTF-8', '', input.html);
  } else {
    const boundary = `seepoint-${crypto.randomUUID()}`;
    mimeLines.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(input.html).toString('base64'),
    );
    for (const attachment of attachments) {
      const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const base64 = attachment.content.toString('base64').replace(/.{1,76}/g, '$&\r\n').trim();
      mimeLines.push(
        `--${boundary}`,
        `Content-Type: ${attachment.contentType}; name="${safeFilename}"`,
        `Content-Disposition: attachment; filename="${safeFilename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        base64,
      );
    }
    mimeLines.push(`--${boundary}--`);
  }
  const mime = mimeLines.join('\r\n');
  const raw = Buffer.from(mime).toString('base64url');
  const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenData.access_token}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    body: JSON.stringify({ raw }),
  });
  if (!gmailResponse.ok) {
    const result = await gmailResponse.json().catch(() => null) as { error?: { message?: string } } | null;
    console.warn('[email] Gmail rejected the message', { status: gmailResponse.status, message: result?.error?.message || gmailResponse.statusText });
    throw new Error('E-mail se nepodařilo odeslat. Zkuste to prosím znovu.');
  }
  const gmailResult = await gmailResponse.json().catch(() => null) as { id?: string } | null;
  return { status: 'sent', provider: 'gmail', messageId: gmailResult?.id };
}

export async function sendActivationEmail(email: string, url: string): Promise<EmailDeliveryResult> {
  const safeUrl = escapeHtml(url);
  return sendEmail({
    to: email,
    subject: 'Aktivace účtu SeePoint',
    html: `<h1>Vítejte v SeePoint</h1><p>Pro nastavení hesla a aktivaci účtu použijte následující odkaz:</p><p><a href="${safeUrl}">Aktivovat účet</a></p><p>Pokud jste účet neočekávali, tento e-mail ignorujte.</p>`,
    webhookBody: { template: 'activation', activationUrl: url },
  });
}

export async function sendPasswordResetEmail(email: string, url: string): Promise<EmailDeliveryResult> {
  const safeUrl = escapeHtml(url);
  return sendEmail({
    to: email,
    subject: 'Obnovení hesla SeePoint',
    html: `<h1>Obnovení hesla</h1><p>Pro nastavení nového hesla použijte následující odkaz:</p><p><a href="${safeUrl}">Nastavit nové heslo</a></p><p>Pokud jste o změnu nežádali, tento e-mail ignorujte.</p>`,
    webhookBody: { template: 'password-reset', resetUrl: url },
  });
}
