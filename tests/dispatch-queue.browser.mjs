import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const items=[{id:'ready',title:'Výměna reklamy',client:'Klient',address:'Ostrava',source:'work',state:'ready',reason:'',detailUrl:'/work/ready',quantity:1},{id:'blocked',title:'Chybí GPS',client:'',address:'',source:'field',state:'issue',reason:'Potvrďte polohu',detailUrl:'/election-removal/c',quantity:1},{id:'assigned',title:'Přidělená práce',client:'',address:'',source:'work',state:'planned',reason:'',detailUrl:'/work/assigned',quantity:1}];
const mocks={
 'next/link':'export default function Link({children,...props}){return <a {...props}>{children}</a>}',
 'next/navigation':'export const useRouter=()=>({push:url=>{window.pushed=url},refresh:()=>{window.refreshed=true}});',
 '@/components/election-removal/LocationPickerMap':'export function LocationPickerMap({onChange}){return <button type="button" onClick={()=>onChange({latitude:49,longitude:18})}>Potvrdit místo na mapě</button>}'
};
const bundle=await build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import {DispatchBoard} from "./components/dispatch/DispatchBoard";createRoot(document.getElementById("root")).render(<DispatchBoard items={'+JSON.stringify(items)+'} plans={[]} date="2035-06-10" canCreate messages={[]}/>);',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env':'{}'},plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:'<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let sent;
await page.route('**/api/work/dispatch',async route=>{sent=route.request().postDataJSON();await route.fulfill({json:{campaignId:'created'},status:201});});
await page.goto('http://127.0.0.1:'+server.address().port);
assert.equal(await page.getByRole('checkbox',{name:'Vybrat Chybí GPS'}).isDisabled(),true);assert.equal(await page.getByRole('checkbox',{name:'Vybrat Přidělená práce'}).isDisabled(),true);
await page.getByRole('checkbox',{name:'Vybrat Výměna reklamy'}).check();assert.match(await page.getByRole('link',{name:/Naplánovat:/}).getAttribute('href'),/jobs=ready/);
await page.getByRole('button',{name:'Přidat práci',exact:true}).click();await page.getByLabel('Název práce').fill('Přesun lavičky');await page.getByRole('button',{name:'Přesun objektu',exact:true}).click();
await page.getByLabel('Médium nebo objekt').selectOption('BENCH');await page.getByLabel('Místo předání',{exact:true}).fill('Park');
await page.getByRole('button',{name:'Uložit do fronty práce'}).click();assert.match(await page.getByRole('alert').innerText(),/Vyberte místo/);assert.equal(sent,undefined);
await page.getByRole('button',{name:'Potvrdit místo na mapě'}).nth(0).click();await page.getByRole('button',{name:'Potvrdit místo na mapě'}).nth(1).click();await page.getByRole('button',{name:'Uložit do fronty práce'}).click();await page.waitForFunction(()=>window.refreshed);
assert.equal(sent.task.operationType,'RELOCATION');assert.equal(sent.task.destinationGpsConfirmed,true);assert.equal(sent.task.materialDisposition,'TRANSFER');assert.equal(sent.task.deadlineAt,undefined);assert.ok(sent.requestKey);assert.deepEqual(errors,[]);console.log('PASS mobile queue selection, transport validation and undated intake');
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
