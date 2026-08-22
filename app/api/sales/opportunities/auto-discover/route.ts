import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity } from '@/lib/opportunities/service';
import { parseOpportunityFromAiInput } from '@/lib/opportunities/parser';

export const runtime = 'nodejs';

/**
 * Live Automated AI Discovery Job for Moravskoslezský kraj
 * 
 * Fetches regional news RSS signals (Google News MS Region, Patriot Magazín, Polar Ostrava),
 * passes items to Gemini/OpenAI for opportunity parsing, deduplicates, scores,
 * and saves into SalesOpportunity table.
 */
export async function POST() {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const rssUrls = [
      'https://news.google.com/rss/search?q=ostrava+otev%C5%99en%C3%AD+prodejny+pobo%C4%8Dky+provozovny&hl=cs&gl=CZ&ceid=CZ:cs',
      'https://news.google.com/rss/search?q=moravskoslezsky+kraj+nova+pobocka+retail+park&hl=cs&gl=CZ&ceid=CZ:cs',
    ];

    const rawArticles: Array<{ title: string; link: string; pubDate?: string }> = [];

    for (const rssUrl of rssUrls) {
      try {
        const res = await fetch(rssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SeePointBot/1.0' },
        });
        if (res.ok) {
          const xmlText = await res.text();
          const itemRegex = /<item>[\s\S]*?<\/item>/gi;
          const items = xmlText.match(itemRegex) || [];

          for (const itemXml of items.slice(0, 10)) {
            const titleMatch = itemXml.match(/<title>(.*?)<\/title>/i);
            const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);
            const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);

            if (titleMatch?.[1] && linkMatch?.[1]) {
              const cleanTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim();
              const cleanLink = linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim();
              rawArticles.push({
                title: cleanTitle,
                link: cleanLink,
                pubDate: pubDateMatch?.[1],
              });
            }
          }
        }
      } catch {
        // Continue to next RSS feed
      }
    }

    let addedCount = 0;
    let duplicateCount = 0;

    // Process top 5 unique articles with AI
    const uniqueArticles = rawArticles.filter(
      (art, idx, all) => all.findIndex((candidate) => candidate.title === art.title) === idx
    ).slice(0, 5);

    for (const article of uniqueArticles) {
      try {
        const parsed = await parseOpportunityFromAiInput(article.title, article.link);

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
        });

        if (result.created) {
          addedCount++;
        } else {
          duplicateCount++;
        }
      } catch (err) {
        console.error('Failed parsing article for opportunity', article.title, err);
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
