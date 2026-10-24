import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { hasModuleAccess } from '@/lib/module-policy';
import { runWithTenantContext } from '@/lib/tenant-context';
import { createDispatchWork } from '@/lib/dispatch/intake';

export async function POST(request: Request) {
  const user=await requireApiAccess('work','workRoute');if(isApiDenied(user))return user;
  if(!['ADMIN','MANAGER'].includes(user.role) || !hasModuleAccess(user,'electionRemoval','electionRemoval'))return NextResponse.json({error:'Nemáte oprávnění zadávat terénní práci.'},{status:403});
  try {
    const body=await request.json();
    const result=await runWithTenantContext({organizationId:user.organizationId!,userId:user.id,source:'session'},()=>createDispatchWork(body,user));
    return NextResponse.json(result,{status:201});
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Práci se nepodařilo uložit.'},{status:400});}
}
