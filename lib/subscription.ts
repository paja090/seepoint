export type PlanCode = 'INTERNAL' | 'START' | 'BUSINESS' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatusCode = 'INTERNAL' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export interface PlanSpecification {
  code: PlanCode;
  label: string;
  monthlyPriceCzk: number | null;
  annualPriceCzk: number | null;
  surfaceLimit: number | null;
  userLimit: number | null;
}

export const PLAN_SPECIFICATIONS: Record<PlanCode, PlanSpecification> = {
  INTERNAL: {
    code: 'INTERNAL',
    label: 'Interní provoz',
    monthlyPriceCzk: null,
    annualPriceCzk: null,
    surfaceLimit: null,
    userLimit: null,
  },
  START: {
    code: 'START',
    label: 'START',
    monthlyPriceCzk: 1900,
    annualPriceCzk: 19000,
    surfaceLimit: 100,
    userLimit: 3,
  },
  BUSINESS: {
    code: 'BUSINESS',
    label: 'BUSINESS',
    monthlyPriceCzk: 4900,
    annualPriceCzk: 49000,
    surfaceLimit: 500,
    userLimit: 10,
  },
  PRO: {
    code: 'PRO',
    label: 'PRO',
    monthlyPriceCzk: 9900,
    annualPriceCzk: 99000,
    surfaceLimit: 2000,
    userLimit: null,
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    label: 'ENTERPRISE',
    monthlyPriceCzk: null,
    annualPriceCzk: null,
    surfaceLimit: null,
    userLimit: null,
  },
};

export function getPlanSpecification(plan?: string | null): PlanSpecification {
  const key = (plan?.toUpperCase() || 'START') as PlanCode;
  return PLAN_SPECIFICATIONS[key] ?? PLAN_SPECIFICATIONS.START;
}

export interface SubscriptionBannerInfo {
  tone: 'info' | 'warning' | 'danger';
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface SubscriptionEvaluation {
  plan: PlanSpecification;
  status: SubscriptionStatusCode;
  statusLabel: string;
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
  banner: SubscriptionBannerInfo | null;
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatusCode, string> = {
  INTERNAL: 'Interní licence',
  TRIAL: 'Zkušební provoz (Pilot)',
  ACTIVE: 'Aktivní předplatné',
  PAST_DUE: 'Faktura po splatnosti',
  CANCELLED: 'Předplatné ukončeno',
};

export function evaluateSubscriptionState(
  organization: {
    id?: string | null;
    plan?: string | null;
    subscriptionStatus?: string | null;
    trialEndsAt?: Date | string | null;
  } | null | undefined,
  nowMs: number = Date.now()
): SubscriptionEvaluation {
  const plan = getPlanSpecification(organization?.plan);
  const rawStatus = (organization?.subscriptionStatus?.toUpperCase() || 'TRIAL') as SubscriptionStatusCode;
  const status: SubscriptionStatusCode =
    organization?.id === 'org_seepoint_default'
      ? 'INTERNAL'
      : SUBSCRIPTION_STATUS_LABELS[rawStatus]
        ? rawStatus
        : 'TRIAL';

  const statusLabel = SUBSCRIPTION_STATUS_LABELS[status];

  let trialDaysRemaining: number | null = null;
  if (organization?.trialEndsAt) {
    const endMs =
      organization.trialEndsAt instanceof Date
        ? organization.trialEndsAt.getTime()
        : new Date(organization.trialEndsAt).getTime();
    if (!Number.isNaN(endMs)) {
      trialDaysRemaining = Math.ceil((endMs - nowMs) / 86400000);
    }
  }

  const isTrialExpired = status === 'TRIAL' && trialDaysRemaining !== null && trialDaysRemaining < 0;

  let banner: SubscriptionBannerInfo | null = null;

  if (status === 'TRIAL') {
    if (isTrialExpired && trialDaysRemaining !== null) {
      banner = {
        tone: 'danger',
        title: `Zkušební doba tarifu ${plan.label} skončila před ${Math.abs(trialDaysRemaining)} dny`,
        description:
          'Pro plynulé pokračování bez omezení si prosím aktivujte předplatné na fakturu (info@seepoint.cz / +420 777 807 717).',
        ctaLabel: 'Přehled předplatného',
        ctaHref: '/settings/company',
      };
    } else if (trialDaysRemaining !== null && trialDaysRemaining <= 14) {
      banner = {
        tone: trialDaysRemaining <= 5 ? 'warning' : 'info',
        title:
          trialDaysRemaining === 0
            ? `Zkušební doba tarifu ${plan.label} končí dnes`
            : `Zkušební provoz (tarif ${plan.label}) končí za ${trialDaysRemaining} ${
                trialDaysRemaining === 1 ? 'den' : trialDaysRemaining >= 2 && trialDaysRemaining <= 4 ? 'dny' : 'dní'
              }`,
        description: 'Všechna vaše data, nosiče i nabídky vám při přechodu na placený tarif zůstanou zachovány.',
        ctaLabel: 'Detail tarifu a fakturace',
        ctaHref: '/settings/company',
      };
    }
  } else if (status === 'PAST_DUE') {
    banner = {
      tone: 'warning',
      title: 'Evidujeme fakturu po splatnosti za předplatné SeePoint OS',
      description:
        'Prosím zkontrolujte úhradu faktury nebo kontaktujte podporu (+420 777 807 717), aby nedošlo k přepnutí účtu do režimu pouze pro čtení.',
      ctaLabel: 'Fakturační údaje',
      ctaHref: '/settings/company',
    };
  } else if (status === 'CANCELLED') {
    banner = {
      tone: 'danger',
      title: 'Předplatné této organizace je ukončeno',
      description: 'Pro obnovení plného přístupu kontaktujte podporu na info@seepoint.cz nebo +420 777 807 717.',
      ctaLabel: 'Nastavení firmy',
      ctaHref: '/settings/company',
    };
  }

  return {
    plan,
    status,
    statusLabel,
    trialDaysRemaining,
    isTrialExpired,
    banner,
  };
}
