export * from './rbac';

export function AccessDenied({ title = 'Nemáte oprávnění' }: { title?: string }) {
  return (
    <section className="card">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">Tahle část je dostupná jen oprávněným rolím.</p>
    </section>
  );
}
