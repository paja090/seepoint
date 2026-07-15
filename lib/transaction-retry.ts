import { Prisma } from '@prisma/client';
import { prisma } from './db';

export class ConcurrencyError extends Error {
  constructor(message = 'Nepodařilo se dokončit operaci z důvodu vysokého souběžného zatížení. Zkuste to prosím znovu.') {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export async function runTransactionWithRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  retries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isSerializationConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';

      if (isSerializationConflict) {
        if (attempt < retries) {
          // Exponential backoff with a small jitter
          const delay = Math.pow(2, attempt) * 100 + Math.random() * 50;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // Throw ConcurrencyError if it's the last attempt
        throw new ConcurrencyError();
      }
      // Re-throw any other errors immediately
      throw error;
    }
  }
  throw new ConcurrencyError();
}
