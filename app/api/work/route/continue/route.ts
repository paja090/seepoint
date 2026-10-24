import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { runWithTenantContext } from '@/lib/tenant-context';
import { getPlan, requirePlannerManager } from '@/lib/field-planning/service';
import { postponeFieldPlan } from '@/lib/election-removal/postpone-plan';
export async function POST(request:Request){
  const user=await requireApiAccess('work','workRoute');if(isApiDenied(user))return user;
  try {requirePlannerManager(user);const body=await request.json();if(typeof body.planId!=='string')throw new Error('Chybí výjezd.');
    const result=await runWithTenantContext({organizationId:user.organizationId!,userId:user.id,source:'session'},async()=>{await getPlan(body.planId);return postponeFieldPlan(body.planId,user);});
    return NextResponse.json(result);
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Přesun selhal.'},{status:error instanceof Error&&error.message.startsWith('FORBIDDEN')?403:409});}
}
