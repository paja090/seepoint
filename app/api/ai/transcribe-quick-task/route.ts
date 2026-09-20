import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { assertOrganizationId, TenantContextError } from '@/lib/tenant-context';
import { logAIUsage } from '@/lib/ai-usage';
import { transcribeQuickTask, transcriptionModel } from '@/lib/ai-quick-task-transcription';
import { MAX_QUICK_TASK_AUDIO_BYTES, validateQuickTaskAudio } from '@/lib/quick-task-audio';

export const runtime = 'nodejs';
export const maxDuration = 40;

export async function POST(request: Request) {
  let organizationId: string | null = null;
  let userId: string | null = null;
  try {
    const actor = await requireApiAccess('myTasks', 'myTasks');
    if (isApiDenied(actor)) return actor;
    organizationId = actor.organizationId;
    userId = actor.id;
    if (!organizationId) return NextResponse.json({ error: 'Vyberte aktivní organizaci.' }, { status: 403 });
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'Očekávána audio nahrávka.' }, { status: 400 });
    }
    // Bound the actual stream as well as Content-Length (which is client controlled).
    const maxBodyBytes = MAX_QUICK_TASK_AUDIO_BYTES + 64_000;
    if (Number(request.headers.get('content-length')) > maxBodyBytes) {
      return NextResponse.json({ error: 'Nahrávka je příliš velká.' }, { status: 413 });
    }
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Nahrávka chybí.' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBodyBytes) {
          await reader.cancel();
          return NextResponse.json({ error: 'Nahrávka je příliš velká.' }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Neplatná nahrávka.' }, { status: 400 });
    assertOrganizationId(form.get('organizationId'), organizationId);
    const audio = form.get('audio');
    if (!(audio instanceof Blob)) return NextResponse.json({ error: 'Nahrávka chybí.' }, { status: 400 });
    const validationError = validateQuickTaskAudio(audio);
    if (validationError) return NextResponse.json({ error: validationError }, { status: audio.size > MAX_QUICK_TASK_AUDIO_BYTES ? 413 : 400 });
    const result = await transcribeQuickTask(audio, AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]));
    await logAIUsage({ organizationId, userId, feature: 'ASSISTANT', modelName: result.model,
      promptTokens: result.usage?.promptTokenCount, outputTokens: result.usage?.candidatesTokenCount,
      metadata: { action: 'quick-task-transcription', audioBytes: audio.size, contentType: audio.type } });
    if (!result.transcript) return NextResponse.json({ error: 'V nahrávce nebyla rozpoznána řeč. Zkuste ji zopakovat.' }, { status: 422 });
    return NextResponse.json({ transcript: result.transcript });
  } catch (error) {
    if (error instanceof TenantContextError) return NextResponse.json({ error: 'Organizace neodpovídá aktivnímu přihlášení.' }, { status: 403 });
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    console.error('quick-task-ai', { endpoint: '/api/ai/transcribe-quick-task', organizationId, userId, phase: 'transcription', provider: 'gemini', model: transcriptionModel(), error: timeout ? 'TIMEOUT' : error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ code: timeout ? 'TIMEOUT' : 'PROVIDER_ERROR', error: timeout
      ? 'Přepis trval příliš dlouho. Zkuste nahrávání zopakovat nebo úkol napište ručně.'
      : 'AI přepis není dostupný. Zkuste nahrávání zopakovat nebo úkol napište ručně.' }, { status: timeout ? 504 : 502 });
  }
}
