export function isSurfaceDetailClientCurrent(surface: {
  hasCurrentClient: boolean;
  status: string;
  currentRentStart: Date | null;
  currentRentEnd: Date | null;
}, now: Date) {
  if (!surface.hasCurrentClient || surface.status === 'OUT_OF_SERVICE') return false;
  if (surface.currentRentStart && surface.currentRentStart > now) return false;
  if (surface.currentRentEnd && surface.currentRentEnd < now) return false;
  return true;
}
