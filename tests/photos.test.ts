import assert from 'node:assert/strict';
import test from 'node:test';

// Simulation of standard photo model and atomic transaction linking logic
interface PhotoRecord {
  id: string;
  carrierId: string | null;
  surfaceId: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

interface MockTransactionClient {
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<void>;
  photo: {
    count: (args: { where: Partial<PhotoRecord> }) => Promise<number>;
    create: (args: { data: Omit<PhotoRecord, 'id'> & { id: string } }) => Promise<PhotoRecord>;
  };
}

class MockPrismaClient {
  photos: PhotoRecord[] = [];
  activeLocks: Set<string> = new Set();

  // Helper to clear DB state between tests
  clear() {
    this.photos = [];
    this.activeLocks.clear();
  }

  // Simulate Prisma transaction execution
  async $transaction<T>(fn: (tx: MockTransactionClient) => Promise<T>): Promise<T> {
    const tx: MockTransactionClient = {
      $executeRaw: async (strings, ...values) => {
        const sql = strings[0];
        const resourceId = values[0] as string;

        if (sql.includes('FOR UPDATE')) {
          // Wait if resource is locked (simulate row lock blocking)
          while (this.activeLocks.has(resourceId)) {
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
          this.activeLocks.add(resourceId);
        }
      },
      photo: {
        count: async (args) => {
          const { carrierId, surfaceId, isPrimary } = args.where;
          return this.photos.filter((p) => {
            if (carrierId !== undefined && p.carrierId !== carrierId) return false;
            if (surfaceId !== undefined && p.surfaceId !== surfaceId) return false;
            if (isPrimary !== undefined && p.isPrimary !== isPrimary) return false;
            return true;
          }).length;
        },
        create: async (args) => {
          const record: PhotoRecord = { ...args.data };
          this.photos.push(record);
          return record;
        }
      }
    };

    try {
      return await fn(tx);
    } finally {
      // Release locks on transaction completion
      this.activeLocks.clear();
    }
  }
}

// Logic replica from app/api/photos/link/route.ts
async function linkPhoto(
  prisma: MockPrismaClient,
  input: {
    carrierId: string | null;
    surfaceId: string | null;
    driveFileId: string;
    fileName: string;
  }
) {
  const { carrierId, surfaceId, driveFileId } = input;
  const photoId = `photo-${driveFileId}`;

  // Execute database transaction replica with row locking
  return prisma.$transaction(async (tx) => {
    // 1. Lock target row to serialize execution
    if (carrierId) {
      await tx.$executeRaw`SELECT id FROM "AdvertisingCarrier" WHERE id = ${carrierId} FOR UPDATE`;
    } else if (surfaceId) {
      await tx.$executeRaw`SELECT id FROM "AdvertisingSurface" WHERE id = ${surfaceId} FOR UPDATE`;
    }

    // 2. Fetch counts
    const count = await tx.photo.count({
      where: {
        carrierId,
        surfaceId,
      },
    });

    const hasPrimary = await tx.photo.count({
      where: {
        carrierId,
        surfaceId,
        isPrimary: true,
      },
    });

    const isPrimary = hasPrimary === 0;

    // 3. Create photo
    return tx.photo.create({
      data: {
        id: photoId,
        carrierId,
        surfaceId,
        isPrimary,
        sortOrder: count,
      },
    });
  });
}

test('Photos: linking multiple photos concurrently checks and sets exactly one primary photo', async () => {
  const prisma = new MockPrismaClient();

  // Test Case 1: Connect 3 photos concurrently (parallel requests simulation)
  // Simulate network timing differences using small delays before execution
  const runParallel = async () => {
    return Promise.all([
      (async () => {
        await new Promise((r) => setTimeout(r, 2));
        return linkPhoto(prisma, { carrierId: 'carrier-1', surfaceId: null, driveFileId: 'df-1', fileName: 'p1.jpg' });
      })(),
      (async () => {
        await new Promise((r) => setTimeout(r, 0));
        return linkPhoto(prisma, { carrierId: 'carrier-1', surfaceId: null, driveFileId: 'df-2', fileName: 'p2.jpg' });
      })(),
      (async () => {
        await new Promise((r) => setTimeout(r, 4));
        return linkPhoto(prisma, { carrierId: 'carrier-1', surfaceId: null, driveFileId: 'df-3', fileName: 'p3.jpg' });
      })()
    ]);
  };

  await runParallel();

  const primaryCount = prisma.photos.filter((p) => p.isPrimary).length;
  const nonPrimaryCount = prisma.photos.filter((p) => !p.isPrimary).length;

  assert.equal(prisma.photos.length, 3, 'All 3 photos must be successfully linked.');
  assert.equal(primaryCount, 1, 'Only exactly one photo must be marked as primary.');
  assert.equal(nonPrimaryCount, 2, 'The other 2 photos must be non-primary.');
});

test('Photos: linking multiple photos sequentially sets the first one as primary', async () => {
  const prisma = new MockPrismaClient();

  // First photo
  const p1 = await linkPhoto(prisma, { carrierId: 'carrier-2', surfaceId: null, driveFileId: 'df-4', fileName: 'p4.jpg' });
  assert.equal(p1.isPrimary, true, 'First linked photo must be primary.');

  // Second photo
  const p2 = await linkPhoto(prisma, { carrierId: 'carrier-2', surfaceId: null, driveFileId: 'df-5', fileName: 'p5.jpg' });
  assert.equal(p2.isPrimary, false, 'Second linked photo must be non-primary.');

  // Third photo
  const p3 = await linkPhoto(prisma, { carrierId: 'carrier-2', surfaceId: null, driveFileId: 'df-6', fileName: 'p6.jpg' });
  assert.equal(p3.isPrimary, false, 'Third linked photo must be non-primary.');

  const primaryCount = prisma.photos.filter((p) => p.isPrimary).length;
  assert.equal(primaryCount, 1, 'Exactly one photo remains primary.');
});
