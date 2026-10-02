export type EmailRuntimeEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'VERCEL_ENV' | 'EMAIL_SEND_IN_PREVIEW'>>;

export function skippedEmailEnvironment(environment: EmailRuntimeEnvironment): 'preview' | 'development' | null {
  if (environment.VERCEL_ENV === 'preview' && environment.EMAIL_SEND_IN_PREVIEW !== 'true') return 'preview';
  if (environment.NODE_ENV !== 'production') return 'development';
  return null;
}

export function isValidEmailAddress(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidEmailIdempotencyKey(value: string) {
  return value.length <= 256 && /^[A-Za-z0-9_./:-]+$/.test(value);
}

export function emailBccRecipients(input: { bcc?: string | string[]; organizationId?: string }, platformBcc?: string): string[] {
  if (Array.isArray(input.bcc)) return input.bcc.filter(Boolean);
  if (input.bcc) return [input.bcc];
  // Only the original SeePoint organization keeps its existing internal copies.
  return input.organizationId && input.organizationId !== 'org_seepoint_default' ? [] : [platformBcc || 'info@seepoint.cz'];
}

export function offerBccRecipients(input: { organizationId?: string; salespersonEmail: string }, platformBcc?: string) {
  return Array.from(new Set([input.salespersonEmail, ...emailBccRecipients({ organizationId: input.organizationId }, platformBcc)].filter(Boolean)));
}
