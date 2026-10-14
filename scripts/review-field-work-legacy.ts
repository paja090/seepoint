import { prisma } from '../lib/db';
import { runWithTenantContext } from '../lib/tenant-context';
import { classifyLegacyOperation } from '../lib/election-removal/legacy-classification';
// Read-only report. No .env file is loaded and no mutations occur.
const organizationId = process.argv[2];
if (!organizationId) throw new Error('Usage: tsx scripts/review-field-work-legacy.ts ORGANIZATION_ID');
async function main() { await runWithTenantContext({ organizationId, source: 'script' }, async () => {
  const points = await prisma.electionRemovalPoint.findMany({ where: { organizationId, reviewRequired: true }, select: { id: true, description: true, status: true } });
  console.log(JSON.stringify(points.map(p => ({ id: p.id, historicalStatus: p.status, ...classifyLegacyOperation(p.description) })), null, 2));
}); }
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
