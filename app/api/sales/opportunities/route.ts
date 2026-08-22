import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity, getOpportunities, getOpportunityStats } from '@/lib/opportunities/service';
import type { OpportunityEventType, OpportunityStatus } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const city = searchParams.get('city') || undefined;
    const region = searchParams.get('region') || undefined;
    const eventType = (searchParams.get('eventType') as OpportunityEventType) || undefined;
    const status = (searchParams.get('status') as OpportunityStatus) || undefined;
    const minScore = searchParams.get('minScore') ? Number(searchParams.get('minScore')) : undefined;
    const maxScore = searchParams.get('maxScore') ? Number(searchParams.get('maxScore')) : undefined;
    const assignedToUserId = searchParams.get('assignedToUserId') || undefined;
    const take = searchParams.get('take') ? Number(searchParams.get('take')) : 50;
    const skip = searchParams.get('skip') ? Number(searchParams.get('skip')) : 0;

    const [data, stats] = await Promise.all([
      getOpportunities({
        search,
        city,
        region,
        eventType,
        status,
        minScore,
        maxScore,
        assignedToUserId,
        take,
        skip,
      }),
      getOpportunityStats(),
    ]);

    return NextResponse.json({ ...data, stats });
  } catch (error) {
    console.error('Failed to fetch sales opportunities', error);
    return NextResponse.json({ error: 'Příležitosti se nepodařilo načíst.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const body = await request.json();
    if (!body.companyName || !body.title || !body.city) {
      return NextResponse.json({ error: 'Zadejte název firmy, titulek a město.' }, { status: 400 });
    }

    const result = await createOpportunity({
      companyName: body.companyName,
      companyId: body.companyId,
      website: body.website,
      eventType: body.eventType,
      title: body.title,
      summary: body.summary,
      city: body.city,
      region: body.region,
      address: body.address,
      eventDate: body.eventDate,
      sourceUrl: body.sourceUrl || 'https://seepoint.cz',
      sourceTitle: body.sourceTitle || 'Interní zadání obchodníka',
      suggestedMediaTypes: body.suggestedMediaTypes,
      clientId: body.clientId,
      assignedToUserId: body.assignedToUserId || user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to create sales opportunity', error);
    return NextResponse.json({ error: 'Příležitost se nepodařilo vytvořit.' }, { status: 500 });
  }
}
