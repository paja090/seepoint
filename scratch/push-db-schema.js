const { execSync } = require('child_process');
const fs = require('fs');

const envFile = fs.readFileSync('c:/Users/42077/Documents/seepoint/.env.production', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

console.log('Pushing database schema with DATABASE_URL from .env.production...');
execSync('npx prisma db push', {
  env: { ...process.env, ...envVars },
  stdio: 'inherit'
});
