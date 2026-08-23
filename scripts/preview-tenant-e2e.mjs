import { PrismaClient } from '@prisma/client';

const mode = process.argv[2] ?? 'audit';
const emailArg = process.argv.find((arg) => arg.startsWith('--email='));
const email = emailArg?.slice('--email='.length).trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;

if (!databaseUrl) throw new Error('Preview database URL is missing.');
const databaseHost = new URL(databaseUrl).hostname;
if (process.env.VERCEL_ENV !== 'preview' || !databaseHost.endsWith('.neon.tech')) {
  throw new Error('Refusing to run outside a Vercel preview Neon database.');
}
if (!email) throw new Error('Pass --email=<existing user email>.');

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      platformRole: true,
      organizationMemberships: {
        select: { role: true, isActive: true, organization: { select: { id: true, name: true, slug: true, isActive: true } } },
        orderBy: { organization: { name: 'asc' } },
      },
    },
  });
  if (!user) throw new Error('Requested preview user does not exist.');

  if (mode === 'promote-super-admin' && user.platformRole !== 'SUPER_ADMIN') {
    await prisma.user.update({ where: { id: user.id }, data: { platformRole: 'SUPER_ADMIN' } });
    user.platformRole = 'SUPER_ADMIN';
  } else if (mode !== 'audit' && mode !== 'promote-super-admin') {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  console.log(JSON.stringify({
    environment: process.env.VERCEL_ENV,
    databaseHost,
    mode,
    user: { email: user.email, platformRole: user.platformRole },
    memberships: user.organizationMemberships.map((membership) => ({
      role: membership.role,
      isActive: membership.isActive,
      organization: membership.organization,
    })),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
