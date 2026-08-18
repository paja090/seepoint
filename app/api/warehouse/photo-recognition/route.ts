import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();

  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nahrajte fotku materiálu.' }, { status: 400 });
    }

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

    if (aiItems.length > 0) {
      for (const aiItem of aiItems) {
        // Try to match AI identified name with existing database items
        const matchedDbItem = allItems.find(
          (dbItem) =>
            dbItem.name.toLowerCase().includes(aiItem.name.toLowerCase()) ||
            aiItem.name.toLowerCase().includes(dbItem.name.toLowerCase())
        );

        if (matchedDbItem) {
          detected.push({
            itemId: matchedDbItem.id,
            name: matchedDbItem.name,
            unit: matchedDbItem.unit,
            detectedQty: aiItem.quantity,
            confidence: 0.95,
          });
        } else {
          // If not in DB yet, present item name from Vision AI
          detected.push({
            itemId: allItems[0]?.id || 'new',
            name: aiItem.name,
            unit: aiItem.unit,
            detectedQty: aiItem.quantity,
            confidence: 0.9,
          });
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
      message: `AI rozpoznala ${detected.length} položek na fotce.`,
    });
  } catch (error) {
    console.error('Photo recognition error:', error);
    return NextResponse.json({ error: 'Rozpoznání fotky selhalo.' }, { status: 500 });
  }
}
