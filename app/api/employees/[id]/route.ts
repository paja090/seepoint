import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const actor=await getCurrentUser(); if(!actor||!['ADMIN','MANAGER'].includes(actor.role)) return NextResponse.json({error:'Nemáte oprávnění.'},{status:403});
  const {id}=await params; const input=await request.json().catch(()=>null) as Record<string,unknown>|null; if(!input) return NextResponse.json({error:'Neplatná data.'},{status:400});
  const employee=await prisma.employee.findUnique({where:{id},include:{user:true}}); if(!employee) return NextResponse.json({error:'Zaměstnanec nebyl nalezen.'},{status:404});
  if(actor.role==='MANAGER'&&employee.user?.role==='ADMIN') return NextResponse.json({error:'Manažer nemůže upravovat administrátora.'},{status:403});
  const text=(key:string)=>typeof input[key]==='string'&&(input[key] as string).trim()?(input[key] as string).trim():null;
  const firstName=text('firstName'), lastName=text('lastName'), email=text('email')?.toLowerCase()??null; if(!firstName||!lastName) return NextResponse.json({error:'Jméno a příjmení jsou povinné.'},{status:400});
  if(employee.user&&!email) return NextResponse.json({error:'Účet s přístupem musí mít e-mail.'},{status:400});
  const positions=[...new Set((text('positions')??text('position')??'').split(',').map(value=>value.trim()).filter(Boolean))].slice(0,12);
  const isActive=input.isActive===true||input.isActive==='true';
  try { await prisma.$transaction(async tx=>{ if(!isActive&&employee.isActive&&employee.user){const member=await tx.organizationMember.findUnique({where:{organizationId_userId:{organizationId:actor.organizationId!,userId:employee.user.id}}});if(member&&['OWNER','ADMIN'].includes(member.role)){const count=await tx.organizationMember.count({where:{organizationId:actor.organizationId!,isActive:true,role:{in:['OWNER','ADMIN']}}});if(count<=1)throw new Error('LAST_ADMIN')}} await tx.employee.update({where:{id},data:{firstName,lastName,email,phone:text('phone'),position:positions[0]??null,positions,isActive,note:text('note')}}); if(employee.user){await tx.user.update({where:{id:employee.user.id},data:{name:`${firstName} ${lastName}`,email:email!}});if(!isActive){await tx.organizationMember.update({where:{organizationId_userId:{organizationId:actor.organizationId!,userId:employee.user.id}},data:{isActive:false}});await tx.userSession.deleteMany({where:{userId:employee.user.id,activeOrganizationId:actor.organizationId!}})}}}, {isolationLevel:Prisma.TransactionIsolationLevel.Serializable}); }
  catch(error){if(error instanceof Error&&error.message==='LAST_ADMIN')return NextResponse.json({error:'Posledního aktivního administrátora nelze deaktivovat.'},{status:409});throw error}
  return NextResponse.json({ok:true});
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !['ADMIN', 'MANAGER'].includes(actor.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!employee) return NextResponse.json({ error: 'Zaměstnanec nebyl nalezen.' }, { status: 404 });

  if (actor.role === 'MANAGER' && employee.user?.role === 'ADMIN') {
    return NextResponse.json({ error: 'Manažer nemůže mazat administrátora.' }, { status: 403 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (employee.userId) {
        await tx.organizationMember.delete({
          where: { organizationId_userId: { organizationId: actor.organizationId!, userId: employee.userId } },
        }).catch(() => null);
        await tx.userSession.deleteMany({ where: { userId: employee.userId, activeOrganizationId: actor.organizationId! } });
      }
      await tx.employee.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Chyba při mazání zaměstnance.' }, { status: 500 });
  }
}
