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
