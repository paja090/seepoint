import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx']);
const SELF_PATH = 'scripts/check-tenant-security.mjs';

// Every bypass is intentionally explicit. A legitimate change must update this
// baseline in the same reviewed pull request instead of silently widening access.
const PLATFORM_PRISMA_BASELINE = new Map([
  ['app/admin/organizations/[id]/page.tsx', 5],
  ['app/admin/organizations/page.tsx', 3],
  ['app/api/admin/organizations/[id]/route.ts', 3],
  ['app/api/admin/organizations/route.ts', 5],
  ['app/api/auth/login/route.ts', 2],
  ['app/api/auth/reset-admin/route.ts', 4],
  ['app/api/auth/set-password/route.ts', 5],
  ['app/api/network/inventory/route.ts', 2],
  ['app/api/network/partners/route.ts', 2],
  ['app/api/organization/invitations/[id]/route.ts', 6],
  ['app/api/organization/invitations/route.ts', 6],
  ['app/api/onboarding/route.ts', 7],
  ['app/api/settings/company/route.ts', 5],
  ['app/onboarding/page.tsx', 5],
  ['app/settings/company/page.tsx', 2],
  ['app/settings/members/page.tsx', 3],
  ['lib/ai-usage.ts', 3],
  ['lib/auth.ts', 7],
  ['lib/db.ts', 6],
  ['lib/offers/service.ts', 3],
  ['lib/organization-usage.ts', 3],
  ['lib/public-tenant.ts', 3],
  ['lib/tenant-request-context.ts', 2],
  ['scripts/import-carriers-2026.ts', 4],
]);

const RAW_SQL_BASELINE = new Map([
  ['app/api/photos/link/route.ts', 2],
  ['app/api/photos/route.ts', 3],
  ['lib/crm/order-service.ts', 1],
  ['lib/navigation/navigation-service.ts', 1],
  ['lib/offers/service.ts', 1],
  ['scripts/import-carriers-2026.ts', 2],
]);

const DIRECT_CLIENT_BASELINE = new Map([
  ['lib/db.ts', 1],
  ['scripts/check_database_settlements.js', 1],
  ['scripts/check_seeding_status.js', 1],
  ['scripts/import-carriers-2026.ts', 1],
  ['scripts/inspect-and-purge-orders.js', 1],
  ['scripts/list_employees.js', 1],
  ['scripts/list_users.js', 1],
  ['scripts/preview-tenant-e2e.mjs', 1],
  ['scripts/purge-test-offers.js', 1],
  ['scripts/seed-demo-settlement.ts', 1],
  ['scripts/seed-vehicles-2026.ts', 1],
  ['scripts/seed-warehouse-2026.ts', 1],
  ['scripts/setup_e2e_rates_and_tasks.js', 1],
  ['scripts/setup_e2e_users.js', 1],
]);

const API_ROUTE_EXCEPTIONS = new Set([
  // Authentication endpoints establish or destroy the organization-aware session.
  'app/api/auth/forgot-password/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/auth/reset-admin/route.ts',
  'app/api/auth/switch-organization/route.ts',
  // Public lead capture from marketing landing page.
  'app/api/leads/demo/route.ts',
  // Public token services resolve ownership before entering tenant context.
  'app/api/client/navigation-documentation/[token]/logo/route.ts',
  'app/api/client/navigation-documentation/[token]/photos/[photoId]/route.ts',
  'app/api/client/navigation-documentation/[token]/route.ts',
  'app/api/proposals/[token]/artwork/route.ts',
  'app/api/proposals/[token]/installation-sheet/route.ts',
  'app/api/proposals/[token]/logo/route.ts',
  'app/api/proposals/[token]/pdf/route.ts',
  'app/api/proposals/[token]/photos/[photoId]/route.ts',
  'app/api/proposals/[token]/respond/route.ts',
  'app/api/proposals/[token]/route.ts',
  'app/api/proposals/[token]/salesperson-photo/route.ts',
  'app/api/proposals/[token]/selection/route.ts',
]);

const DIRECT_GUARD_PATTERN = /\b(?:requireApiAccess|getCurrentUser|requireOrganization|requireOrganizationMember|requireOrganizationRole|requireSuperAdmin|enterTenantContext|requireTenantContext)\s*\(/;
const ROUTE_HANDLER_PATTERN = /export\s+(?:(?:async\s+)?function|const)\s+(?:GET|POST|PUT|PATCH|DELETE)\b/;

function normalizePath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function sourceFiles(root) {
  const files = [];
  for (const sourceRoot of ['app', 'lib', 'scripts']) {
    const absoluteRoot = path.join(root, sourceRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(absolute);
      }
    };
    visit(absoluteRoot);
  }
  return files.filter((file) => normalizePath(root, file) !== SELF_PATH);
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function collectOccurrences(root, files, pattern) {
  const occurrences = new Map();
  for (const file of files) {
    const count = countMatches(fs.readFileSync(file, 'utf8'), pattern);
    if (count) occurrences.set(normalizePath(root, file), count);
  }
  return occurrences;
}

function compareBaseline(label, actual, expected, errors) {
  for (const [file, count] of actual) {
    const allowed = expected.get(file);
    if (allowed === undefined) errors.push(`${label}: nové nepovolené použití v ${file} (${count}×).`);
    else if (allowed !== count) errors.push(`${label}: ${file} má ${count} použití, schválený baseline je ${allowed}.`);
  }
  for (const [file, count] of expected) {
    if (!actual.has(file)) errors.push(`${label}: odstraňte zastaralý baseline ${file} (${count}×).`);
  }
}

export function hasDirectTenantGuard(source) {
  return DIRECT_GUARD_PATTERN.test(source);
}

export function validateTenantSecurity(root = PROJECT_ROOT) {
  const errors = [];
  const files = sourceFiles(root);
  const platformPrisma = collectOccurrences(root, files, /\bplatformPrisma\b/g);
  const rawSql = collectOccurrences(root, files, /\.\$(?:queryRaw|executeRaw)(?:Unsafe)?\b/g);
  const directClients = collectOccurrences(root, files, /new\s+PrismaClient\b/g);
  compareBaseline('platformPrisma bypass', platformPrisma, PLATFORM_PRISMA_BASELINE, errors);
  compareBaseline('raw SQL', rawSql, RAW_SQL_BASELINE, errors);
  compareBaseline('přímý PrismaClient', directClients, DIRECT_CLIENT_BASELINE, errors);

  for (const file of files) {
    const relative = normalizePath(root, file);
    const source = fs.readFileSync(file, 'utf8');
    if (/\.\$(?:queryRaw|executeRaw)Unsafe\b/.test(source)) {
      errors.push(`unsafe raw SQL je zakázáno: ${relative}.`);
    }
    if (relative.startsWith('app/api/') && relative.endsWith('/route.ts') && ROUTE_HANDLER_PATTERN.test(source)) {
      if (!hasDirectTenantGuard(source) && !API_ROUTE_EXCEPTIONS.has(relative)) {
        errors.push(`API route nemá přímý organization/auth guard: ${relative}.`);
      }
    }
  }
  return errors;
}

function selfTest() {
  if (!hasDirectTenantGuard('const user = await getCurrentUser();')) throw new Error('Self-test: getCurrentUser guard nebyl rozpoznán.');
  if (!hasDirectTenantGuard('await requireOrganizationRole(\'ADMIN\');')) throw new Error('Self-test: organization guard nebyl rozpoznán.');
  if (hasDirectTenantGuard('export async function GET() { return Response.json([]); }')) throw new Error('Self-test: nezabezpečený handler byl přijat.');
  console.log('Tenant security self-test: OK');
}

const args = new Set(process.argv.slice(2));
if (args.has('--self-test')) selfTest();
else {
  const errors = validateTenantSecurity();
  if (errors.length) {
    console.error('Tenant security guard selhal:\n');
    errors.forEach((error) => console.error(`- ${error}`));
    console.error('\nNovou výjimku přidejte pouze s bezpečnostním zdůvodněním a code review.');
    process.exitCode = 1;
  } else {
    console.log('Tenant security guard: OK');
  }
}
