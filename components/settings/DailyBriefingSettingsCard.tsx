'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import type { DailyBriefingSettings, SendBriefingsResult } from '@/lib/work/daily-briefing';

type PreviewWorker = {
  recipientName: string;
  recipientEmail: string;
  taskCount: number;
  vehicles: string[];
  crewMates: string[];
  tasks: Array<{
    title: string;
    clientName: string;
    workTypeLabel: string;
    scheduledTimeLabel?: string;
  }>;
};

type BriefingLogItem = {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  sentAt: string;
  metadata?: {
    targetDate?: string;
    recipientName?: string;
    taskCount?: number;
    isTest?: boolean;
  } | null;
};

type ApiResponse = {
  settings: DailyBriefingSettings;
  preview: {
    targetDate: string;
    targetDateLabel: string;
    unmatchedWorkerNames: string[];
    briefings: PreviewWorker[];
  };
  recentLogs: BriefingLogItem[];
  error?: string;
};

export function DailyBriefingSettingsCard({ currentUserEmail }: { currentUserEmail?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [settings, setSettings] = useState<DailyBriefingSettings>({
    enabled: true,
    sendHourLocal: 17,
    timezone: 'Europe/Prague',
    skipWeekends: false,
  });
  const [preview, setPreview] = useState<ApiResponse['preview'] | null>(null);
  const [recentLogs, setRecentLogs] = useState<BriefingLogItem[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/settings/daily-briefing');
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || 'Načtení selhalo.');
      setSettings(data.settings);
      setPreview(data.preview);
      setRecentLogs(data.recentLogs || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst nastavení rozesílače.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSave() {
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/settings/daily-briefing', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = (await res.json()) as { ok?: boolean; settings?: DailyBriefingSettings; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Uložení selhalo.');
      if (data.settings) setSettings(data.settings);
      setNotice(
        data.settings?.enabled
          ? `Automatický rozesílač uložen. Pracovníkům budou chodit úkoly den předem v ${data.settings.sendHourLocal}:00.`
          : 'Automatické rozesílání bylo pozastaveno a uloženo.'
      );
      setTimeout(() => setNotice(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nepodařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    setSendingTest(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/settings/daily-briefing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'send_test',
          testEmail: currentUserEmail,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; summary?: SendBriefingsResult; error?: string };
      if (!res.ok || !data.ok || !data.summary) throw new Error(data.error || 'Testovací e-mail se nepodařilo odeslat.');

      if (data.summary.sentCount > 0) {
        setNotice(`Testovací přehled byl úspěšně odeslán na ${data.summary.deliveries[0]?.recipientEmail}. Zkontrolujte doručenou poštu.`);
      } else if (data.summary.skippedEnvCount > 0) {
        setNotice('Test proběhl v náhledovém/vývojovém režimu (odesílání e-mailů je v tomto prostředí blokováno, na ostré verzi odejde normálně).');
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test selhal.');
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSendNow(force = false) {
    if (!preview) return;
    const confirmed = window.confirm(
      force
        ? `Opravdu chcete ZNOVU odeslat zítřejší plány (${preview.targetDateLabel}) všem ${preview.briefings.length} pracovníkům e-mailem?`
        : `Opravdu chcete hned teď odeslat zítřejší plány (${preview.targetDateLabel}) všem ${preview.briefings.length} pracovníkům, kteří jej ještě nedostali?`
    );
    if (!confirmed) return;

    setSendingNow(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/settings/daily-briefing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'send_now',
          targetDate: preview.targetDate,
          force,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; summary?: SendBriefingsResult; error?: string };
      if (!res.ok || !data.ok || !data.summary) throw new Error(data.error || 'Rozeslání selhalo.');
      const s = data.summary;
      setNotice(
        `Hotovo pro ${s.targetDateLabel}: odesláno ${s.sentCount} e-mailů` +
          (s.skippedAlreadySentCount ? `, přeskočeno (již dříve odesláno) ${s.skippedAlreadySentCount}` : '') +
          (s.skippedEnvCount ? `, testovací režim ${s.skippedEnvCount}` : '') +
          (s.failedCount ? `, chyby ${s.failedCount}` : '') +
          '.'
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rozeslání selhalo.');
    } finally {
      setSendingNow(false);
    }
  }

  return (
    <section id="daily-briefing" className="card space-y-6 border-sky-200 bg-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Mail size={18} />
            </span>
            <h2 className="text-xl font-black text-slate-950">
              Automatický denní plán práce e-mailem (den předem)
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Systém každý den ve zvolenou hodinu automaticky projde zítřejší zakázky a naplánované trasy a každému pracovníkovi pošle přehled jeho zítřejších úkolů, adres, navigace a podkladů na Disku, aby se mohl předem připravit.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Obnovit náhled</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-800">
          <AlertTriangle size={18} className="shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 py-4">Načítám nastavení a zítřejší náhled…</p>
      ) : (
        <>
          {/* Settings form */}
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              <div>
                <span className="block text-sm font-bold text-slate-900">
                  Automatické rozesílání zapnuto
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Pokud má pracovník na zítřek úkol nebo výjezd, obdrží e-mail.
                </span>
              </div>
            </label>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <Clock size={12} className="inline mr-1" />
                Hodina odeslání (den předem)
              </label>
              <select
                value={settings.sendHourLocal}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, sendHourLocal: Number(e.target.value) }))
                }
                className="input w-full bg-white text-sm font-bold"
              >
                {[12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00 (čas ČR)
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.skipWeekends}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, skipWeekends: e.target.checked }))
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              <div>
                <span className="block text-sm font-bold text-slate-900">
                  Přeskočit víkendové dny
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  V pátek a sobotu neposílat přehledy na sobotu/neděli (nechte vypnuté, pokud máte i víkendové akce).
                </span>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-slate-800 transition disabled:opacity-50"
            >
              {saving ? 'Ukládám…' : 'Uložit nastavení rozesílače'}
            </button>

            <button
              type="button"
              onClick={() => void handleSendTest()}
              disabled={sendingTest || !currentUserEmail}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-xs font-black text-sky-800 hover:bg-sky-100 transition disabled:opacity-50"
            >
              <Send size={14} />
              <span>
                {sendingTest
                  ? 'Odesílám test…'
                  : `Poslat testovací náhled na ${currentUserEmail || 'můj e-mail'}`}
              </span>
            </button>

            {preview && preview.briefings.length > 0 && (
              <button
                type="button"
                onClick={() => void handleSendNow(false)}
                disabled={sendingNow}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50"
              >
                <Mail size={14} />
                <span>
                  {sendingNow
                    ? 'Rozesílám…'
                    : `Odeslat zítřejší plán teď (${preview.briefings.length} pracovníkům)`}
                </span>
              </button>
            )}
          </div>

          {/* Tomorrow preview */}
          {preview && (
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Calendar size={16} className="text-sky-600" />
                  <span>Náhled rozeslání na zítřek: {preview.targetDateLabel}</span>
                </h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {preview.briefings.length}{' '}
                  {preview.briefings.length === 1
                    ? 'příjemce s úkolem'
                    : preview.briefings.length >= 2 && preview.briefings.length <= 4
                    ? 'příjemci s úkoly'
                    : 'příjemců s úkoly'}
                </span>
              </div>

              {preview.unmatchedWorkerNames.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <span>
                      U některých zítřejších zakázek nemají tito pracovníci v systému přiřazený e-mail (přehled se jim neodešle):
                    </span>
                  </div>
                  <p className="font-semibold">
                    {preview.unmatchedWorkerNames.join(', ')}{' '}
                    <Link href="/settings/members" className="underline text-amber-800 ml-1">
                      Doplnit uživatele / zaměstnance →
                    </Link>
                  </p>
                </div>
              )}

              {preview.briefings.length === 0 ? (
                <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-200 p-4 text-center">
                  Na zítřek ({preview.targetDateLabel}) zatím nejsou naplánovány žádné zakázky s přiřazenými pracovníky s e-mailem.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {preview.briefings.map((worker) => (
                    <div
                      key={worker.recipientEmail}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <Users size={14} className="text-sky-600" />
                            <span>{worker.recipientName}</span>
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {worker.recipientEmail}
                          </div>
                        </div>
                        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-black text-sky-800">
                          {worker.taskCount} {worker.taskCount === 1 ? 'úkol' : worker.taskCount <= 4 ? 'úkoly' : 'úkolů'}
                        </span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-700 border-t border-slate-200/70 pt-2">
                        {worker.tasks.map((task, idx) => (
                          <li key={idx} className="truncate">
                            {task.scheduledTimeLabel ? (
                              <strong className="text-sky-700 mr-1">{task.scheduledTimeLabel}</strong>
                            ) : (
                              <span className="text-slate-400 mr-1">•</span>
                            )}
                            <span className="font-semibold">{task.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent delivery history */}
          {recentLogs.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Poslední odeslané denní plány
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800">
                        {log.metadata?.recipientName || log.recipient}
                      </span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-600 truncate">{log.subject}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">
                      {new Date(log.sentAt).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
