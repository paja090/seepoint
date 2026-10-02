import { randomUUID } from 'node:crypto';
import { isValidEmailAddress } from '../email-policy';

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export type GmailSender = { id: string; organizationId: string; provider: string; status: string; accountEmail: string | null; scopes: string[]; settings?: unknown };

export function usesExistingPlatformMail(organizationId: string) {
  return organizationId === 'org_seepoint_default';
}

export function gmailSendingEnabled(settings: unknown) {
  return !!settings && typeof settings === 'object' && !Array.isArray(settings)
    && (settings as Record<string, unknown>).sendingEnabled === true;
}

export function selectGmailSender(connections: GmailSender[], organizationId: string) {
  if (usesExistingPlatformMail(organizationId)) return null;
  const senders = connections.filter(c => c.organizationId === organizationId && c.provider === 'GMAIL' && c.status !== 'REVOKED' && gmailSendingEnabled(c.settings) && c.scopes.includes(GMAIL_SEND_SCOPE));
  if (senders.length > 1) throw new Error('Více Gmail schránek má povolené odesílání. Ponechte připojenou pouze jednu odesílací schránku.');
  const sender = senders[0];
  if (!sender) return null;
  if (sender.status !== 'CONNECTED' || !sender.accountEmail || !isValidEmailAddress(sender.accountEmail)) {
    throw new Error('Odesílací Gmail schránku je nutné znovu připojit.');
  }
  return sender;
}

export function gmailRawMessage(input: {
  from: string; to: string; bcc: string[]; subject: string; html: string;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}) {
  for (const address of [input.from, input.to, ...input.bcc]) {
    if (!isValidEmailAddress(address) || /[<>;,\r\n]/.test(address)) throw new Error('Neplatná e-mailová adresa.');
  }
  if (!input.subject.trim() || input.subject.length > 200 || /[\r\n]/.test(input.subject)) throw new Error('Neplatný předmět.');
  const encoded = (value: Buffer) => value.toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
  const boundary = `seepoint-${randomUUID()}`;
  const lines = [
    `From: ${input.from}`, `To: ${input.to}`, `Reply-To: ${input.from}`,
    ...(input.bcc.length ? [`Bcc: ${input.bcc.join(', ')}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,
    'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encoded(Buffer.from(input.html)),
  ];
  for (const attachment of input.attachments) {
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(attachment.contentType) || /[\r\n]/.test(attachment.filename)) throw new Error('Neplatná příloha.');
    const name = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    lines.push(`--${boundary}`, `Content-Type: ${attachment.contentType}`, `Content-Disposition: attachment; filename="${name}"`, 'Content-Transfer-Encoding: base64', '', encoded(attachment.content));
  }
  lines.push(`--${boundary}--`, '');
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}
