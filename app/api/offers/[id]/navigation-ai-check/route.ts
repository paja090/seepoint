import { NextResponse } from 'next/server';
import type { NavigationArrowDirection } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { computeGoogleRoute } from '@/lib/google-maps';
import {
  inferArrowDirectionFromRoute,
  formatNavigationPointDetails,
  type ArrowDirection,
} from '@/lib/ai-offers/route-direction-helper';
import { formatNavigationPositionName } from '@/lib/navigation/navigation-naming';
import { evaluateNavigationZoning } from '@/lib/ai-offers/navigation-constraints';
import { canAccessOffer } from '@/lib/offers/domain';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const offer = await prisma.offer.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: {
        navigationOffer: {
          include: {
            points: { orderBy: { sortOrder: 'asc' } },
            targets: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!offer || !offer.navigationOffer) {
      return NextResponse.json({ error: 'Navigační nabídka nebyla nalezena.' }, { status: 404 });
    }

    if (!canAccessOffer(auth, offer.createdByUserId)) {
      return NextResponse.json({ error: 'Nemáte přístup k této nabídce.' }, { status: 403 });
    }

    const nav = offer.navigationOffer;
    const points = nav.points;
    if (points.length === 0) {
      return NextResponse.json({ ok: true, message: 'Nabídka nemá žádné navigační body.', updatedCount: 0 });
    }

    // Targets list
    const targets = nav.targets.length > 0
      ? nav.targets
      : nav.targetLatitude && nav.targetLongitude
      ? [
          {
            id: 'target-1',
            name: nav.targetName,
            address: nav.targetAddress,
            latitude: nav.targetLatitude,
            longitude: nav.targetLongitude,
          },
        ]
      : [];

    if (targets.length === 0) {
      return NextResponse.json({ error: 'Cíl navigace nemá nastavené platné GPS souřadnice.' }, { status: 400 });
    }

    const reqReferer = request.headers.get('referer') || request.headers.get('origin') || undefined;
    const city = nav.city || 'Ostrava';
    const zoningWarnings: Array<{ pointId: string; label: string; reason: string; badge: string }> = [];

    const updatedPoints = await Promise.all(
      points.map(async (point, index) => {
        const ptTarget =
          targets.find((t) => t.id === point.navigationTargetId) || targets[0];

        if (!ptTarget?.latitude || !ptTarget?.longitude) {
          return point;
        }

        // 1. Driving route calculation via Google Routes API (or OSRM fallback)
        const origin = { latitude: point.latitude, longitude: point.longitude };
        const dest = { latitude: ptTarget.latitude, longitude: ptTarget.longitude };
        const route = await computeGoogleRoute(origin, dest, 'DRIVING', reqReferer);

        const routePolyline = route.polyline || point.routePolyline;
        const roundedDist = route.distanceMeters > 0
          ? Math.max(50, Math.round(route.distanceMeters / 50) * 50)
          : point.calculatedDistanceMeters;

        // 2. Truthful arrow direction from geometry
        let arrowDir: NavigationArrowDirection = point.arrowDirectionEnum || 'STRAIGHT';
        let turnText: 'vpravo' | 'vlevo' | 'rovně' = 'rovně';
        let turnVerb = 'Pokračovat rovně';
        if (routePolyline) {
          const inferred = inferArrowDirectionFromRoute(origin, dest, routePolyline);
          arrowDir = inferred.arrowDirection as NavigationArrowDirection;
          turnText = inferred.turnText;
          turnVerb = inferred.turnVerb;
        }

        // 3. Municipal zoning evaluation
        const streetPart = point.address ? point.address.split(',')[0]?.trim() : city;
        const zoning = evaluateNavigationZoning({
          latitude: point.latitude,
          longitude: point.longitude,
          addressText: point.address || streetPart,
          city,
        });
        if (!zoning.isAllowed) {
          zoningWarnings.push({
            pointId: point.id,
            label: point.label,
            reason: zoning.reason,
            badge: zoning.badge,
          });
        }

        // 4. Canonical position title with real distance & truthful direction
        const canonicalLabel = formatNavigationPositionName({
          positionNumber: index + 1,
          street: streetPart,
          city,
          distanceMeters: roundedDist || undefined,
          direction: turnText,
        });

        // 5. Circuit tier & details
        const simpleArrow: ArrowDirection =
          arrowDir === 'LEFT' || arrowDir === 'SLANTED_LEFT'
            ? 'LEFT'
            : arrowDir === 'RIGHT' || arrowDir === 'SLANTED_RIGHT'
            ? 'RIGHT'
            : 'STRAIGHT';

        const circuit = (roundedDist || 1000) <= 750 ? 'INNER' : 'OUTER';
        const details = formatNavigationPointDetails({
          circuit,
          streetPart,
          arrowDirection: simpleArrow,
          turnText,
          turnVerb,
          distanceMeters: roundedDist || 0,
          zoning,
          index: index + 1,
        });

        const circuitBadge = circuit === 'INNER' ? '🔵 Vnitřní okruh (dojezd)' : '🟣 Vnější okruh (hlavní tah)';
        const updatedClientNote = point.clientNote && !point.clientNote.includes('okruh')
          ? `${circuitBadge}: ${point.clientNote} · ${details.reasons[1]}`
          : details.reasons.join(' · ');

        // 6. Update in database
        const updated = await prisma.navigationPoint.update({
          where: { id: point.id },
          data: {
            calculatedDistanceMeters: roundedDist ?? undefined,
            routeDistanceMeters: roundedDist ?? undefined,
            routeDurationSeconds: route.durationSeconds > 0 ? route.durationSeconds : undefined,
            routePolyline: routePolyline || undefined,
            routeProvider: 'GOOGLE_ROUTES',
            routeCalculatedAt: new Date(),
            routeStatus: 'OK',
            arrowDirectionEnum: arrowDir,
            label: canonicalLabel,
            clientNote: updatedClientNote,
            targetLatitude: ptTarget.latitude,
            targetLongitude: ptTarget.longitude,
          },
        });

        return updated;
      })
    );

    return NextResponse.json({
      ok: true,
      updatedCount: updatedPoints.length,
      zoningWarnings,
      message: zoningWarnings.length > 0
        ? `AI zkontrolovala ${updatedPoints.length} bodů. Pozor: ${zoningWarnings.length} bodů leží v regulované nebo historické zóně.`
        : `Všech ${updatedPoints.length} bodů bylo úspěšně zkontrolováno a aktualizováno podle pravdy.`,
    });
  } catch (error) {
    console.error('[POST /api/offers/[id]/navigation-ai-check] failed:', error);
    return NextResponse.json(
      { error: 'AI kontrola tras a směrových rčení selhala.' },
      { status: 500 }
    );
  }
}
