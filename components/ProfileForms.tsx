'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, KeyRound, Phone, User, CheckCircle2, AlertCircle } from 'lucide-react';

export function ProfileForms({
  firstName,
  lastName,
  phone,
  email,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}) {
  const router = Router();
  const [activeTab, setActiveTab] = useState<'contact' | 'password'>('contact');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function Router() {
    return useRouter();
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const formData = new FormData(event.currentTarget);
      const body = {
        action: 'contact',
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        phone: formData.get('phone'),
      };

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as { ok?: boolean; error?: string };
      setBusy(false);

      if (!response.ok || result.error) {
        setFeedback({ type: 'error', message: result.error || 'Nepodařilo se uložit kontaktní údaje.' });
      } else {
        setFeedback({ type: 'success', message: 'Kontaktní údaje byly úspěšně aktualizovány.' });
        router.refresh();
      }
    } catch {
      setBusy(false);
      setFeedback({ type: 'error', message: 'Chyba při komunikaci se serverem.' });
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const body = {
        action: 'password',
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword'),
        confirmNewPassword: formData.get('confirmNewPassword'),
      };

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as { ok?: boolean; error?: string };
      setBusy(false);

      if (!response.ok || result.error) {
        setFeedback({ type: 'error', message: result.error || 'Změna hesla selhala.' });
      } else {
        setFeedback({ type: 'success', message: 'Vaše heslo bylo úspěšně změněno.' });
        form.reset();
        router.refresh();
      }
    } catch {
      setBusy(false);
      setFeedback({ type: 'error', message: 'Chyba při komunikaci se serverem.' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('contact');
            setFeedback(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition ${
            activeTab === 'contact'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <UserCheck size={18} />
          Kontaktní a osobní údaje
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('password');
            setFeedback(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition ${
            activeTab === 'password'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <KeyRound size={18} />
          Zabezpečení & Heslo
        </button>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-3 p-4 rounded-2xl border text-sm font-medium animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="shrink-0 text-emerald-600" size={20} />
          ) : (
            <AlertCircle className="shrink-0 text-rose-600" size={20} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Tab Content 1: Contact Form */}
      {activeTab === 'contact' && (
        <form onSubmit={submitContact} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <User className="text-sky-600" size={20} />
              Úprava osobních údajů
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tyto údaje se zobrazují kolegovému týmu a na pracovních výkazech.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Jméno *
              <input
                className="input mt-1 w-full rounded-xl border-slate-300 p-2.5 focus:ring-2 focus:ring-sky-500"
                name="firstName"
                defaultValue={firstName}
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Příjmení *
              <input
                className="input mt-1 w-full rounded-xl border-slate-300 p-2.5 focus:ring-2 focus:ring-sky-500"
                name="lastName"
                defaultValue={lastName}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              E-mailová adresa (Přihlašovací jméno)
              <input
                className="input mt-1 w-full rounded-xl border-slate-200 bg-slate-100 p-2.5 text-slate-500 cursor-not-allowed"
                value={email}
                disabled
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Telefonní číslo
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  className="input w-full pl-10 rounded-xl border-slate-300 p-2.5 focus:ring-2 focus:ring-sky-500"
                  name="phone"
                  defaultValue={phone}
                  placeholder="+420 777 123 456"
                />
              </div>
            </label>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              disabled={busy}
              type="submit"
              className="rounded-xl bg-slate-950 px-6 py-2.5 font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {busy ? 'Ukládám údaje…' : '💾 Uložit kontaktní údaje'}
            </button>
          </div>
        </form>
      )}

      {/* Tab Content 2: Password Form */}
      {activeTab === 'password' && (
        <form onSubmit={submitPassword} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="text-amber-600" size={20} />
              Změna přihlašovacího hesla
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Heslo musí mít alespoň 12 znaků, obsahovat písmeno i číslo.
            </p>
          </div>

          <div className="space-y-4 max-w-lg">
            <label className="block text-sm font-semibold text-slate-700">
              Současné heslo *
              <input
                className="input mt-1 w-full rounded-xl border-slate-300 p-2.5 focus:ring-2 focus:ring-sky-500"
                type="password"
                name="currentPassword"
                autoComplete="current-password"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Nové heslo *
              <input
                className="input mt-1 w-full rounded-xl border-slate-300 p-2.5 focus:ring-2 focus:ring-sky-500"
                type="password"
                name="newPassword"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Potvrdit nové heslo *
              <input
                className="input mt-1 w-full rounded-xl border-slate-300 p-2.5 focus:ring-2 focus:ring-sky-500"
                type="password"
                name="confirmNewPassword"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              disabled={busy}
              type="submit"
              className="rounded-xl bg-amber-600 px-6 py-2.5 font-bold text-white shadow-md hover:bg-amber-700 disabled:opacity-50 transition"
            >
              {busy ? 'Měním heslo…' : '🔒 Změnit přístupové heslo'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
