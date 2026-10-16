export interface FormattedAlbumTitle {
  displayTitle: string;
  displayLocation?: string;
  displayPeriod?: string;
  shortClient?: string;
}

/**
 * Formats raw album titles into a clean, modern layout:
 * Headline: Client – Location (e.g. "BILLA – Ostrava" or "BILLA")
 * Badge: Period (e.g. "3. čtvrtletí 2026")
 */
export function formatAlbumDisplay(
  rawTitle: string,
  clientName?: string | null,
  periodFallback?: string | null
): FormattedAlbumTitle {
  // Strip redundant "Fotodokumentace" or "Fotoalbum" from the beginning
  const cleaned = (rawTitle || '').replace(/^(?:fotodokumentace|fotoalbum)\s*[-–—:]*\s*/i, '').trim();

  let period = periodFallback || '';
  let locationOrAction = '';

  // Match period like "– 3. čtvrtletí 2026", "2. čtvrtletí 2026", "Q3 2026", "10/2026"
  const periodMatch =
    cleaned.match(/[-–—]?\s*(\d+\.?\s*(?:čtvrtletí|kvartál|měsíc)\s*\d{4})/i) ||
    cleaned.match(/[-–—]?\s*(Q[1-4]\s*\/?\s*\d{4})/i) ||
    cleaned.match(/[-–—]?\s*(\d{1,2}\/\d{4})/i);

  if (periodMatch) {
    if (!period) {
      period = periodMatch[1].trim();
    }
    locationOrAction = cleaned.replace(periodMatch[0], '').trim();
  } else {
    locationOrAction = cleaned;
  }

  // Clean location punctuation
  locationOrAction = locationOrAction.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();

  // Clean legal form suffix from client name (e.g. "BILLA, spol. s r. o." -> "BILLA")
  const rawClient = (clientName || '').trim();
  const shortClient = rawClient
    .replace(/,\s*(?:spol\.\s*s\s*r\.\s*o\.|s\.r\.o\.|a\.s\.|v\.o\.s\.|z\.s\.|o\.p\.s\.)/i, '')
    .trim();

  let displayTitle = '';
  if (shortClient && locationOrAction) {
    // Avoid "BILLA – BILLA Ostrava"
    if (locationOrAction.toLowerCase().includes(shortClient.toLowerCase())) {
      displayTitle = locationOrAction;
    } else {
      displayTitle = `${shortClient} – ${locationOrAction}`;
    }
  } else if (shortClient) {
    displayTitle = shortClient;
  } else if (locationOrAction) {
    displayTitle = locationOrAction;
  } else {
    displayTitle = rawTitle || 'Fotoalbum';
  }

  return {
    displayTitle,
    displayLocation: locationOrAction || undefined,
    displayPeriod: period || undefined,
    shortClient: shortClient || undefined,
  };
}
