import { randomUUID, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const databaseUrl =
  (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) ||
  (process.env.POSTGRES_PRISMA_URL && process.env.POSTGRES_PRISMA_URL.trim()) ||
  (process.env.POSTGRES_URL_NON_POOLING && process.env.POSTGRES_URL_NON_POOLING.trim()) ||
  (process.env.POSTGRES_URL && process.env.POSTGRES_URL.trim());

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

const prisma = new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute || process.argv.includes('--dry-run');

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  const checksum = createHash('sha256').update(buffer).digest('hex');
  return { mimeType, buffer, checksum };
}

async function migrateLegacyChatBase64() {
  console.log('='.repeat(70));
  console.log(` SeePoint OS – Migrace legacy Base64 fotografií v chatu a úložišti`);
  console.log(` Režim: ${isDryRun ? '🔍 DRY RUN (náhled bez zápisu)' : '🚀 EXECUTE (zápis do databáze)'}`);
  console.log('='.repeat(70));

  let totalChatMigrated = 0;
  let totalChatBytes = 0;
  let totalPhotoMigrated = 0;
  let totalPhotoBytes = 0;
  let totalFuelMigrated = 0;

  // 1. Chat messages
  const chatMessages = await prisma.chatMessage.findMany({
    where: { imageUrl: { startsWith: 'data:' } },
    select: { id: true, organizationId: true, channel: true, createdAt: true, imageUrl: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n💬 Nalezeno ChatMessage s inline Base64: ${chatMessages.length}`);

  for (const msg of chatMessages) {
    if (!msg.imageUrl) continue;
    const parsed = parseDataUrl(msg.imageUrl);
    if (!parsed) {
      console.warn(`  ⚠️ Zpráva ${msg.id}: neplatný formát data URL, přeskočeno.`);
      continue;
    }

    const byteLength = parsed.buffer.length;
    totalChatBytes += byteLength;
    const photoId = randomUUID();
    const targetUrl = `/api/photos/${photoId}/file`;
    const fileName = `chat-migrated-${msg.id}.jpg`;

    console.log(`  • Zpráva ${msg.id} [${msg.channel}] - ${(byteLength / 1024).toFixed(1)} KB -> ${targetUrl}`);

    if (isExecute) {
      await prisma.$transaction(async (tx) => {
        await tx.photo.create({
          data: {
            id: photoId,
            organizationId: msg.organizationId,
            url: targetUrl,
            storageProvider: 'DATABASE',
            content: parsed.buffer,
            contentChecksum: parsed.checksum,
            fileName,
            mimeType: parsed.mimeType,
            size: byteLength,
            type: 'ARCHIVE',
            note: `Migrováno z legacy chat zprávy ${msg.id} (${msg.channel})`,
            aiStatus: 'SKIPPED',
          },
        });

        await tx.chatMessage.update({
          where: { id: msg.id },
          data: { imageUrl: targetUrl },
        });
      });
      totalChatMigrated++;
    }
  }

  // 2. Photos with data: URL
  const photos = await prisma.photo.findMany({
    where: { url: { startsWith: 'data:' } },
    select: { id: true, organizationId: true, type: true, carrierId: true, createdAt: true, url: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n📸 Nalezeno záznamů Photo s inline Base64 URL: ${photos.length}`);

  for (const photo of photos) {
    if (!photo.url) continue;
    const parsed = parseDataUrl(photo.url);
    if (!parsed) {
      console.warn(`  ⚠️ Foto ${photo.id}: neplatný formát data URL, přeskočeno.`);
      continue;
    }

    const byteLength = parsed.buffer.length;
    totalPhotoBytes += byteLength;
    const targetUrl = `/api/photos/${photo.id}/file`;

    console.log(`  • Foto ${photo.id} [${photo.type}] - ${(byteLength / 1024).toFixed(1)} KB -> ${targetUrl}`);

    if (isExecute) {
      await prisma.photo.update({
        where: { id: photo.id },
        data: {
          url: targetUrl,
          content: parsed.buffer,
          contentChecksum: parsed.checksum,
          storageProvider: 'DATABASE',
          size: byteLength,
          mimeType: parsed.mimeType,
        },
      });
      totalPhotoMigrated++;
    }
  }

  // 3. Vehicle Fuel Expenses with data: URL
  const fuelExpenses = await prisma.vehicleFuelExpense.findMany({
    where: { receiptUrl: { startsWith: 'data:' } },
    select: { id: true, organizationId: true, receiptUrl: true },
  });

  if (fuelExpenses.length > 0) {
    console.log(`\n⛽ Nalezeno VehicleFuelExpense s inline Base64: ${fuelExpenses.length}`);
    for (const exp of fuelExpenses) {
      if (!exp.receiptUrl) continue;
      const parsed = parseDataUrl(exp.receiptUrl);
      if (!parsed) continue;
      const photoId = randomUUID();
      const targetUrl = `/api/photos/${photoId}/file`;
      if (isExecute) {
        await prisma.$transaction(async (tx) => {
          await tx.photo.create({
            data: {
              id: photoId,
              organizationId: exp.organizationId,
              url: targetUrl,
              storageProvider: 'DATABASE',
              content: parsed.buffer,
              contentChecksum: parsed.checksum,
              fileName: `fuel-receipt-${exp.id}.jpg`,
              mimeType: parsed.mimeType,
              size: parsed.buffer.length,
              type: 'EXPENSE_RECEIPT',
              note: `Migrováno z účtenky PHM ${exp.id}`,
            },
          });
          await tx.vehicleFuelExpense.update({
            where: { id: exp.id },
            data: { receiptUrl: targetUrl },
          });
        });
        totalFuelMigrated++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(` Shrnutí:`);
  console.log(`  • Chat zprávy: ${chatMessages.length} nalezeno, ${isExecute ? totalChatMigrated : 0} migrováno (uvolněno ${(totalChatBytes / (1024 * 1024)).toFixed(2)} MB z pollingu)`);
  console.log(`  • Fotografie:  ${photos.length} nalezeno, ${isExecute ? totalPhotoMigrated : 0} migrováno (uvolněno ${(totalPhotoBytes / (1024 * 1024)).toFixed(2)} MB z databáze)`);
  if (fuelExpenses.length > 0) {
    console.log(`  • Účtenky PHM: ${fuelExpenses.length} nalezeno, ${isExecute ? totalFuelMigrated : 0} migrováno`);
  }
  console.log(`  • Stav: ${isDryRun ? 'Náhled proběhl úspěšně. Pro reálnou migraci spusťte s --execute.' : 'Migrace úspěšně dokončena!'}`);
  console.log('='.repeat(70) + '\n');
}

migrateLegacyChatBase64()
  .catch((err) => {
    console.error('Chyba při migraci legacy Base64:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
