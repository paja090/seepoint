import crypto from 'node:crypto';

const RESEND_API_BASE = 'https://api.resend.com';
const TIMEOUT_MS = 15_000;

export type ResendDnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  status: string;
  priority?: number;
  ttl?: string;
};

export type ResendDomainResponse = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  region?: string;
  records?: ResendDnsRecord[];
};

export type ResendApiKeyResponse = {
  id: string;
  token: string;
};

function getManagementApiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!key) {
    throw new Error('Chybí RESEND_API_KEY. Nastavte jej v systémových proměnných prostředí.');
  }
  return key;
}

function formatResendError(rawMessage: string): string {
  if (/restricted to only send emails/i.test(rawMessage)) {
    return 'Váš RESEND_API_KEY ve Vercelu má oprávnění pouze pro odesílání ("Sending access"). Pro automatickou registraci a správu firemních domén musí mít klíč v Resendu oprávnění "Full access". Vytvořte v Resendu nový API klíč s "Full access" a aktualizujte proměnnou RESEND_API_KEY ve Vercelu.';
  }
  if (/api key.*invalid/i.test(rawMessage) || /unauthorized/i.test(rawMessage)) {
    return 'Zadaný RESEND_API_KEY je neplatný nebo byl zneplatněn. Zkontrolujte prosím hodnotu proměnné prostředí ve Vercelu.';
  }
  return rawMessage;
}

/**
 * Registers a new custom domain in Resend.
 * Returns the domain details including DNS records (SPF, DKIM, MX).
 * If the domain already exists in the Resend account, seamlessly loads and returns its records.
 */
export async function registerResendDomain(domain: string): Promise<ResendDomainResponse> {
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!cleanDomain || !cleanDomain.includes('.') || cleanDomain.length > 120) {
    throw new Error('Neplatný název domény.');
  }

  const apiKey = getManagementApiKey();
  const res = await fetch(`${RESEND_API_BASE}/domains`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: cleanDomain }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // If domain has already been registered in this Resend account, fetch it from existing domains!
    if (/registered already/i.test(data?.message || '') || /already exists/i.test(data?.message || '')) {
      try {
        const listRes = await fetch(`${RESEND_API_BASE}/domains`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const listData = await listRes.json().catch(() => ({}));
        const existing = (listData?.data as ResendDomainResponse[] | undefined)?.find(
          (d) => d.name.toLowerCase() === cleanDomain
        );
        if (existing) {
          return await getResendDomain(existing.id);
        }
      } catch (lookupErr) {
        console.warn('[resend] Fallback lookup for existing domain failed:', lookupErr);
      }
    }

    const message = formatResendError(data?.message || res.statusText);
    console.error('[resend] Domain creation failed:', { status: res.status, message });
    throw new Error(`Registrace domény v Resend selhala: ${message}`);
  }

  return data as ResendDomainResponse;
}

/**
 * Triggers Resend to re-verify DNS records for a registered domain.
 */
export async function verifyResendDomain(domainId: string): Promise<ResendDomainResponse> {
  if (!domainId) throw new Error('Chybí ID domény pro ověření.');

  const apiKey = getManagementApiKey();
  const res = await fetch(`${RESEND_API_BASE}/domains/${encodeURIComponent(domainId)}/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = formatResendError(data?.message || res.statusText);
    console.error('[resend] Domain verify failed:', { status: res.status, message });
    throw new Error(`Ověření domény v Resend selhalo: ${message}`);
  }

  return data as ResendDomainResponse;
}

/**
 * Fetches current domain details and DNS status from Resend.
 */
export async function getResendDomain(domainId: string): Promise<ResendDomainResponse> {
  if (!domainId) throw new Error('Chybí ID domény.');

  const apiKey = getManagementApiKey();
  const res = await fetch(`${RESEND_API_BASE}/domains/${encodeURIComponent(domainId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = formatResendError(data?.message || res.statusText);
    throw new Error(`Načtení stavu domény selhalo: ${message}`);
  }

  return data as ResendDomainResponse;
}

/**
 * Creates a domain-scoped sending API key restricted exclusively to sending from this domain.
 */
export async function createDomainSendingKey(domainId: string, domainName: string): Promise<ResendApiKeyResponse> {
  if (!domainId) throw new Error('Chybí ID domény pro vytvoření sending klíče.');

  const apiKey = getManagementApiKey();
  const res = await fetch(`${RESEND_API_BASE}/api-keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Seepoint OS: ${domainName.trim().toLowerCase()}`,
      permission: 'sending_access',
      domain_id: domainId,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = formatResendError(data?.message || res.statusText);
    console.error('[resend] API key creation failed:', { status: res.status, message });
    throw new Error(`Vytvoření doménového klíče v Resend selhalo: ${message}`);
  }

  return data as ResendApiKeyResponse;
}

/**
 * Deletes a registered domain from Resend.
 */
export async function deleteResendDomain(domainId: string): Promise<void> {
  if (!domainId) return;

  const apiKey = getManagementApiKey();
  const res = await fetch(`${RESEND_API_BASE}/domains/${encodeURIComponent(domainId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    console.warn('[resend] Domain deletion warning:', data);
  }
}

/**
 * Verifies the Svix / Resend cryptographic webhook signature.
 * Prevents unauthorized or spoofed webhook requests.
 */
export function verifyResendWebhookSignature(
  rawBody: string,
  headers: {
    id?: string | null;
    timestamp?: string | null;
    signature?: string | null;
  }
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // If webhook secret is not set in development, reject in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook] RESEND_WEBHOOK_SECRET is missing in production');
      return false;
    }
    return true;
  }

  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return false;
  }

  // Check timestamp freshness (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp, 10);
  if (isNaN(eventTime) || Math.abs(now - eventTime) > 300) {
    return false;
  }

  try {
    // Svix secret key format: "whsec_<base64>"
    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const secretBytes = Buffer.from(cleanSecret, 'base64');

    const signedPayload = `${id}.${timestamp}.${rawBody}`;
    const expectedHmac = crypto.createHmac('sha256', secretBytes).update(signedPayload).digest('base64');

    // Signatures in header may be space-delimited list of "v1,<sig>"
    const signatures = signature.split(' ');
    for (const sig of signatures) {
      const [version, hash] = sig.split(',');
      if (version === 'v1' && hash) {
        const hashBuf = Buffer.from(hash, 'utf8');
        const expectedBuf = Buffer.from(expectedHmac, 'utf8');
        if (hashBuf.length === expectedBuf.length && crypto.timingSafeEqual(hashBuf, expectedBuf)) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.error('[webhook] Signature verification error:', err);
    return false;
  }
}
