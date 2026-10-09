import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { hashToken } from '@/lib/auth';
import { platformPrisma } from '@/lib/db';
import { isTokenUsable } from '@/lib/token-policy';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await platformPrisma.userToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  const isInvalid = !record || !isTokenUsable(record);

  if (isInvalid) {
    const isUsed = record?.usedAt !== null && record?.usedAt !== undefined;
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
        <section className="card w-full max-w-md text-center py-8 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-bold">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-white">
            {isUsed ? 'Odkaz již byl použit nebo zneplatněn' : 'Odkaz vypršel nebo je neplatný'}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            {isUsed
              ? 'Tento aktivační odkaz již byl dříve využit, případně byl zneplatněn nastavením dočasného hesla. Pokud se nemůžete přihlásit, nechte si zaslat nový odkaz pro obnovu hesla.'
              : 'Tento aktivační odkaz již vypršel nebo je neplatný. Můžete si nechat zaslat nový odkaz pro nastavení hesla.'}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/forgot-password"
              className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 transition"
            >
              Zaslat nový odkaz na e-mail
            </Link>
            <Link
              href="/login"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Přejít na přihlášení
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <section className="card w-full max-w-md">
        <h1 className="text-2xl font-bold">Aktivace účtu</h1>
        <p className="mt-2 text-sm text-slate-500">Nastavte si bezpečné heslo pro přístup do aplikace.</p>
        <AuthForm mode="password" token={token} purpose="activation" />
      </section>
    </main>
  );
}
