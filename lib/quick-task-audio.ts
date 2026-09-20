// Shared upload limits stay below common serverless request-body limits.
export const MAX_QUICK_TASK_AUDIO_BYTES = 4_000_000;
export const MAX_QUICK_TASK_RECORDING_MS = 120_000;
export const QUICK_TASK_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/aac'];

export function audioContentType(type: string) {
  return type.split(';')[0].trim().toLowerCase();
}

export function validateQuickTaskAudio(audio: Blob): string | null {
  if (!audio.size) return 'Nahrávka je prázdná. Zkuste ji zopakovat.';
  if (audio.size > MAX_QUICK_TASK_AUDIO_BYTES) return 'Nahrávka je příliš velká. Namluvte kratší zadání.';
  if (!QUICK_TASK_AUDIO_TYPES.includes(audioContentType(audio.type))) return 'Formát nahrávky není podporován. Zadejte úkol ručně.';
  return null;
}
