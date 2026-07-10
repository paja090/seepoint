export function isMissingDatabaseStructureError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const maybe = error as { code?: string; message?: string };

  return maybe.code === 'P2021'
    || maybe.code === 'P2022'
    || Boolean(maybe.message?.includes('does not exist'))
    || Boolean(maybe.message?.includes('The column'))
    || Boolean(maybe.message?.includes('does not exist in the current database'));
}

export function productionMigrationMessage() {
  return 'Databaze jeste nema spustenou posledni migraci pro obsazenost a nabidky. Nejdriv spustte bezpecne `npm run db:migrate:deploy` proti produkcni DATABASE_URL.';
}
