import { Prisma, WarehouseMovementType } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  MAX_WAREHOUSE_BATCH_SIZE,
  WarehouseInputError,
  warehouseMovementType,
  warehouseNumber,
  warehouseText,
} from '@/lib/warehouse-validation';

export type WarehouseMovementRequest = {
  itemId: unknown;
  type: unknown;
  quantity: unknown;
  workOrderId?: unknown;
  assignedEmployeeId?: unknown;
  note?: unknown;
};

export class WarehouseStockError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'WarehouseStockError';
  }
}

function parseMovement(input: WarehouseMovementRequest) {
  return {
    itemId: warehouseText(input.itemId, 'Skladová položka', 128, true)!,
    type: warehouseMovementType(input.type),
    quantity: warehouseNumber(input.quantity, 'Množství'),
    workOrderId: warehouseText(input.workOrderId, 'Zakázka', 128),
    assignedEmployeeId: warehouseText(input.assignedEmployeeId, 'Zaměstnanec', 128),
    note: warehouseText(input.note, 'Poznámka', 1000),
  };
}

export async function recordWarehouseMovements(inputs: WarehouseMovementRequest[], performedByName: string) {
  if (inputs.length === 0 || inputs.length > MAX_WAREHOUSE_BATCH_SIZE) {
    throw new WarehouseInputError(`Jedna operace může obsahovat 1 až ${MAX_WAREHOUSE_BATCH_SIZE} pohybů.`);
  }
  const parsed = inputs.map(parseMovement);

  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const input of parsed) {
      const item = await tx.warehouseItem.findUnique({ where: { id: input.itemId } });
      if (!item) throw new WarehouseStockError('Skladová položka nebyla nalezena.', 404);

      if (input.workOrderId) {
        const workOrder = await tx.workOrder.findUnique({ where: { id: input.workOrderId }, select: { id: true } });
        if (!workOrder) throw new WarehouseStockError('Vybraná zakázka nebyla nalezena.', 400);
      }

      let assignedEmployeeName: string | null = null;
      if (input.assignedEmployeeId) {
        const employee = await tx.employee.findUnique({
          where: { id: input.assignedEmployeeId },
          select: { firstName: true, lastName: true },
        });
        if (!employee) throw new WarehouseStockError('Vybraný zaměstnanec nebyl nalezen.', 400);
        assignedEmployeeName = `${employee.firstName} ${employee.lastName}`.trim();
      }

      if (input.type === WarehouseMovementType.ISSUE) {
        const updated = await tx.warehouseItem.updateMany({
          where: { id: input.itemId, quantityInStock: { gte: input.quantity } },
          data: { quantityInStock: { decrement: input.quantity } },
        });
        if (updated.count !== 1) {
          const latest = await tx.warehouseItem.findUnique({ where: { id: input.itemId }, select: { quantityInStock: true, unit: true } });
          throw new WarehouseStockError(
            `Nedostatek materiálu na skladě. Aktuálně je k dispozici pouze ${Number(latest?.quantityInStock ?? 0)} ${latest?.unit ?? item.unit}.`,
            409,
          );
        }
      } else if (input.type === WarehouseMovementType.ADJUSTMENT) {
        await tx.warehouseItem.update({ where: { id: input.itemId }, data: { quantityInStock: input.quantity } });
      } else {
        await tx.warehouseItem.update({
          where: { id: input.itemId },
          data: { quantityInStock: { increment: input.quantity } },
        });
      }

      const movement = await tx.warehouseMovement.create({
        data: {
          itemId: input.itemId,
          type: input.type,
          quantity: new Prisma.Decimal(input.quantity),
          workOrderId: input.workOrderId,
          assignedEmployeeId: input.assignedEmployeeId,
          assignedEmployeeName,
          performedByName,
          note: input.note,
        },
        include: { item: true, workOrder: true },
      });
      results.push(movement);
    }
    return results;
  });
}
