/** One deadline shared by retries; never restart the full timeout. */
export function radarRequestSignal(deadline: number, requestLimitMs = 30_000): AbortSignal {
  const remaining = Math.floor(deadline - Date.now());
  if (remaining <= 0) throw new Error('Časový limit radaru byl vyčerpán.');
  return AbortSignal.timeout(Math.min(remaining, requestLimitMs));
}
