import type { IntegrationProvider } from '@prisma/client';

const ALLOWED_GOOGLE_DRIVE_TOKEN_SCOPES = new Set([
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file',
]);

export function assertGoogleTokenScopes(provider: IntegrationProvider, scopes: string[]) {
  if (provider !== 'GOOGLE_DRIVE') throw new Error('Tato Google integrace zatím není podporovaná.');
  const unexpected = scopes.filter((scope) => !ALLOWED_GOOGLE_DRIVE_TOKEN_SCOPES.has(scope));
  if (unexpected.length) throw new Error('Google vrátil širší oprávnění, než SeePoint požaduje. Připojení bylo odmítnuto.');
  if (!scopes.includes('https://www.googleapis.com/auth/drive.file')) {
    throw new Error('Google neudělil požadované omezené oprávnění drive.file.');
  }
}
