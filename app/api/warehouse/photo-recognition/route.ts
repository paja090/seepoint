import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { WarehouseInputError, validateWarehouseImage, warehouseNumber, warehouseText } from '@/lib/warehouse-validation';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireApiAccess('warehouse');
  if (isApiDenied(user)) return user;
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
    const aiItems = await analyzeWarehouseItemsFromPhotoWithGemini(base64Data, allItems);

    const detected: { itemId: string; name: string; unit: string; detectedQty: number; confidence: number }[] = [];
    const unmatchedItems: string[] = [];

    function normalizeText(str: string): string {
      return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function getTokens(str: string): string[] {
      const stopWords = new Set(['baleni', 'sada', 'kusu', 'kus', 'pro', 'cca', 'nebo', 'ks', 'mm', 'kg', 'duty']);
      return normalizeText(str)
        .split(' ')
        .filter((t) => t.length >= 2 && !stopWords.has(t));
    }

    function matchItemToCatalog(aiName: string, matchedCatalogItemId?: string | null) {
      // 1. Direct ID match from AI Vision
      if (matchedCatalogItemId) {
        const byId = allItems.find((c) => c.id === matchedCatalogItemId);
        if (byId) return { ...byId, confidence: 0.98 };
      }

      const normAi = normalizeText(aiName);
      if (!normAi) return null;

      // 2. Direct code match
      for (const item of allItems) {
        if (item.code && normAi.includes(normalizeText(item.code))) {
          return { ...item, confidence: 0.95 };
        }
      }

      // 3. Exact or substring match (case and diacritics insensitive)
      for (const item of allItems) {
        const normDb = normalizeText(item.name);
        if (normDb === normAi || normDb.includes(normAi) || normAi.includes(normDb)) {
          return { ...item, confidence: 0.95 };
        }
      }

      // 4. Token overlap and distinct brand/keyword matching
      const aiTokens = getTokens(aiName);
      if (aiTokens.length === 0) return null;

      let bestMatch: (typeof allItems)[number] | null = null;
      let highestScore = 0;

      for (const item of allItems) {
        const dbTokens = new Set(getTokens(item.name));
        let matchCount = 0;
        let distinctBonus = 0;

        for (const token of aiTokens) {
          if (dbTokens.has(token)) {
            matchCount++;
            const occurrences = allItems.filter((c) => getTokens(c.name).includes(token)).length;
            if (occurrences === 1 && token.length >= 4) {
              distinctBonus += 3;
            } else if (occurrences <= 2) {
              distinctBonus += 1;
            }
          }
        }

        if (matchCount > 0) {
          const score = (matchCount / aiTokens.length) * 10 + distinctBonus;
          if (score > highestScore && (matchCount >= 2 || distinctBonus >= 3)) {
            highestScore = score;
            bestMatch = item;
          }
        }
      }

      if (bestMatch) {
        return { ...bestMatch, confidence: 0.9 };
      }

      return null;
    }

    if (aiItems.length > 0) {
      for (const aiItem of aiItems) {
        const aiName = warehouseText(aiItem.name, 'Rozpoznaný název', 200, true)!;
        const matchedDbItem = matchItemToCatalog(aiName, aiItem.matchedCatalogItemId);

        if (matchedDbItem) {
          const detectedQty = warehouseNumber(aiItem.quantity, 'Rozpoznané množství');
          detected.push({
            itemId: matchedDbItem.id,
            name: matchedDbItem.name,
            unit: matchedDbItem.unit,
            detectedQty,
            confidence: matchedDbItem.confidence,
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
      catalogItems: allItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit })),
      message: `AI bezpečně spárovala ${detected.length} položek se skladem${unmatchedItems.length ? `; ${unmatchedItems.length} nerozpoznaných položek nebylo možné vydat` : ''}.`,
    });
  } catch (error) {
    if (error instanceof WarehouseInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Photo recognition error:', error);
    return NextResponse.json({ error: 'Rozpoznání fotky selhalo.' }, { status: 500 });
  }
}
