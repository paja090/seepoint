import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SYSTEM_MODULES, getModuleIdForPath } from '../../lib/organization-modules';
import { roles, canAccess } from '../../lib/rbac';
const out = 'reports/academy-2026-10-08';
function walk(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name).replaceAll('\\','/')]); }
const files = walk('app');
const pages = files.filter(p => p.endsWith('/page.tsx')).map(file => {
  const source = readFileSync(file,'utf8');
  const route = file.replace(/^app/,'').replace(/\/page.tsx$/,'') || '/';
  const guard = [...source.matchAll(/(?:requirePageAccess|canAccess|hasModuleAccess)\([^\n;]+/g)].map(m => m[0]);
  const section = source.match(/requirePageAccess\(['"]([^'"]+)/)?.[1];
  return { route, file, module: getModuleIdForPath(route), guard, rolesByDirectSectionOnly: section ? roles.filter(r => canAccess(r, section as any)) : null, redirects: [...source.matchAll(/redirect\(['"]([^'"]+)/g)].map(m=>m[1]), components: [...source.matchAll(/from ['"](@\/components\/[^'"]+)/g)].map(m=>m[1]), evidence: 'CODE_INDEXED', runtime: 'NOT_VERIFIED' };
});
const api = files.filter(p => p.endsWith('/route.ts')).map(file => { const source = readFileSync(file,'utf8'); return { route: file.replace(/^app/,'').replace(/\/route.ts$/,''), file, methods: [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|OPTIONS|HEAD)\b/g)].map(m=>m[1]), securityMarkers: [...new Set([...source.matchAll(/\b(requireApiAccess|requireModuleAccess|getCurrentUser|runWithTenantContext|requireTenantContext|getPublicRow|enforceRateLimit)\b/g)].map(m=>m[1]))], runtime: 'NOT_VERIFIED' }; });
const schema = readFileSync('prisma/schema.prisma','utf8');
const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(m=>({ name:m[1], tenant: /\borganizationId\b/.test(m[2]), fields:m[2].split('\n').map(x=>x.trim()).filter(x=>x && !x.startsWith('//')) }));
const tests = walk('tests').filter(x=>x.endsWith('.test.ts'));
const e2e = walk('e2e').filter(x=>x.endsWith('.spec.ts'));
writeFileSync(`${out}/inventory.json`, JSON.stringify({ generatedAt: new Date().toISOString(), scope:'Local working tree; not remote HEAD verification. Direct guard extraction is an index, not an authorization proof.', counts:{pages:pages.length,routeHandlers:api.length,models:models.length,unitTestFiles:tests.length,e2eSpecs:e2e.length}, modules:SYSTEM_MODULES,pages,api,models,tests,e2e },null,2));
writeFileSync(`${out}/route-index.md`, '# Úplný index stránek\n\nGenerovaný index, nikoli důkaz funkčnosti. Role jsou pouze přímý section guard; platí navíc tenant, licence a pravidla konkrétní akce. Prázdný guard neznamená veřejný přístup.\n\n| Route | Soubor | Přímý guard |\n|---|---|---|\n'+pages.map(p=>`| \`${p.route}\` | \`${p.file}\` | ${p.guard.join('; ').replaceAll('|','/')} |`).join('\n')+'\n');
console.log(JSON.stringify({pages:pages.length,routeHandlers:api.length,models:models.length,unitTestFiles:tests.length,e2eSpecs:e2e.length}));
