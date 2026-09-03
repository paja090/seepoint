import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { OpportunityValidationError } from './policy';

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped || (isIP(normalized) === 4 ? normalized : undefined);
  if (!ipv4) return false;
  const [a, b] = ipv4.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

export async function assertPublicHttpUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new OpportunityValidationError('URL článku není platná.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new OpportunityValidationError('URL článku musí být veřejná HTTP(S) adresa.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new OpportunityValidationError('Interní URL nelze analyzovat.');
  if (url.port && !['80', '443'].includes(url.port)) throw new OpportunityValidationError('URL článku používá nepovolený port.');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) throw new OpportunityValidationError('URL článku nevede na povolenou veřejnou adresu.');
  return url;
}

async function readLimitedText(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new OpportunityValidationError('Stažený článek je příliš velký.', 413);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new OpportunityValidationError('Stažený článek je příliš velký.', 413);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(merged);
}

export async function fetchPublicArticle(rawUrl: string) {
  let url = await assertPublicHttpUrl(rawUrl);
  for (let redirect = 0; redirect <= 3; redirect++) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'SeePointOpportunityRadar/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirect === 3) throw new OpportunityValidationError('Článek má příliš mnoho přesměrování.');
      url = await assertPublicHttpUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new OpportunityValidationError(`Článek se nepodařilo načíst (${response.status}).`, 422);
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (type && !type.includes('text/html') && !type.includes('text/plain')) throw new OpportunityValidationError('URL neobsahuje textový článek.', 422);
    return { text: await readLimitedText(response, 1_000_000), finalUrl: url.toString() };
  }
  throw new OpportunityValidationError('Článek se nepodařilo načíst.');
}
