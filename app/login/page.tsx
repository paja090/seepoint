import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { getCurrentUser } from '@/lib/auth';

export default async function Login({ searchParams }: { searchParams: Promise<{ activated?: string; email?: string }> }) {
  if (await getCurrentUser()) redirect('/dashboard');
  const query = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <Image src="/seepoint-logo.svg" alt="SeePOINT" width={240} height={80} className="h-20 w-auto" priority />
        <h1 className="mt-6 text-2xl font-bold">Přihlášení do aplikace</h1>
        <p className="mt-2 text-sm text-slate-500">Správa reklamních ploch a interního provozu.</p>
        <AuthForm
          mode="login"
          defaultEmail={query.email || ''}
          initialMessage={query.activated === '1' ? 'Heslo bylo bezpečně uloženo. Přihlaste se novým heslem.' : ''}
        />
        <Link className="mt-5 block text-center text-sm font-medium text-sky-700" href="/forgot-password">Zapomenuté heslo</Link>
      </section>
    </main>
  );
}
