const requireSeedPassword = process.argv.includes('--require-seed') && !process.argv.includes('--post-seed');
const required = ['DATABASE_URL', 'APP_URL', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_NAME', 'EMAIL_WEBHOOK_URL', 'EMAIL_WEBHOOK_SECRET'];
if (requireSeedPassword) required.push('SEED_ADMIN_PASSWORD');
const missing = required.filter((name) => !process.env[name]?.trim());
const invalid = [];
function validUrl(name, protocols) { const value = process.env[name]; if (!value) return; try { if (!protocols.includes(new URL(value).protocol)) invalid.push(name); } catch { invalid.push(name); } }
validUrl('DATABASE_URL', ['postgres:', 'postgresql:']);
validUrl('APP_URL', ['https:']);
validUrl('EMAIL_WEBHOOK_URL', ['https:']);
if (process.env.SEED_ADMIN_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.SEED_ADMIN_EMAIL)) invalid.push('SEED_ADMIN_EMAIL');
if (process.env.SEED_ADMIN_PASSWORD && (process.env.SEED_ADMIN_PASSWORD.length < 12 || !/[a-zá-ž]/i.test(process.env.SEED_ADMIN_PASSWORD) || !/\d/.test(process.env.SEED_ADMIN_PASSWORD))) invalid.push('SEED_ADMIN_PASSWORD');
if (process.env.EMAIL_WEBHOOK_SECRET && process.env.EMAIL_WEBHOOK_SECRET.length < 16) invalid.push('EMAIL_WEBHOOK_SECRET');
if (missing.length) console.error(`Chybějící proměnné: ${missing.join(', ')}`);
if (invalid.length) console.error(`Neplatné proměnné: ${[...new Set(invalid)].join(', ')}`);
if (missing.length || invalid.length) process.exit(1);
console.log(`Produkční konfigurace je formálně platná (${requireSeedPassword ? 'režim před seedem' : 'režim po seedu'}).`);
