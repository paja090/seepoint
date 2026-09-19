import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { NextResponse } from 'next/server';
import * as tenant from '../lib/tenant-context';
import * as audio from '../lib/quick-task-audio';
import { normalizeQuickTasks } from '../lib/quick-task-parsing';

// Execute the actual route with only I/O boundaries replaced; no DB or paid provider calls.
function load<T>(path: string, dependencies: Record<string, unknown>): T {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} };
  new Function('require', 'exports', 'module', code)((id: string) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
    return dependencies[id];
  }, loadedModule.exports, loadedModule);
  return loadedModule.exports as T;
}

type Route = { POST: (request: Request) => Promise<Response> };
const actor = { id: 'user-a', organizationId: 'org-a', employee: { id: 'employee-a' } };
function transcriptionRoute(options: { denied?: number; missingOrg?: boolean; provider?: () => Promise<unknown> } = {}) {
  const usage: Record<string, unknown>[] = [];
  let calls = 0;
  const route = load<Route>('app/api/ai/transcribe-quick-task/route.ts', {
    'next/server': { NextResponse },
    '@/lib/api-auth': { requireApiAccess: async () => options.denied ? NextResponse.json({}, { status: options.denied }) : options.missingOrg ? { ...actor, organizationId: null } : actor, isApiDenied: (value: unknown) => value instanceof Response },
    '@/lib/tenant-context': tenant,
    '@/lib/quick-task-audio': audio,
    '@/lib/ai-usage': { logAIUsage: async (entry: Record<string, unknown>) => { usage.push(entry); } },
    '@/lib/ai-quick-task-transcription': { transcriptionModel: () => 'test-model', transcribeQuickTask: async (_blob: Blob, signal: AbortSignal) => { calls++; assert.ok(signal instanceof AbortSignal); return options.provider ? options.provider() : { transcript: 'Zítra zavolat Petrovi.', model: 'test-model', usage: { promptTokenCount: 15 } }; } },
  });
  return { ...route, usage, calls: () => calls };
}
function upload(size = 32, type = 'audio/webm', organizationId?: string) {
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(size)], { type }), 'recording');
  if (organizationId) form.append('organizationId', organizationId);
  return new Request('http://localhost/api/ai/transcribe-quick-task', { method: 'POST', body: form });
}

for (const status of [401, 403]) test(`transcription rejects denied access ${status} before provider`, async () => {
  const route = transcriptionRoute({ denied: status });
  assert.equal((await route.POST(upload())).status, status);
  assert.equal(route.calls(), 0);
});
test('transcription rejects absent or overridden tenant', async () => {
  assert.equal((await transcriptionRoute({ missingOrg: true }).POST(upload())).status, 403);
  const route = transcriptionRoute();
  assert.equal((await route.POST(upload(32, 'audio/mp4', 'org-b'))).status, 403);
  assert.equal(route.calls(), 0);
});
for (const [size, type, status] of [[0, 'audio/webm', 400], [4_000_001, 'audio/webm', 413], [32, 'text/plain', 400]] as const) {
  test(`transcription validates ${size} bytes / ${type}`, async () => {
    const route = transcriptionRoute();
    assert.equal((await route.POST(upload(size, type))).status, status);
    assert.equal(route.calls(), 0);
  });
}
test('transcription limits real streamed body without Content-Length', async () => {
  const route = transcriptionRoute();
  assert.equal((await route.POST(upload(4_100_000))).status, 413);
  assert.equal(route.calls(), 0);
});
test('transcription returns Czech text and tenant-scoped usage for Safari MP4', async () => {
  const route = transcriptionRoute();
  const result = await route.POST(upload(32, 'audio/mp4;codecs=mp4a.40.2'));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { transcript: 'Zítra zavolat Petrovi.' });
  assert.equal(route.usage[0].organizationId, 'org-a');
  assert.equal(route.usage[0].userId, 'user-a');
});
test('provider errors and timeout are controlled, logged and never exposed', async t => {
  const logs: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => logs.push(args));
  for (const [error, status] of [[new Error('provider internal failure'), 502], [new DOMException('timeout', 'TimeoutError'), 504]] as const) {
    const route = transcriptionRoute({ provider: async () => { throw error; } });
    const response = await route.POST(upload());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /provider internal failure|stack/);
  }
  assert.deepEqual((logs[0][1] as Record<string, unknown>).organizationId, 'org-a');
});
test('silence is not a successful transcription', async () => {
  assert.equal((await transcriptionRoute({ provider: async () => ({ transcript: '', model: 'test' }) }).POST(upload())).status, 422);
});

test('parser validates hallucinated and other-tenant IDs before actual writes', async t => {
  const writes: Record<string, unknown>[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.ok(init.signal);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ tasks: [{ title: 'Zavolat', assignedToEmployeeId: 'foreign-employee', dueDate: 'garbage', priority: 'INVALID' }] }) }] } }] });
  });
  const route = load<Route>('app/api/ai/parse-quick-tasks/route.ts', {
    'next/server': { NextResponse }, '@/lib/tenant-context': tenant,
    '@/lib/quick-task-parsing': { normalizeQuickTasks },
    '@/lib/api-auth': { requireApiAccess: async () => actor, isApiDenied: () => false },
    '@/lib/ai-gemini': { getGeminiApiKey: () => 'test-key' }, '@/lib/ai-usage': { logAIUsage: async () => {} },
    '@/lib/db': { prisma: {
      employee: { findMany: async ({ where }: { where: Record<string, unknown> }) => { assert.deepEqual(where, { isActive: true, organizationId: 'org-a' }); return [{ id: 'employee-a', userId: 'user-a', firstName: 'Pavel', lastName: 'Novák' }]; } },
      quickInternalTask: { create: ({ data }: { data: Record<string, unknown> }) => { assert.equal(data.assignedToEmployeeId, 'employee-a'); assert.equal(data.organizationId, 'org-a'); writes.push(data); return Promise.resolve({ id: 'task-a', ...data }); } },
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    } },
  });
  const request = (extra = {}) => new Request('http://localhost/api/ai/parse-quick-tasks', { method: 'POST', body: JSON.stringify({ prompt: 'Zavolat Petrovi', ...extra }) });
  assert.equal((await route.POST(request({ defaultAssigneeId: 'foreign-employee' }))).status, 403);
  assert.equal((await route.POST(request({ organizationId: 'org-b' }))).status, 403);
  assert.equal(writes.length, 0);
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].priority, 'MEDIUM');
  assert.equal(writes[0].dueDate, null);
});

test('normalization rejects malformed output and requires an active fallback', () => {
  assert.deepEqual(normalizeQuickTasks([null, {}, { title: 9 }], new Set(['a']), 'a'), []);
  assert.throws(() => normalizeQuickTasks([{ title: 'Test' }], new Set(['a']), 'foreign'));
});

test('Gemini provider sends actual audio, Czech instruction and header-only credential', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.doesNotMatch(url, /test-key/);
    assert.equal((init.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
    const body = JSON.parse(init.body as string);
    assert.match(body.systemInstruction.parts[0].text, /čeština/);
    assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'audio/mp4');
    assert.equal(body.contents[0].parts[0].inlineData.data, Buffer.from('audio-data').toString('base64'));
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"transcript":"Zavolat Petrovi"}' }] } }] });
  });
  const provider = load<{ transcribeQuickTask: (audio: Blob, signal: AbortSignal) => Promise<{ transcript: string }> }>('lib/ai-quick-task-transcription.ts', { './ai-gemini': { getGeminiApiKey: () => 'test-key' }, './quick-task-audio': audio });
  assert.equal((await provider.transcribeQuickTask(new Blob(['audio-data'], { type: 'audio/mp4' }), new AbortController().signal)).transcript, 'Zavolat Petrovi');
});
