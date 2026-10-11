import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import type { PlanningInput, PlanningResult } from '@/lib/field-planning/contracts';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * PATCH /api/election-removal/campaigns/[id]/crews
 * Allows dispatcher/manager to update crew members (and optionally vehicle)
 * for an already approved route in a campaign.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  // Only manager, admin, technician can reassign crews
  if (!['ADMIN', 'MANAGER', 'TECHNICIAN'].includes(auth.user.role)) {
    return NextResponse.json(
      { error: 'Nemáte oprávnění měnit složení posádek.' },
      { status: 403 }
    );
  }

  const { id: campaignId } = await params;

  try {
    const body = (await req.json()) as {
      crewId: string;
      employeeIds: string[];
      vehicleId?: string | null;
    };

    if (!body.crewId || typeof body.crewId !== 'string') {
      return NextResponse.json(
        { error: 'Chybí identifikátor posádky (crewId).' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.employeeIds) || body.employeeIds.length === 0) {
      return NextResponse.json(
        { error: 'Posádka musí mít přiřazeného alespoň jednoho pracovníka.' },
        { status: 400 }
      );
    }

    // Verify campaign exists and belongs to the organization
    const campaign = await prisma.electionCampaign.findFirst({
      where: { id: campaignId, organizationId: auth.organizationId },
      include: {
        fieldPlans: {
          where: { organizationId: auth.organizationId },
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Volební kampaň nebyla nalezena.' },
        { status: 404 }
      );
    }

    // Fetch and validate employees
    const employees = await prisma.employee.findMany({
      where: {
        organizationId: auth.organizationId,
        id: { in: body.employeeIds },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (employees.length !== body.employeeIds.length) {
      return NextResponse.json(
        { error: 'Někteří z vybraných pracovníků nejsou v organizaci aktivní.' },
        { status: 400 }
      );
    }

    const employeeMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()]));
    const employeeNames = body.employeeIds.map((id) => employeeMap.get(id) || id);

    // Fetch and validate vehicle if provided
    let vehicleName: string | null = null;
    if (body.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: body.vehicleId,
          organizationId: auth.organizationId,
        },
        select: { id: true, name: true, registrationNumber: true },
      });

      if (!vehicle) {
        return NextResponse.json(
          { error: 'Vybrané vozidlo nebylo nalezeno.' },
          { status: 400 }
        );
      }
      vehicleName = vehicle.registrationNumber
        ? `${vehicle.name} (${vehicle.registrationNumber})`
        : vehicle.name;
    }

    // Find the latest field plan(s) for this campaign
    const targetPlans = campaign.fieldPlans.filter((p) =>
      ['APPROVED', 'ACTIVE'].includes(p.status)
    );
    // If no active/approved plan, fall back to the most recent plan
    const plansToUpdate = targetPlans.length > 0 ? targetPlans : campaign.fieldPlans.slice(0, 1);

    if (plansToUpdate.length === 0) {
      return NextResponse.json(
        { error: 'Pro tuto kampaň zatím nebyla vytvořena žádná schválená trasa.' },
        { status: 400 }
      );
    }

    // Update each relevant FieldPlan
    for (const plan of plansToUpdate) {
      const summary = plan.planningSummary as unknown as PlanningResult;
      const inputSnap = plan.planningInputSnapshot as unknown as PlanningInput;

      if (summary && Array.isArray(summary.crews)) {
        const crew = summary.crews.find((c) => c.id === body.crewId);
        if (crew) {
          crew.employeeIds = body.employeeIds;
          crew.names = employeeNames;
          crew.vehicleId = body.vehicleId ?? null;
          crew.vehicleName = vehicleName;
        }
      }

      if (inputSnap && Array.isArray(inputSnap.crews)) {
        const inputCrew = inputSnap.crews.find((c) => c.id === body.crewId);
        if (inputCrew) {
          inputCrew.employeeIds = body.employeeIds;
          inputCrew.vehicleId = body.vehicleId ?? null;
        }
      }

      await prisma.fieldPlan.update({
        where: { id: plan.id, organizationId: auth.organizationId },
        data: {
          planningSummary: summary as unknown as Prisma.InputJsonValue,
          planningInputSnapshot: inputSnap as unknown as Prisma.InputJsonValue,
        },
      });

      // Audit log entry
      await prisma.crmAuditLog.create({
        data: {
          organizationId: auth.organizationId,
          entityType: 'FieldPlan',
          entityId: plan.id,
          userId: auth.user.id,
          userEmail: auth.user.email,
          action: 'FIELD_PLAN_CREW_UPDATED',
          detailsJson: JSON.stringify({
            campaignId,
            crewId: body.crewId,
            employeeIds: body.employeeIds,
            employeeNames,
            vehicleId: body.vehicleId ?? null,
            vehicleName,
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      crew: {
        id: body.crewId,
        employeeIds: body.employeeIds,
        names: employeeNames,
        vehicleId: body.vehicleId ?? null,
        vehicleName,
      },
    });
  } catch (error: unknown) {
    console.error('Chyba při změně posádky:', error);
    const message =
      error instanceof Error ? error.message : 'Nepodařilo se změnit posádku.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
