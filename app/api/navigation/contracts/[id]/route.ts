import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { updateNavigationContract } from '@/lib/navigation/contract-service';
import { NavigationContractValidationError, parseNavigationContractInput } from '@/lib/navigation/contract-policy';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiAccess('navigationContracts');
    if (isApiDenied(user)) return user;
    const { id } = await params;
    const contract = await updateNavigationContract(user, id, parseNavigationContractInput(await req.json().catch(() => null)));
    return NextResponse.json({ success: true, contract });
  } catch (error: unknown) {
    if (error instanceof NavigationContractValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Číslo smlouvy už v organizaci existuje.' }, { status: 409 });
    }
    console.error('Smlouvu se nepodařilo změnit.', error);
    return NextResponse.json({ error: 'Smlouvu se nepodařilo změnit.' }, { status: 500 });
  }
}
