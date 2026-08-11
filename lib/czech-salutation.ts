const SURNAME_VOCATIVES: Record<string, string> = {
  'šubert': 'Šuberte',
};

export function formatCzechBusinessSalutation(contactName: string) {
  const normalized = contactName.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'kliente';

  const surname = normalized.split(' ').at(-1)?.toLocaleLowerCase('cs-CZ');
  const vocative = surname ? SURNAME_VOCATIVES[surname] : undefined;
  return vocative ? `pane ${vocative}` : normalized;
}
