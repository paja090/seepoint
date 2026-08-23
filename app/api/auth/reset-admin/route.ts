import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth-crypto';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const defaultPassword = 'Admin2026!Password';
    const hashed = await hashPassword(defaultPassword);

    const targetEmails = ['subert.pvel@gmail.com', 'admin@seepoint.cz'];

    const org = await platformPrisma.organization.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const results = [];

    for (const email of targetEmails) {
      const user = await platformPrisma.user.upsert({
        where: { email },
        create: {
          email,
          name: email === 'subert.pvel@gmail.com' ? 'Pavel Šubert (Super Admin)' : 'SeePoint Admin',
          passwordHash: hashed,
          platformRole: 'SUPER_ADMIN',
          status: 'ACTIVE',
          mustChangePassword: false,
        },
        update: {
          passwordHash: hashed,
          platformRole: 'SUPER_ADMIN',
          status: 'ACTIVE',
          mustChangePassword: false,
        },
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

      results.push({ email: user.email, role: user.platformRole, status: user.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Super Admin účet pro subert.pvel@gmail.com i admin@seepoint.cz byl plně aktivován a heslo nastaveno.',
      password: defaultPassword,
      users: results,
      organization: org?.name,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Neplatný požadavek';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
