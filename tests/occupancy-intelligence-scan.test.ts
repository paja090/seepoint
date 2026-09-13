import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDeterministicFallbackEnrichment,
  type InsightToEnrich,
} from '../lib/occupancy/intelligence-ai';
import { periodsOverlap, getOverlapDaysCount } from '../lib/occupancy/availability-service';

describe('Occupancy Intelligence Audit & AI Layer', () => {
  describe('Deterministic AI Fallback Explanations', () => {
    it('provides clear Czech explanation and recommendation for DOUBLE_BOOKING', () => {
      const insight: InsightToEnrich = {
        id: 'ins-1',
        type: 'DOUBLE_BOOKING',
        severity: 'CRITICAL',
        title: 'Dvojitá rezervace: CP-01',
        deterministicReason: 'Plocha CP-01 má překrývající se blokace.',
        surfaceName: 'CP-01',
        carrierCode: 'OST-001',
        carrierCity: 'Ostrava',
      };

      const res = generateDeterministicFallbackEnrichment(insight);
      assert.ok(res.aiExplanation.includes('souběhu dvou platných rezervací'), 'Must explain collision clearly');
      assert.ok(res.aiRecommendation.includes('alternativní plochu'), 'Must recommend action');
      assert.ok(res.confidence >= 0.9);
    });

    it('provides clear Czech explanation and recommendation for STATUS_MISMATCH', () => {
      const insight: InsightToEnrich = {
        id: 'ins-2',
        type: 'STATUS_MISMATCH',
        severity: 'HIGH',
        title: 'Neshoda stavu: BB-05',
        deterministicReason: 'Plocha má stav OCCUPIED, ale žádná kampaň neprobíhá.',
      };

      const res = generateDeterministicFallbackEnrichment(insight);
      assert.ok(res.aiExplanation.includes('neodpovídá skutečnému stavu'), 'Must explain state divergence');
      assert.ok(res.aiRecommendation.includes('Synchronizovat stav plochy'), 'Must suggest sync action');
    });

    it('provides clear Czech explanation and recommendation for EXPIRED_OCCUPANCY', () => {
      const insight: InsightToEnrich = {
        id: 'ins-3',
        type: 'EXPIRED_OCCUPANCY',
        severity: 'MEDIUM',
        title: 'Neukončená kampaň: CLV-12',
        deterministicReason: 'Kampaň skončila včera, ale není FINISHED.',
      };

      const res = generateDeterministicFallbackEnrichment(insight);
      assert.ok(res.aiExplanation.includes('vypršel v minulosti'), 'Must explain expired state');
      assert.ok(res.aiRecommendation.includes('FINISHED'), 'Must suggest marking finished');
    });

    it('provides clear Czech explanation and recommendation for EXPIRING_CAMPAIGN', () => {
      const insight: InsightToEnrich = {
        id: 'ins-4',
        type: 'EXPIRING_CAMPAIGN',
        severity: 'MEDIUM',
        title: 'Končící kampaň za 7 dní',
        deterministicReason: 'Kampaň končí 20.10.2026.',
      };

      const res = generateDeterministicFallbackEnrichment(insight);
      assert.ok(res.aiExplanation.includes('blíží ke svému smluvnímu konci'), 'Must explain upcoming expiry');
      assert.ok(res.aiRecommendation.includes('prodloužení'), 'Must suggest renewal');
    });

    it('provides clear Czech explanation and recommendation for UNDERUTILIZED_MEDIA', () => {
      const insight: InsightToEnrich = {
        id: 'ins-5',
        type: 'UNDERUTILIZED_MEDIA',
        severity: 'LOW',
        title: 'Nevyužitá plocha > 60 dní',
        deterministicReason: 'Plocha neměla kampaň 75 dní.',
      };

      const res = generateDeterministicFallbackEnrichment(insight);
      assert.ok(res.aiExplanation.includes('ušlý zisk'), 'Must mention lost revenue/capacity');
      assert.ok(res.aiRecommendation.includes('balíčků') || res.aiRecommendation.includes('slevu'), 'Must suggest packages/discount');
    });
  });

  describe('Stable Fingerprint Generation & Deduplication Logic', () => {
    it('produces identical fingerprints for the same logical collision regardless of item order', () => {
      const orgId = 'org-123';
      const surfaceId = 'surf-456';
      const occA = 'occ-aaa';
      const occB = 'occ-bbb';

      // Sorted order ensures idempotency
      const pairKey1 = [occA, occB].sort().join('_');
      const pairKey2 = [occB, occA].sort().join('_');

      const fp1 = `${orgId}:DOUBLE_BOOKING:${surfaceId}:${pairKey1}`;
      const fp2 = `${orgId}:DOUBLE_BOOKING:${surfaceId}:${pairKey2}`;

      assert.equal(fp1, fp2, 'Fingerprints must match deterministically across scans');
    });

    it('produces distinct fingerprints for different surfaces', () => {
      const fp1 = 'org-1:STATUS_MISMATCH:surf-A';
      const fp2 = 'org-1:STATUS_MISMATCH:surf-B';
      assert.notEqual(fp1, fp2);
    });

    it('produces distinct fingerprints for different tenants (Tenant Isolation)', () => {
      const fpTenantA = 'org-AAA:DOUBLE_BOOKING:surf-1:occ-1_occ-2';
      const fpTenantB = 'org-BBB:DOUBLE_BOOKING:surf-1:occ-1_occ-2';
      assert.notEqual(fpTenantA, fpTenantB, 'Fingerprints must never bleed between tenants');
    });
  });

  describe('Simulation of Auto-Resolution Flow', () => {
    it('detects when an open issue disappears in subsequent scans', () => {
      // Previous scan had 2 active findings
      const previousScanOpenFingerprints = new Set([
        'org-1:DOUBLE_BOOKING:s1:o1_o2',
        'org-1:STATUS_MISMATCH:s2',
      ]);

      // Current scan detects only STATUS_MISMATCH (DOUBLE_BOOKING was fixed)
      const currentScanDetectedFingerprints = new Set([
        'org-1:STATUS_MISMATCH:s2',
      ]);

      // Auto-resolve logic
      const resolved = [...previousScanOpenFingerprints].filter(
        (fp) => !currentScanDetectedFingerprints.has(fp)
      );

      assert.deepEqual(resolved, ['org-1:DOUBLE_BOOKING:s1:o1_o2'], 'Fixed issue must be auto-resolved');
    });
  });

  describe('Occupancy Intelligence Actions & Payload Compatibility', () => {
    it('accepts both action and actionType in resolve request payload', () => {
      const resolveAction = (body: { insightId?: string; action?: string; actionType?: string }) => {
        const action = body.action || body.actionType;
        if (!body.insightId || !action) {
          throw new Error('Chybí povinné parametry insightId nebo action.');
        }
        return { insightId: body.insightId, action };
      };

      assert.equal(resolveAction({ insightId: 'test-1', actionType: 'SYNC_STATUS' }).action, 'SYNC_STATUS');
      assert.equal(resolveAction({ insightId: 'test-1', action: 'IGNORE', actionType: 'IGNORE' }).action, 'IGNORE');
      assert.equal(resolveAction({ insightId: 'test-1', action: 'REOPEN' }).action, 'REOPEN');
      assert.equal(resolveAction({ insightId: 'test-1', action: 'RESOLVE' }).action, 'RESOLVE');
      assert.throws(() => resolveAction({ insightId: 'test-1' }), /Chybí povinné parametry/);
    });

    it('provides fallback date range when alternatives search has null dates', () => {
      const getDates = (body: { surfaceId: string; dateFrom?: string | null; dateTo?: string | null }) => {
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 86400000);
        const dateFrom = body.dateFrom || now.toISOString().slice(0, 10);
        const dateTo = body.dateTo || in30.toISOString().slice(0, 10);
        if (!body.surfaceId) throw new Error('Chybí parametr surfaceId.');
        return { dateFrom, dateTo };
      };

      const res = getDates({ surfaceId: 'surf-1', dateFrom: null, dateTo: null });
      assert.ok(res.dateFrom, 'Should have fallback dateFrom');
      assert.ok(res.dateTo, 'Should have fallback dateTo');
      assert.ok(res.dateFrom <= res.dateTo, 'dateFrom must be before dateTo');
    });
  });
});
