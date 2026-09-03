import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity } from '@/lib/opportunities/service';
import { parseOpportunityFromAiInput } from '@/lib/opportunities/parser';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RssArticle = { title: string; link: string; pubDate?: string };

async function fetchRssArticles(rssUrl: string): Promise<RssArticle[]> {
  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SeePointBot/1.0' },
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
      if (!titleMatch?.[1] || !linkMatch?.[1]) return [];
      return [{
        title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim(),
        link: linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim(),
        pubDate: pubDateMatch?.[1],
      }];
    });
  } catch {
    return [];
  }
}

/**
 * Live Automated AI Discovery Job for Moravskoslezský kraj
 * 
 * Fetches regional news RSS signals (Google News MS Region, Patriot Magazín, Polar Ostrava),
 * passes items to Gemini/OpenAI for opportunity parsing, deduplicates, scores,
 * and saves into SalesOpportunity table.
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) return NextResponse.json({ error: 'Automatické hledání může spustit pouze administrátor nebo manažer.' }, { status: 403 });
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.opportunityDiscovery);
  if (limited) return limited;

  try {
    const rssUrls = [
      'https://news.google.com/rss/search?q=ostrava+otev%C5%99en%C3%AD+prodejny+pobo%C4%8Dky+provozovny&hl=cs&gl=CZ&ceid=CZ:cs',
      'https://news.google.com/rss/search?q=moravskoslezsky+kraj+nova+pobocka+retail+park&hl=cs&gl=CZ&ceid=CZ:cs',
      'https://news.google.com/rss/search?q=opava+havirov+karvina+frydek+mistek+otevreni+prodejna&hl=cs&gl=CZ&ceid=CZ:cs',
      'https://news.google.com/rss/search?q=ostrava+opava+koncert+festival+sportovni+akce&hl=cs&gl=CZ&ceid=CZ:cs',
      'https://news.google.com/rss/search?q=ostrava+novy+restaurace+autosalon+prodejna&hl=cs&gl=CZ&ceid=CZ:cs',
    ];

    const rawArticles = (await Promise.all(rssUrls.map(fetchRssArticles))).flat();

    let addedCount = 0;
    let duplicateCount = 0;

    // Keep the interactive request bounded: RSS and AI calls run in parallel, DB writes stay sequential.
    const oldestAllowed = Date.now() - 45 * 24 * 60 * 60_000;
    const newestAllowed = Date.now() + 24 * 60 * 60_000;
    const freshArticles = rawArticles.filter((article) => {
      if (!article.pubDate) return false;
      const publishedAt = new Date(article.pubDate).getTime();
      return Number.isFinite(publishedAt) && publishedAt >= oldestAllowed && publishedAt <= newestAllowed;
    });
    const uniqueArticles = freshArticles.filter(
      (art, idx, all) => all.findIndex((candidate) => candidate.title === art.title) === idx
    ).slice(0, 5);

    const parsedArticles = await Promise.all(uniqueArticles.map(async (article) => {
      try {
        const parsed = await parseOpportunityFromAiInput(article.title, article.link);
        return { article, parsed };
      } catch (err) {
        console.error('Failed parsing article for opportunity', article.title, err);
        return null;
      }
    }));

    for (const candidate of parsedArticles) {
      if (!candidate?.parsed.isRelevant) continue;
      const { article, parsed } = candidate;
      try {
        const result = await createOpportunity({
          companyName: parsed.companyName,
          companyId: parsed.companyId,
          website: parsed.website,
          eventType: parsed.eventType,
          title: parsed.title,
          summary: parsed.summary,
          city: parsed.city,
          region: parsed.region || 'Moravskoslezský kraj',
          address: parsed.address,
          eventDate: parsed.eventDate,
          sourceUrl: article.link,
          sourceTitle: article.title,
          sourcePublishedAt: article.pubDate ? new Date(article.pubDate) : new Date(),
          suggestedMediaTypes: parsed.suggestedMediaTypes,
        }, user.organizationId);

        if (result.created) {
          addedCount++;
        } else {
          duplicateCount++;
        }
      } catch (err) {
        console.error('Failed saving discovered opportunity', article.title, err);
      }
    }

    return NextResponse.json({
      success: true,
      foundArticles: rawArticles.length,
      processed: uniqueArticles.length,
      addedCount,
      duplicateCount,
    });
  } catch (error) {
    console.error('AI Auto Discovery error', error);
    return NextResponse.json({ error: 'Automatické vyhledávání selhalo.' }, { status: 500 });
  }
}
