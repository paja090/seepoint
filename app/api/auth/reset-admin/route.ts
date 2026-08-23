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
        mustChangePassword: false,
      },
    });

    // Ensure active organization membership exists
    const org = await platformPrisma.organization.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (org) {
      await platformPrisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: user.id,
          },
        },
        create: {
          organizationId: org.id,
          userId: user.id,
          role: 'OWNER',
          isActive: true,
        },
        update: {
          role: 'OWNER',
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Super Admin účet (admin@seepoint.cz) byl plně aktivován a heslo nastaveno.',
      email: user.email,
      password: defaultPassword,
      role: user.platformRole,
      organization: org?.name,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Neplatný požadavek';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
