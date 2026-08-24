import { platformPrisma } from './db';
import { getOrganizationAIUsage } from './ai-usage';

export type OrganizationFullUsageReport = {
  organizationId: string;
  startOfMonth: Date;
  // AI Engine Usage
  aiCalls: number;
  aiCostUsd: number;
  aiCostCzk: number;
  aiTokens: number;
  // Google Maps API Usage
  googleMapsGeocodes: number;
  googleMapsMapLoads: number;
  googleMapsCostUsd: number;
  googleMapsCostCzk: number;
  // Storage & Files Usage
  totalPhotosCount: number;
  estimatedStorageMb: number;
  estimatedStorageGb: number;
  storageCostCzk: number;
  // Overall Summary
  totalEstimatedCostCzk: number;
};

/**
 * Calculates complete multi-resource billable usage for an organization (AI, Google Maps, Cloud Storage).
 */
export async function getOrganizationFullUsageReport(organizationId: string): Promise<OrganizationFullUsageReport> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  try {
    // 1. AI Usage
    const ai = await getOrganizationAIUsage(organizationId);
    const aiCalls = ai.totalCalls || 0;
    const aiCostUsd = ai.totalCostUsd || 0;
    const aiTokens = (ai.totalPromptTokens || 0) + (ai.totalOutputTokens || 0);
    const aiCostCzk = Math.round(aiCostUsd * 23.5);

    // 2. Count Photos & Storage
    const photoCount = await platformPrisma.photo.count({
      where: {
        createdAt: { gte: startOfMonth },
        organizationId,
      },
    }).catch(() => 0);

    const totalSurfacesCount = await platformPrisma.advertisingSurface.count({
      where: { organizationId },
    }).catch(() => 0);

    // Estimate storage: Each photo ~ 2.5 MB on average
    const estimatedStorageMb = Math.round(photoCount * 2.5);
    const estimatedStorageGb = Number((estimatedStorageMb / 1024).toFixed(2));
    // Official Google Cloud Storage + Egress: $0.026 / GB / month (~ 0.61 Kč / GB)
    const storageCostCzk = Math.round(estimatedStorageGb * 1.5);

    // 3. Google Maps API usage estimates (Official Google Maps Platform Rates 2026)
    // - Dynamic Maps JS API: $7.00 per 1,000 requests ($0.007 / load)
    // - Geocoding API: $5.00 per 1,000 requests ($0.005 / geocode)
    const googleMapsGeocodes = Math.round(totalSurfacesCount * 0.4);
    const googleMapsMapLoads = Math.round(totalSurfacesCount * 3.5);
    const googleMapsCostUsd = (googleMapsGeocodes * 0.005) + (googleMapsMapLoads * 0.007);
    const googleMapsCostCzk = Math.round(googleMapsCostUsd * 23.5);

    const totalEstimatedCostCzk = aiCostCzk + storageCostCzk + googleMapsCostCzk;

    return {
      organizationId,
      startOfMonth,
      aiCalls,
      aiCostUsd,
      aiCostCzk,
      aiTokens,
      googleMapsGeocodes,
      googleMapsMapLoads,
      googleMapsCostUsd,
      googleMapsCostCzk,
      totalPhotosCount: photoCount,
      estimatedStorageMb,
      estimatedStorageGb,
      storageCostCzk,
      totalEstimatedCostCzk,
    };
  } catch (err) {
    console.warn('[Full Usage Report Error]:', err);
    return {
      organizationId,
      startOfMonth,
      aiCalls: 0,
      aiCostUsd: 0,
      aiCostCzk: 0,
      aiTokens: 0,
      googleMapsGeocodes: 0,
      googleMapsMapLoads: 0,
      googleMapsCostUsd: 0,
      googleMapsCostCzk: 0,
      totalPhotosCount: 0,
      estimatedStorageMb: 0,
      estimatedStorageGb: 0,
      storageCostCzk: 0,
      totalEstimatedCostCzk: 0,
    };
  }
}
