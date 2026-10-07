import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGoogleMyMapsKml,
  detectMediaTypeFromText,
  resolveLayerMediaType,
  CZECH_BOUNDS,
} from '../lib/election-removal/kml-parser';

test('detectMediaTypeFromText: detects common Czech terms', () => {
  assert.equal(detectMediaTypeFromText('Áčka'), 'ACKO');
  assert.equal(detectMediaTypeFromText('A-stojany centrum'), 'ACKO');
  assert.equal(detectMediaTypeFromText('Velké Towery'), 'TOWER');
  assert.equal(detectMediaTypeFromText('Mini Tower Brno'), 'MINI_TOWER');
  assert.equal(detectMediaTypeFromText('Bannery na plotech'), 'BANNER');
  assert.equal(detectMediaTypeFromText('Plotová reklama'), 'PLOT');
  assert.equal(detectMediaTypeFromText('Lavičky MHD'), 'BENCH');
  assert.equal(detectMediaTypeFromText('City Postery nádraží'), 'CITY_POSTER');
  assert.equal(detectMediaTypeFromText('Neznámá kategorie 123'), null);
});

test('resolveLayerMediaType: falls back to OTHER on unknown layer', () => {
  assert.equal(resolveLayerMediaType('Áčka'), 'ACKO');
  assert.equal(resolveLayerMediaType('Neznámá vrstva XYZ'), 'OTHER');
});

test('parseGoogleMyMapsKml: parses Google My Maps layers, placemarks, and coordinates correctly', () => {
  const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name><![CDATA[Senátní volby 2026 - Ostrava]]></name>
    <description>Volební kampaň</description>
    <Folder>
      <name>Áčka</name>
      <Placemark>
        <name>Bod 1 - Zastávka</name>
        <description><![CDATA[U přístřešku <b>MHD</b>]]></description>
        <Point>
          <coordinates>18.28204,49.82092,0</coordinates>
        </Point>
      </Placemark>
      <Placemark>
        <name>Bod 2 - Roh ulice</name>
        <Point>
          <coordinates>18.28300, 49.82100</coordinates>
        </Point>
      </Placemark>
    </Folder>
    <Folder>
      <name>Towery</name>
      <Placemark>
        <name>Tower Nádraží</name>
        <Point>
          <coordinates>18.26700,49.85100,0</coordinates>
        </Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

  const result = parseGoogleMyMapsKml(sampleKml);

  assert.equal(result.suggestedCampaignName, 'Senátní volby 2026 - Ostrava');
  assert.equal(result.layers.length, 2);
  assert.equal(result.layers[0].name, 'Áčka');
  assert.equal(result.layers[0].detectedMediaType, 'ACKO');
  assert.equal(result.layers[0].pointCount, 2);
  assert.equal(result.layers[0].defaultServiceMinutes, 5);

  assert.equal(result.layers[1].name, 'Towery');
  assert.equal(result.layers[1].detectedMediaType, 'TOWER');
  assert.equal(result.layers[1].pointCount, 1);
  assert.equal(result.layers[1].defaultServiceMinutes, 15);

  assert.equal(result.points.length, 3);

  // Placemark 1: lng=18.28204, lat=49.82092
  const p1 = result.points[0];
  assert.equal(p1.name, 'Bod 1 - Zastávka');
  assert.equal(p1.layerName, 'Áčka');
  assert.equal(p1.mediaType, 'ACKO');
  assert.equal(p1.quantity, 1);
  assert.equal(p1.serviceMinutes, 5);
  assert.equal(p1.longitude, 18.28204);
  assert.equal(p1.latitude, 49.82092);
  assert.equal(p1.isValid, true);
  assert.equal(p1.isOutsideCzechBounds, false);
  assert.equal(p1.description, 'U přístřešku MHD');

  // Placemark 3 (Tower)
  const p3 = result.points[2];
  assert.equal(p3.name, 'Tower Nádraží');
  assert.equal(p3.mediaType, 'TOWER');
  assert.equal(p3.serviceMinutes, 15);

  assert.equal(result.summary.totalPoints, 3);
  assert.equal(result.summary.validPoints, 3);
  assert.equal(result.summary.totalEstimatedMinutes, 25); // 5 + 5 + 15
});

test('parseGoogleMyMapsKml: binding rule - 2 placemarks at identical GPS remain separate points', () => {
  const duplicateGpsKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Kombinovaná stanoviště</name>
      <Placemark>
        <name>Áčko u vchodu</name>
        <Point>
          <coordinates>14.42000,50.08000,0</coordinates>
        </Point>
      </Placemark>
      <Placemark>
        <name>Tower u vchodu</name>
        <Point>
          <coordinates>14.42000,50.08000,0</coordinates>
        </Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

  const result = parseGoogleMyMapsKml(duplicateGpsKml);

  // Must NOT merge into 1 point!
  assert.equal(result.points.length, 2);
  assert.equal(result.points[0].latitude, 50.08);
  assert.equal(result.points[0].longitude, 14.42);
  assert.equal(result.points[0].quantity, 1);
  assert.equal(result.points[0].mediaType, 'ACKO'); // secondary Placemark name signal

  assert.equal(result.points[1].latitude, 50.08);
  assert.equal(result.points[1].longitude, 14.42);
  assert.equal(result.points[1].quantity, 1);
  assert.equal(result.points[1].mediaType, 'TOWER'); // secondary Placemark name signal

  // Distinct IDs
  assert.notEqual(result.points[0].id, result.points[1].id);
});

test('parseGoogleMyMapsKml: GPS coordinate validation and Czech bounds soft warning', () => {
  const boundsKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Bannery</name>
      <Placemark>
        <name>Platný bod v ČR</name>
        <Point><coordinates>14.4200,50.0800,0</coordinates></Point>
      </Placemark>
      <Placemark>
        <name>Bod v zahraničí (Vídeň)</name>
        <Point><coordinates>16.3738,48.2082,0</coordinates></Point>
      </Placemark>
      <Placemark>
        <name>Bod s neplatnou latitude</name>
        <Point><coordinates>14.4200,195.0000,0</coordinates></Point>
      </Placemark>
      <Placemark>
        <name>Bod bez souřadnic</name>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

  const result = parseGoogleMyMapsKml(boundsKml);

  assert.equal(result.summary.totalPoints, 4);
  assert.equal(result.summary.validPoints, 2);
  assert.equal(result.summary.invalidPoints, 2);
  assert.equal(result.summary.outsideCzechBoundsCount, 1);

  // Bod v ČR: valid, inside bounds
  assert.equal(result.points[0].isValid, true);
  assert.equal(result.points[0].isOutsideCzechBounds, false);

  // Bod ve Vídni: valid GPS, soft warning outside Czech bounds
  assert.equal(result.points[1].isValid, true);
  assert.equal(result.points[1].isOutsideCzechBounds, true);

  // Neplatná latitude: invalid
  assert.equal(result.points[2].isValid, false);
  assert.match(result.points[2].validationError || '', /mimo globální rozsah/);

  // Bez souřadnic: invalid
  assert.equal(result.points[3].isValid, false);
  assert.match(result.points[3].validationError || '', /chybí element <coordinates>/);
});
