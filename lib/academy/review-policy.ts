import { hasModuleAccess } from '../module-policy';
import type { AcademyActor } from './policy';

// Review of explicitly authorized synthetic training records, not a publication gate.
const reviewOrganizations = new Set(['cmui330fi0005l404dx9noytp', 'org_seepoint_default']);
export function canReviewAcademy(actor: AcademyActor | null, environment = process.env.VERCEL_ENV) {
  const isAllowedEnv = environment === 'preview' || environment === 'production' || !environment || environment === 'development';
  return isAllowedEnv && actor?.role === 'ADMIN'
    && reviewOrganizations.has(actor.organizationId ?? '')
    && hasModuleAccess(actor, 'offers', 'offers');
}

