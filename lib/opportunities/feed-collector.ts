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
    locations.push(...profile.targetCities.slice(0, 4));
  }
  if (profile.targetRegions.length > 0 && locations.length < 4) {
    for (const r of profile.targetRegions) {
      if (!locations.includes(r)) locations.push(r);
      if (locations.length >= 4) break;
    }
  }
  if (locations.length === 0) {
    locations.push('Česká republika');
  }

  const queries: string[] = [];
  const baseActions = [
    '"nová prodejna" OR "nová pobočka" OR "otevření prodejny"',
    '"retail park" OR "nákupní centrum" OR expanze',
    'festival OR koncert OR veletrh OR výstava',
  ];

  for (const loc of locations) {
    for (const act of baseActions) {
      queries.push(`${loc} ${act}`);
    }
  }

  if (profile.customKeywords.length > 0) {
    for (const kw of profile.customKeywords.slice(0, 3)) {
      queries.push(`${locations[0] || ''} "${kw}"`.trim());
    }
  }

  return queries.slice(0, 10);
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

  const queries = buildDynamicRssQueries(profile);
  for (const q of queries) {
    rssUrls.push(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=cs&gl=CZ&ceid=CZ:cs`);
  }

  const fetchedGroups = await Promise.allSettled(rssUrls.slice(0, 10).map(fetchRssArticles));
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

  const toUpsert = uniqueArticles.slice(0, 30).map((art) => {
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
      sourceUrl: { in: toUpsert.map((t) => t.sourceUrl) },
    },
    take: 30,
  });

  // Prioritize NEW unprocessed signals first
  const sortedSignals = persistedSignals.sort((a, b) => {
    if (a.status === 'NEW' && b.status !== 'NEW') return -1;
    if (a.status !== 'NEW' && b.status === 'NEW') return 1;
    return 0;
  });

  return {
    sourceErrors,
    rawFound: rawArticles.length,
    uniqueSignals: sortedSignals,
  };
}

