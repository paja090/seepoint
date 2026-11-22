import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';
import { normalizeDateOnly } from '@/lib/occupancy/availability-service';

export type ExpirationCategory =
  | 'OCCUPANCY_LEASE'
  | 'RESERVATION_HOLD'
  | 'CLIENT_CONTRACT'
  | 'CARRIER_PERMIT';

export type ExpirationUrgency = 'EXPIRED' | 'URGENT' | 'WARNING' | 'UPCOMING';

export interface ExpirationAlertItem {
  id: string;
  category: ExpirationCategory;
  urgency: ExpirationUrgency;
  daysRemaining: number;
  expiresAt: string; // YYYY-MM-DD
  title: string;
  subtitle: string;
  link: string;
}

export interface OrganizationExpirationSummary {
  organizationId: string;
  evaluatedDate: string;
  items: ExpirationAlertItem[];
  counts: {
    total: number;
    expired: number;
    urgent: number;
    warning: number;
    upcoming: number;
    byCategory: Record<ExpirationCategory, number>;
  };
}

export function classifyExpirationUrgency(
  expiresAt: Date | string,
  referenceDate: Date = new Date()
): { daysRemaining: number; urgency: ExpirationUrgency } {
  const expDay = normalizeDateOnly(expiresAt).getTime();
  const refDay = normalizeDateOnly(referenceDate).getTime();
  const daysRemaining = Math.round((expDay - refDay) / (24 * 60 * 60 * 1000));

  let urgency: ExpirationUrgency = 'UPCOMING';
  if (daysRemaining < 0) urgency = 'EXPIRED';
  else if (daysRemaining <= 7) urgency = 'URGENT';
  else if (daysRemaining <= 14) urgency = 'WARNING';

  return { daysRemaining, urgency };
}

export function formatExpirationBadgeText(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const abs = Math.abs(daysRemaining);
    return abs === 1 ? 'Vypršelo včera' : `Vypršelo před ${abs} dny`;
  }
  if (daysRemaining === 0) return 'Vyprší dnes';
  if (daysRemaining === 1) return 'Vyprší zítra';
  if (daysRemaining <= 4) return `Vyprší za ${daysRemaining} dny`;
  return `Vyprší za ${daysRemaining} dní`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveBaseUrl(override?: string): string {
  const candidate =
    override ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'https://seepoint.vercel.app';
  return candidate.replace(/\/+$/, '');
}

/**
 * Collects all upcoming and recently expired leases, reservation holds, client contracts,
 * and carrier permits for a given organization.
 */
export async function collectExpirationsForOrganization(
  organizationId: string,
  options: {
    referenceDate?: Date;
    lookaheadDays?: number;
    expiredLookbackDays?: number;
  } = {}
): Promise<OrganizationExpirationSummary> {
  const refDate = options.referenceDate ?? new Date();
  const refDay = normalizeDateOnly(refDate);
  const lookaheadDays = options.lookaheadDays ?? 30;
  const expiredLookbackDays = options.expiredLookbackDays ?? 30;

  const minDate = new Date(refDay.getTime() - expiredLookbackDays * 24 * 60 * 60 * 1000);
  const maxDate = new Date(refDay.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
  const maxReservationDate = new Date(refDay.getTime() + Math.min(lookaheadDays, 14) * 24 * 60 * 60 * 1000);

  const [leases, reservations, contracts, permits] = await Promise.all([
    prisma.occupancy.findMany({
      where: {
        organizationId,
        status: 'OCCUPIED',
        dateTo: { gte: minDate, lte: maxDate },
      },
      select: {
        id: true,
        clientName: true,
        campaignName: true,
        dateTo: true,
        surface: {
          select: {
            id: true,
            name: true,
            carrier: { select: { id: true, code: true, city: true } },
          },
        },
      },
      orderBy: { dateTo: 'asc' },
      take: 80,
    }),
    prisma.occupancy.findMany({
      where: {
        organizationId,
        status: 'RESERVED',
        reservedUntil: { not: null, gte: minDate, lte: maxReservationDate },
      },
      select: {
        id: true,
        clientName: true,
        campaignName: true,
        reservedUntil: true,
        dateFrom: true,
        dateTo: true,
        surface: {
          select: {
            id: true,
            name: true,
            carrier: { select: { id: true, code: true, city: true } },
          },
        },
      },
      orderBy: { reservedUntil: 'asc' },
      take: 60,
    }),
    prisma.clientContract.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        validTo: { not: null, gte: minDate, lte: maxDate },
      },
      select: {
        id: true,
        title: true,
        contractNumber: true,
        validTo: true,
        clientId: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { validTo: 'asc' },
      take: 60,
    }),
    prisma.advertisingCarrier.findMany({
      where: {
        organizationId,
        archivedAt: null,
        permitValidUntil: { not: null, gte: minDate, lte: maxDate },
      },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        permitValidUntil: true,
      },
      orderBy: { permitValidUntil: 'asc' },
      take: 60,
    }),
  ]);

  const items: ExpirationAlertItem[] = [];

  for (const occ of leases) {
    const { daysRemaining, urgency } = classifyExpirationUrgency(occ.dateTo, refDate);
    const code = occ.surface?.carrier?.code || 'Plocha';
    const city = occ.surface?.carrier?.city ? ` (${occ.surface.carrier.city})` : '';
    items.push({
      id: `lease-${occ.id}`,
      category: 'OCCUPANCY_LEASE',
      urgency,
      daysRemaining,
      expiresAt: normalizeDateOnly(occ.dateTo).toISOString().slice(0, 10),
      title: `Konec pronájmu: ${occ.clientName} · ${code}`,
      subtitle: `${occ.campaignName} · ${occ.surface?.name || ''}${city}`,
      link: `/occupancy`,
    });
  }

  for (const res of reservations) {
    if (!res.reservedUntil) continue;
    const { daysRemaining, urgency } = classifyExpirationUrgency(res.reservedUntil, refDate);
    const code = res.surface?.carrier?.code || 'Plocha';
    items.push({
      id: `res-${res.id}`,
      category: 'RESERVATION_HOLD',
      urgency,
      daysRemaining,
      expiresAt: normalizeDateOnly(res.reservedUntil).toISOString().slice(0, 10),
      title: `Platnost rezervace: ${res.clientName} · ${code}`,
      subtitle: `${res.campaignName} (kampaň ${normalizeDateOnly(res.dateFrom).toISOString().slice(0, 10)} – ${normalizeDateOnly(res.dateTo).toISOString().slice(0, 10)})`,
      link: `/occupancy`,
    });
  }

  for (const c of contracts) {
    if (!c.validTo) continue;
    const { daysRemaining, urgency } = classifyExpirationUrgency(c.validTo, refDate);
    items.push({
      id: `contract-${c.id}`,
      category: 'CLIENT_CONTRACT',
      urgency,
      daysRemaining,
      expiresAt: normalizeDateOnly(c.validTo).toISOString().slice(0, 10),
      title: `Konec smlouvy: ${c.client.name}`,
      subtitle: `${c.title}${c.contractNumber ? ` (${c.contractNumber})` : ''}`,
      link: `/clients/${c.clientId}`,
    });
  }

  for (const car of permits) {
    if (!car.permitValidUntil) continue;
    const { daysRemaining, urgency } = classifyExpirationUrgency(car.permitValidUntil, refDate);
    items.push({
      id: `permit-${car.id}`,
      category: 'CARRIER_PERMIT',
      urgency,
      daysRemaining,
      expiresAt: normalizeDateOnly(car.permitValidUntil).toISOString().slice(0, 10),
      title: `Povolení nosiče: ${car.code} (${car.city})`,
      subtitle: car.name,
      link: `/carriers/${car.id}`,
    });
  }

  items.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const byCategory: Record<ExpirationCategory, number> = {
    OCCUPANCY_LEASE: 0,
    RESERVATION_HOLD: 0,
    CLIENT_CONTRACT: 0,
    CARRIER_PERMIT: 0,
  };
  let expired = 0;
  let urgent = 0;
  let warning = 0;
  let upcoming = 0;

  for (const item of items) {
    byCategory[item.category]++;
    if (item.urgency === 'EXPIRED') expired++;
    else if (item.urgency === 'URGENT') urgent++;
    else if (item.urgency === 'WARNING') warning++;
    else upcoming++;
  }

  return {
    organizationId,
    evaluatedDate: refDay.toISOString().slice(0, 10),
    items,
    counts: {
      total: items.length,
      expired,
      urgent,
      warning,
      upcoming,
      byCategory,
    },
  };
}

const CATEGORY_LABELS: Record<ExpirationCategory, string> = {
  OCCUPANCY_LEASE: '📅 Konce pronájmů a kampaní',
  RESERVATION_HOLD: '⏳ Expirující předběžné rezervace',
  CLIENT_CONTRACT: '📄 Konce klientských smluv',
  CARRIER_PERMIT: '🏛️ Konce povolení nosičů',
};

export function renderExpirationDigestEmail(
  summary: OrganizationExpirationSummary,
  organizationName: string,
  baseUrl?: string
): { subject: string; html: string; text: string } {
  const origin = resolveBaseUrl(baseUrl);
  const criticalCount = summary.counts.expired + summary.counts.urgent;
  const subject =
    criticalCount > 0
      ? `Upozornění na expirace (${organizationName}): ${criticalCount} urgentních / prošlých, celkem ${summary.counts.total}`
      : `Přehled blížících se konců pronájmů, smluv a povolení (${summary.counts.total})`;

  const categories: ExpirationCategory[] = [
    'RESERVATION_HOLD',
    'OCCUPANCY_LEASE',
    'CLIENT_CONTRACT',
    'CARRIER_PERMIT',
  ];

  const sectionsHtml = categories
    .map((cat) => {
      const catItems = summary.items.filter((i) => i.category === cat);
      if (catItems.length === 0) return '';
      const rows = catItems
        .slice(0, 20)
        .map((item) => {
          const badgeColor =
            item.urgency === 'EXPIRED'
              ? '#b91c1c'
              : item.urgency === 'URGENT'
              ? '#c2410c'
              : item.urgency === 'WARNING'
              ? '#b45309'
              : '#0369a1';
          const bg =
            item.urgency === 'EXPIRED'
              ? '#fef2f2'
              : item.urgency === 'URGENT'
              ? '#fff7ed'
              : '#f8fafc';
          return `
            <div style="margin:0 0 8px;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;background:${bg};">
              <div style="font-size:11px;font-weight:800;color:${badgeColor};text-transform:uppercase;">
                ${escapeHtml(formatExpirationBadgeText(item.daysRemaining))} · ${escapeHtml(item.expiresAt)}
              </div>
              <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:2px;">
                <a href="${escapeHtml(origin + item.link)}" style="color:#0f172a;text-decoration:none;">${escapeHtml(item.title)}</a>
              </div>
              <div style="font-size:12px;color:#475569;margin-top:2px;">${escapeHtml(item.subtitle)}</div>
            </div>`;
        })
        .join('');

      return `
        <h2 style="margin:16px 0 8px;font-size:14px;font-weight:900;color:#0f172a;">
          ${escapeHtml(CATEGORY_LABELS[cat])} (${catItems.length})
        </h2>
        ${rows}`;
    })
    .filter(Boolean)
    .join('');

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;border-radius:18px;overflow:hidden;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="background:#0f172a;padding:20px 24px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;">
            ${escapeHtml(organizationName)} · Hlídač obsazenosti a platností
          </div>
          <h1 style="margin:6px 0 8px;font-size:19px;font-weight:900;color:#ffffff;">
            Blížící se konce pronájmů, rezervací, smluv a povolení
          </h1>
          <div style="font-size:13px;color:#cbd5e1;font-weight:700;">
            🔴 Prošlé: ${summary.counts.expired} · 🟠 Do 7 dní: ${summary.counts.urgent} · 🟡 Do 14 dní: ${summary.counts.warning} · 🔵 Do 30 dní: ${summary.counts.upcoming}
          </div>
        </div>
        <div style="padding:18px 22px;">
          ${sectionsHtml}
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0;">
            <a href="${escapeHtml(origin + '/occupancy')}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#0284c7;color:#ffffff;font-size:12.5px;font-weight:800;text-decoration:none;">
              Otevřít Obsazenost ploch →
            </a>
          </div>
        </div>
      </div>
    </div>`;

  const textLines = [
    subject,
    `Prošlé: ${summary.counts.expired} | Do 7 dní: ${summary.counts.urgent} | Do 14 dní: ${summary.counts.warning} | Do 30 dní: ${summary.counts.upcoming}`,
    '',
    ...summary.items.map(
      (i) => `[${formatExpirationBadgeText(i.daysRemaining)} | ${i.expiresAt}] ${i.title} – ${i.subtitle} (${origin}${i.link})`
    ),
  ];

  return { subject, html, text: textLines.join('\n') };
}

/**
 * Sends daily deduplicated expiration alert digest to organization managers/sales
 * when there are expired, urgent (<=7d), or warning (<=14d) items (or 30-day milestone).
 */
export async function sendExpirationAlertEmailsForOrganization(
  organizationId: string,
  options: { force?: boolean; baseUrl?: string } = {}
): Promise<{
  evaluatedDate: string;
  totalItems: number;
  alertableItems: number;
  sentCount: number;
  skippedAlreadySent: number;
}> {
  const summary = await collectExpirationsForOrganization(organizationId);
  // Trigger email when there are expired, <=14d items, or exact 30-day milestone items
  const alertable = summary.items.filter(
    (item) =>
      item.urgency === 'EXPIRED' ||
      item.urgency === 'URGENT' ||
      item.urgency === 'WARNING' ||
      item.daysRemaining === 30
  );

  if (alertable.length === 0 && !options.force) {
    return {
      evaluatedDate: summary.evaluatedDate,
      totalItems: summary.counts.total,
      alertableItems: 0,
      sentCount: 0,
      skippedAlreadySent: 0,
    };
  }

  const [org, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: { in: ['ADMIN', 'MANAGER', 'SALES'] },
      },
      select: {
        user: { select: { email: true, status: true } },
      },
    }),
  ]);

  const emails = [
    ...new Set(
      members
        .filter((m) => m.user && m.user.status !== 'SUSPENDED' && Boolean(m.user.email))
        .map((m) => m.user.email.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    ),
  ];

  if (emails.length === 0) {
    return {
      evaluatedDate: summary.evaluatedDate,
      totalItems: summary.counts.total,
      alertableItems: alertable.length,
      sentCount: 0,
      skippedAlreadySent: 0,
    };
  }

  const alreadySent = new Set<string>();
  if (!options.force) {
    const recentLogs = await prisma.emailLog.findMany({
      where: {
        organizationId,
        template: 'occupancy-expiration-alerts',
        status: 'SENT',
        sentAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
      },
      select: { recipient: true, metadata: true },
    });
    for (const log of recentLogs) {
      const meta = log.metadata as Record<string, unknown> | null;
      if (!meta || meta.evaluatedDate === summary.evaluatedDate) {
        alreadySent.add(log.recipient.trim().toLowerCase());
      }
    }
  }

  const rendered = renderExpirationDigestEmail(
    summary,
    org?.name || 'SeePoint OS',
    options.baseUrl
  );

  let sentCount = 0;
  let skippedAlreadySent = 0;

  for (const email of emails) {
    if (alreadySent.has(email)) {
      skippedAlreadySent++;
      continue;
    }
    const res = await sendTransactionalEmail({
      to: email,
      bcc: [],
      subject: rendered.subject,
      message: rendered.text,
      customHtml: rendered.html,
      template: 'occupancy-expiration-alerts',
      organizationId,
      allowPlatformFallback: true,
      metadata: {
        evaluatedDate: summary.evaluatedDate,
        totalItems: summary.counts.total,
        expired: summary.counts.expired,
        urgent: summary.counts.urgent,
      },
    });
    if (res.status === 'sent') sentCount++;
  }

  return {
    evaluatedDate: summary.evaluatedDate,
    totalItems: summary.counts.total,
    alertableItems: alertable.length,
    sentCount,
    skippedAlreadySent,
  };
}
