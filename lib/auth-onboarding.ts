export function normalizeAuthEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidAuthEmail(value: string) {
  const normalized = normalizeAuthEmail(value);
  return normalized.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function passwordsMatch(password: string, confirmation: string) {
  return password.length > 0 && password === confirmation;
}

export function temporaryPasswordError(password: string, confirmation: string) {
  if (password.length < 12) return 'Dočasné heslo musí mít alespoň 12 znaků.';
  if (!/[a-zá-ž]/i.test(password)) return 'Dočasné heslo musí obsahovat alespoň jedno písmeno.';
  if (!/\d/.test(password)) return 'Dočasné heslo musí obsahovat alespoň jedno číslo.';
  if (password !== confirmation) return 'Potvrzení dočasného hesla se neshoduje.';
  return null;
}

export function activatedLoginPath(email: string) {
  const params = new URLSearchParams({ activated: '1', email: normalizeAuthEmail(email) });
  return `/login?${params.toString()}`;
}
