export type AnalyticsOccupancyInput = {
  status: string;
  price: number | null;
};

export type AnalyticsContractInput = {
  status: string;
  startDate: Date;
  endDate: Date;
  monthlyPrice: number | null;
} | null;

export function deriveAnalyticsSurfaceState(input: {
  surfaceStatus: string;
  contract: AnalyticsContractInput;
  occupancies: AnalyticsOccupancyInput[];
  asOf: Date;
}) {
  const activeContract = input.contract
    && ['ACTIVE', 'EXPIRING'].includes(input.contract.status)
    && input.contract.startDate <= input.asOf
    && input.contract.endDate >= input.asOf
      ? input.contract
      : null;
  const activeOccupancy = input.occupancies.find((item) => ['OCCUPIED', 'RESERVED'].includes(item.status)) ?? null;
  const isOccupied = Boolean(activeContract || activeOccupancy || ['OCCUPIED', 'RESERVED'].includes(input.surfaceStatus));
  const contractPrice = activeContract?.monthlyPrice ?? null;
  const occupancyPrice = activeOccupancy?.price ?? null;
  const monthlyRent = contractPrice && contractPrice > 0
    ? contractPrice
    : occupancyPrice && occupancyPrice > 0
      ? occupancyPrice
      : null;

  return {
    isOccupied,
    monthlyRent,
    hasExplicitPrice: monthlyRent !== null,
  };
}
