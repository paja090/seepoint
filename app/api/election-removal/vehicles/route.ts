import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { plannerTransaction } from '@/lib/field-planning/service';
export async function PATCH(request: Request) {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  try { const p = await request.json();
    if (typeof p.vehicleId !== 'string' || !Number.isInteger(p.capacitySlots) || p.capacitySlots < 1 || p.capacitySlots > 100000 || !Array.isArray(p.equipment) || !p.equipment.every((v: unknown) => typeof v === 'string' && v.length < 100)) throw new Error('Vyplňte platnou kapacitu a vybavení.');
    await plannerTransaction(async tx => {
      const changed = await tx.vehicle.updateMany({ where: { id: p.vehicleId, organizationId: auth.organizationId }, data: { capacitySlots: p.capacitySlots, equipment: p.equipment } });
      if (!changed.count) throw new Error('Vozidlo nebylo nalezeno.');
      await tx.crmAuditLog.create({ data: { organizationId: auth.organizationId, entityType: 'Vehicle', entityId: p.vehicleId, userId: auth.user.id, userEmail: auth.user.email, action: 'FIELD_VEHICLE_CAPACITY_UPDATED', detailsJson: JSON.stringify(p) } });
    }); return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Zápis selhal.' }, { status: 409 }); }
}
