import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();

  try {
    const body = await request.json();
    const { speechText, workOrderId, assignedEmployeeId } = body;

    if (!speechText || typeof speechText !== 'string' || !speechText.trim()) {
      return NextResponse.json({ error: 'Nebylo zachyceno žádné slovo.' }, { status: 400 });
    }

    const text = speechText.trim().toLowerCase();
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

    const isReturn = /vrátil|vracím|vracim|dávám zpět|davam zpet|vráceno|vraceno|zpět do skladu|zpet do skladu/i.test(text);
    const movementType = isReturn ? 'RETURN' : 'ISSUE';

    const performedByName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;

    let assignedEmployeeName: string | null = null;
    if (assignedEmployeeId) {
      const emp = await prisma.employee.findUnique({ where: { id: assignedEmployeeId } });
      if (emp) assignedEmployeeName = `${emp.firstName} ${emp.lastName}`.trim();
    }

    const results = [];

    for (const issue of matchedIssues) {
      const currentStock = Number(issue.item.quantityInStock);

      let newStock = currentStock;
      if (movementType === 'RETURN') {
        newStock = currentStock + issue.quantity;
      } else {
        newStock = Math.max(0, currentStock - issue.quantity);
      }

      const [movement] = await prisma.$transaction([
        prisma.warehouseMovement.create({
          data: {
            itemId: issue.item.id,
            type: movementType,
            quantity: issue.quantity,
            workOrderId: workOrderId || null,
            assignedEmployeeId: assignedEmployeeId || null,
            assignedEmployeeName: assignedEmployeeName || null,
            performedByName,
            note: `Hlasový pohyb (${isReturn ? 'Vracení' : 'Výdej'}): "${speechText}"`,
          },
        }),
        prisma.warehouseItem.update({
          where: { id: issue.item.id },
          data: { quantityInStock: newStock },
        }),
      ]);

      results.push({
        name: issue.item.name,
        quantity: issue.quantity,
        unit: issue.item.unit,
        newStock,
      });
    }

    const actionTitle = isReturn ? 'Úspěšně vráceno do skladu' : 'Úspěšně vydáno ze skladu';
    return NextResponse.json({
      success: true,
      speechText,
      issuedItems: results,
      message: `${actionTitle}: ${results.map((r) => `${r.quantity} ${r.unit} ${r.name}`).join(', ')}`,
    });
  } catch (error) {
    console.error('Voice issue error:', error);
    return NextResponse.json({ error: 'Zpracování hlasového příkazu selhalo.' }, { status: 500 });
  }
}
