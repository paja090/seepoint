import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
await build({entryPoints:['tests/fixtures/academy-ui.tsx'],outfile:'tmp/academy-ui-bundle.js',bundle:true,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'},logLevel:'silent'});
const html=`<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${readFileSync('tmp/academy-ui.css','utf8')}</style><body><div id="root"></div><script>window.process={env:{}};</script><script src="/bundle.js"></script></body></html>`;
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(readFileSync('tmp/academy-ui-bundle.js'));return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 let requestData;
 await page.route('**/api/academy/feedback',route=>{requestData=route.request().postDataJSON();return route.fulfill({status:201,contentType:'application/json',body:'{"id":"fixture-feedback"}'});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('heading',{name:'Naučte se další krok'}).waitFor();
 await page.screenshot({path:'tmp/academy-component-desktop.png',fullPage:true});
 await page.locator('summary').click();
 await page.getByLabel('Co se stalo?').fill('Testovací podnět bez zákaznických dat.');
 await page.getByRole('button',{name:'Odeslat podnět'}).click();
 await page.getByText('Podnět fixture-feedback byl uložen',{exact:false}).waitFor();
 assert.equal(requestData.revisionId,'fixture-revision');assert.equal(requestData.category,'UNCLEAR');assert.equal('organizationId' in requestData,false);
 await page.setViewportSize({width:360,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'tmp/academy-component-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 writeFileSync('tmp/academy-ui-result.txt','PASS: real catalog and feedback components rendered in isolated browser; feedback request/response with mocked endpoint, no client tenant field, no page errors, no horizontal overflow at 360 px. Not an authenticated application E2E.\n');
 console.log('Academy component browser checks passed.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
