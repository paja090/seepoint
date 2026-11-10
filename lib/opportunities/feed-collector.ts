import 'server-only';
import { prisma } from '@/lib/db';
import type { OrganizationRadarProfileData } from './types';

export type RawRssArticle = {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  publisher?: string;
  publisherUrl?: string;
};

/**
 * Builds Google News search queries dynamically from the organization's profile
 */
export function buildDynamicRssQueries(profile: OrganizationRadarProfileData): string[] {
  const locations: string[] = [];
  if (profile.targetCities.length > 0) {
    locations.push(...profile.targetCities.slice(0, 5));
  }
  if (profile.targetRegions.length > 0 && locations.length < 6) {
    for (const r of profile.targetRegions) {
      if (!locations.includes(r)) locations.push(r);
      if (locations.length >= 6) break;
    }
  }
  if (locations.length === 0) {
    locations.push('Česká republika');
  }

  const queries: string[] = [];
  const baseActions = [
    '(otevírá OR otevře OR "nová prodejna" OR "nová pobočka" OR supermarket OR showroom)',
    '("retail park" OR "nákupní centrum" OR výstavba OR developer OR rezidence OR expanze)',
    '(festival OR koncert OR veletrh OR výstava OR autosalon OR klinika)',
  ];

  for (const loc of locations) {
    for (const act of baseActions) {
      queries.push(`${loc} ${act}`);
    }
  }

  if (profile.customKeywords.length > 0) {
    for (const kw of profile.customKeywords.slice(0, 4)) {
      queries.push(`${locations[0] || ''} "${kw}"`.trim());
    }
  }

  return queries.slice(0, 14);
}

export async function fetchRssArticles(rssUrl: string): Promise<RawRssArticle[]> {
  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutdoorRadarBot/1.0; +https://seepoint.cz)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > 1_000_000) throw new Error('RSS překročilo limit velikosti.');
    const xmlText = (await res.text()).slice(0, 1_000_000);
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
    return items.slice(0, 25).flatMap((itemXml) => {
      const titleMatch = itemXml.match(/<title>(.*?)<\/title>/i);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);
      const descMatch = itemXml.match(/<description>(.*?)<\/description>/i);
      const sourceMatch = itemXml.match(/<source\s+url="([^"]+)">([^<]+)<\/source>/i);
      if (!titleMatch?.[1] || !linkMatch?.[1]) return [];
      return [{
        title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim(),
        link: linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim(),
        pubDate: pubDateMatch?.[1],
        description: descMatch?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        publisher: sourceMatch?.[2]?.trim(),
        publisherUrl: sourceMatch?.[1]?.trim(),
      }];
    });
  } catch {
    throw new Error('RSS zdroj není dostupný nebo překročil časový limit.');
  }
}

const REGIONAL_FEEDS: Record<string, string[]> = {
  ustecky: [
    'https://servis.idnes.cz/rss.aspx?c=usti',
    'https://www.denik.cz/rss/ustecky-kraj.html',
  ],
  moravskoslezsky: [
    'https://servis.idnes.cz/rss.aspx?c=ostrava',
    'https://www.denik.cz/rss/moravskoslezsky-kraj.html',
  ],
  jihomoravsky: [
    'https://www.denik.cz/rss/jihomoravsky-kraj.html',
  ],
  praha: [
    'https://www.denik.cz/rss/praha.html',
  ],
  stredocesky: [
    'https://servis.idnes.cz/rss.aspx?c=stredni-cechy',
    'https://www.denik.cz/rss/stredocesky-kraj.html',
  ],
  plzensky: [
    'https://servis.idnes.cz/rss.aspx?c=plzen',
    'https://www.denik.cz/rss/plzensky-kraj.html',
  ],
  liberecky: [
    'https://servis.idnes.cz/rss.aspx?c=liberec',
    'https://www.denik.cz/rss/liberecky-kraj.html',
  ],
  kralovehradecky: [
    'https://servis.idnes.cz/rss.aspx?c=hradec',
    'https://www.denik.cz/rss/kralovehradecky-kraj.html',
  ],
  pardubicky: [
    'https://servis.idnes.cz/rss.aspx?c=pardubice',
    'https://www.denik.cz/rss/pardubicky-kraj.html',
  ],
  jihocesky: [
    'https://servis.idnes.cz/rss.aspx?c=budejovice',
    'https://www.denik.cz/rss/jihocesky-kraj.html',
  ],
  vysocina: [
    'https://servis.idnes.cz/rss.aspx?c=jihlava',
    'https://www.denik.cz/rss/kraj-vysocina.html',
  ],
  olomoucky: [
    'https://servis.idnes.cz/rss.aspx?c=olomouc',
    'https://www.denik.cz/rss/olomoucky-kraj.html',
  ],
  zlinsky: [
    'https://servis.idnes.cz/rss.aspx?c=zlin',
    'https://www.denik.cz/rss/zlinsky-kraj.html',
  ],
  karlovarsky: [
    'https://servis.idnes.cz/rss.aspx?c=karlovy-vary',
    'https://www.denik.cz/rss/karlovarsky-kraj.html',
  ],
};

const NATIONAL_BUSINESS_FEEDS = [
  'https://servis.idnes.cz/rss.aspx?c=ekonomika',
  'https://www.novinky.cz/rss/ekonomika',
  'https://www.seznamzpravy.cz/rss',
  'https://www.ceskenoviny.cz/sluzby/rss/ekonomika.php',
];

function normalizeLocString(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function getCuratedRssFeeds(profile: OrganizationRadarProfileData): string[] {
  const feeds: string[] = [...NATIONAL_BUSINESS_FEEDS];
  const combinedLocs = [...profile.targetRegions, ...profile.targetCities].map(normalizeLocString);

  for (const [regionKey, urls] of Object.entries(REGIONAL_FEEDS)) {
    const isMatched = combinedLocs.some(loc => loc.includes(regionKey) || regionKey.includes(loc));
    if (isMatched) {
      feeds.push(...urls);
    }
  }

  // If no regional match found, include default major regional feeds
  if (feeds.length === NATIONAL_BUSINESS_FEEDS.length) {
    feeds.push(
      'https://servis.idnes.cz/rss.aspx?c=usti',
      'https://www.denik.cz/rss/ustecky-kraj.html',
      'https://www.denik.cz/rss/praha.html',
      'https://www.denik.cz/rss/jihomoravsky-kraj.html',
      'https://servis.idnes.cz/rss.aspx?c=ostrava'
    );
  }

  return [...new Set(feeds)];
}

/**
 * Collects and persists raw signals for an organization into RadarSignal table
 */
export async function collectSignalsForProfile(
  profile: OrganizationRadarProfileData,
  organizationId: string
) {
  const rssUrls: string[] = [];

  if (profile.customRssSources.length > 0) {
    rssUrls.push(...profile.customRssSources);
  }

  // Curated direct Czech news feeds (regional & business)
  const curatedFeeds = getCuratedRssFeeds(profile);
  rssUrls.push(...curatedFeeds);

  // Dynamic Google News queries
  const queries = buildDynamicRssQueries(profile);
  for (const q of queries) {
    rssUrls.push(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=cs&gl=CZ&ceid=CZ:cs`);
  }

  const uniqueRssUrls = [...new Set(rssUrls)];
  const fetchedGroups = await Promise.allSettled(uniqueRssUrls.slice(0, 24).map(fetchRssArticles));
  const sourceErrors = fetchedGroups.filter(result => result.status === 'rejected').length;
  const rawArticles = fetchedGroups.flatMap(result => result.status === 'fulfilled' ? result.value : []);

  const oldestAllowed = Date.now() - 45 * 24 * 60 * 60_000;
  const newestAllowed = Date.now() + 24 * 60 * 60_000;
  const fresh = rawArticles.filter((a) => {
    if (!a.pubDate) return true;
    const t = new Date(a.pubDate).getTime();
    return Number.isFinite(t) && t >= oldestAllowed && t <= newestAllowed;
  });

  const uniqueArticles = fresh.filter(
    (art, idx, all) => all.findIndex((cand) => cand.title === art.title || cand.link === art.link) === idx
  );

  // Preserve every distinct URL, including syndications with identical titles.
  // The original title/URL Stage 1 check still prioritizes one article per title in this batch.
  const articlesToPersist = fresh.filter((art, idx, all) => all.findIndex(c => c.link === art.link) === idx);
  const toUpsert = articlesToPersist.slice(0, 100).map((art) => {
    const pubDate = art.pubDate ? new Date(art.pubDate) : null;
    const cleanTitle = art.publisher ? `${art.title} - ${art.publisher}` : art.title;
    return {
      organizationId,
      sourceUrl: art.link,
      sourceTitle: cleanTitle,
      sourcePublishedAt: pubDate && Number.isFinite(pubDate.getTime()) ? pubDate : null,
      rawText: art.description || null,
      status: 'NEW',
    };
  });

  if (toUpsert.length > 0) {
    await prisma.radarSignal.createMany({
      data: toUpsert,
      skipDuplicates: true,
    });
  }

  const persistedSignals = await prisma.radarSignal.findMany({
    where: {
      organizationId,
      OR: [
        { sourceUrl: { in: toUpsert.map((t) => t.sourceUrl) } },
        { status: 'NEW', discoveredOpportunityId: null },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });

  // Prioritize NEW unprocessed signals first
  const sortedSignals = persistedSignals.sort((a, b) => {
    if (a.status === 'NEW' && b.status !== 'NEW') return -1;
    if (a.status !== 'NEW' && b.status === 'NEW') return 1;
    return Number(!uniqueArticles.some(x => x.link === a.sourceUrl)) - Number(!uniqueArticles.some(x => x.link === b.sourceUrl));
  });

  return {
    sourceErrors,
    stage1DuplicateCount: Math.max(0, fresh.length - uniqueArticles.length) + persistedSignals.filter(s => Boolean(s.discoveredOpportunityId)).length,
    rawFound: rawArticles.length,
    uniqueSignals: sortedSignals,
  };
}

