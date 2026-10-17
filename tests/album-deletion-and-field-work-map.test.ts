import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePointClientName } from '../lib/election-removal/point-metadata.js';

describe('Album Deletion and Field Work Map Status', () => {
  it('correctly parses multi-client album identifier into campaign ID and client key', () => {
    const rawSingleId = 'cm89abcdef1234567890';
    const rawMultiId = 'cm89abcdef1234567890::client::Koalice%20SPOLU';
    const decodedMultiId = decodeURIComponent(rawMultiId);

    const [singleCampaignId, singleClientKey] = rawSingleId.includes('::client::')
      ? rawSingleId.split('::client::')
      : [rawSingleId, null];

    assert.equal(singleCampaignId, 'cm89abcdef1234567890');
    assert.equal(singleClientKey, null);

    const [multiCampaignId, multiClientKey] = decodedMultiId.includes('::client::')
      ? decodedMultiId.split('::client::')
      : [decodedMultiId, null];

    assert.equal(multiCampaignId, 'cm89abcdef1234567890');
    assert.equal(multiClientKey, 'Koalice SPOLU');
  });

  it('correctly maps campaign points to client names using metadata resolver', () => {
    const defaultCampaignClient = 'Hlavní zadavatel';

    const p1 = {
      id: 'pt-1',
      label: 'Bod 1',
      description: 'Zadavatel: ANO 2011\nUlice: Nádražní',
      layerName: 'Obecná vrstva',
      clientName: null,
    };

    const p2 = {
      id: 'pt-2',
      label: 'Bod 2',
      description: 'Montáž na sloup',
      layerName: 'Pirátská strana',
      clientName: null,
    };

    const p3 = {
      id: 'pt-3',
      label: 'Bod 3',
      description: 'Běžný bod',
      layerName: 'Default layer',
      clientName: null,
    };

    assert.equal(resolvePointClientName(p1, defaultCampaignClient), 'ANO 2011');
    assert.equal(resolvePointClientName(p2, defaultCampaignClient), 'Pirátská strana');
    assert.equal(resolvePointClientName(p3, defaultCampaignClient), 'Hlavní zadavatel');
  });

  it('determines correct category and pin appearance based on point status for dispatcher map', () => {
    const category = (p: { status: string; reviewRequired?: boolean; steps?: { completedQuantity: number }[]; assignedFieldPlanId?: string | null }) =>
      p.status === 'COMPLETED'
        ? 'DONE'
        : p.reviewRequired
        ? 'REVIEW'
        : p.status === 'ISSUE'
        ? 'ISSUE'
        : p.steps?.some((s) => s.completedQuantity > 0)
        ? 'PARTIAL'
        : p.status === 'IN_PROGRESS'
        ? 'IN_PROGRESS'
        : p.assignedFieldPlanId
        ? 'ASSIGNED'
        : 'PENDING';

    const donePoint = { status: 'COMPLETED' };
    const inProgressPoint = { status: 'IN_PROGRESS' };
    const issuePoint = { status: 'ISSUE' };
    const pendingPoint = { status: 'PENDING', steps: [] };

    assert.equal(category(donePoint), 'DONE');
    assert.equal(category(inProgressPoint), 'IN_PROGRESS');
    assert.equal(category(issuePoint), 'ISSUE');
    assert.equal(category(pendingPoint), 'PENDING');
  });
});
