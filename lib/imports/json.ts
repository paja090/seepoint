import { Prisma } from '@prisma/client';

/** Normalize JSON boundaries (omit undefined, serialize dates, reject cycles). */
export function importJson(value: unknown) {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) return Prisma.JsonNull;
  const normalized: unknown = JSON.parse(encoded);
  return normalized === null ? Prisma.JsonNull : normalized as Prisma.InputJsonValue;
}
