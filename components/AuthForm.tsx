'use client';

import { FormEvent, useState } from 'react';

export function AuthForm({
  mode,
  token,
  purpose,
  defaultEmail = '',
  initialMessage = '',
}: {
  mode: 'login' | 'forgot' | 'password';
  token?: string;
  purpose?: 'activation' | 'reset';
  defaultEmail?: string;
  initialMessage?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (mode === 'password' && values.password !== values.passwordConfirmation) {
      setLoading(false);
      setError('Zadaná hesla se neshodují.');
      return;
    }
    const endpoint =
      mode === 'login'
        ? '/api/auth/login'
        : mode === 'forgot'
        ? '/api/auth/forgot-password'
        : '/api/auth/set-password';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...values, token, purpose }),
    });

    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      return setError(result.error ?? 'Požadavek se nepodařilo dokončit.');
    }

    if (mode === 'login' || mode === 'password') {
      setMessage(
        mode === 'password'
          ? 'Účet byl úspěšně aktivován a heslo uloženo. Přesměrovávám do aplikace…'
          : 'Přihlašování úspěšné…'
      );
      setTimeout(() => {
        window.location.replace(result.redirectTo ?? '/dashboard');
      }, 500);
    } else {
      setMessage(result.message || 'Pokyny byly odeslány.');
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      {mode !== 'password' && (
        <label className="block text-sm font-medium">
          E-mail
          <input
            className="input mt-1"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={defaultEmail}
          />
        </label>
      )}

      {mode !== 'forgot' && (
        <label className="block text-sm font-medium">
          {mode === 'login' ? 'Heslo' : 'Nové heslo'}
          <input
            className="input mt-1"
            name="password"
            type="password"
            minLength={mode === 'password' ? 12 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </label>
      )}

      {mode === 'password' && (
        <label className="block text-sm font-medium">
          Potvrzení nového hesla
          <input
            className="input mt-1"
            name="passwordConfirmation"
            type="password"
            minLength={12}
            autoComplete="new-password"
            required
          />
        </label>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status">
          {message}
        </p>
      )}

      <button
        className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
        disabled={loading}
      >
        {loading
          ? 'Zpracovávám…'
          : mode === 'login'
          ? 'Přihlásit'
          : mode === 'forgot'
          ? 'Odeslat pokyny'
          : 'Aktivovat účet & Vstoupit'}
      </button>
    </form>
  );
}
