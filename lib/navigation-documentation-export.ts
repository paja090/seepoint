import type { SnapshotItemData } from './navigation-documentation';

/**
 * Downloads a file/blob directly in the browser
 */
export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Generates and downloads a standard GPX 1.1 file containing all navigation points and route
 */
export function exportPointsToGpx(options: {
  reportTitle: string;
  clientName: string;
  items: SnapshotItemData[];
  fileName?: string;
}) {
  const { reportTitle, clientName, items, fileName } = options;
  const validPoints = items.filter(
    (i) => i.latitude !== null && i.longitude !== null && (i.latitude !== 0 || i.longitude !== 0),
  );

  if (validPoints.length === 0) {
    alert('V tomto reportu nejsou žádné body se zadanými GPS souřadnicemi.');
    return;
  }

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SeePOINT Outdoor Navigation Portal - https://seepoint.cz"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(`${clientName} - ${reportTitle}`)}</name>
    <desc>Trasa a body navigačních nosičů SeePOINT pro klienta ${escapeXml(clientName)}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>`;

  const waypoints = validPoints
    .map(
      (item, index) => `  <wpt lat="${item.latitude}" lon="${item.longitude}">
    <name>${escapeXml(item.pointCode || `Bod ${index + 1}`)}</name>
    <desc>${escapeXml([item.city, item.address, item.direction ? `Směr: ${item.direction}` : null].filter(Boolean).join(' · '))}</desc>
    <type>Navigační nosič</type>
  </wpt>`,
    )
    .join('\n');

  const routePoints = validPoints
    .map(
      (item, index) => `    <rtept lat="${item.latitude}" lon="${item.longitude}">
      <name>${index + 1}. ${escapeXml(item.pointCode)}</name>
    </rtept>`,
    )
    .join('\n');

  const route = `  <rte>
    <name>${escapeXml(`Trasa navigací - ${clientName}`)}</name>
${routePoints}
  </rte>`;

  const gpxContent = `${gpxHeader}\n${waypoints}\n${route}\n</gpx>`;
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });

  const safeClient = clientName.toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  const targetName = fileName || `Trasa-navigaci-${safeClient}.gpx`;
  triggerBlobDownload(blob, targetName);
}

/**
 * Builds Google Maps URL with the sequence of navigation points
 */
export function getGoogleMapsRouteUrl(items: SnapshotItemData[]): string | null {
  const valid = items.filter(
    (i) => i.latitude !== null && i.longitude !== null && (i.latitude !== 0 || i.longitude !== 0),
  );

  if (valid.length === 0) return null;

  if (valid.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${valid[0].latitude},${valid[0].longitude}`;
  }

  const origin = `${valid[0].latitude},${valid[0].longitude}`;
  const destination = `${valid[valid.length - 1].latitude},${valid[valid.length - 1].longitude}`;

  // Google Maps supports up to ~9 intermediate waypoints in URL query
  const intermediateWaypoints = valid.slice(1, -1).slice(0, 9);
  const waypointsParam =
    intermediateWaypoints.length > 0
      ? `&waypoints=${intermediateWaypoints.map((w) => `${w.latitude},${w.longitude}`).join('%7C')}`
      : '';

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}&travelmode=driving`;
}

/**
 * Exports the visible Leaflet map container to high-resolution PNG with branding header
 */
export async function exportMapToPng(options: {
  mapElement: HTMLElement;
  leafletMap: unknown; // L.Map instance
  title: string;
  clientName: string;
  period: string;
  items: SnapshotItemData[];
  fileName?: string;
}): Promise<void> {
  const { mapElement, leafletMap, title, clientName, period, items, fileName } = options;

  const validPoints = items.filter(
    (i) => i.latitude !== null && i.longitude !== null && (i.latitude !== 0 || i.longitude !== 0),
  );

  const rect = mapElement.getBoundingClientRect();
  const mapWidth = Math.max(800, Math.round(rect.width));
  const mapHeight = Math.max(500, Math.round(rect.height));

  const headerHeight = 90;
  const footerHeight = validPoints.length > 0 ? 50 : 20;
  const totalWidth = mapWidth;
  const totalHeight = headerHeight + mapHeight + footerHeight;

  const canvas = document.createElement('canvas');
  // High-dpi scale factor
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = totalWidth * dpr;
  canvas.height = totalHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Nelze vytvořit grafický kontext canvas.');

  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // 1. Draw Header
  ctx.fillStyle = '#020617'; // slate-950
  ctx.fillRect(0, 0, totalWidth, headerHeight);

  // Bottom border of header
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(totalWidth, headerHeight);
  ctx.stroke();

  // Logo text / Brand
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#009EE2'; // SeePOINT cyan
  ctx.fillText('SeePOINT', 24, 38);

  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8'; // slate-400
  ctx.fillText('FOTODOKUMENTACE & MAPA NAVIGAČNÍCH NOSIČŮ', 24, 56);

  // Client info on right side
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(clientName, totalWidth - 24, 36);

  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#38bdf8'; // sky-400
  ctx.fillText(`${title} · ${period}`, totalWidth - 24, 56);
  ctx.textAlign = 'left';

  // 2. Draw Leaflet Tiles onto Map Area
  ctx.save();
  ctx.translate(0, headerHeight);

  let tilesDrawnSuccessfully = false;
  try {
    const tileImages = Array.from(mapElement.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img'));

    // Clip to map area
    ctx.beginPath();
    ctx.rect(0, 0, mapWidth, mapHeight);
    ctx.clip();

    // Map background fill before tiles
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    for (const img of tileImages) {
      if (!img.complete || img.naturalWidth === 0) continue;
      const imgRect = img.getBoundingClientRect();
      const x = imgRect.left - rect.left;
      const y = imgRect.top - rect.top;
      ctx.drawImage(img, x, y, imgRect.width, imgRect.height);
    }
    tilesDrawnSuccessfully = true;
  } catch (err) {
    console.warn('[exportMapToPng] Chyba při přenosu tiles z Leafletu, použije se vektorové plátno:', err);
  }

  if (!tilesDrawnSuccessfully) {
    // Elegant fallback grid
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, mapWidth, mapHeight);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < mapWidth; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mapHeight);
      ctx.stroke();
    }
    for (let y = 0; y < mapHeight; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mapWidth, y);
      ctx.stroke();
    }
  }

  // 3. Draw Points & Connecting Route Lines
  const lMap = leafletMap as {
    latLngToContainerPoint?: (coords: [number, number]) => { x: number; y: number };
  };

  const pointCoords: Array<{ x: number; y: number; item: SnapshotItemData; index: number }> = [];

  if (typeof lMap?.latLngToContainerPoint === 'function') {
    validPoints.forEach((item, index) => {
      const p = lMap.latLngToContainerPoint!([item.latitude!, item.longitude!]);
      pointCoords.push({ x: p.x, y: p.y, item, index: index + 1 });
    });
  }

  // Draw connecting route line if >= 2 points
  if (pointCoords.length >= 2) {
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pointCoords[0].x, pointCoords[0].y);
    for (let i = 1; i < pointCoords.length; i++) {
      ctx.lineTo(pointCoords[i].x, pointCoords[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw Markers
  pointCoords.forEach(({ x, y, item, index }) => {
    // Outer glow
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Sequence Number
    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index), x, y);

    // Callout Label box above point
    const label = item.pointCode || `Bod ${index}`;
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const boxW = textWidth + 12;
    const boxH = 18;
    const boxX = x - boxW / 2;
    const boxY = y - 24;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, x, boxY + boxH / 2);
  });

  ctx.restore();

  // 4. Draw Footer
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, headerHeight + mapHeight, totalWidth, footerHeight);

  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(
    `Celkem ${validPoints.length} navigačních nosičů · Exportováno: ${new Date().toLocaleDateString('cs-CZ')}`,
    24,
    headerHeight + mapHeight + footerHeight / 2,
  );

  ctx.textAlign = 'right';
  ctx.fillText('© SeePOINT s.r.o. · www.seepoint.cz', totalWidth - 24, headerHeight + mapHeight + footerHeight / 2);

  // Convert to Blob and Download
  canvas.toBlob((blob) => {
    if (!blob) {
      alert('Nepodařilo se vygenerovat obrázek mapy.');
      return;
    }
    const safeClient = clientName.toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const outName = fileName || `Mapa-navigaci-${safeClient}.png`;
    triggerBlobDownload(blob, outName);
  }, 'image/png');
}
