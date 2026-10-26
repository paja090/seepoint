// Shared upload limits stay below common serverless request-body limits.
export const MAX_QUICK_TASK_AUDIO_BYTES = 4_000_000;
export const MAX_QUICK_TASK_RECORDING_MS = 120_000;
export const QUICK_TASK_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/x-pn-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
];

export function audioContentType(type: string) {
  const cleaned = (type || '').split(';')[0].trim().toLowerCase();
  return cleaned || 'audio/webm';
}

export function validateQuickTaskAudio(audio: Blob): string | null {
  if (!audio.size) return 'Nahrávka je prázdná. Zkuste ji zopakovat.';
  if (audio.size > MAX_QUICK_TASK_AUDIO_BYTES) return 'Nahrávka je příliš velká. Namluvte kratší zadání.';
  const ct = audioContentType(audio.type);
  if (audio.type && !QUICK_TASK_AUDIO_TYPES.includes(ct)) return 'Formát nahrávky není podporován. Zadejte úkol ručně.';
  return null;
}
