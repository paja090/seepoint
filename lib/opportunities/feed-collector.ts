import 'server-only';
import { prisma } from '@/lib/db';
import type { OrganizationRadarProfileData } from './types';

export type RawRssArticle = {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
};

/**
 * Builds Google News search queries dynamically from the organization's profile
 */
export function buildDynamicRssQueries(profile: OrganizationRadarProfileData): string[] {
  const locations: string[] = [];
  if (profile.targetCities.length > 0) {
    locations.push(...profile.targetCities.slice(0, 3));
  }
  if (profile.targetRegions.length > 0 && locations.length < 3) {
    for (const r of profile.targetRegions) {
      if (!locations.includes(r)) locations.push(r);
      if (locations.length >= 3) break;
    }
  }
  if (locations.length === 0) {
    locations.push('Česká republika');
  }

  const queries: string[] = [];
  const baseActions = [
    'otevření prodejny pobočky provozovny',
    'nová pobočka expanze retail park',
    'koncert festival veletrh sportovní akce',
  ];

  for (const loc of locations) {
    for (const act of baseActions) {
      queries.push(`${loc} ${act}`);
    }
  }

  if (profile.customKeywords.length > 0) {
    for (const kw of profile.customKeywords.slice(0, 2)) {
      queries.push(`${locations[0] || ''} ${kw}`.trim());
    }
  }

  return queries.slice(0, 5);
}

export async function fetchRssArticles(rssUrl: string): Promise<RawRssArticle[]> {
  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutdoorRadarBot/1.0; +https://seepoint.cz)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > 1_000_000) return [];
    const xmlText = (await res.text()).slice(0, 1_000_000);
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
    return items.slice(0, 15).flatMap((itemXml) => {
      const titleMatch = itemXml.match(/<title>(.*?)<\/title>/i);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);
      const descMatch = itemXml.match(/<description>(.*?)<\/description>/i);
      if (!titleMatch?.[1] || !linkMatch?.[1]) return [];
      return [{
        title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim(),
        link: linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim(),
        pubDate: pubDateMatch?.[1],
        description: descMatch?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      }];
    });
  } catch {
    return [];
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

  const fetchedGroups = await Promise.all(rssUrls.slice(0, 6).map(fetchRssArticles));
  const rawArticles = fetchedGroups.flat();

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

  const persistedSignals = [];
  for (const art of uniqueArticles.slice(0, 15)) {
    const pubDate = art.pubDate ? new Date(art.pubDate) : null;
    const signal = await prisma.radarSignal.upsert({
      where: {
        organizationId_sourceUrl: {
          organizationId,
          sourceUrl: art.link,
        },
      },
      create: {
        organizationId,
        sourceUrl: art.link,
        sourceTitle: art.title,
        sourcePublishedAt: pubDate && Number.isFinite(pubDate.getTime()) ? pubDate : null,
        rawText: art.description || null,
        status: 'NEW',
      },
      update: {},
    });
    persistedSignals.push(signal);
  }

  return {
    rawFound: rawArticles.length,
    uniqueSignals: persistedSignals,
  };
}
