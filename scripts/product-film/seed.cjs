const fs=require('node:fs'),crypto=require('node:crypto');const {PrismaClient}=require('@prisma/client');
if(new URL(process.env.DATABASE_URL).pathname!='/seepoint_film')throw Error('Film database only');const db=new PrismaClient();
(async()=>{
const org=await db.organization.upsert({where:{slug:'seepoint-os-film'},update:{},create:{name:'SeePoint OS · DEMO',slug:'seepoint-os-film',plan:'ENTERPRISE',subscriptionStatus:'ACTIVE',enabledModules:{offers:true,carriers:true,myTasks:true,aiOccupancy:true,aiInbox:true,aiSalesRadar:true},primaryColor:'#9333ea'}});
const user=await db.user.upsert({where:{email:'jana@seepoint-film.invalid'},update:{},create:{name:'Jana Nová',email:'jana@seepoint-film.invalid',role:'ADMIN',status:'ACTIVE'}});
if(!await db.organizationMember.findFirst({where:{organizationId:org.id,userId:user.id}}))await db.organizationMember.create({data:{organizationId:org.id,userId:user.id,role:'ADMIN'}});
if(!await db.employee.findFirst({where:{organizationId:org.id,userId:user.id}}))await db.employee.create({data:{organizationId:org.id,userId:user.id,firstName:'Jana',lastName:'Nová',position:'Obchodní manažerka',role:'ADMIN'}});
let client=await db.client.findFirst({where:{organizationId:org.id,name:'Městská kavárna'}});if(!client)client=await db.client.create({data:{organizationId:org.id,name:'Městská kavárna',normalizedName:'mestska kavarna',billingCity:'Ostrava',status:'ACTIVE',note:'Demonstrační klient pro produktové video.'}});
const rows=[['BILLBOARD','Rudná — hlavní tah',49.806,18.248,6500,'media-city-poster.jpg'],['CITYLIGHT','Centrum — u zastávky',49.834,18.284,3800,'media-clv.png'],['PROMO_BENCH','Poruba — Hlavní třída',49.829,18.177,1800,'media-promo-bench.png'],['CITY_POSTER','Karolina — pěší zóna',49.829,18.289,2400,'media-city-poster.png'],['BILLBOARD','Mariánské Hory',49.827,18.238,6500,'media-city-poster.png'],['CITYLIGHT','Nádražní — centrum',49.843,18.275,3800,'media-clv.png'],['PROMO_BENCH','Hrabůvka — náměstí',49.787,18.263,1800,'media-promo-bench.png'],['CITY_POSTER','Výškovice — sídliště',49.779,18.242,2400,'media-city-poster.png']];
for(const [i,r]of rows.entries()){
 const code='OS-'+String(i+1).padStart(3,'0');let carrier=await db.advertisingCarrier.findFirst({where:{organizationId:org.id,code}});
 if(!carrier){carrier=await db.advertisingCarrier.create({data:{organizationId:org.id,code,name:r[1],type:r[0],city:'Ostrava',address:r[1],latitude:r[2],longitude:r[3],gpsStatus:'VERIFIED',description:'Ukázkový nosič pro představení systému.'}});
 await db.advertisingSurface.create({data:{organizationId:org.id,carrierId:carrier.id,name:'Reklamní plocha A',mediaType:r[0],price:r[4],size:r[0]==='BILLBOARD'?'510 × 240 cm':'120 × 180 cm'}});
 await db.photo.create({data:{organizationId:org.id,carrierId:carrier.id,url:'/offer/'+(r[5].endsWith('.jpg')?'media-city-poster.png':r[5]),isPrimary:true,isClientVisible:true}});}
 const pc='DEMO-'+r[0];if(!await db.offerPriceRule.findFirst({where:{organizationId:org.id,code:pc}}))await db.offerPriceRule.create({data:{organizationId:org.id,code:pc,label:'Pronájem '+r[0],category:'RENTAL',mediaType:r[0],unit:'měsíc',unitPrice:r[4],pricingSegment:'COMMERCIAL'}});
}
const token=crypto.randomBytes(32).toString('base64url');await db.userSession.create({data:{userId:user.id,activeOrganizationId:org.id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),sessionVersion:1,expiresAt:new Date(Date.now()+24*3600000)}});
fs.writeFileSync('tmp/product-film-session.json',JSON.stringify({token,organizationId:org.id,clientId:client.id}));console.log('Demo ready: 8 carriers, 1 client, 1 employee. Session saved locally.');await db.$disconnect();
})().catch(e=>{console.error(e.message);process.exit(1)});
