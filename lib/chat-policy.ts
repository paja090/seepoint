import type { AppRole } from './rbac';

export const chatChannels = ['general', 'installations', 'vehicles', 'sales', 'urgent'] as const;
export type ChatChannel = typeof chatChannels[number];

export function isChatChannel(value: unknown): value is ChatChannel {
  return typeof value === 'string' && chatChannels.includes(value as ChatChannel);
}

export function canAssignChatMessage(actor: { id: string; role: AppRole }, message: { userId: string }) {
  return actor.role === 'ADMIN' || actor.role === 'MANAGER' || actor.id === message.userId;
}

export function canResolveChatMessage(actor: { id: string; role: AppRole; employee?: { id: string } | null }, message: { userId: string; assignedToUserId: string | null }) {
  return canAssignChatMessage(actor, message) || actor.id === message.assignedToUserId || actor.employee?.id === message.assignedToUserId;
}

export function validateChatImage(value: unknown, maxBytes = 1_000_000) {
  if (value === undefined || value === null || value === '') return { value: null as string | null };
  if (typeof value !== 'string') return { error: 'Fotografie má neplatný formát.' };
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return { error: 'Chat přijímá pouze vložený obrázek JPEG, PNG nebo WebP.' };
  const base64 = match[2];
  const byteLength = Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  if (byteLength <= 0 || byteLength > maxBytes) return { error: 'Fotografie v chatu může mít nejvýše 1 MB.' };
  const signature = Buffer.from(base64.slice(0, 24), 'base64');
  const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const isPng = signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = signature.subarray(0, 4).toString('ascii') === 'RIFF' && signature.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) return { error: 'Obsah fotografie neodpovídá formátu JPEG, PNG ani WebP.' };
  return { value };
}
