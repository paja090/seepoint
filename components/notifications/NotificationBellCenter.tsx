'use client';

import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Clock, FileText, CheckCircle2, ChevronRight, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  link: string;
  createdAt: string;
};

export function NotificationBellCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [highCount, setHighCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (res.ok && data.notifications) {
        setNotifications(data.notifications);
        setTotalCount(data.totalCount || 0);
        setHighCount(data.highCount || 0);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition active:scale-95"
        title="Centrum notifikací a upozornění"
      >
        <Bell size={18} />
        {totalCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ${
              highCount > 0 ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
            }`}
          >
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-amber-600" />
                <h3 className="font-black text-sm text-slate-900">Upozornění & Notifikace</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {totalCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchNotifications}
                  disabled={loading}
                  className="p-1 text-slate-400 hover:text-slate-600"
                  title="Obnovit"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                  <p className="font-bold text-slate-700">Vše v pořádku</p>
                  <p className="mt-0.5">Žádné urgentní úkoly nebo končící smlouvy ke kontrole.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl border p-3 text-xs transition hover:scale-[1.01] ${
                      n.severity === 'HIGH'
                        ? 'border-rose-200 bg-rose-50/70 text-rose-950 hover:border-rose-300'
                        : 'border-slate-100 bg-slate-50 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold">{n.title}</h4>
                      {n.severity === 'HIGH' && (
                        <span className="shrink-0 rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                          URGENTNÍ
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">{n.message}</p>
                  </Link>
                ))
              )}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-2.5 text-center">
              <Link
                href="/work"
                onClick={() => setOpen(false)}
                className="text-xs font-bold text-sky-700 hover:underline flex items-center justify-center gap-1"
              >
                Přejít do kompletního Plánu práce <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
