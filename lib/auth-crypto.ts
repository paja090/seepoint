import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function newToken() { return randomBytes(32).toString('base64url'); }
export async function hashPassword(password: string) { const salt = randomBytes(16); const derived = await scrypt(password, salt, 64) as Buffer; return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`; }
export async function verifyPassword(password: string, stored: string) { const [algorithm, saltValue, hashValue] = stored.split(':'); if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false; const expected = Buffer.from(hashValue, 'base64'); const actual = await scrypt(password, Buffer.from(saltValue, 'base64'), expected.length) as Buffer; return expected.length === actual.length && timingSafeEqual(expected, actual); }
export function validatePassword(password: string) { return password.length >= 12 && /[a-zá-ž]/i.test(password) && /\d/.test(password); }
