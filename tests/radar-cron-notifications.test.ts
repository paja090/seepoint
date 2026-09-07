import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const source = (relPath: string) => readFileSync(new URL(`../${relPath}`, import.meta.url), 'utf8');

test('vercel.json is valid and contains sales-radar cron job', () => {
  assert.equal(existsSync(new URL('../vercel.json', import.meta.url)), true);
  const vercelConfig = JSON.parse(source('vercel.json'));
  assert.ok(Array.isArray(vercelConfig.crons), 'crons must be an array');
  const radarCron = vercelConfig.crons.find((c: { path: string }) => c.path === '/api/cron/sales-radar');
  assert.ok(radarCron, 'cron /api/cron/sales-radar must be registered');
  assert.equal(radarCron.schedule, '0 6 * * 1-5', 'schedule should be weekdays at 06:00 UTC');
});

test('cron route guards execution with CRON_SECRET and admin check', () => {
  const cronSrc = source('app/api/cron/sales-radar/route.ts');
  assert.match(cronSrc, /CRON_SECRET/);
  assert.match(cronSrc, /getCurrentUser\(\)/);
  assert.match(cronSrc, /runDiscoveryForOrganization/);
  assert.match(cronSrc, /profile\.enabled/);
  assert.match(cronSrc, /SKIPPED_DISABLED/);
});

test('notifications service supports RADAR_OPPORTUNITY and includes them for sales', () => {
  const notifSrc = source('lib/notifications-service.ts');
  assert.match(notifSrc, /RADAR_OPPORTUNITY/);
  assert.match(notifSrc, /prisma\.salesOpportunity\.findMany/);
  assert.match(notifSrc, /opportunityScore/);
  assert.match(notifSrc, /\/sales\/opportunities/);
});

test('unread notifications route includes fresh radar opportunities in toast items', () => {
  const unreadSrc = source('app/api/notifications/unread/route.ts');
  assert.match(unreadSrc, /recentRadarOpps/);
  assert.match(unreadSrc, /type:\s*'RADAR'/);
  assert.match(unreadSrc, /opportunityScore\s*>=\s*70/);
});

test('radar settings modal clearly shows automated morning cron status and notifications', () => {
  const modalSrc = source('components/opportunities/RadarSettingsModal.tsx');
  assert.match(modalSrc, /Ranní automat: Každý všední den v 7:00/);
  assert.match(modalSrc, /Notifikace: Upozornění nad/);
  assert.match(modalSrc, /Automatické skenování i notifikace jsou pozastaveny/);
});
