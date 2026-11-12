import crypto from 'node:crypto';

export type BriefingEmailAction = 'ack' | 'complete' | 'reschedule';

export type BriefingAckPayload = {
  orgId: string;
  orderIds: string[];
  action?: BriefingEmailAction;
  userId?: string | null;
  employeeId?: string | null;
  workerName: string;
  email: string;
  exp: number; // unix epoch seconds
};

const CZECH_VOCATIVE_OVERRIDES: Record<string, string> = {
  pavel: 'Pavle',
  karel: 'Karle',
  marek: 'Marku',
  jiri: 'Jiří',
  jirka: 'Jirko',
  miroslav: 'Miroslave',
  mirek: 'Mirku',
  ondrej: 'Ondřeji',
  ondra: 'Ondro',
  tomas: 'Tomáši',
  tom: 'Tome',
  petr: 'Petře',
  peta: 'Péťo',
  lukas: 'Lukáši',
  jakub: 'Jakube',
  kuba: 'Kubo',
  martin: 'Martine',
  michal: 'Michale',
  misa: 'Míšo',
  david: 'Davide',
  jan: 'Jane',
  honza: 'Honzo',
  josef: 'Josefe',
  pepa: 'Pepo',
  frantisek: 'Františku',
  franta: 'Franto',
  vaclav: 'Václave',
  vasek: 'Vašku',
  zdenek: 'Zdeňku',
  radek: 'Radku',
  ales: 'Aleši',
  filip: 'Filipe',
  adam: 'Adame',
  daniel: 'Danieli',
  vojtech: 'Vojtěchu',
  vojta: 'Vojto',
  matej: 'Matěji',
  stepan: 'Štěpáne',
  patrik: 'Patriku',
  dominik: 'Dominiku',
  jaroslav: 'Jaroslave',
  jarda: 'Jardo',
  ladislav: 'Ladislave',
  lada: 'Láďo',
  stanislav: 'Stanislave',
  standa: 'Stando',
  roman: 'Romane',
  milan: 'Milane',
  vladimir: 'Vladimíre',
  vladimira: 'Vladimíro',
  vladka: 'Vlaďko',
  lenka: 'Lenko',
  zuzana: 'Zuzano',
  zuzka: 'Zuzko',
  katerina: 'Kateřino',
  katka: 'Katko',
  kacka: 'Kačko',
  tereza: 'Terezo',
  terka: 'Terko',
  silvie: 'Silvie',
  silva: 'Silvo',
  silvy: 'Silvi',
  jana: 'Jano',
  eva: 'Evo',
  lucie: 'Lucie',
  marketa: 'Markéto',
  hana: 'Hano',
  petra: 'Petro',
  veronika: 'Veroniko',
  klara: 'Kláro',
  anna: 'Anno',
  michaela: 'Michaelo',
};

function stripCzechDiacriticsLower(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function czechFirstNameVocative(firstName?: string | null): string {
  const clean = (firstName || '').trim().split(/\s+/)[0];
  if (!clean) return 'kolego';

  const normalized = stripCzechDiacriticsLower(clean);
  if (CZECH_VOCATIVE_OVERRIDES[normalized]) {
    return CZECH_VOCATIVE_OVERRIDES[normalized];
  }

  // Fallback Czech vocative inflection rules
  if (/[aeěiouyáéíóúůý]$/i.test(clean)) {
    if (/a$/i.test(clean)) return `${clean.slice(0, -1)}o`;
    return clean;
  }
  if (/ek$/i.test(clean)) return `${clean.slice(0, -2)}ku`;
  if (/el$/i.test(clean)) return `${clean.slice(0, -2)}le`;
  if (/[kgh]$/i.test(clean)) return `${clean}u`;
  if (/ch$/i.test(clean)) return `${clean}u`;
  if (/[šžčřcjďťň]$/i.test(clean)) return `${clean}i`;
  if (/r$/i.test(clean)) return `${clean.slice(0, -1)}ře`;

  return `${clean}e`;
}

function getSigningSecret(secretOverride?: string): string {
  if (secretOverride?.trim()) return secretOverride.trim();
  const envSecret =
    process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() ||
    process.env.OFFER_PORTAL_ACTIVE_KEY?.trim();

  if (envSecret) return envSecret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Chybí tajný klíč pro podepisování e-mailových potvrzení.');
  }
  return 'seepoint-dev-local-briefing-ack-secret';
}

const ALLOWED_BRIEFING_ACTIONS = new Set<BriefingEmailAction>(['ack', 'complete', 'reschedule']);

export function createBriefingAckToken(
  input: Omit<BriefingAckPayload, 'exp'> & { ttlDays?: number },
  secretOverride?: string
): string {
  const ttlSeconds = Math.max(1, input.ttlDays ?? 14) * 24 * 60 * 60;
  const payload: BriefingAckPayload = {
    orgId: input.orgId,
    orderIds: [...new Set(input.orderIds.filter(Boolean))],
    ...(input.action && input.action !== 'ack' ? { action: input.action } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    workerName: input.workerName,
    email: input.email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigHex = crypto
    .createHmac('sha256', getSigningSecret(secretOverride))
    .update(payloadB64)
    .digest('hex');

  return `${payloadB64}.${sigHex}`;
}

export function verifyBriefingAckToken(
  token: string,
  secretOverride?: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): BriefingAckPayload | null {
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigHex] = parts;
  if (!payloadB64 || !/^[a-f0-9]{64}$/i.test(sigHex)) return null;

  try {
    const expectedHex = crypto
      .createHmac('sha256', getSigningSecret(secretOverride))
      .update(payloadB64)
      .digest('hex');

    const actualBuf = Buffer.from(sigHex, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as BriefingAckPayload;

    if (
      !parsed ||
      typeof parsed.orgId !== 'string' ||
      !Array.isArray(parsed.orderIds) ||
      parsed.orderIds.length === 0 ||
      typeof parsed.workerName !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }

    if (parsed.action !== undefined && !ALLOWED_BRIEFING_ACTIONS.has(parsed.action)) {
      return null;
    }

    if (parsed.exp < nowEpochSeconds) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
