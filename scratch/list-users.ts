import { platformPrisma } from '../lib/db';

async function main() {
  const users = await platformPrisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
    },
  });

  console.log('--- ALL USERS IN SEEPOINT ---');
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error);
