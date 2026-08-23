import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth-crypto';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const defaultPassword = 'Admin2026!Password';
    const hashed = await hashPassword(defaultPassword);

    const user = await platformPrisma.user.update({
      where: { email: 'admin@seepoint.cz' },
      data: {
        passwordHash: hashed,
        platformRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Heslo pro Super Admin účet bylo úspěšně nastaveno.',
      email: user.email,
      password: defaultPassword,
      role: user.platformRole,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Neplatný požadavek';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
