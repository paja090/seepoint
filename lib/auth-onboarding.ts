export function normalizeAuthEmail(value: string) {
  return value.trim().toLowerCase();
}

export function passwordsMatch(password: string, confirmation: string) {
  return password.length > 0 && password === confirmation;
}

export function activatedLoginPath(email: string) {
  const params = new URLSearchParams({ activated: '1', email: normalizeAuthEmail(email) });
  return `/login?${params.toString()}`;
}
