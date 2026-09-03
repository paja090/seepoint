import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { canRecordWarehouseMovement } from '@/lib/rbac';
import { recordWarehouseMovements, WarehouseStockError } from '@/lib/warehouse-stock';
import { WarehouseInputError, warehouseText } from '@/lib/warehouse-validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  if (!canRecordWarehouseMovement(user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění zapisovat pohyby skladu.' }, { status: 403 });
  }

  await ensureWarehouseSchema();

  try {
    const body = await request.json();
    const { speechText, workOrderId, assignedEmployeeId } = body;

    const cleanSpeechText = warehouseText(speechText, 'Hlasový příkaz', 500, true)!;
    const text = cleanSpeechText.toLowerCase();
    const allItems = await prisma.warehouseItem.findMany();

    if (allItems.length === 0) {
      return NextResponse.json({ error: 'Ve skladu zatím nejsou žádné položky.' }, { status: 400 });
    }

    // Match items in text
    const matchedIssues: { item: typeof allItems[0]; quantity: number }[] = [];

    for (const item of allItems) {
      const itemNameLower = item.name.toLowerCase();
      const keywords = itemNameLower.split(/\s+/).filter((w) => w.length > 3);

      // Check if text mentions this item's keywords or code
      const isMatch =
        (item.code && text.includes(item.code.toLowerCase())) ||
        keywords.some((kw) => text.includes(kw));

      if (isMatch) {
        // Try to extract numbers preceding or succeeding the keyword
        let qty = 1;
        const numberMatches = text.match(/(\d+)\s*(ks|balení|baleni|kusy|kusů|role|kbelík|kbelik)?/i);
        if (numberMatches && numberMatches[1]) {
          const parsed = parseInt(numberMatches[1], 10);
          if (parsed > 0) qty = parsed;
        }

        // Avoid duplicates in single voice command
        if (!matchedIssues.some((m) => m.item.id === item.id)) {
          matchedIssues.push({ item, quantity: qty });
        }
      }
    }

    if (matchedIssues.length === 0) {
      return NextResponse.json({
        error: `AI nerozpoznala v příkazu "${speechText}" žádnou známou skladovou položku. Zkuste vyslovit např. "pásky", "lepidlo" nebo "žebřík".`,
      }, { status: 400 });
    }
    if (matchedIssues.length > 1) {
      return NextResponse.json({
        error: 'Příkaz odpovídá více skladovým položkám. Kvůli bezpečnému výdeji vyslovte vždy jen jednu položku a její množství.',
      }, { status: 400 });
    }

    const isReturn = /vrátil|vracím|vracim|dávám zpět|davam zpet|vráceno|vraceno|zpět do skladu|zpet do skladu/i.test(text);
    const movementType = isReturn ? 'RETURN' : 'ISSUE';

    const performedByName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;

    const movements = await recordWarehouseMovements(matchedIssues.map((issue) => ({
      itemId: issue.item.id,
      type: movementType,
      quantity: issue.quantity,
      workOrderId,
      assignedEmployeeId,
      note: `Hlasový pohyb (${isReturn ? 'Vracení' : 'Výdej'}): "${cleanSpeechText}"`,
    })), performedByName);
    const results = movements.map((movement) => ({
      name: movement.item.name,
      quantity: Number(movement.quantity),
      unit: movement.item.unit,
      newStock: Number(movement.item.quantityInStock),
    }));

    const actionTitle = isReturn ? 'Úspěšně vráceno do skladu' : 'Úspěšně vydáno ze skladu';
    return NextResponse.json({
      success: true,
      speechText: cleanSpeechText,
      issuedItems: results,
      message: `${actionTitle}: ${results.map((r) => `${r.quantity} ${r.unit} ${r.name}`).join(', ')}`,
    });
  } catch (error) {
    if (error instanceof WarehouseInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof WarehouseStockError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Voice issue error:', error);
    return NextResponse.json({ error: 'Zpracování hlasového příkazu selhalo.' }, { status: 500 });
  }
}
