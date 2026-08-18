'use client';

import { FormEvent, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, KeyRound, Phone, User, CheckCircle2, AlertCircle, Camera, Upload } from 'lucide-react';

export function ProfileForms({
  firstName,
  lastName,
  phone,
  email,
  currentPhotoUrl,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  currentPhotoUrl?: string | null;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'contact' | 'photo' | 'password'>('contact');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(currentPhotoUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  }

  async function submitPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const formData = new FormData(event.currentTarget);

      const response = await fetch('/api/profile/photo', {
        method: 'POST',
        body: formData,
      });

      const result = (await response.json()) as { ok?: boolean; photoUrl?: string; error?: string };
      setBusy(false);

      if (!response.ok || result.error) {
        setFeedback({ type: 'error', message: result.error || 'Nepodařilo se uložit profilovou fotku.' });
      } else {
        setFeedback({ type: 'success', message: 'Profilová fotografia byla úspěšně nahrána!' });
        if (result.photoUrl) setPhotoPreview(result.photoUrl);
        router.refresh();
      }
    } catch {
      setBusy(false);
      setFeedback({ type: 'error', message: 'Chyba při nahrávání profilové fotky.' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2">
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
            setActiveTab('photo');
            setFeedback(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition ${
            activeTab === 'photo'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Camera size={18} />
          Profilová fotka
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('password');
            setFeedback(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition ${
            activeTab === 'password'
              ? 'border-amber-600 text-amber-600'
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

      {/* Tab Content 2: Profile Photo Form */}
      {activeTab === 'photo' && (
        <form onSubmit={submitPhoto} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Camera className="text-emerald-600" size={20} />
              Nahrání profilové fotografie
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Vaše profilová fotka se bude zobrazovat v hlavičce, v navigačním menu a u vašich záznamů v systému.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Live Preview */}
            <div className="relative group shrink-0">
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-slate-900 text-3xl font-black text-emerald-400 shadow-md ring-4 ring-slate-100">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profilový náhled" className="h-full w-full object-cover" />
                ) : (
                  <span>{firstName[0]}{lastName[0]}</span>
                )}
              </div>
            </div>

            <div className="space-y-4 flex-1 w-full">
              <label className="block text-sm font-semibold text-slate-700">
                Vybrat obrázek z počítače / telefonu
                <input
                  type="file"
                  name="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="mt-1.5 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              </label>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-3 text-xs text-slate-400 font-semibold uppercase">Nebo zadat URL adresu</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                URL adresa fotografie
                <input
                  className="input mt-1 w-full rounded-xl border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                  name="photoUrl"
                  placeholder="https://example.com/moje-fotka.jpg"
                />
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              disabled={busy}
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              <Upload size={18} />
              {busy ? 'Nahrávám fotku…' : '📷 Uložit profilovou fotku'}
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
