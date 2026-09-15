import { computeGoogleRoute } from '../google-maps';
import { estimatedLeg, type TravelProvider } from './planning-engine';
import type { PlanningProfile } from './contracts';

export function googleTravelProvider(profile: PlanningProfile): TravelProvider {
  return async (from, to) => {
    const route = await computeGoogleRoute(from, to);
    if (route.status === 'OK' && Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0 && Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0) {
      return { distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, polyline: route.polyline, estimated: false };
    }
    return estimatedLeg(from, to, profile);
  };
}
