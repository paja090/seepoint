/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server';

// Replace only authentication and persistence, then invoke the shipped HTTP handlers
// with the real task parser, task service, and transactional execution service.
let currentDb: any = null;
const sharedDb: any = new Proxy({}, {
  get(_target, prop) {
    if (prop === '$transaction') {
      return (fn: any, options: any) => currentDb.$transaction ? currentDb.$transaction(fn, options) : fn(currentDb);
    }
    return currentDb?.[prop];
  },
});

test('HTTP task creation stores a standalone installation without creating a carrier; rejects tenant and role violations', async () => {
  const points: any[] = []; const steps: any[] = []; const audits: any[] = [];
  let role = 'MANAGER'; let organizationId = 'org';
  const actor = () => ({ id:'user',email:'worker@example.test',role,organizationId });
  const tx: any = {
    electionCampaign: { findFirst: async ({where}:any) => where.id === 'campaign' && where.organizationId === 'org' ? {id:'campaign'} : null, update: async () => ({}) },
    electionRemovalPoint: { create: async ({data}:any) => { const p = {id:'point-'+points.length,...data}; points.push(p); return p; }, count: async () => points.length },
    fieldWorkStep: { create: async ({data}:any) => { steps.push(data); return data; } },
    crmAuditLog: { create: async ({data}:any) => { audits.push(data); return data; } },
  };
  const db = { ...tx, $transaction: async (fn:any,options:any) => { assert.equal(options.isolationLevel,'Serializable'); return fn(tx); } };
  currentDb = db;
  const keys = [require.resolve('../lib/db'),require.resolve('../lib/election-removal/guard')];
  const previous = keys.map(k=>require.cache[k]);
  require.cache[keys[0]] = { exports:{prisma:sharedDb} } as any;
  require.cache[keys[1]] = { exports:{
    requireElectionRemovalAccess: async (manage=false) => manage && role !== 'MANAGER' ? NextResponse.json({error:'Forbidden'},{status:403}) : {user:actor(),organizationId},
    isElectionRemovalAccessDenied: (r:any)=>r instanceof NextResponse,
  }} as any;
  try {
    const {POST} = require('../app/api/election-removal/tasks/route');
    const payload = {campaignId:'campaign',label:'Nová informační tabule',objectType:'Tabule',operationType:'INSTALL_OBJECT',mediaType:'OTHER',quantity:2,latitude:50,longitude:14,gpsConfirmed:true,materialDisposition:'LEAVE',description:'Ukotvit podle přiloženého výkresu'};
    // The HTTP handler must establish tenant scope itself after asynchronous authentication.
    const call = (value=payload) => POST(new Request('http://localhost/api/election-removal/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})) as Promise<Response>;
    assert.equal((await call()).status,200); assert.equal(points.length,1); assert.equal(points[0].carrierId,null); assert.equal(steps.length,1); assert.equal(steps[0].photoType,'AFTER_INSTALLATION'); assert.equal(audits.length,1);
    role='WORKER'; assert.equal((await call()).status,403);
    role='MANAGER'; organizationId='foreign'; assert.equal((await call()).status,409);
    organizationId='org'; assert.equal((await call({...payload,gpsConfirmed:false})).status,409); assert.equal(points.length,1);
  } finally { keys.forEach((k,i)=>{if(previous[i])require.cache[k]=previous[i];else delete require.cache[k];}); }
});

test('HTTP batch point update sets operation without requiring manual GPS reconfirmation for existing coordinates', async () => {
  const points: any[] = [{
    id: 'point-1',
    organizationId: 'org',
    campaignId: 'campaign',
    label: 'Plakátovací plocha',
    mediaType: 'ACKO',
    latitude: 50.08,
    longitude: 14.42,
    quantity: 1,
    reviewRequired: true,
    operationType: null,
    materialDisposition: null,
    steps: [],
  }];
  const steps: any[] = [];
  const audits: any[] = [];
  const actor = () => ({ id: 'user', email: 'dispatcher@example.test', role: 'MANAGER', organizationId: 'org' });
  const tx: any = {
    electionCampaign: {
      findFirst: async ({ where }: any) => where.id === 'campaign' && where.organizationId === 'org' ? { id: 'campaign' } : null,
      update: async () => ({}),
    },
    electionRemovalPoint: {
      findMany: async ({ where }: any) => points.filter((p) => p.organizationId === where.organizationId && where.id.in.includes(p.id)),
      findFirst: async ({ where }: any) => points.find((p) => p.id === where.id && p.organizationId === where.organizationId) || null,
      update: async ({ where, data }: any) => {
        const idx = points.findIndex((p) => p.id === where.id);
        points[idx] = { ...points[idx], ...data };
        return points[idx];
      },
      count: async () => points.length,
    },
    fieldWorkStep: {
      deleteMany: async () => ({}),
      create: async ({ data }: any) => { steps.push(data); return data; },
    },
    crmAuditLog: { create: async ({ data }: any) => { audits.push(data); return data; } },
  };
  const db = { ...tx, $transaction: async (fn: any) => fn(tx) };
  currentDb = db;
  const keys = [require.resolve('../lib/db'), require.resolve('../lib/election-removal/guard')];
  const previous = keys.map((k) => require.cache[k]);
  require.cache[keys[0]] = { exports: { prisma: sharedDb } } as any;
  require.cache[keys[1]] = {
    exports: {
      requireElectionRemovalAccess: async () => ({ user: actor(), organizationId: 'org' }),
      isElectionRemovalAccessDenied: () => false,
    },
  } as any;

  try {
    const { PATCH } = require('../app/api/election-removal/points/batch/route');
    const call = (body: any) => PATCH(new Request('http://localhost/api/election-removal/points/batch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })) as Promise<Response>;

    const res = await call({
      pointIds: ['point-1'],
      changes: { operationType: 'INSTALL_AD' },
    });
    assert.equal(res.status, 200);
    assert.equal(points[0].operationType, 'INSTALL_AD');
    assert.equal(points[0].materialDisposition, 'LEAVE');
    assert.equal(points[0].reviewRequired, false);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].kind, 'WORK');
    assert.equal(steps[0].photoType, 'AFTER_INSTALLATION');

    // Forbidden keys are rejected
    const badRes = await call({
      pointIds: ['point-1'],
      changes: { invalidKey: 'foo' },
    });
    assert.equal(badRes.status, 409);
  } finally {
    keys.forEach((k, i) => {
      if (previous[i]) require.cache[k] = previous[i];
      else delete require.cache[k];
    });
  }
});

