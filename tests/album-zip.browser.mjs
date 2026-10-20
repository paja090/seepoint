import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const points=[{id:'a',label:'Ostrava',quantity:1,latitude:50,longitude:14,mediaType:'BANNER',photos:[{id:'shown',url:'/shown.png',type:'CONTROL',fileName:'Shown.jpg',createdAt:'2026-10-20T08:00:00Z'}]},{id:'b',label:'Brno',quantity:1,latitude:49,longitude:16,mediaType:'BANNER',photos:[{id:'hidden',url:'/hidden.png',type:'CONTROL',fileName:'Hidden.jpg',createdAt:'2026-10-20T08:00:00Z'}]}];
const bundle=await build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import {CampaignPhotoAlbum} from "./components/election-removal/CampaignPhotoAlbum";import {PublicCampaignAlbumView} from "./components/election-removal/PublicCampaignAlbumView";const points='+JSON.stringify(points)+';createRoot(document.getElementById("root")).render(<><section id="internal"><CampaignPhotoAlbum campaignId="campaign" campaignName="Album" albumSlug="signed" downloadZipUrl="/api/client/fotodokumentace/signed/download-zip?client=ClientA" points={points}/></section><section id="public"><PublicCampaignAlbumView token="signed" campaign={{id:"campaign",name:"Client album",totalPoints:2,completedPoints:2}} points={points} availablePeriods={["2026-10"]}/></section></>);',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env':'{}'}});
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text)}else{res.setHeader('Content-Type','text/html');res.end('<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try {
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const requests=[];
 await page.route('**/download-zip*',async route=>{requests.push({method:route.request().method(),data:new URLSearchParams(route.request().postData()),url:route.request().url()});await route.fulfill({status:200,headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="album.zip"'},body:Buffer.from('test-archive')});});
 for(const section of ['internal','public']) {
   const scope=page.locator('#'+section);
   const search=scope.getByPlaceholder(section==='internal'?'Hledat klienta, místo nebo popis…':'Hledat lokalitu / ulici…');
   await search.fill('Ostrava');
   const button=scope.getByRole('button',{name:/Stáhnout.*ZIP/});
   assert.equal(await scope.locator('input[name="photoIds"]').inputValue(),'shown');
   const download=page.waitForEvent('download');await button.click();await download;
   assert.equal(requests.at(-1).method,'POST');assert.equal(requests.at(-1).data.get('photoIds'),'shown');
   await search.fill('No match');assert.equal(await button.isDisabled(),true);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS mobile internal and public ZIP submit exactly the visible photos and disable empty selection');
} finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
