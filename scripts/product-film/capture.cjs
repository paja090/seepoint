const {chromium}=require('@playwright/test');const fs=require('fs');
const mode=process.argv[2]||'offer',base='http://127.0.0.1:3125',dir='output/product-film';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const c=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});const s=JSON.parse(fs.readFileSync('tmp/product-film-session.json'));await c.addCookies([{name:'seepoint_session',value:s.token,url:base}]);const p=await c.newPage();p.setDefaultTimeout(35000);const frames=[];const captureDir=dir+'/frames-'+mode;fs.mkdirSync(captureDir,{recursive:true});const start=Date.now(),marks=[];let cdp;let frameNo=0;const mark=n=>{const m={name:n,t:(Date.now()-start)/1000};marks.push(m);console.log(m)};const hold=ms=>p.waitForTimeout(ms);const click=async l=>{await l.scrollIntoViewIfNeeded();const r=await l.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:22});await hold(250);await l.click();};const type=async(l,t)=>{await click(l);await l.pressSequentially(t,{delay:38})};
try{
await p.goto(base+(mode==='occupancy'?'/occupancy/ai':'/offers/new'),{waitUntil:'domcontentloaded',timeout:360000});
await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
await p.evaluate(()=>{let el=document.createElement('div');el.id='film-cursor';el.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;width:18px;height:18px;border:2px solid #a78bfa;border-radius:50%;background:#a78bfa44;box-shadow:0 0 12px #a78bfa80;left:-30px';document.body.append(el);document.addEventListener('mousemove',e=>{el.style.left=(e.clientX-9)+'px';el.style.top=(e.clientY-9)+'px'})});
cdp=await c.newCDPSession(p);cdp.on('Page.screencastFrame',async e=>{const n=frameNo++;const file='frame-'+String(n).padStart(6,'0')+'.jpg';frames.push({file,t:(Date.now()-start)/1000});fs.writeFileSync(captureDir+'/'+file,Buffer.from(e.data,'base64'));await cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1600,maxHeight:900,everyNthFrame:1});mark('ready');await hold(1700);
if(mode==='offer'){
await click(p.getByRole('button',{name:'Spustit AI Copilota'}));await hold(800);
await p.locator('label').filter({hasText:/^Klient/}).locator('select').selectOption(s.clientId);
await click(p.getByText('Cenová kategorie a rozpočet',{exact:true}));await p.getByLabel('Délka (měsíce)').fill('1');await click(p.getByText('Cenová kategorie a rozpočet',{exact:true}));
mark('typing');await type(p.getByPlaceholder('Popište kampaň, lokalitu a očekávání klienta.'),'Otevření nové kavárny v Ostravě. Navrhněte viditelnou měsíční kampaň a vhodný mix reklamních ploch.');await type(p.getByPlaceholder('Např. Ostrava'),'Ostrava');await p.getByPlaceholder('Např. 30000').fill('30000');await hold(1300);mark('submit');
const res=p.waitForResponse(r=>r.url().includes('/api/offers/ai-generate')&&r.request().method()==='POST',{timeout:360000});await click(p.getByRole('button',{name:'Připravit AI návrh',exact:true}));const r=await res;console.log('preview status',r.status());if(!r.ok())throw Error(await r.text());await p.getByRole('button',{name:'Vytvořit koncept nabídky',exact:true}).waitFor();mark('result');await hold(2800);await p.screenshot({path:dir+'/offer-result.png'});
await p.getByRole('button',{name:'Vytvořit koncept nabídky',exact:true}).scrollIntoViewIfNeeded();await hold(2000);mark('confirm');await click(p.getByRole('button',{name:'Vytvořit koncept nabídky',exact:true}));await p.waitForURL(/\/offers\/(?!new)[^/]+/,{timeout:360000});await p.waitForLoadState('domcontentloaded');mark('created');await hold(4500);await p.screenshot({path:dir+'/offer-created.png'});console.log('created URL',p.url());
}else if(mode==='task'){
await click(p.getByRole('button',{name:'AI Rychlý Úkolníček',exact:true}));await hold(800);mark('typing');await type(p.getByRole('textbox',{name:'Zadání úkolů'}),'Jana zítra zkontroluje tiskové podklady, připraví grafiku pro kavárnu a zavolá klientovi.');await hold(1200);mark('submit');const res=p.waitForResponse(r=>r.url().includes('/api/ai/parse-quick-tasks'),{timeout:360000});await click(p.getByRole('button',{name:'Vytvořit Check-list',exact:true}));const r=await res;console.log('tasks status',r.status());if(!r.ok())throw Error(await r.text());await p.getByRole('button',{name:'Hotovo',exact:true}).waitFor();mark('result');await hold(6000);await p.screenshot({path:dir+'/task-result.png'});
}else{
console.log((await p.locator('body').innerText()).slice(-8000));const q=p.getByPlaceholder(/Zadejte dotaz/);await q.scrollIntoViewIfNeeded();mark('typing');await type(q,'Které plochy v Ostravě jsou volné v listopadu 2026?');await hold(900);mark('submit');const res=p.waitForResponse(r=>r.url().includes('/api/occupancy/intelligence/ask'),{timeout:360000});await q.press('Enter');const r=await res;console.log('occupancy status',r.status());if(!r.ok())throw Error(await r.text());mark('result');await hold(6000);await p.screenshot({path:dir+'/occupancy-result.png'});console.log((await p.locator('body').innerText()).slice(-6000));
}
mark('end');
}catch(e){console.error(e);mark('error');await p.screenshot({path:dir+'/'+mode+'-error.png'});console.log((await p.locator('body').innerText()).slice(-6000));process.exitCode=1}
finally{fs.writeFileSync(dir+'/'+mode+'-marks.json',JSON.stringify(marks,null,2));if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});fs.writeFileSync(dir+'/'+mode+'-frames.json',JSON.stringify(frames));await c.close();await b.close()}
})();




