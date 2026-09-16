/** Reject trip distances, unreadable results and invented/malformed values. */
export function validOdometer(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000_000;
}
