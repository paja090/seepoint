import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';
import { OfferAvailabilityError, OfferValidationError } from './domain';

function logOfferFailure(context: string, error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(context, { code: error.code, meta: error.meta, message: error.message });
    return;
  }
  console.error(context, error);
}

export function offerErrorResponse(error: unknown, context = 'Offer request failed') {
  if (error instanceof OfferAvailabilityError) {
    return NextResponse.json({ error: error.message, code: error.code, conflicts: error.conflicts }, { status: 409 });
  }
  if (error instanceof OfferValidationError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_STATUS_TRANSITION' ? 409 : 400;
    return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status });
  }
  if (isMissingDatabaseStructureError(error)) {
    logOfferFailure(context, error);
    return NextResponse.json({ error: productionMigrationMessage() }, { status: 503 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return NextResponse.json({ error: 'Stejný záznam už existuje.', code: 'DUPLICATE' }, { status: 409 });
  }
  logOfferFailure(context, error);
  return NextResponse.json({ error: 'Požadavek se nepodařilo dokončit.' }, { status: 500 });
}

export async function optionalJson(request: Request) {
  const text = await request.text();
  return text ? JSON.parse(text) as unknown : {};
}
