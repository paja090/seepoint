'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Camera,
  Fuel,
  Volume2,
  VolumeX,
  Users,
  Check,
  CheckCheck,
  Sparkles,
  MessageSquare,
  Wrench,
  Car,
  Tag,
  X,
  Plus,
  ShieldCheck,
  Clock,
  Paperclip,
} from 'lucide-react';
import type { AppRole } from '@/lib/rbac';
import { roleLabel } from '@/lib/rbac';

interface VehicleOption {
  id: string;
  label: string;
}

interface TeamChatContainerProps {
  currentUser: {
    id: string;
    name: string;
    role: AppRole;
  };
  vehicles: VehicleOption[];
}

interface ChatMessageData {
  id: string;
  channel: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  imageUrl?: string | null;
  fuelExpenseId?: string | null;
  createdAt: string;
  reads?: Array<{ userId: string; readAt: string }>;
}

interface ActiveUser {
  id: string;
  name: string;
  roleLabel: string;
  position?: string | null;
  photoUrl?: string | null;
  lastActive?: string | null;
}

const channels = [
  { id: 'general', label: '📢 Celý Tým SeePOINT', description: 'Všeobecný firemní chat a aktuality' },
  { id: 'installations', label: '🛠️ Montáže & Zakázky', description: 'Diskuze k výjezdům a terénním montážím' },
  { id: 'vehicles', label: '🚗 Auta & Účtenky Paliva', description: 'Nahrávání benzínu, nafty a stavu autoparku' },
  { id: 'sales', label: '🏷️ Obchod & Nabídky', description: 'Dotazy k rezervacím nosičů a klientům' },
];

export function TeamChatContainer({ currentUser, vehicles }: TeamChatContainerProps) {
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [inputText, setInputText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showFuelModal, setShowFuelModal] = useState(false);

  // Fuel modal form state
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [fuelAmount, setFuelAmount] = useState('');
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [fuelNote, setFuelNote] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef<number>(0);

  // Sound chime synthesizer via Web Audio API
  function playNewMessageChime() {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Ignore audio context errors
    }
  }

  // Fetch messages for active channel
  async function fetchMessages(isPolling = false) {
    try {
      const res = await fetch(`/api/chat/messages?channel=${activeChannel}`);
      if (!res.ok) return;
      const data: ChatMessageData[] = await res.json();

      // Check if new message arrived from someone else
      if (isPolling && data.length > previousMessageCount.current) {
        const newest = data[data.length - 1];
        if (newest.userId !== currentUser.id) {
          playNewMessageChime();
        }
      }

      previousMessageCount.current = data.length;
      setMessages(data);
    } catch {
      // Ignore polling errors
    }
  }

  // Fetch online active users
  async function fetchPresence() {
    try {
      const res = await fetch('/api/chat/presence');
      if (res.ok) {
        const users = await res.json();
        setActiveUsers(users);
      }
    } catch {
      // Ignore errors
    }
  }

  useEffect(() => {
    fetchMessages();
    fetchPresence();
    const interval = setInterval(() => {
      fetchMessages(true);
      fetchPresence();
    }, 4000); // 4s poll interval for real-time responsiveness
    return () => clearInterval(interval);
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !imageUrl) || sending) return;

    try {
      setSending(true);
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: activeChannel,
          content: inputText,
          imageUrl: imageUrl || null,
        }),
      });

      if (res.ok) {
        setInputText('');
        setImageUrl('');
        await fetchMessages();
      } else {
        const err = await res.json();
        alert(err.error || 'Zprávu se nepodařilo odeslat.');
      }
    } catch {
      alert('Chyba spojení.');
    } finally {
      setSending(false);
    }
  }

  async function handleSendFuelExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicleId || !fuelAmount || Number(fuelAmount) <= 0 || sending) return;

    try {
      setSending(true);
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'vehicles',
          content: `⛽ Načerpáno palivo: ${fuelAmount} Kč ${fuelLiters ? `(${fuelLiters} l)` : ''} ${fuelOdometer ? `· stav tacho: ${fuelOdometer} km` : ''}`,
          imageUrl: imageUrl || null,
          fuelExpense: {
            vehicleId: selectedVehicleId,
            amount: Number(fuelAmount),
            liters: fuelLiters ? Number(fuelLiters) : undefined,
            odometer: fuelOdometer ? Number(fuelOdometer) : undefined,
            note: fuelNote || undefined,
            receiptUrl: imageUrl || undefined,
          },
        }),
      });

      if (res.ok) {
        setShowFuelModal(false);
        setFuelAmount('');
        setFuelLiters('');
        setFuelOdometer('');
        setFuelNote('');
        setImageUrl('');
        setActiveChannel('vehicles');
        await fetchMessages();
      } else {
        const err = await res.json();
        alert(err.error || 'Účtenku se nepodařilo uložit.');
      }
    } catch {
      alert('Chyba při ukládání účtenky.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-full rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden">
      {/* 🚀 Sidebar Channels & Active Users (Hidden on small screens when viewing messages) */}
      <div className="w-full lg:w-72 bg-slate-950 p-4 text-white flex flex-col justify-between border-r border-slate-800">
        <div>
          {/* Header & Sound Toggle */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">Týmové Chaty</h2>
            </div>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white transition"
              title={audioEnabled ? 'Hlasová/zvuková notifikace zapnutá' : 'Notifikace vypnutá'}
            >
              {audioEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} />}
            </button>
          </div>

          {/* Channels List */}
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-1">Skupiny</p>
            {channels.map((ch) => {
              const isActive = activeChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <span className="truncate">{ch.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Fuel Receipt Button */}
          <div className="mt-6">
            <button
              onClick={() => setShowFuelModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-amber-400 active:scale-95 transition"
            >
              <Fuel size={16} />
              <span>⛽ Nahrat Účtenku za Benzin</span>
            </button>
          </div>
        </div>

        {/* 🟢 Online Presence List */}
        <div className="mt-6 border-t border-slate-900 pt-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
              <Users size={12} className="text-emerald-400" />
              <span>Aktivní v týmu ({activeUsers.length})</span>
            </span>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {activeUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs hover:bg-slate-900">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                <span className="font-semibold text-slate-200 truncate">{u.name}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{u.roleLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 💬 Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {/* Active Channel Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-xs">
          <div>
            <h3 className="font-bold text-slate-950">
              {channels.find((c) => c.id === activeChannel)?.label}
            </h3>
            <p className="text-xs text-slate-500">
              {channels.find((c) => c.id === activeChannel)?.description}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Clock size={14} className="text-emerald-600" />
            <span>Aktualizace v reálném čase</span>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <MessageSquare className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-semibold">Zatím žádné zprávy v této skupině.</p>
              <p className="text-xs text-slate-400 mt-0.5">Napište první zprávu týmu níže.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.userId === currentUser.id;
              const hasReads = msg.reads && msg.reads.length > 0;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-bold text-slate-900">{msg.userName}</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-md">
                      {msg.userRole}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`max-w-md rounded-2xl p-4 shadow-xs border ${
                      isMe
                        ? 'bg-slate-950 text-white border-slate-900 rounded-br-none'
                        : 'bg-white text-slate-950 border-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm font-normal whitespace-pre-wrap">{msg.content}</p>

                    {/* Image Attachment */}
                    {msg.imageUrl && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-slate-700">
                        <img
                          src={msg.imageUrl}
                          alt="Příloha"
                          className="max-h-60 w-full object-cover cursor-pointer hover:opacity-90 transition"
                          onClick={() => window.open(msg.imageUrl!, '_blank')}
                        />
                      </div>
                    )}
                  </div>

                  {/* Read Receipts */}
                  {isMe && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1 font-semibold">
                      {hasReads ? (
                        <>
                          <CheckCheck size={13} className="text-emerald-600" />
                          <span>Zobrazeno týmem</span>
                        </>
                      ) : (
                        <>
                          <Check size={13} />
                          <span>Odesláno</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-4 space-y-3">
          {imageUrl && (
            <div className="flex items-center justify-between rounded-xl bg-slate-100 p-2 text-xs">
              <span className="truncate text-slate-700 font-mono">📷 Příloha fotky připojena</span>
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="text-slate-500 hover:text-red-600"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const url = prompt('Zadejte URL adresu fotky nebo zadejte odkaz:');
                if (url) setImageUrl(url.trim());
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
              title="Připojit fotku / obrázek"
            >
              <Camera size={18} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Napište zprávu do skupiny ${channels.find((c) => c.id === activeChannel)?.label}...`}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />

            <button
              type="submit"
              disabled={sending || (!inputText.trim() && !imageUrl)}
              className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-bold text-slate-950 shadow-md hover:bg-emerald-400 active:scale-95 transition disabled:opacity-50"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Odeslat</span>
            </button>
          </div>
        </form>
      </div>

      {/* ⛽ Fuel Receipt Modal */}
      {showFuelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Fuel className="h-5 w-5 text-amber-600" />
                <h3 className="font-bold text-slate-950">Nahrát Účtenku za Palivo / Benzin</h3>
              </div>
              <button
                onClick={() => setShowFuelModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendFuelExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vyberte Služební Vozidlo</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Částka (Kč)*</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Např. 1850"
                    value={fuelAmount}
                    onChange={(e) => setFuelAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Litry paliva (l)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Např. 48.5"
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Stav tachometru (km)</label>
                <input
                  type="number"
                  placeholder="Např. 142500"
                  value={fuelOdometer}
                  onChange={(e) => setFuelOdometer(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Odkaz na fotku účtenky / URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFuelModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Zrušit
                </button>

                <button
                  type="submit"
                  disabled={sending || !fuelAmount}
                  className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-black text-slate-950 hover:bg-amber-400 shadow-md transition disabled:opacity-50"
                >
                  Uložit Účtenku a Odeslat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
