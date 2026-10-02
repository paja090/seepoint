import { prisma } from '@/lib/db';
import { getTenantContext } from '@/lib/tenant-context';
import { resolveRequestTenantContext } from '@/lib/tenant-request-context';
import { connectedGoogleAccessToken } from './google-oauth';
import { GMAIL_SEND_SCOPE, gmailRawMessage, selectGmailSender, usesExistingPlatformMail } from './gmail-message';

export async function tenantGmailSender(organizationId: string) {
  // Keep SeePoint's existing transport independent of new tenant Gmail connections.
  if (usesExistingPlatformMail(organizationId)) return null;
  const context = getTenantContext() ?? await resolveRequestTenantContext();
  if (!context || context.organizationId !== organizationId) throw new Error('Nesprávná organizace odesílatele.');
  const connections = await prisma.integrationConnection.findMany({
    where: { organizationId, provider: 'GMAIL', status: { not: 'REVOKED' }, scopes: { has: GMAIL_SEND_SCOPE }, settings: { path: ['sendingEnabled'], equals: true } },
    select: { id: true, organizationId: true, provider: true, status: true, accountEmail: true, scopes: true, settings: true },
    take: 2,
  });
  return selectGmailSender(connections, organizationId);
}

export async function sendThroughTenantGmail(organizationId: string, input: Omit<Parameters<typeof gmailRawMessage>[0], 'from'>) {
  // Resolve again at send time so revoked/changed connections cannot use a stale sender.
  const sender = await tenantGmailSender(organizationId);
  if (!sender?.accountEmail) throw new Error('Připojte Gmail s oprávněním k odesílání.');
  const token = await connectedGoogleAccessToken('GMAIL', sender.id);
  if (!token) throw new Error('Odesílací Gmail schránku je nutné znovu připojit.');
  return sendGmailMessageWithToken(token, { ...input, from: sender.accountEmail });
}

export async function sendGmailMessageWithToken(token: string, input: Parameters<typeof gmailRawMessage>[0]) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ raw: gmailRawMessage(input) }),
  });
  if (!response.ok) throw new Error('Gmail zprávu nepotvrdil. Před dalším pokusem zkontrolujte Odeslanou poštu, aby nevznikla duplicita.');
  const data = await response.json() as { id?: string };
  if (!data.id) throw new Error('Gmail nevrátil potvrzení odeslání. Zkontrolujte Odeslanou poštu.');
  return { messageId: data.id, from: input.from };
}
