import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { Prisma, WarehouseItemCategory } from '@prisma/client';
import { canManageWarehouseCatalog } from '@/lib/rbac';
import {
  MAX_WAREHOUSE_BATCH_SIZE,
  WarehouseInputError,
  validateWarehouseDataImage,
  warehouseCategory,
  warehouseNumber,
  warehouseText,
} from '@/lib/warehouse-validation';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';

type ProposedWarehouseItem = {
  name: string;
  category: WarehouseItemCategory;
  unit: string;
  quantityInStock: number;
  minQuantity: number;
  location: string;
  note: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  if (!canManageWarehouseCatalog(user.role)) {
    return NextResponse.json({ error: 'AI import skladu může spustit pouze administrátor nebo manažer.' }, { status: 403 });
  }
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.warehouseAi);
  if (limited) return limited;

  await ensureWarehouseSchema();

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });

    // If saving confirmed items directly to DB:
    if (body.itemsToSave && Array.isArray(body.itemsToSave)) {
      if (body.itemsToSave.length === 0 || body.itemsToSave.length > MAX_WAREHOUSE_BATCH_SIZE) {
        throw new WarehouseInputError(`Najednou lze uložit 1 až ${MAX_WAREHOUSE_BATCH_SIZE} položek.`);
      }
      const performedByName = user.employee
        ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
        : user.name || user.email;

      const parsedItems = body.itemsToSave.map((item: Record<string, unknown>) => ({
        name: warehouseText(item.name, 'Název položky', 200, true)!,
        quantity: warehouseNumber(item.quantityInStock, 'Množství'),
        category: warehouseCategory(item.category),
        unit: warehouseText(item.unit ?? 'ks', 'Jednotka', 30, true)!,
        minQuantity: warehouseNumber(item.minQuantity ?? 2, 'Minimální zásoba', { allowZero: true }),
        location: warehouseText(item.location ?? 'Dílna / Regál', 'Umístění', 200, true)!,
        note: warehouseText(item.note ?? 'Automaticky naskladněno pomocí AI fotky regálu', 'Poznámka', 2000, true)!,
      }));

      await prisma.$transaction(async (tx) => {
        for (const item of parsedItems) {
          const existing = await tx.warehouseItem.findFirst({
            where: { name: { equals: item.name, mode: 'insensitive' } },
          });
          if (existing) {
            await tx.warehouseItem.update({
              where: { id: existing.id },
              data: { quantityInStock: { increment: item.quantity } },
            });
            await tx.warehouseMovement.create({
              data: {
                itemId: existing.id,
                type: 'RECEIPT',
                quantity: item.quantity,
                performedByName,
                note: 'AI naskladnění regálu (aktualizace stávající položky)',
              },
            });
          } else {
            const newItem = await tx.warehouseItem.create({
              data: {
                name: item.name,
                category: item.category,
                unit: item.unit,
                quantityInStock: item.quantity,
                minQuantity: item.minQuantity,
                location: item.location,
                note: item.note,
              },
            });
            await tx.warehouseMovement.create({
              data: {
                itemId: newItem.id,
                type: 'RECEIPT',
                quantity: item.quantity,
                performedByName,
                note: 'AI naskladnění regálu (nová položka)',
              },
            });
          }
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      const savedCount = parsedItems.length;

      return NextResponse.json({
        success: true,
        count: savedCount,
        message: `Úspěšně zpracováno a uloženo ${savedCount} položek v databázi skladu!`,
      });
    }

    // Otherwise photo analysis request
    const { photoBase64 } = body;
    const validatedPhoto = validateWarehouseDataImage(photoBase64);

    let proposedItems: ProposedWarehouseItem[] = [];

    // Call real Gemini Vision AI model
    if (validatedPhoto) {
      const { analyzeWarehouseItemsFromPhotoWithGemini } = await import('@/lib/ai-gemini');
      const aiItems = await analyzeWarehouseItemsFromPhotoWithGemini(validatedPhoto);

      if (aiItems.length > 0) {
        proposedItems = aiItems.map((i) => ({
          name: warehouseText(i.name, 'Název položky', 200, true)!,
          category: warehouseCategory(i.category),
          unit: warehouseText(i.unit, 'Jednotka', 30, true)!,
          quantityInStock: warehouseNumber(i.quantity, 'Množství'),
          minQuantity: 2,
          location: warehouseText(i.location ?? 'Dílna / Regál', 'Umístění', 200, true)!,
          note: warehouseText(i.note ?? 'Rozpoznáno AI', 'Poznámka', 2000, true)!,
        }));
      }
    }

    if (proposedItems.length === 0) {
      return NextResponse.json({
        error: 'AI z fotky nedokázala rozpoznat žádné položky. Zkontrolujte prosím, zda je fotka dostatečně ostrá a osvětlená.',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      proposedItems,
      message: `AI rozpoznala a klasifikovala ${proposedItems.length} nových položek pro uložení do databáze.`,
    });
  } catch (error) {
    if (error instanceof WarehouseInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('AI import photo error:', error);
    return NextResponse.json({
      error: 'AI analýza nebo uložení fotky selhalo.',
    }, { status: 500 });
  }
}
