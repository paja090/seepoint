import { prisma } from '@/lib/db';
import { OccupancyInsightType, OccupancyInsightSeverity, Prisma } from '@prisma/client';
import { runWithTenantContext } from '@/lib/tenant-context';
import {
  periodsOverlap,
  getOverlapDaysCount,
  getSurfaceAvailabilityState,
  normalizeDateOnly,
  BLOCKING_OCCUPANCY_STATUSES,
} from './availability-service';
import { getOrganizationOccupancyProfile } from './intelligence-profile';

export type RawFinding = {
  type: OccupancyInsightType;
  severity: OccupancyInsightSeverity;
  fingerprint: string;
  surfaceId?: string | null;
  carrierId?: string | null;
  occupancyId?: string | null;
  offerId?: string | null;
  clientId?: string | null;
  title: string;
  deterministicReason: string;
  suggestedActionType?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditSummary = {
  organizationId: string;
  checkedSurfaces: number;
  checkedOccupancies: number;
  openInsights: number;
  newInsights: number;
  autoResolvedInsights: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  byType: Record<OccupancyInsightType, number>;
  scannedAt: string;
};

/**
 * Executes a deterministic multi-tenant audit of occupancy data for an organization.
 * Batch loads surfaces, carriers, occupancies and offers to avoid N+1 queries.
 */
export async function runOccupancyAudit(
  organizationId: string,
  options: {
    userId?: string;
  } = {}
): Promise<AuditSummary> {
  return runWithTenantContext(
    {
      organizationId,
      userId: options.userId || 'system',
      source: 'session',
    },
    async () => {
      const profile = await getOrganizationOccupancyProfile(organizationId);
      const now = new Date();
      const today = normalizeDateOnly(now);
      const todayTime = today.getTime();

      // 1. Fetch carriers and surfaces
      const carriers = await prisma.advertisingCarrier.findMany({
        where: {
          organizationId,
          archivedAt: null,
          status: 'ACTIVE',
          city: profile.targetCities.length ? { in: profile.targetCities } : undefined,
        },
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          region: true,
          status: true,
          type: true,
          surfaces: {
            select: {
              id: true,
              name: true,
              status: true,
              mediaType: true,
              currentClientId: true,
              contractId: true,
            },
          },
        },
      });

      const allSurfaces = carriers
        .flatMap((c) =>
          c.surfaces.map((s) => ({
            ...s,
            carrier: {
              id: c.id,
              code: c.code,
              name: c.name,
              city: c.city,
              region: c.region,
              status: c.status,
              type: c.type,
            },
          }))
        )
        .filter((s) => {
          if (!profile.preferredMediaTypes?.length) return true;
          return (
            profile.preferredMediaTypes.includes(s.mediaType) ||
            profile.preferredMediaTypes.includes(s.carrier.type)
          );
        });

      const surfaceIds = allSurfaces.map((s) => s.id);
      const surfaceMap = new Map(allSurfaces.map((s) => [s.id, s]));

      // 2. Fetch all occupancies in one batch
      const allOccupancies = await prisma.occupancy.findMany({
        where: {
          organizationId,
          surfaceId: { in: surfaceIds },
        },
        select: {
          id: true,
          surfaceId: true,
          clientId: true,
          clientName: true,
          campaignName: true,
          dateFrom: true,
          dateTo: true,
          status: true,
          price: true,
          offerId: true,
        },
        orderBy: { dateFrom: 'asc' },
      });

      // Group occupancies by surfaceId
      const occupanciesBySurface = new Map<string, typeof allOccupancies>();
      for (const occ of allOccupancies) {
        const list = occupanciesBySurface.get(occ.surfaceId) || [];
        list.push(occ);
        occupanciesBySurface.set(occ.surfaceId, list);
      }

      // 3. Optionally fetch pending offers
      let pendingOfferItems: Array<{
        id: string;
        offerId: string;
        surfaceId: string;
        dateFrom: Date;
        dateTo: Date;
        offer: {
          id: string;
          title: string;
          status: string;
          clientId: string;
          client: { name: string } | null;
        };
      }> = [];

      if (profile.checkOfferConflicts) {
        pendingOfferItems = await prisma.offerItem.findMany({
          where: {
            organizationId,
            surfaceId: { in: surfaceIds },
            offer: {
              status: { in: ['SENT', 'ACCEPTED'] },
              archivedAt: null,
            },
          },
          select: {
            id: true,
            offerId: true,
            surfaceId: true,
            dateFrom: true,
            dateTo: true,
            offer: {
              select: {
                id: true,
                title: true,
                status: true,
                clientId: true,
                client: {
                  select: { name: true },
                },
              },
            },
          },
        });
      }

      const rawFindings: RawFinding[] = [];

      // =========================================================================
      // RULE EVALUATION ENGINE
      // =========================================================================

      for (const surface of allSurfaces) {
        const occs = occupanciesBySurface.get(surface.id) || [];
        const activeOccs = occs.filter(
          (o) => o.status !== 'FINISHED' && o.status !== 'CANCELLED'
        );

        const isNavigation =
          surface.mediaType === 'NAVIGATION_SIGN' ||
          surface.carrier.type === 'NAVIGATION';

        // RULE 1: MISSING_DATA (Invalid dates or missing references)
        if (profile.checkMissingData) {
          for (const occ of occs) {
            const from = normalizeDateOnly(occ.dateFrom).getTime();
            const to = normalizeDateOnly(occ.dateTo).getTime();
            if (from > to) {
              rawFindings.push({
                type: 'MISSING_DATA',
                severity: 'HIGH',
                fingerprint: `${organizationId}:MISSING_DATA:${surface.id}:${occ.id}:inverted_dates`,
                surfaceId: surface.id,
                carrierId: surface.carrier.id,
                occupancyId: occ.id,
                clientId: occ.clientId,
                title: `Neplatný interval kampaně: ${surface.name}`,
                deterministicReason: `Záznam kampaně '${occ.campaignName}' má počáteční datum (${occ.dateFrom.toISOString().slice(0, 10)}) po koncovém datu (${occ.dateTo.toISOString().slice(0, 10)}).`,
                suggestedActionType: 'FIX_DATES',
                metadata: { dateFrom: occ.dateFrom, dateTo: occ.dateTo },
              });
            }
          }
        }

        // RULE 2: DOUBLE_BOOKING (Overlapping blocking occupancies)
        if (profile.checkCampaignConflicts || profile.checkReservationConflicts) {
          const blocking = activeOccs.filter((o) =>
            BLOCKING_OCCUPANCY_STATUSES.includes(o.status as (typeof BLOCKING_OCCUPANCY_STATUSES)[number])
          );

          for (let i = 0; i < blocking.length; i++) {
            for (let j = i + 1; j < blocking.length; j++) {
              const a = blocking[i];
              const b = blocking[j];

              if (periodsOverlap(a.dateFrom, a.dateTo, b.dateFrom, b.dateTo)) {
                const overlapDays = getOverlapDaysCount(a.dateFrom, a.dateTo, b.dateFrom, b.dateTo);
                const dFromA = normalizeDateOnly(a.dateFrom).toISOString().slice(0, 10);
                const dToA = normalizeDateOnly(a.dateTo).toISOString().slice(0, 10);
                const dFromB = normalizeDateOnly(b.dateFrom).toISOString().slice(0, 10);
                const dToB = normalizeDateOnly(b.dateTo).toISOString().slice(0, 10);

                // Stable sorted IDs for deterministic fingerprint
                const pairKey = [a.id, b.id].sort().join('_');

                rawFindings.push({
                  type: 'DOUBLE_BOOKING',
                  severity: 'CRITICAL',
                  fingerprint: `${organizationId}:DOUBLE_BOOKING:${surface.id}:${pairKey}`,
                  surfaceId: surface.id,
                  carrierId: surface.carrier.id,
                  occupancyId: a.id,
                  clientId: a.clientId,
                  title: `Dvojitá rezervace: ${surface.name} (${surface.carrier.code})`,
                  deterministicReason: `Plocha ${surface.name} má překrývající se blokace: Kampaň '${a.campaignName}' (${a.clientName}, ${dFromA}–${dToA}) a kampaň '${b.campaignName}' (${b.clientName}, ${dFromB}–${dToB}). Překryv trvá ${overlapDays} dní.`,
                  suggestedActionType: 'RESOLVE_COLLISION',
                  metadata: {
                    occupancyA: { id: a.id, client: a.clientName, campaign: a.campaignName, dateFrom: dFromA, dateTo: dToA, status: a.status },
                    occupancyB: { id: b.id, client: b.clientName, campaign: b.campaignName, dateFrom: dFromB, dateTo: dToB, status: b.status },
                    overlapDays,
                  },
                });
              }
            }
          }
        }

        // RULE 3: STATUS_MISMATCH (Surface status vs Calendar snapshot)
        if (profile.checkStatusMismatch && surface.status !== 'OUT_OF_SERVICE') {
          // In OOH, navigation signs represent long-term infrastructure with annual or indefinite leases.
          // If a navigation sign is marked 'OCCUPIED' or has a client/contract assigned, it is legitimately occupied
          // even if no short-term calendar entries are created.
          const isOngoingNavigationInstallation =
            isNavigation && (surface.status === 'OCCUPIED' || Boolean(surface.currentClientId) || Boolean(surface.contractId));

          if (!isOngoingNavigationInstallation) {
            const expectedSnapshot = getSurfaceAvailabilityState(occs, now);
            if (surface.status !== expectedSnapshot.status) {
              rawFindings.push({
                type: 'STATUS_MISMATCH',
                severity: 'HIGH',
                fingerprint: `${organizationId}:STATUS_MISMATCH:${surface.id}`,
                surfaceId: surface.id,
                carrierId: surface.carrier.id,
                occupancyId: expectedSnapshot.activeOccupancyId,
                clientId: expectedSnapshot.currentClientId,
                title: `Neshoda stavu plochy: ${surface.name}`,
                deterministicReason: `Plocha ${surface.name} má v inventáři stav '${surface.status}', ale k dnešnímu dni by měla mít stav '${expectedSnapshot.status}'. ${expectedSnapshot.activeOccupancyId ? `Aktivní kampaň trvá do ${expectedSnapshot.currentRentEnd?.toISOString().slice(0, 10)}.` : 'Dnes na ploše žádná kampaň neprobíhá.'}`,
                suggestedActionType: 'SYNC_STATUS',
                metadata: {
                  currentStatus: surface.status,
                  expectedStatus: expectedSnapshot.status,
                  activeOccupancyId: expectedSnapshot.activeOccupancyId,
                },
              });
            }
          }
        }

        // RULE 4: EXPIRED_OCCUPANCY (Campaign ended in the past but was never marked FINISHED)
        for (const occ of activeOccs) {
          const toTime = normalizeDateOnly(occ.dateTo).getTime();
          if (toTime < todayTime && ['OCCUPIED', 'RESERVED'].includes(occ.status)) {
            // Navigation signs are annual rolling leases. If the surface is actively assigned
            // to this client or still marked OCCUPIED, treat as an annual rolling lease, not an expired anomaly.
            if (isNavigation && (surface.status === 'OCCUPIED' || surface.currentClientId === occ.clientId || surface.contractId)) {
              continue;
            }

            const dTo = normalizeDateOnly(occ.dateTo).toISOString().slice(0, 10);
            const daysPast = Math.round((todayTime - toTime) / (1000 * 60 * 60 * 24));

            rawFindings.push({
              type: 'EXPIRED_OCCUPANCY',
              severity: 'MEDIUM',
              fingerprint: `${organizationId}:EXPIRED_OCCUPANCY:${surface.id}:${occ.id}`,
              surfaceId: surface.id,
              carrierId: surface.carrier.id,
              occupancyId: occ.id,
              clientId: occ.clientId,
              title: `Neukončená kampaň: ${surface.name}`,
              deterministicReason: `Kampaň '${occ.campaignName}' pro klienta '${occ.clientName}' skončila před ${daysPast} dny (${dTo}), ale v kalendáři stále zůstává ve stavu '${occ.status}' místo FINISHED.`,
              suggestedActionType: 'FINISH_EXPIRED_OCCUPANCY',
              metadata: { dateTo: dTo, daysPast, status: occ.status },
            });
          }
        }

        // RULE 5: EXPIRING_CAMPAIGN (Opportunity for renewal)
        if (profile.checkExpiringCampaigns) {
          const warningWindow = profile.expiringCampaignWarningDays * 24 * 60 * 60 * 1000;
          const warningEndTime = todayTime + warningWindow;

          for (const occ of activeOccs) {
            if (occ.status === 'OCCUPIED') {
              const toTime = normalizeDateOnly(occ.dateTo).getTime();
              if (toTime >= todayTime && toTime <= warningEndTime) {
                const diffDays = Math.round((toTime - todayTime) / (1000 * 60 * 60 * 24));
                const dTo = normalizeDateOnly(occ.dateTo).toISOString().slice(0, 10);

                rawFindings.push({
                  type: 'EXPIRING_CAMPAIGN',
                  severity: diffDays <= 7 ? 'HIGH' : 'MEDIUM',
                  fingerprint: `${organizationId}:EXPIRING_CAMPAIGN:${surface.id}:${occ.id}`,
                  surfaceId: surface.id,
                  carrierId: surface.carrier.id,
                  occupancyId: occ.id,
                  clientId: occ.clientId,
                  title: `Končící kampaň (${diffDays} dní): ${surface.name}`,
                  deterministicReason: `Kampaň '${occ.campaignName}' pro klienta '${occ.clientName}' končí ${dTo} (za ${diffDays} dní). Vhodná chvíle nabídnout klientovi prodloužení nebo předrezervovat plochu.`,
                  suggestedActionType: 'EXTEND_OFFER',
                  metadata: { clientName: occ.clientName, campaignName: occ.campaignName, dateTo: dTo, diffDays },
                });
              }
            }
          }
        }

        // RULE 6: UNDERUTILIZED_MEDIA (Ležák - no active or scheduled occupancy in X days)
        if (profile.checkUnderutilizedMedia && surface.status !== 'OUT_OF_SERVICE') {
          // An occupied navigation sign or one with an active client is not an underutilized ležák
          const isOccupiedNavigation =
            isNavigation && (surface.status === 'OCCUPIED' || Boolean(surface.currentClientId) || Boolean(surface.contractId));

          if (!isOccupiedNavigation) {
            const cutoffTime = todayTime - profile.underutilizedAfterDays * 24 * 60 * 60 * 1000;
            const recentOrFuture = occs.filter((o) => {
              if (o.status === 'CANCELLED') return false;
              const toTime = normalizeDateOnly(o.dateTo).getTime();
              return toTime >= cutoffTime;
            });

            if (recentOrFuture.length === 0) {
              rawFindings.push({
                type: 'UNDERUTILIZED_MEDIA',
                severity: 'LOW',
                fingerprint: `${organizationId}:UNDERUTILIZED_MEDIA:${surface.id}`,
                surfaceId: surface.id,
                carrierId: surface.carrier.id,
                title: `Nevyužitá plocha (> ${profile.underutilizedAfterDays} dní): ${surface.name}`,
                deterministicReason: `Plocha ${surface.name} v lokalitě ${surface.carrier.city} neměla žádnou kampaň více než ${profile.underutilizedAfterDays} dní a nemá naplánovanou žádnou budoucí rezervaci.`,
                suggestedActionType: 'CREATE_OFFER',
                metadata: { city: surface.carrier.city, mediaType: surface.mediaType },
              });
            }
          }
        }

        // RULE 7: CALENDAR_GAP (Empty gap between two scheduled occupancies)
        // Only applies to campaign media (billboards, bigboards), not static navigation signs
        if (profile.checkCalendarGaps && !isNavigation) {
          const futureOrCurrentOccs = activeOccs
            .filter((o) => normalizeDateOnly(o.dateTo).getTime() >= todayTime)
            .sort((a, b) => normalizeDateOnly(a.dateFrom).getTime() - normalizeDateOnly(b.dateFrom).getTime());

          for (let i = 0; i < futureOrCurrentOccs.length - 1; i++) {
            const cur = futureOrCurrentOccs[i];
            const next = futureOrCurrentOccs[i + 1];

            const curEnd = normalizeDateOnly(cur.dateTo).getTime();
            const nextStart = normalizeDateOnly(next.dateFrom).getTime();

            const gapMillis = nextStart - curEnd - 24 * 60 * 60 * 1000;
            const gapDays = Math.round(gapMillis / (1000 * 60 * 60 * 24));

            if (gapDays >= 1 && gapDays <= profile.calendarGapMaxDays) {
              const gapStartStr = new Date(curEnd + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
              const gapEndStr = new Date(nextStart - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

              rawFindings.push({
                type: 'CALENDAR_GAP',
                severity: 'LOW',
                fingerprint: `${organizationId}:CALENDAR_GAP:${surface.id}:${cur.id}_${next.id}`,
                surfaceId: surface.id,
                carrierId: surface.carrier.id,
                title: `Volné okno v kalendáři (${gapDays} dní): ${surface.name}`,
                deterministicReason: `Mezi kampaní '${cur.campaignName}' (končí ${cur.dateTo.toISOString().slice(0, 10)}) a '${next.campaignName}' (začíná ${next.dateFrom.toISOString().slice(0, 10)}) je volné okno ${gapDays} dní (${gapStartStr}–${gapEndStr}). Vhodné pro last-minute nabídku.`,
                suggestedActionType: 'FILL_GAP',
                metadata: { gapDays, gapStart: gapStartStr, gapEnd: gapEndStr },
              });
            }
          }
        }
      }

      // RULE 8: OFFER_CONFLICT (Offers in SENT/ACCEPTED conflicting with Occupancy)
      if (profile.checkOfferConflicts && pendingOfferItems.length > 0) {
        for (const item of pendingOfferItems) {
          const surface = surfaceMap.get(item.surfaceId);
          if (!surface) continue;

          const surfaceOccs = occupanciesBySurface.get(item.surfaceId) || [];
          const collisions = surfaceOccs.filter(
            (o) =>
              o.offerId !== item.offerId &&
              BLOCKING_OCCUPANCY_STATUSES.includes(o.status as (typeof BLOCKING_OCCUPANCY_STATUSES)[number]) &&
              periodsOverlap(item.dateFrom, item.dateTo, o.dateFrom, o.dateTo)
          );

          for (const coll of collisions) {
            const dFromItem = normalizeDateOnly(item.dateFrom).toISOString().slice(0, 10);
            const dToItem = normalizeDateOnly(item.dateTo).toISOString().slice(0, 10);
            const dFromColl = normalizeDateOnly(coll.dateFrom).toISOString().slice(0, 10);
            const dToColl = normalizeDateOnly(coll.dateTo).toISOString().slice(0, 10);

            rawFindings.push({
              type: 'OFFER_CONFLICT',
              severity: item.offer.status === 'ACCEPTED' ? 'CRITICAL' : 'HIGH',
              fingerprint: `${organizationId}:OFFER_CONFLICT:${item.surfaceId}:${item.offerId}:${coll.id}`,
              surfaceId: item.surfaceId,
              carrierId: surface.carrier.id,
              offerId: item.offerId,
              occupancyId: coll.id,
              clientId: item.offer.clientId,
              title: `Kolize nabídky s obsazeností: ${surface.name}`,
              deterministicReason: `Nabídka '${item.offer.title}' pro klienta '${item.offer.client?.name}' (stav: ${item.offer.status}, termín: ${dFromItem}–${dToItem}) koliduje s obsazeností '${coll.campaignName}' (${coll.clientName}, ${dFromColl}–${dToColl}).`,
              suggestedActionType: 'FIND_ALTERNATIVE',
              metadata: {
                offerId: item.offerId,
                offerTitle: item.offer.title,
                offerStatus: item.offer.status,
                occupancyId: coll.id,
                occupancyClient: coll.clientName,
                occupancyCampaign: coll.campaignName,
              },
            });
          }
        }
      }

      // =========================================================================
      // PERSISTENCE, DEDUPLICATION & AUTO-RESOLUTION
      // =========================================================================

      // Fetch all existing insights for this organization (including RESOLVED and IGNORED)
      // to avoid @@unique([organizationId, fingerprint]) collisions on re-detection
      const existingInsights = await prisma.occupancyInsight.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          fingerprint: true,
          status: true,
        },
      });

      const existingMap = new Map(existingInsights.map((e) => [e.fingerprint, e]));
      const detectedFingerprints = new Set<string>();
      const processedFingerprintsInBatch = new Set<string>();

      let newCount = 0;

      const toCreate: Prisma.OccupancyInsightCreateManyInput[] = [];
      const toUpdate: Array<{ id: string; data: Prisma.OccupancyInsightUpdateInput }> = [];

      // Partition detected findings into creates and updates
      for (const finding of rawFindings) {
        detectedFingerprints.add(finding.fingerprint);
        if (processedFingerprintsInBatch.has(finding.fingerprint)) {
          // Avoid duplicate updates/creates in the same scan if multiple rules emit identical fingerprints
          continue;
        }
        processedFingerprintsInBatch.add(finding.fingerprint);

        const existing = existingMap.get(finding.fingerprint);

        if (existing) {
          // Re-activate if previously RESOLVED; preserve IGNORED or REVIEWED status
          const nextStatus = existing.status === 'RESOLVED' ? 'OPEN' : existing.status;
          const isIgnored = existing.status === 'IGNORED';
          toUpdate.push({
            id: existing.id,
            data: {
              title: finding.title,
              deterministicReason: finding.deterministicReason,
              severity: finding.severity,
              status: nextStatus,
              resolvedAt: isIgnored ? undefined : null,
              resolvedByUser: isIgnored ? undefined : { disconnect: true },
              suggestedActionType: finding.suggestedActionType,
              metadata: finding.metadata ? (JSON.parse(JSON.stringify(finding.metadata)) as Prisma.InputJsonValue) : undefined,
              detectedAt: now,
            },
          });
        } else {
          toCreate.push({
            organizationId,
            type: finding.type,
            severity: finding.severity,
            status: 'OPEN',
            fingerprint: finding.fingerprint,
            surfaceId: finding.surfaceId,
            carrierId: finding.carrierId,
            occupancyId: finding.occupancyId,
            offerId: finding.offerId,
            clientId: finding.clientId,
            title: finding.title,
            deterministicReason: finding.deterministicReason,
            suggestedActionType: finding.suggestedActionType,
            metadata: finding.metadata ? (JSON.parse(JSON.stringify(finding.metadata)) as Prisma.InputJsonValue) : undefined,
            detectedAt: now,
          });
          newCount++;
        }
      }

      // Batch create new insights with duplicate protection
      if (toCreate.length > 0) {
        for (let i = 0; i < toCreate.length; i += 100) {
          const chunk = toCreate.slice(i, i + 100);
          await prisma.occupancyInsight.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        }
      }

      // Concurrently update existing findings in small batches to stay well within DB pool limits
      const UPDATE_CONCURRENCY = 20;
      for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
        const batch = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
        await Promise.all(
          batch.map((item) =>
            prisma.occupancyInsight.update({
              where: { id: item.id },
              data: item.data,
            })
          )
        );
      }

      // Auto-resolve OPEN or REVIEWED insights whose issue is no longer present via batch updateMany
      const toResolveIds = existingInsights
        .filter(
          (e) =>
            (e.status === 'OPEN' || e.status === 'REVIEWED') &&
            !detectedFingerprints.has(e.fingerprint)
        )
        .map((e) => e.id);

      let autoResolvedCount = 0;
      if (toResolveIds.length > 0) {
        for (let i = 0; i < toResolveIds.length; i += 200) {
          const chunk = toResolveIds.slice(i, i + 200);
          const res = await prisma.occupancyInsight.updateMany({
            where: {
              organizationId,
              id: { in: chunk },
            },
            data: {
              status: 'RESOLVED',
              resolvedAt: now,
            },
          });
          autoResolvedCount += res.count;
        }
      }

      // Update profile lastCheckAt
      await prisma.organizationOccupancyAIProfile.updateMany({
        where: { organizationId },
        data: { lastCheckAt: now },
      });

      // Calculate summary
      const byType: Record<OccupancyInsightType, number> = {
        DOUBLE_BOOKING: 0,
        STATUS_MISMATCH: 0,
        EXPIRED_OCCUPANCY: 0,
        OFFER_CONFLICT: 0,
        EXPIRING_CAMPAIGN: 0,
        UNDERUTILIZED_MEDIA: 0,
        CALENDAR_GAP: 0,
        MISSING_DATA: 0,
      };

      let critical = 0;
      let high = 0;
      let medium = 0;
      let low = 0;
      let info = 0;

      for (const f of rawFindings) {
        byType[f.type] = (byType[f.type] || 0) + 1;
        if (f.severity === 'CRITICAL') critical++;
        else if (f.severity === 'HIGH') high++;
        else if (f.severity === 'MEDIUM') medium++;
        else if (f.severity === 'LOW') low++;
        else if (f.severity === 'INFO') info++;
      }

      return {
        organizationId,
        checkedSurfaces: surfaceIds.length,
        checkedOccupancies: allOccupancies.length,
        openInsights: rawFindings.length,
        newInsights: newCount,
        autoResolvedInsights: autoResolvedCount,
        critical,
        high,
        medium,
        low,
        info,
        byType,
        scannedAt: now.toISOString(),
      };
    }
  );
}

/**
 * Executes a 1-click user-approved action for an insight.
 * Changes database state deterministically and writes an audit log.
 */
export async function executeInsightAction(
  organizationId: string,
  insightId: string,
  action: 'SYNC_STATUS' | 'FINISH_EXPIRED_OCCUPANCY' | 'IGNORE' | string,
  user: { id: string; name?: string | null; email?: string | null }
): Promise<{ success: boolean; message: string }> {
  return runWithTenantContext(
    {
      organizationId,
      userId: user.id,
      source: 'session',
    },
    async () => {
      const insight = await prisma.occupancyInsight.findFirst({
        where: { id: insightId, organizationId },
        include: {
          surface: true,
        },
      });

      if (!insight) {
        throw new Error('Nález nebyl nalezen v dané organizaci.');
      }

      if (action === 'IGNORE') {
        await prisma.occupancyInsight.update({
          where: { id: insightId },
          data: {
            status: 'IGNORED',
            resolvedAt: new Date(),
            resolvedByUserId: user.id,
          },
        });

        // Write audit log
        await prisma.crmAuditLog.create({
          data: {
            organizationId,
            userId: user.id,
            userEmail: user.email || 'unknown',
            action: 'OCCUPANCY_INSIGHT_IGNORE',
            entityType: 'OccupancyInsight',
            entityId: insightId,
            detailsJson: JSON.stringify({ fingerprint: insight.fingerprint, type: insight.type }),
          },
        });

        return { success: true, message: 'Nález byl označen jako ignorovaný.' };
      }

      if (action === 'SYNC_STATUS') {
        if (!insight.surfaceId) {
          throw new Error('Nález nemá přiřazenou plochu.');
        }

        const occupancies = await prisma.occupancy.findMany({
          where: { surfaceId: insight.surfaceId },
          select: { id: true, clientId: true, status: true, dateFrom: true, dateTo: true },
        });

        const derived = getSurfaceAvailabilityState(occupancies, new Date());

        await prisma.advertisingSurface.update({
          where: { id: insight.surfaceId },
          data: {
            status: derived.status,
            currentClientId: derived.currentClientId,
            currentRentStart: derived.currentRentStart,
            currentRentEnd: derived.currentRentEnd,
          },
        });

        await prisma.occupancyInsight.update({
          where: { id: insightId },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedByUserId: user.id,
          },
        });

        await prisma.crmAuditLog.create({
          data: {
            organizationId,
            userId: user.id,
            userEmail: user.email || 'unknown',
            action: 'OCCUPANCY_INSIGHT_SYNC_STATUS',
            entityType: 'AdvertisingSurface',
            entityId: insight.surfaceId,
            detailsJson: JSON.stringify({ derivedStatus: derived.status, surfaceId: insight.surfaceId }),
          },
        });

        return { success: true, message: `Stav plochy byl úspěšně synchronizován na '${derived.status}'.` };
      }

      if (action === 'FINISH_EXPIRED_OCCUPANCY') {
        if (!insight.occupancyId) {
          throw new Error('Nález nemá přiřazený záznam obsazenosti.');
        }

        await prisma.occupancy.update({
          where: { id: insight.occupancyId },
          data: {
            status: 'FINISHED',
          },
        });

        // Also sync surface state
        if (insight.surfaceId) {
          const occupancies = await prisma.occupancy.findMany({
            where: { surfaceId: insight.surfaceId },
            select: { id: true, clientId: true, status: true, dateFrom: true, dateTo: true },
          });
          const derived = getSurfaceAvailabilityState(occupancies, new Date());
          await prisma.advertisingSurface.update({
            where: { id: insight.surfaceId },
            data: {
              status: derived.status,
              currentClientId: derived.currentClientId,
            },
          });
        }

        await prisma.occupancyInsight.update({
          where: { id: insightId },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedByUserId: user.id,
          },
        });

        await prisma.crmAuditLog.create({
          data: {
            organizationId,
            userId: user.id,
            userEmail: user.email || 'unknown',
            action: 'OCCUPANCY_INSIGHT_FINISH_CAMPAIGN',
            entityType: 'Occupancy',
            entityId: insight.occupancyId,
            detailsJson: JSON.stringify({ occupancyId: insight.occupancyId, surfaceId: insight.surfaceId }),
          },
        });

        return { success: true, message: 'Kampaň byla úspěšně označena jako ukončená (FINISHED).' };
      }

      throw new Error(`Neznámá akce: ${action}`);
    }
  );
}
