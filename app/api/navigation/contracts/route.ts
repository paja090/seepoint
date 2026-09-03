import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { createNavigationContract, listNavigationContracts } from '@/lib/navigation/contract-service';
import { NavigationContractValidationError, parseNavigationContractFilters, parseNavigationContractInput } from '@/lib/navigation/contract-policy';

export const dynamic = 'force-dynamic';

function failure(error: unknown, fallback: string) {
  if (error instanceof NavigationContractValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return NextResponse.json({ error: 'Číslo smlouvy už v organizaci existuje.' }, { status: 409 });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const user = await requireApiAccess('navigationContracts');
    if (isApiDenied(user)) return user;
    const result = await listNavigationContracts(user, parseNavigationContractFilters(new URL(req.url).searchParams));
    return NextResponse.json({ success: true, contracts: result.items, total: result.total });
  } catch (error: unknown) {
    return failure(error, 'Smlouvy se nepodařilo načíst.');
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireApiAccess('navigationContracts');
    if (isApiDenied(user)) return user;
    const data = parseNavigationContractInput(await req.json().catch(() => null));
    const contract = await createNavigationContract(user, data);
    return NextResponse.json({ success: true, contract }, { status: 201 });
  } catch (error: unknown) {
    return failure(error, 'Smlouvu se nepodařilo vytvořit.');
  }
}
