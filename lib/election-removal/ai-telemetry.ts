import type { ElectionRemovalMediaType } from '@prisma/client';
import {
  DEFAULT_MEDIA_SERVICE_MINUTES,
  DEFAULT_BANNER_CHANGE_SERVICE_MINUTES,
  DEFAULT_RELOCATION_SERVICE_MINUTES,
  ELECTION_REMOVAL_MEDIA_LABELS,
  type ElectionRemovalOperationType,
} from './constants';
import { detectOperationTypeFromText } from './kml-parser';

export interface PointTelemetry {
  pointId: string;
  mediaType: ElectionRemovalMediaType;
  operationType: ElectionRemovalOperationType;
  plannedMinutes: number;
  actualMinutes: number | null;
  startedAt: string | null;
  completedAt: string | null;
  diffMinutes: number | null;
  isOutlier: boolean;
}

export interface MediaTelemetryAggregate {
  mediaType: ElectionRemovalMediaType;
  mediaLabel: string;
  operationType: ElectionRemovalOperationType;
  completedCount: number;
  plannedMinutesAvg: number;
  actualMinutesAvg: number;
  actualMinutesMedian: number;
  savedMinutesTotal: number;
  recommendedServiceMinutes: number;
}

export interface CampaignTelemetryReport {
  campaignId: string;
  totalCompletedWithTimes: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  totalDiffMinutes: number;
  efficiencyPercent: number; // e.g. 115% means 15% faster than planned
  aggregates: MediaTelemetryAggregate[];
  aiSummary: string;
  recommendedCalibration: Record<string, number>;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

/**
 * Calculates execution telemetry for a single point.
 */
export function calculatePointTelemetry(point: {
  id: string;
  mediaType: ElectionRemovalMediaType;
  serviceMinutes: number;
  layerName?: string | null;
  description?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}): PointTelemetry {
  const rawText = `${point.layerName || ''} ${point.description || ''}`;
  const operationType: ElectionRemovalOperationType = detectOperationTypeFromText(rawText);

  let actualMinutes: number | null = null;
  let diffMinutes: number | null = null;
  let isOutlier = false;

  if (point.startedAt && point.completedAt) {
    const diffMs = new Date(point.completedAt).getTime() - new Date(point.startedAt).getTime();
    const rawMins = Math.max(1, Math.round(diffMs / 60000));
    actualMinutes = rawMins;
    diffMinutes = rawMins - point.serviceMinutes;

    // Filter outliers (unrealistic times like forgotten tasks > 120 min or rapid clicks < 1 min)
    if (rawMins > 120 || rawMins < 1) {
      isOutlier = true;
    }
  }

  return {
    pointId: point.id,
    mediaType: point.mediaType,
    operationType,
    plannedMinutes: point.serviceMinutes,
    actualMinutes,
    startedAt: point.startedAt ? new Date(point.startedAt).toISOString() : null,
    completedAt: point.completedAt ? new Date(point.completedAt).toISOString() : null,
    diffMinutes,
    isOutlier,
  };
}

/**
 * Generates an end-to-end telemetry and AI calibration report for a campaign.
 */
export function analyzeCampaignTelemetry(points: Array<{
  id: string;
  mediaType: ElectionRemovalMediaType;
  serviceMinutes: number;
  layerName?: string | null;
  description?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  status: string;
}>): CampaignTelemetryReport {
  const telemetries = points
    .filter((p) => p.status === 'COMPLETED' && p.startedAt && p.completedAt)
    .map(calculatePointTelemetry);

  const validPoints = telemetries.filter((t) => !t.isOutlier && t.actualMinutes !== null);

  // Group by mediaType and operationType
  const groups = new Map<string, typeof validPoints>();
  for (const item of validPoints) {
    const key = `${item.mediaType}:${item.operationType}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  const aggregates: MediaTelemetryAggregate[] = [];
  const recommendedCalibration: Record<string, number> = {};

  let totalPlannedMinutes = 0;
  let totalActualMinutes = 0;

  for (const [key, items] of groups.entries()) {
    const [mediaTypeStr, opTypeStr] = key.split(':');
    const mediaType = mediaTypeStr as ElectionRemovalMediaType;
    const operationType = opTypeStr as ElectionRemovalOperationType;

    const actuals = items.map((i) => i.actualMinutes!);
    const planneds = items.map((i) => i.plannedMinutes);

    const sumActual = actuals.reduce((a, b) => a + b, 0);
    const sumPlanned = planneds.reduce((a, b) => a + b, 0);

    totalActualMinutes += sumActual;
    totalPlannedMinutes += sumPlanned;

    const avgActual = Math.round((sumActual / items.length) * 10) / 10;
    const avgPlanned = Math.round((sumPlanned / items.length) * 10) / 10;
    const medianActual = calculateMedian(actuals);

    // Recommendation: Round median to nearest integer (bounded between 2 and 60)
    const recommended = Math.max(2, Math.round(medianActual));
    recommendedCalibration[key] = recommended;

    aggregates.push({
      mediaType,
      mediaLabel: ELECTION_REMOVAL_MEDIA_LABELS[mediaType] ?? mediaType,
      operationType,
      completedCount: items.length,
      plannedMinutesAvg: avgPlanned,
      actualMinutesAvg: avgActual,
      actualMinutesMedian: medianActual,
      savedMinutesTotal: sumPlanned - sumActual,
      recommendedServiceMinutes: recommended,
    });
  }

  const totalDiff = totalPlannedMinutes - totalActualMinutes;
  const efficiencyPercent =
    totalPlannedMinutes > 0
      ? Math.round((totalPlannedMinutes / Math.max(1, totalActualMinutes)) * 100)
      : 100;

  // Build AI Summary in Czech
  let aiSummary = '';
  if (validPoints.length === 0) {
    aiSummary = 'Zatím nebyly zaznamenány žádné dokončené demontáže s naměřeným časem začátku a konce. Po dokončení prvních bodů v terénu zde AI vyhodnotí reálnou rychlost týmu.';
  } else {
    const fastest = aggregates.filter((a) => a.savedMinutesTotal > 0);
    const slower = aggregates.filter((a) => a.savedMinutesTotal < 0);

    const summaryParts: string[] = [];
    if (totalDiff > 0) {
      summaryParts.push(
        `Práce v terénu probíhá o ${totalDiff} minut rychleji než byl původní plán (efektivita ${efficiencyPercent} %).`
      );
    } else if (totalDiff < 0) {
      summaryParts.push(
        `Práce v terénu nabírá zpoždění o ${Math.abs(totalDiff)} minut oproti plánu.`
      );
    } else {
      summaryParts.push('Práce v terénu přesně odpovídá původním časovým normám.');
    }

    if (fastest.length > 0) {
      const topFast = fastest[0];
      summaryParts.push(
        `Největší časová úspora byla u ${topFast.mediaLabel} (reálný medián ${topFast.actualMinutesMedian} min oproti plánu ${topFast.plannedMinutesAvg} min).`
      );
    }

    if (slower.length > 0) {
      const topSlow = slower[0];
      summaryParts.push(
        `Nejvýraznější zdržení nastalo u ${topSlow.mediaLabel} (reálný medián ${topSlow.actualMinutesMedian} min oproti plánu ${topSlow.plannedMinutesAvg} min).`
      );
    }

    aiSummary = summaryParts.join(' ');
  }

  return {
    campaignId: '',
    totalCompletedWithTimes: validPoints.length,
    totalPlannedMinutes,
    totalActualMinutes,
    totalDiffMinutes: totalDiff,
    efficiencyPercent,
    aggregates,
    aiSummary,
    recommendedCalibration,
  };
}
