import { prisma } from '../db';
import { requireTenantContext, runWithTenantContext } from '../tenant-context';
import { verifySurfaceAlbumSlug } from '../election-removal/album-token';
import { resolvePointClientName } from '../election-removal/point-metadata';

export const campaignAlbumKey = (id: string, client?: string | null) => JSON.stringify(['campaign',id,client?.trim().toLocaleLowerCase('cs') || '']);
export const surfaceAlbumKey = (client: string) => JSON.stringify(['surfaces',client.trim().toLocaleLowerCase('cs')]);
export const navigationAlbumKey = (id: string) => JSON.stringify(['navigation',id]);
export function albumItemKey(album: { id: string; source: string; albumSlug: string; clientName?: string | null }) {
  if (album.source === 'NAVIGATION') return navigationAlbumKey(album.id);
  if (album.albumSlug.startsWith('surface.')) return surfaceAlbumKey(album.clientName || 'Vlastní síť nosičů');
  const [id,client] = album.id.split('::client::');
  return campaignAlbumKey(id,client);
}
export async function readAlbumTitle(organizationId: string, key: string, fallback: string, db = prisma) {
  return runWithTenantContext({organizationId,source:'public-token'},async()=>{
    const row=await db.photoAlbumSettings.findUnique({where:{organizationId_albumKey:{organizationId,albumKey:key}}});
    return row?.publicTitle || fallback;
  });
}
export async function saveAlbumTitle(id: string, input: {title:unknown;source:unknown;albumSlug?:unknown}, actor:{id:string;email:string;role:string}, db=prisma) {
  if (!['ADMIN','MANAGER'].includes(actor.role)) throw new Error('Název alba může upravit správce nebo manažer.');
  const title=typeof input.title==='string'?input.title.trim():'';
  if (!title || title.length>160) throw new Error('Zadejte název alba o délce 1 až 160 znaků.');
  const {organizationId}=requireTenantContext();
  return db.$transaction(async tx=>{
    let key:string;
    if (input.source==='NAVIGATION') {
      if (!await tx.navigationDocumentationReport.findFirst({where:{id,organizationId},select:{id:true}})) throw new Error('Album nebylo nalezeno.');
      key=navigationAlbumKey(id);
    } else if (input.source==='FIELD_WORK' && typeof input.albumSlug==='string' && input.albumSlug.startsWith('surface.')) {
      const album=verifySurfaceAlbumSlug(input.albumSlug);
      if (!album || album.organizationId!==organizationId) throw new Error('Album nebylo nalezeno.');
      key=surfaceAlbumKey(album.clientName);
    } else if (input.source==='FIELD_WORK') {
      const [campaignId,client]=id.split('::client::');
      const campaign=await tx.electionCampaign.findFirst({where:{id:campaignId,organizationId},include:{points:{select:{label:true,description:true,layerName:true}}}});
      if (!campaign || (client && !campaign.points.some(p=>(resolvePointClientName(p,campaign.clientName)||'').trim().toLocaleLowerCase('cs')===client.trim().toLocaleLowerCase('cs')))) throw new Error('Album nebylo nalezeno.');
      key=campaignAlbumKey(campaignId,client);
    } else throw new Error('Neplatný typ alba.');
    await tx.photoAlbumSettings.upsert({where:{organizationId_albumKey:{organizationId,albumKey:key}},create:{organizationId,albumKey:key,publicTitle:title},update:{publicTitle:title}});
    await tx.crmAuditLog.create({data:{organizationId,entityType:'PhotoAlbum',entityId:id,userId:actor.id,userEmail:actor.email,action:'ALBUM_RENAMED',detailsJson:JSON.stringify({albumKey:key,title})}});
    return {title};
  });
}
