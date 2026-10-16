const {chromium}=require('@playwright/test');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 const session=JSON.parse(fs.readFileSync('tmp/product-film-session.json'));
 await context.addCookies([{name:'seepoint_session',value:session.token,url:'http://127.0.0.1:3125'}]);
 const page=await context.newPage();page.setDefaultTimeout(120000);
 await page.goto('http://127.0.0.1:3125/offers/new',{waitUntil:'networkidle',timeout:180000});
 console.log((await page.locator('body').innerText()).slice(-14000));
 await page.getByRole('button',{name:'Spustit AI Copilota'}).click();
 fs.mkdirSync('output/product-film',{recursive:true});
 await page.screenshot({path:'output/product-film/probe.png'});
 console.log('MODAL',await page.locator('body').innerText());
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
