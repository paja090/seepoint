import { connectedGoogleAccessToken } from '@/lib/integrations/google-oauth';
import type { RawInboundMessage, RawInboundMessageAttachment } from '../types';

export type GmailHeader = {
  name: string;
  value: string;
};

export type GmailPartBody = {
  attachmentId?: string;
  size?: number;
  data?: string;
};

export type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailPartBody;
  parts?: GmailMessagePart[];
};

export type GmailMessagePayload = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
  sizeEstimate?: number;
};

export type GmailListMessagesResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

function base64UrlDecode(input: string): string {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function parseEmailAddress(raw: string): { email: string; name: string | null } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/);
  if (match) {
    const name = match[1]?.trim() || null;
    const email = match[2]?.trim().toLowerCase() || '';
    return { email, name };
  }
  return { email: trimmed.toLowerCase(), name: null };
}

export function parseEmailList(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((item) => parseEmailAddress(item).email)
    .filter(Boolean);
}

function findHeader(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  const found = headers.find((h) => h.name.toLowerCase() === target);
  return found?.value ?? null;
}

export function extractTextAndHtml(part: GmailMessagePart): { text: string; html: string; attachments: RawInboundMessageAttachment[] } {
  let text = '';
  let html = '';
  const attachments: RawInboundMessageAttachment[] = [];

  function traverse(current: GmailMessagePart) {
    const mimeType = current.mimeType?.toLowerCase() || '';
    const filename = current.filename?.trim() || '';
    const body = current.body;

    if (filename && (body?.attachmentId || body?.data)) {
      attachments.push({
        providerAttachmentId: body.attachmentId,
        filename,
        mimeType: mimeType || 'application/octet-stream',
        size: body.size || 0,
      });
      return;
    }

    if (mimeType === 'text/plain' && body?.data) {
      text += (text ? '\n' : '') + base64UrlDecode(body.data);
    } else if (mimeType === 'text/html' && body?.data) {
      html += (html ? '\n' : '') + base64UrlDecode(body.data);
    }

    if (current.parts && Array.isArray(current.parts)) {
      for (const subPart of current.parts) {
        traverse(subPart);
      }
    }
  }

  traverse(part);
  return { text, html, attachments };
}

export async function getGmailAccessToken(connectionId?: string): Promise<string> {
  const token = await connectedGoogleAccessToken('GMAIL', connectionId);
  if (!token) {
    throw new Error('Gmail účet není připojen nebo vypršela platnost přístupu.');
  }
  return token;
}

export async function listGmailMessages(
  accessToken: string,
  options?: { query?: string; maxResults?: number; pageToken?: string }
): Promise<GmailListMessagesResponse> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  if (options?.query) url.searchParams.set('q', options.query);
  url.searchParams.set('maxResults', String(options?.maxResults || 20));
  if (options?.pageToken) url.searchParams.set('pageToken', options.pageToken);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Gmail API listMessages failed (${res.status}): ${errorText}`);
  }

  return (await res.json()) as GmailListMessagesResponse;
}

export async function getGmailMessage(accessToken: string, messageId: string): Promise<GmailMessagePayload> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Gmail API getMessage failed (${res.status}): ${errorText}`);
  }

  return (await res.json()) as GmailMessagePayload;
}

export async function getGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ size: number; dataBase64: string }> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Gmail API getAttachment failed (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as { size?: number; data?: string };
  const rawData = data.data || '';
  const standardBase64 = rawData.replace(/-/g, '+').replace(/_/g, '/');
  return {
    size: data.size || 0,
    dataBase64: standardBase64,
  };
}

export function parseRawGmailMessage(rawMessage: GmailMessagePayload): RawInboundMessage {
  const payload = rawMessage.payload || {};
  const headers = payload.headers || [];

  const rawFrom = findHeader(headers, 'From') || '';
  const { email: fromEmail, name: fromName } = parseEmailAddress(rawFrom);

  const rawTo = findHeader(headers, 'To');
  const toEmails = parseEmailList(rawTo);

  const rawCc = findHeader(headers, 'Cc');
  const ccEmails = parseEmailList(rawCc);

  const subject = findHeader(headers, 'Subject') || '(Bez předmětu)';
  const internetMessageId = findHeader(headers, 'Message-ID') || findHeader(headers, 'Message-Id');
  const inReplyTo = findHeader(headers, 'In-Reply-To');
  const rawReferences = findHeader(headers, 'References');
  const references = rawReferences
    ? rawReferences.split(/\s+/).filter(Boolean)
    : [];

  const dateHeader = findHeader(headers, 'Date');
  let receivedAt = dateHeader ? new Date(dateHeader) : new Date();
  if (Number.isNaN(receivedAt.getTime()) && rawMessage.internalDate) {
    const epochMs = Number.parseInt(rawMessage.internalDate, 10);
    if (!Number.isNaN(epochMs)) receivedAt = new Date(epochMs);
  }
  if (Number.isNaN(receivedAt.getTime())) {
    receivedAt = new Date();
  }

  const { text, html, attachments } = extractTextAndHtml(payload);

  return {
    provider: 'GMAIL',
    providerMessageId: rawMessage.id,
    providerThreadId: rawMessage.threadId || null,
    internetMessageId: internetMessageId || null,
    inReplyTo: inReplyTo || null,
    references,
    fromEmail: fromEmail || 'neznamy@odesilatel.cz',
    fromName: fromName || null,
    toEmails: toEmails.length > 0 ? toEmails : ['prijemce@seepoint.cz'],
    ccEmails,
    subject,
    textBody: text.trim() || null,
    htmlBody: html.trim() || null,
    receivedAt,
    attachments,
  };
}
