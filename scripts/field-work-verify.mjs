import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
const mode = process.argv[2];
const url = new URL(readFileSync('tmp/field-work-test-url.txt','utf8').trim());
if (url.hostname !== 'ep-shiny-lake-askav78k-pooler.c-4.eu-central-1.aws.neon.tech' || url.pathname !== '/seepoint_field_work_test') throw new Error('Only the independently created test database is allowed.');
url.searchParams.set('schema','field_work_verified');
const env = {...process.env, DATABASE_URL:url.href,DIRECT_URL:url.href,POSTGRES_PRISMA_URL:url.href,POSTGRES_URL:url.href,POSTGRES_URL_NON_POOLING:url.href,
  FIELD_WORK_LOCAL_TEST:'yes',FIELD_WORK_TEST_BRANCH:'br-restless-base-as6yz12i',SEEPOINT_STORAGE_PROVIDER:'DATABASE',APP_URL:'http://localhost:3107',E2E_BASE_URL:'http://localhost:3107',E2E_BROWSER_CHANNEL:'chrome',NODE_OPTIONS:'--max-old-space-size=6144'};
for(const k of ['GOOGLE_MAPS_SERVER_API_KEY','GOOGLE_MAPS_SERVER_KEY','GOOGLE_MAPS_API_KEY','GOOGLE_ROUTES_API_KEY','GOOGLE_API_KEY','MAPS_API_KEY','GOOGLE_MAPS','NEXT_PUBLIC_GOOGLE_MAPS_API_KEY','NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY','NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY','NEXT_PUBLIC_GOOGLE_MAPS_KEY']) env[k]='';
mkdirSync('tmp',{recursive:true});
function run(args, output) { const r=spawnSync(process.execPath,args,{env,encoding:'utf8',stdio:output?['ignore','pipe','pipe']:'inherit'});if(output)writeFileSync(output,r.stdout||'');if(r.error)throw r.error;if(r.status!==0){if(output)console.error(r.stderr);throw new Error('Verification command failed: '+args[0]+' ('+r.status+')');} }
if(mode==='baseline') {
  const head=spawnSync('git',['show','8fde0bb:prisma/schema.prisma'],{encoding:'utf8'});if(head.status!==0)throw new Error('Cannot read baseline');writeFileSync('tmp/field-work-head.prisma',head.stdout);
  run(['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel','tmp/field-work-head.prisma','--script'],'tmp/field-work-baseline.sql');
  const sql='CREATE SCHEMA IF NOT EXISTS field_work_verified; SET search_path TO field_work_verified;\n'+readFileSync('tmp/field-work-baseline.sql','utf8');writeFileSync('tmp/field-work-baseline.sql',sql);
  run(['node_modules/prisma/build/index.js','db','execute','--schema','prisma/schema.prisma','--file','tmp/field-work-baseline.sql']);
  const migration='SET search_path TO field_work_verified;\n'+readFileSync('prisma/migrations/20261012150000_field_work_steps/migration.sql','utf8');writeFileSync('tmp/field-work-additive.sql',migration);
  run(['node_modules/prisma/build/index.js','db','execute','--schema','prisma/schema.prisma','--file','tmp/field-work-additive.sql']);
} else if(mode==='db-test') run(['node_modules/tsx/dist/cli.mjs','--require','./tests/helpers/server-only.cjs','--test','tests/field-work-db.test.ts']);
else if(mode==='server' || mode==='dev') { const child=spawn(process.execPath,['node_modules/next/dist/bin/next',mode==='dev'?'dev':'start','-p','3107','-H','127.0.0.1'],{env,stdio:'inherit'});child.on('exit',code=>process.exit(code??1)); }
else if(mode==='browser') run(['node_modules/@playwright/test/cli.js','test','e2e/field-work.spec.ts','--workers=1']);
else if(mode==='build') { run(['node_modules/prisma/build/index.js','generate']); run(['node_modules/next/dist/bin/next','build']); }
else throw new Error('Expected baseline, db-test, server, dev, browser or build.');
