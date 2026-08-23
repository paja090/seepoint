import { readFileSync, writeFileSync } from 'node:fs';

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);

const tenantModels = new Set([
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
]);

let schema = readFileSync(schemaPath, 'utf8');

if (!schema.includes('enum PlatformRole')) {
  schema = schema.replace('enum Role {', `enum PlatformRole {
  SUPER_ADMIN
}

enum OrganizationRole {
  OWNER
  ADMIN
  MANAGER
  SALES
  TECHNICIAN
  WORKER
  ACCOUNTANT
  VIEWER
}

enum OrganizationPlan {
  INTERNAL
  START
  BUSINESS
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  INTERNAL
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELLED
}

enum InventoryVisibility {
  PRIVATE
  PARTNER
  SHARED
  MARKETPLACE
}

enum Role {`);
}

if (!schema.includes('model Organization {')) {
  const organizationModels = `
model Organization {
  id                 String             @id @default(cuid())
  name               String
  slug               String             @unique
  companyId          String?
  vatId              String?
  street             String?
  city               String?
  postalCode         String?
  country            String             @default("CZ")
  email              String?
  phone              String?
  website            String?
  logoUrl            String?
  primaryColor       String?
  secondaryColor     String?
  emailSignature     String?
  defaultCurrency    String             @default("CZK")
  bankAccount        String?
  iban               String?
  swift              String?
  plan               OrganizationPlan   @default(START)
  subscriptionStatus SubscriptionStatus @default(TRIAL)
  trialEndsAt        DateTime?
  isActive           Boolean            @default(true)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  members            OrganizationMember[]
  invitations        OrganizationInvitation[]

  @@index([isActive])
  @@index([plan])
}

model OrganizationMember {
  id             String           @id @default(cuid())
  organizationId String
  userId         String
  role           OrganizationRole
  roles          OrganizationRole[] @default([])
  isActive       Boolean          @default(true)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([userId, isActive])
  @@index([organizationId, role])
}

model OrganizationInvitation {
  id             String           @id @default(cuid())
  organizationId String
  email          String
  role           OrganizationRole
  tokenHash      String           @unique
  expiresAt      DateTime
  acceptedAt     DateTime?
  invitedById    String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  invitedBy      User?            @relation(fields: [invitedById], references: [id], onDelete: SetNull)

  @@index([organizationId, email])
  @@index([email, expiresAt])
}

`;
  schema = schema.replace('model User {', `${organizationModels}model User {`);
}

schema = schema.replace(
  /model User \{([\s\S]*?)\n\}/,
  (block) => {
    let next = block;
    if (!next.includes('platformRole')) {
      next = next.replace(/(\n  email\s+String\s+@unique)/, '$1\n  platformRole       PlatformRole?');
    }
    if (!next.includes('organizationMemberships')) {
      next = next.replace(/(\n  importBatches\s+ImportBatch\[\])/, '\n  organizationMemberships         OrganizationMember[]\n  organizationInvitations         OrganizationInvitation[]$1');
    }
    return next;
  },
);

schema = schema.replace(
  /model UserSession \{([\s\S]*?)\n\}/,
  (block) => block.includes('activeOrganizationId')
    ? block
    : block.replace(/(\n  userId\s+String)/, '$1\n  activeOrganizationId String?'),
);

schema = schema.replace('  employee                       Employee?', '  employees                      Employee[]');
schema = schema.replace(/(model AdvertisingCarrier \{[\s\S]*?\n  code\s+String[^\n]*)(?![\s\S]*?\n  visibility)/, '$1\n  visibility           InventoryVisibility @default(PRIVATE)');
schema = schema.replace(/(model AdvertisingSurface \{[\s\S]*?\n  name\s+String[^\n]*)(?![\s\S]*?\n  visibility)/, '$1\n  visibility           InventoryVisibility @default(PRIVATE)');

schema = schema.replace(/model ([A-Za-z0-9_]+) \{([\s\S]*?)\n\}/g, (block, modelName) => {
  if (!tenantModels.has(modelName) || block.includes('organizationId')) return block;
  let next = block.replace(/(\n  id\s+String[^\n]*)/, '$1\n  organizationId String @default(dbgenerated("current_setting(\'app.current_organization_id\'::text, true)"))');
  next = next.replace(/\n\}/, '\n\n  @@index([organizationId])\n}');
  return next;
});

schema = schema.replace(/model ([A-Za-z0-9_]+) \{([\s\S]*?)\n\}/g, (block, modelName) => {
  if (!tenantModels.has(modelName)) return block;
  return block.replace(
    /organizationId\s+String(?!\s+@default)/,
    'organizationId String @default(dbgenerated("current_setting(\'app.current_organization_id\'::text, true)"))',
  );
});

const replacements = [
  ['  userId         String?        @unique', '  userId         String?'],
  ['  email          String?        @unique', '  email          String?'],
  ['  normalizedName  String               @unique', '  normalizedName  String'],
  ['  externalCode    String?              @unique', '  externalCode    String?'],
  ['  code                 String        @unique', '  code                 String'],
  ['  sourceKey            String?       @unique', '  sourceKey            String?'],
  ['  sourceKey              String?                @unique', '  sourceKey              String?'],
  ['  code              String                @unique', '  code              String'],
  ['  versionKey      String       @unique', '  versionKey      String'],
  ['  invoiceNumber String        @unique', '  invoiceNumber String'],
  ['  orderNumber     String         @unique', '  orderNumber     String'],
  ['  contractNumber   String         @unique', '  contractNumber   String'],
  ['  invoiceNumber  String              @unique', '  invoiceNumber  String'],
  ['  contractNumber    String   @unique', '  contractNumber    String'],
];
for (const [from, to] of replacements) schema = schema.replaceAll(from, to);

const compoundUniques = new Map([
  ['Employee', ['@@unique([organizationId, userId])', '@@unique([organizationId, email])']],
  ['Client', ['@@unique([organizationId, normalizedName])', '@@unique([organizationId, externalCode])']],
  ['AdvertisingCarrier', ['@@unique([organizationId, code])', '@@unique([organizationId, sourceKey])']],
  ['AdvertisingSurface', ['@@unique([organizationId, sourceKey])']],
  ['Occupancy', ['@@unique([organizationId, sourceKey])']],
  ['OfferPriceRule', ['@@unique([organizationId, code])']],
  ['PriceListItem', ['@@unique([organizationId, versionKey])']],
  ['Invoice', ['@@unique([organizationId, invoiceNumber])']],
  ['CrmOrder', ['@@unique([organizationId, orderNumber])']],
  ['ClientContract', ['@@unique([organizationId, contractNumber])']],
  ['ClientInvoice', ['@@unique([organizationId, invoiceNumber])']],
  ['NavigationContract', ['@@unique([organizationId, contractNumber])']],
]);

schema = schema.replace(/model ([A-Za-z0-9_]+) \{([\s\S]*?)\n\}/g, (block, modelName) => {
  const uniques = compoundUniques.get(modelName);
  if (!uniques) return block;
  const missing = uniques.filter((value) => !block.includes(value));
  if (missing.length === 0) return block;
  return block.replace(/\n\}/, `\n  ${missing.join('\n  ')}\n}`);
});

writeFileSync(schemaPath, schema);
console.log(`Prepared ${tenantModels.size} tenant-scoped models in prisma/schema.prisma.`);
