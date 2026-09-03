import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { WarehouseInputError, validateWarehouseImage, warehouseNumber, warehouseText } from '@/lib/warehouse-validation';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  if (!canAccess(user.role, 'warehouse')) return NextResponse.json({ error: 'Nemáte oprávnění ke skladu.' }, { status: 403 });
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.warehouseAi);
  if (limited) return limited;

  await ensureWarehouseSchema();

  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nahrajte fotku materiálu.' }, { status: 400 });
    }
    validateWarehouseImage(file);

    const allItems = await prisma.warehouseItem.findMany({
      select: { id: true, name: true, code: true, category: true, unit: true, quantityInStock: true, location: true },
    });

    if (allItems.length === 0) {
      return NextResponse.json({ error: 'Ve skladu zatím nejsou žádné položky pro spárování.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = `data:${file.type || 'image/jpeg'};base64,${Buffer.from(arrayBuffer).toString('base64')}`;

    const { analyzeWarehouseItemsFromPhotoWithGemini } = await import('@/lib/ai-gemini');
    const aiItems = await analyzeWarehouseItemsFromPhotoWithGemini(base64Data);

    const detected: { itemId: string; name: string; unit: string; detectedQty: number; confidence: number }[] = [];
    const unmatchedItems: string[] = [];

    if (aiItems.length > 0) {
      for (const aiItem of aiItems) {
        const aiName = warehouseText(aiItem.name, 'Rozpoznaný název', 200, true)!;
        const aiNameLower = aiName.toLowerCase();
        // Try to match AI identified name with existing database items
        const matchedDbItem = allItems.find(
          (dbItem) =>
            dbItem.name.toLowerCase().includes(aiNameLower) ||
            aiNameLower.includes(dbItem.name.toLowerCase())
        );

        if (matchedDbItem) {
          const detectedQty = warehouseNumber(aiItem.quantity, 'Rozpoznané množství');
          detected.push({
            itemId: matchedDbItem.id,
            name: matchedDbItem.name,
            unit: matchedDbItem.unit,
            detectedQty,
            confidence: 0.95,
          });
        } else {
          // Never bind an unknown AI result to an unrelated stock item.
          unmatchedItems.push(aiName);
        }
      }
    }

    // Heuristics fallback if filename hints
    if (detected.length === 0) {
      const filename = file.name.toLowerCase();
      for (const item of allItems) {
        const nameLower = item.name.toLowerCase();
        if (filename.includes('metr') && nameLower.includes('metr')) {
          detected.push({
            itemId: item.id,
            name: item.name,
            unit: item.unit,
            detectedQty: 1,
            confidence: 0.9,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      detectedItems: detected,
      unmatchedItems,
      message: `AI bezpečně spárovala ${detected.length} položek se skladem${unmatchedItems.length ? `; ${unmatchedItems.length} nerozpoznaných položek nebylo možné vydat` : ''}.`,
    });
  } catch (error) {
    if (error instanceof WarehouseInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Photo recognition error:', error);
    return NextResponse.json({ error: 'Rozpoznání fotky selhalo.' }, { status: 500 });
  }
}
