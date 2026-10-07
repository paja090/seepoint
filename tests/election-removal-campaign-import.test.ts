import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGoogleMyMapsKml,
  detectMediaTypeFromText,
  resolveLayerMediaType,
} from '../lib/election-removal/kml-parser';
import {
  calculateServiceMinutes,
  DEFAULT_MEDIA_SERVICE_MINUTES,
  ELECTION_REMOVAL_MEDIA_LABELS,
} from '../lib/election-removal/constants';

test('KML import pipeline: full campaign parse, layer detection and override workflow', () => {
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name><![CDATA[Krajské volby 2026 - Morava]]></name>
    <description>Demontáž volebních nosičů</description>
    
    <!-- Vrstva 1: Áčka -->
    <Folder>
      <name>Áčka a stojany</name>
      <Placemark>
        <name>Náměstí Svobody 1</name>
        <description>U kašny, 1 ks</description>
        <Point><coordinates>16.6079,49.1951,0</coordinates></Point>
      </Placemark>
      <Placemark>
        <name>Náměstí Svobody 2 - Stejná GPS</name>
        <description>Druhá strana kašny</description>
        <Point><coordinates>16.6079,49.1951,0</coordinates></Point>
      </Placemark>
    </Folder>

    <!-- Vrstva 2: Velké Towery -->
    <Folder>
      <name>Towery</name>
      <Placemark>
        <name>Hlavní nádraží Tower</name>
        <Point><coordinates>16.6128,49.1906,0</coordinates></Point>
      </Placemark>
    </Folder>

    <!-- Vrstva 3: Bannery (zahraniční testovací bod na hranici) -->
    <Folder>
      <name>Bannery na plotech</name>
      <Placemark>
        <name>Plot u dálnice</name>
        <Point><coordinates>16.5500,49.1800,0</coordinates></Point>
      </Placemark>
      <Placemark>
        <name>Příhraniční billboard (Rakousko)</name>
        <Point><coordinates>16.6000,48.1000,0</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

  // 1. Parse KML
  const parsed = parseGoogleMyMapsKml(kmlContent);

  assert.equal(parsed.suggestedCampaignName, 'Krajské volby 2026 - Morava');
  assert.equal(parsed.layers.length, 3);
  assert.equal(parsed.summary.totalPoints, 5);
  assert.equal(parsed.summary.validPoints, 5);
  assert.equal(parsed.summary.invalidPoints, 0);

  // Soft warning outside Czech bounds: 1 point (Rakousko lat 48.10 < 48.55)
  assert.equal(parsed.summary.outsideCzechBoundsCount, 1);

  // 2. Verify layer media type detection
  const ackaLayer = parsed.layers.find((l) => l.name === 'Áčka a stojany')!;
  assert.ok(ackaLayer);
  assert.equal(ackaLayer.detectedMediaType, 'ACKO');
  assert.equal(ackaLayer.defaultServiceMinutes, 5);
  assert.equal(ackaLayer.pointCount, 2);

  const towerLayer = parsed.layers.find((l) => l.name === 'Towery')!;
  assert.ok(towerLayer);
  assert.equal(towerLayer.detectedMediaType, 'TOWER');
  assert.equal(towerLayer.defaultServiceMinutes, 15);
  assert.equal(towerLayer.pointCount, 1);

  const bannerLayer = parsed.layers.find((l) => l.name === 'Bannery na plotech')!;
  assert.ok(bannerLayer);
  assert.equal(bannerLayer.detectedMediaType, 'BANNER');
  assert.equal(bannerLayer.defaultServiceMinutes, 10);
  assert.equal(bannerLayer.pointCount, 2);

  // 3. Verify duplicate GPS binding rule: 2 Placemarks at same GPS = 2 distinct items, quantity 1
  const sameGpsPoints = parsed.points.filter((p) => p.layerName === 'Áčka a stojany');
  assert.equal(sameGpsPoints.length, 2);
  assert.equal(sameGpsPoints[0].latitude, sameGpsPoints[1].latitude);
  assert.equal(sameGpsPoints[0].longitude, sameGpsPoints[1].longitude);
  assert.equal(sameGpsPoints[0].quantity, 1);
  assert.equal(sameGpsPoints[1].quantity, 1);
  assert.notEqual(sameGpsPoints[0].id, sameGpsPoints[1].id);
  assert.equal(sameGpsPoints[0].name, 'Náměstí Svobody 1');
  assert.equal(sameGpsPoints[1].name, 'Náměstí Svobody 2 - Stejná GPS');

  // 4. Test Manager Layer Override Simulation:
  // Suppose manager changes "Bannery na plotech" -> mediaType: PLOT, minutes: 12
  const managerOverrides = {
    'Bannery na plotech': {
      mediaType: 'PLOT' as const,
      serviceMinutes: 12,
    },
  };

  const adjustedPoints = parsed.points.map((pt) => {
    const override = managerOverrides[pt.layerName as keyof typeof managerOverrides];
    const mediaType = override ? override.mediaType : pt.mediaType;
    const baseMinutes = override ? override.serviceMinutes : pt.serviceMinutes;
    return {
      ...pt,
      mediaType,
      serviceMinutes: baseMinutes * pt.quantity,
    };
  });

  const adjustedBannerPoints = adjustedPoints.filter((p) => p.layerName === 'Bannery na plotech');
  assert.equal(adjustedBannerPoints.length, 2);
  assert.equal(adjustedBannerPoints[0].mediaType, 'PLOT');
  assert.equal(adjustedBannerPoints[0].serviceMinutes, 12);
  assert.equal(adjustedBannerPoints[1].mediaType, 'PLOT');
  assert.equal(adjustedBannerPoints[1].serviceMinutes, 12);

  // Total planned service time with overrides:
  // Áčka: 2 × 5 min = 10 min
  // Tower: 1 × 15 min = 15 min
  // Plot: 2 × 12 min = 24 min
  // Sum = 49 min
  const totalAdjustedMinutes = adjustedPoints.reduce((acc, p) => acc + p.serviceMinutes, 0);
  assert.equal(totalAdjustedMinutes, 49);
});
