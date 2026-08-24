import { Prisma } from '@prisma/client';
import { assertOrganizationId, getTenantContext, requireTenantContext, runWithTenantContext } from './tenant-context';

export const TENANT_MODEL_NAMES = [
  'OrganizationOnboarding', 'IntegrationConnection',
  'UserAuditLog',
  'Employee', 'EmployeeBillingProfile', 'EmployeeRate', 'Client',
  'AdvertisingCarrier', 'WorkTask', 'Settlement', 'SettlementItem',
  'Vehicle', 'VehicleReservation', 'VehicleServiceRecord', 'VehicleFuelExpense',
  'EmployeeAbsence', 'ChatMessage', 'ChatRead', 'AdvertisingSurface', 'Occupancy',
  'Offer', 'SalesOpportunity', 'NavigationOffer', 'NavigationPoint',
  'NavigationDocumentationReport', 'NavigationDocumentationItem',
  'NavigationReportAuditLog', 'CityGalleryProject', 'CityGalleryFleetConfig',
  'CityGalleryOffer', 'MediaPackage', 'MediaPackageRule', 'OfferPackageSelection',
  'OfferPriceRule', 'OfferCharge', 'OfferItem', 'OfferEvent', 'Photo', 'ImportBatch',
  'PriceListItem', 'ImportRowError', 'WorkOrder', 'WorkAssignment', 'WorkOrderItem',
  'WorkOrderRate', 'CompanyRate', 'WorkEntry', 'WorkExpense', 'RecurringAdjustment',
  'SettlementAdjustment', 'SystemSettings', 'SettlementAuditLog', 'Invoice',
  'InvoiceItem', 'ClientContact', 'ClientBranch', 'CrmOrder', 'CrmRealization',
  'ClientContract', 'ClientInvoice', 'ClientInvoiceItem', 'ClientCommunication',
  'CrmTask', 'ClientDocument', 'CrmAuditLog', 'ClientMergeLog', 'NavigationOrder',
  'SurveyRoute', 'NavigationCandidatePoint', 'NavigationBillingPeriod',
  'NavigationPriceVersion', 'NavigationPriceAuditLog', 'NavigationContract',
  'NavigationContactPerson', 'CarrierHistoryLog', 'CompanyShoppingItem',
  'WarehouseItem', 'WarehouseMovement', 'QuickInternalTask',
] as const;

const tenantModels = new Set<string>(TENANT_MODEL_NAMES);
const datamodel = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));

type MutableRecord = Record<string, unknown>;

function record(value: unknown): MutableRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as MutableRecord : null;
}

export function tenantWhere(where: unknown, organizationId: string) {
  const current = record(where) ?? {};
  assertOrganizationId(current.organizationId, organizationId);
  return { ...current, organizationId };
}

function scopeCreateData(modelName: string, value: unknown, organizationId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => scopeCreateData(modelName, item, organizationId));
  const data = record(value);
  if (!data) return value;

  if (tenantModels.has(modelName)) {
    assertOrganizationId(data.organizationId, organizationId);
    data.organizationId = organizationId;
  }

  const model = datamodel.get(modelName);
  for (const field of model?.fields ?? []) {
    if (field.kind !== 'object' || !(field.name in data)) continue;
    const relationInput = record(data[field.name]);
    if (!relationInput) continue;
    const target = field.type;

    if ('create' in relationInput) relationInput.create = scopeCreateData(target, relationInput.create, organizationId);
    const createMany = record(relationInput.createMany);
    if (createMany && 'data' in createMany) createMany.data = scopeCreateData(target, createMany.data, organizationId);
    if ('update' in relationInput) relationInput.update = scopeUpdateData(target, relationInput.update, organizationId);
    const updateMany = record(relationInput.updateMany);
    if (updateMany) {
      if ('data' in updateMany) updateMany.data = scopeUpdateData(target, updateMany.data, organizationId);
      if (tenantModels.has(target) && 'where' in updateMany) updateMany.where = tenantWhere(updateMany.where, organizationId);
    }
    if ('upsert' in relationInput) {
      const upsert = record(relationInput.upsert);
      if (upsert) {
        if ('create' in upsert) upsert.create = scopeCreateData(target, upsert.create, organizationId);
        if ('update' in upsert) upsert.update = scopeUpdateData(target, upsert.update, organizationId);
      }
    }
    if ('connect' in relationInput && tenantModels.has(target)) {
      const connect = relationInput.connect;
      relationInput.connect = Array.isArray(connect)
        ? connect.map((item) => tenantWhere(item, organizationId))
        : tenantWhere(connect, organizationId);
    }
    const connectOrCreate = relationInput.connectOrCreate;
    if (connectOrCreate) {
      const entries = Array.isArray(connectOrCreate) ? connectOrCreate : [connectOrCreate];
      for (const entryValue of entries) {
        const entry = record(entryValue);
        if (!entry) continue;
        if (tenantModels.has(target)) entry.where = tenantWhere(entry.where, organizationId);
        entry.create = scopeCreateData(target, entry.create, organizationId);
      }
    }
  }
  return data;
}

function scopeUpdateData(modelName: string, value: unknown, organizationId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => scopeUpdateData(modelName, item, organizationId));
  const data = record(value);
  if (!data) return value;

  if (tenantModels.has(modelName) && 'organizationId' in data) {
    assertOrganizationId(data.organizationId, organizationId);
    delete data.organizationId;
  }

  const model = datamodel.get(modelName);
  for (const field of model?.fields ?? []) {
    if (field.kind !== 'object' || !(field.name in data)) continue;
    const relationInput = record(data[field.name]);
    if (!relationInput) continue;
    const target = field.type;

    if ('create' in relationInput) relationInput.create = scopeCreateData(target, relationInput.create, organizationId);
    const createMany = record(relationInput.createMany);
    if (createMany && 'data' in createMany) createMany.data = scopeCreateData(target, createMany.data, organizationId);
    if ('update' in relationInput) relationInput.update = scopeUpdateData(target, relationInput.update, organizationId);
    const updateMany = record(relationInput.updateMany);
    if (updateMany) {
      if ('data' in updateMany) updateMany.data = scopeUpdateData(target, updateMany.data, organizationId);
      if (tenantModels.has(target) && 'where' in updateMany) updateMany.where = tenantWhere(updateMany.where, organizationId);
    }
    if ('upsert' in relationInput) {
      const upsert = record(relationInput.upsert);
      if (upsert) {
        if ('create' in upsert) upsert.create = scopeCreateData(target, upsert.create, organizationId);
        if ('update' in upsert) upsert.update = scopeUpdateData(target, upsert.update, organizationId);
      }
    }
    if ('connect' in relationInput && tenantModels.has(target)) {
      const connect = relationInput.connect;
      relationInput.connect = Array.isArray(connect)
        ? connect.map((item) => tenantWhere(item, organizationId))
        : tenantWhere(connect, organizationId);
    }
    const connectOrCreate = relationInput.connectOrCreate;
    if (connectOrCreate) {
      const entries = Array.isArray(connectOrCreate) ? connectOrCreate : [connectOrCreate];
      for (const entryValue of entries) {
        const entry = record(entryValue);
        if (!entry) continue;
        if (tenantModels.has(target)) entry.where = tenantWhere(entry.where, organizationId);
        entry.create = scopeCreateData(target, entry.create, organizationId);
      }
    }
  }
  return data;
}

export function scopeTenantQuery(model: string | undefined, operation: string, argsValue: unknown) {
  if (!model || !tenantModels.has(model)) return argsValue;
  const { organizationId } = requireTenantContext();
  const args = record(argsValue) ?? {};

  if (['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
    args.where = tenantWhere(args.where, organizationId);
  }
  if (operation === 'create') args.data = scopeCreateData(model, args.data, organizationId);
  if (operation === 'createMany' || operation === 'createManyAndReturn') args.data = scopeCreateData(model, args.data, organizationId);
  if (operation === 'upsert') {
    args.create = scopeCreateData(model, args.create, organizationId);
    args.update = scopeUpdateData(model, args.update, organizationId);
  }
  if (operation === 'update' || operation === 'updateMany') {
    args.data = scopeUpdateData(model, args.data, organizationId);
  }
  return args;
}

export const tenantPrismaExtension = Prisma.defineExtension({
  name: 'seepoint-tenant-isolation',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        let context = getTenantContext();
        if (!context && model && tenantModels.has(model)) {
          const { resolveRequestTenantContext } = await import('./tenant-request-context');
          context = await resolveRequestTenantContext();
        }
        if (!context || !model || !tenantModels.has(model)) {
          return query(scopeTenantQuery(model, operation, args) as never);
        }
        return runWithTenantContext(context, () => query(scopeTenantQuery(model, operation, args) as never));
      },
    },
  },
});
