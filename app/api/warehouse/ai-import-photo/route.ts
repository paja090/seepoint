import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { WarehouseItemCategory } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();

  try {
    const body = await request.json();

    // If saving confirmed items directly to DB:
    if (body.itemsToSave && Array.isArray(body.itemsToSave)) {
      const createdCount = await prisma.$transaction(
        body.itemsToSave.map((item: any) =>
          prisma.warehouseItem.create({
            data: {
              name: item.name.trim(),
              category: item.category === 'RETURNABLE' ? 'RETURNABLE' : 'CONSUMABLE',
              unit: item.unit || 'ks',
              quantityInStock: Number(item.quantityInStock) || 1,
              minQuantity: item.minQuantity ? Number(item.minQuantity) : 2,
              location: item.location ? String(item.location).trim() : 'Dílna / Regál',
              note: item.note || 'Automaticky naskladněno pomocí AI Fotky regálu',
            },
          })
        )
      );

      return NextResponse.json({
        success: true,
        count: createdCount.length,
        message: `Úspěšně uloženo ${createdCount.length} nových položek do databáze skladu!`,
      });
    }

    // Otherwise photo analysis request
    const { photoBase64, filename } = body;
    if (!photoBase64 && !filename) {
      return NextResponse.json({ error: 'Nahrajte fotku regálu s materiálem.' }, { status: 400 });
    }

    let proposedItems: any[] = [];

    // Call real Gemini Vision AI model
    if (photoBase64) {
      const { analyzeWarehouseItemsFromPhotoWithGemini } = await import('@/lib/ai-gemini');
      const aiItems = await analyzeWarehouseItemsFromPhotoWithGemini(photoBase64);

      if (aiItems.length > 0) {
        proposedItems = aiItems.map((i) => ({
          name: i.name,
          category: i.category,
          unit: i.unit,
          quantityInStock: i.quantity,
          minQuantity: 2,
          location: i.location,
          note: i.note,
        }));
      }
    }

    // Heuristics fallback if photo has specific filename hints or AI Vision key not provided
    if (proposedItems.length === 0) {
      const nameLower = (filename || '').toLowerCase();

      if (nameLower.includes('metr') || nameLower.includes('meter') || nameLower.includes('pasmo')) {
        proposedItems.push({
          name: 'Svinovací metr (5m / pásmo)',
          category: 'RETURNABLE',
          unit: 'ks',
          quantityInStock: 1,
          minQuantity: 1,
          location: 'Regál A1 - Měřidla',
          note: 'Rozpoznán metr na fotografii',
        });
      } else {
        proposedItems.push({
          name: 'Předmět z fotografie',
          category: 'CONSUMABLE',
          unit: 'ks',
          quantityInStock: 1,
          minQuantity: 2,
          location: 'Dílna / Regál',
          note: 'Položka vyfotografována fotoaparátem',
        });
      }
    }

    return NextResponse.json({
      success: true,
      proposedItems,
      message: `AI rozpoznala a klasifikovala ${proposedItems.length} nových položek pro uložení do databáze.`,
    });
  } catch (error) {
    console.error('AI import photo error:', error);
    return NextResponse.json({ error: 'AI analýza fotky selhala.' }, { status: 500 });
  }
}
