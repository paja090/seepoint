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
  AlertTriangle,
  FileImage,
  UserCheck,
  CheckCircle,
  ShoppingBag,
} from 'lucide-react';
import type { AppRole } from '@/lib/rbac';
import { roleLabel } from '@/lib/rbac';
import { CompanyShoppingListModal } from './CompanyShoppingListModal';

interface VehicleOption {
  id: string;
  label: string;
}

interface TeamMemberOption {
  id: string;
  name: string;
  position?: string | null;
}

interface TeamChatContainerProps {
  currentUser: {
    id: string;
    name: string;
    role: AppRole;
  };
  vehicles: VehicleOption[];
  teamMembers?: TeamMemberOption[];
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
  assignedToUserId?: string | null;
  assignedToUserName?: string | null;
  isResolved?: boolean;
  resolvedAt?: string | null;
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
  { id: 'general', label: '📢 Celý Tým SeePOINT', description: 'Všeobecný firemní chat a oficiální oznamy' },
  { id: 'installations', label: '🛠️ Montáže & Zakázky', description: 'Diskuze k výjezdům, montážím a fotkám z terénu' },
  { id: 'vehicles', label: '🚗 Auta, Vozíky & Závady', description: 'Benzín, nafta, servisy a hlásení poruch vozidel' },
  { id: 'sales', label: '🏷️ Obchod & Nabídky', description: 'Dotazy k rezervacím nosičů a klientům' },
  { id: 'urgent', label: '⚡ Urgentní Problémy & Incidenty', description: 'Havárie, poškozené nosiče a neodkladné úkoly' },
];

export function TeamChatContainer({ currentUser, vehicles, teamMembers = [] }: TeamChatContainerProps) {
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [inputText, setInputText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Modal states
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showFaultModal, setShowFaultModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [assigningMsgId, setAssigningMsgId] = useState<string | null>(null);

  // Fuel modal form state
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [fuelAmount, setFuelAmount] = useState('');
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [fuelNote, setFuelNote] = useState('');

  // Vehicle fault modal state
  const [faultTitle, setFaultTitle] = useState('');
  const [faultDescription, setFaultDescription] = useState('');
  const [faultSeverity, setFaultSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousMessageCount = useRef<number>(0);

  // Compress camera/gallery photo on client side to max 1600px / ~300KB to prevent HTTP 413 errors
  function compressImageForChat(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1600;
          const MAX_HEIGHT = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(e.target?.result as string);
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Chyba při načítání obrázku.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Soubor se nepodařilo přečíst.'));
      reader.readAsDataURL(file);
    });
  }

  // Handle direct photo selection from camera or gallery with automatic compression
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImageForChat(file);
      setImageUrl(compressedDataUrl);
    } catch {
      alert('Fotografii se nepodařilo zpracovat. Zkuste vybrat jinou fotku.');
    } finally {
      e.target.value = '';
    }
  }

  // Sound chime synthesizer via Web Audio API
  function playNewMessageChime() {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
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
    }, 4000);
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

  async function handleAssignSolver(messageId: string, solverId: string, solverName: string) {
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          assignedToUserId: solverId,
          assignedToUserName: solverName,
        }),
      });

      if (res.ok) {
        setAssigningMsgId(null);
        await fetchMessages();
      }
    } catch {
      alert('Chyba při přiřazování řešitele.');
    }
  }

  async function handleToggleResolved(messageId: string, currentResolvedStatus: boolean) {
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          isResolved: !currentResolvedStatus,
        }),
      });

      if (res.ok) {
        await fetchMessages();
      }
    } catch {
      alert('Chyba změny stavu.');
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

  async function handleSendVehicleFault(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicleId || !faultTitle.trim() || sending) return;

    try {
      setSending(true);
      const vehicleObj = vehicles.find((v) => v.id === selectedVehicleId);
      const vehicleName = vehicleObj ? vehicleObj.label : 'Služební auto';

      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'vehicles',
          content: `🚨 NAHLÁŠENÍ PORUCHY NA VOZIDLE (${vehicleName}):\nZávada: ${faultTitle}\nDetail: ${faultDescription || 'Bez popisu'}\nZávažnost: ${faultSeverity}`,
          imageUrl: imageUrl || null,
          vehicleFault: {
            vehicleId: selectedVehicleId,
            title: faultTitle,
            description: faultDescription,
            severity: faultSeverity,
            photoUrl: imageUrl || undefined,
          },
        }),
      });

      if (res.ok) {
        setShowFaultModal(false);
        setFaultTitle('');
        setFaultDescription('');
        setImageUrl('');
        setActiveChannel('vehicles');
        await fetchMessages();
      } else {
        const err = await res.json();
        alert(err.error || 'Závadu se nepodařilo nahlásit.');
      }
    } catch {
      alert('Chyba při nahlášení závady.');
    } finally {
      setSending(false);
    }
  }

  const solverOptions = teamMembers.length > 0
    ? teamMembers
    : activeUsers.map((u) => ({ id: u.id, name: u.name, position: u.roleLabel }));

  return (
    <div className="flex flex-col lg:flex-row h-full rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden">
      {/* 📱 Mobile Channel Tab Selector Bar (Visible only on mobile/tablet screens) */}
      <div className="flex lg:hidden overflow-x-auto border-b border-slate-800 bg-slate-950 p-2.5 text-white gap-2 scrollbar-none shrink-0">
        {channels.map((ch) => {
          const isActive = activeChannel === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                isActive ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {ch.label}
            </button>
          );
        })}
      </div>

      {/* 📱 Mobile Quick Actions Bar for Shopping, Fuel & Faults (< lg) */}
      <div className="flex lg:hidden overflow-x-auto border-b border-slate-800 bg-slate-900 px-2.5 py-2 text-white gap-2 scrollbar-none shrink-0">
        <button
          type="button"
          onClick={() => setShowShoppingModal(true)}
          className="flex items-center gap-1.5 shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-3 py-1.5 text-xs font-black text-slate-950 shadow-md active:scale-95 transition"
        >
          <ShoppingBag size={15} />
          <span>🛒 Firemní nákupy</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFuelModal(true)}
          className="flex items-center gap-1.5 shrink-0 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300 active:scale-95 transition"
        >
          <Fuel size={14} />
          <span>⛽ Palivo</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFaultModal(true)}
          className="flex items-center gap-1.5 shrink-0 rounded-xl bg-rose-950/80 border border-rose-800/80 px-3 py-1.5 text-xs font-bold text-rose-300 active:scale-95 transition"
        >
          <AlertTriangle size={14} />
          <span>⚠️ Závada</span>
        </button>
      </div>

      {/* 🚀 Sidebar Channels & Active Users (Desktop) */}
      <div className="hidden lg:flex w-72 bg-slate-950 p-4 text-white flex-col justify-between border-r border-slate-800 shrink-0">
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

          {/* Quick Action Buttons */}
          <div className="mt-5 space-y-2">
            <button
              onClick={() => setShowShoppingModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition"
            >
              <ShoppingBag size={16} />
              <span>🛒 Firemní Nákupy (Kancelář / Dílna)</span>
            </button>

            <button
              onClick={() => setShowFuelModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-slate-950 active:scale-95 transition"
            >
              <Fuel size={15} />
              <span>⛽ Účtenka za Palivo</span>
            </button>

            <button
              onClick={() => setShowFaultModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-950/60 border border-rose-800/60 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white active:scale-95 transition"
            >
              <AlertTriangle size={15} />
              <span>⚠️ Závada na Autě</span>
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
      <div className="flex-1 flex flex-col bg-slate-50 min-w-0">
        {/* Active Channel Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5 shadow-xs">
          <div>
            <h3 className="font-bold text-slate-950">
              {channels.find((c) => c.id === activeChannel)?.label}
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-sm">
              {channels.find((c) => c.id === activeChannel)?.description}
            </p>
          </div>

          {/* Mobile Quick Action Buttons (Fuel & Fault) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowFuelModal(true)}
              className="lg:hidden flex h-8 px-2.5 items-center gap-1 rounded-xl bg-amber-500 text-[11px] font-black text-slate-950"
              title="Účtenka palivo"
            >
              <Fuel size={14} />
              <span className="hidden sm:inline">Účtenka</span>
            </button>
            <button
              onClick={() => setShowFaultModal(true)}
              className="lg:hidden flex h-8 px-2.5 items-center gap-1 rounded-xl bg-rose-600 text-[11px] font-black text-white"
              title="Závada na autě"
            >
              <AlertTriangle size={14} />
              <span className="hidden sm:inline">Závada</span>
            </button>
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
                    className={`max-w-md rounded-2xl p-4 shadow-xs border relative group ${
                      isMe
                        ? 'bg-slate-950 text-white border-slate-900 rounded-br-none'
                        : 'bg-white text-slate-950 border-slate-200 rounded-bl-none'
                    }`}
                  >
                    {/* Assignment & Resolution Badges */}
                    {msg.assignedToUserName && (
                      <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-500/30">
                        <div className="flex items-center gap-1.5">
                          <UserCheck size={14} className="text-amber-600" />
                          <span>Řeší: <b>{msg.assignedToUserName}</b></span>
                        </div>

                        <button
                          onClick={() => handleToggleResolved(msg.id, !!msg.isResolved)}
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-black transition ${
                            msg.isResolved
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                          }`}
                        >
                          {msg.isResolved ? '✓ Vyřešeno' : 'Označit vyřešené'}
                        </button>
                      </div>
                    )}

                    <p className="text-sm font-normal whitespace-pre-wrap">{msg.content}</p>

                    {/* Image Attachment */}
                    {msg.imageUrl && (
                      <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-700">
                        <img
                          src={msg.imageUrl}
                          alt="Příloha fotka z terénu"
                          className="max-h-64 w-full object-cover cursor-pointer hover:opacity-90 transition"
                          onClick={() => window.open(msg.imageUrl!, '_blank')}
                        />
                      </div>
                    )}

                    {/* Assign Solver Quick Action */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/20 flex items-center justify-between text-[11px]">
                      {!msg.assignedToUserName && (
                        <button
                          onClick={() => setAssigningMsgId(assigningMsgId === msg.id ? null : msg.id)}
                          className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition font-semibold"
                        >
                          <UserCheck size={13} />
                          <span>Přidělit řešitele</span>
                        </button>
                      )}

                      {/* Dropdown Menu for Assigning Solver */}
                      {assigningMsgId === msg.id && (
                        <div className="mt-2 w-full rounded-xl bg-slate-900 border border-slate-700 p-2 space-y-1 text-xs text-white z-10">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Vyberte pracovníka pro vyřešení:</p>
                          {solverOptions.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => handleAssignSolver(msg.id, u.id, u.name)}
                              className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-slate-800 font-semibold flex items-center justify-between"
                            >
                              <span>{u.name}</span>
                              <span className="text-[10px] text-slate-400">{u.position || 'Pracovník'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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

        {/* Input Bar with File Picker for Mobile Photos */}
        <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-4 space-y-3">
          {imageUrl && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-2.5 border border-emerald-200 text-xs">
              <div className="flex items-center gap-2">
                <FileImage size={16} className="text-emerald-700" />
                <span className="font-bold text-emerald-900">📷 Fotka z fotoaparátu / galerii připojena</span>
              </div>
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="text-slate-500 hover:text-red-600 font-bold"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Hidden HTML File Input for Mobile Camera / Device Storage */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-emerald-700 hover:bg-emerald-50 active:scale-95 transition shadow-xs shrink-0"
              title="Vyfotit fototoaparátem nebo vybrat fotku"
            >
              <Camera size={20} />
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
              className="flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-bold text-slate-950 shadow-md hover:bg-emerald-400 active:scale-95 transition disabled:opacity-50 shrink-0"
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
                <h3 className="font-bold text-slate-950">Nahrát Účtenku za Palivo</h3>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Fotka účtenky</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <Camera size={16} />
                  <span>{imageUrl ? '📷 Fotka vybraná' : 'Vyfotit / Vybrat účtenku'}</span>
                </button>
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
                  Uložit Účtenku
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚠️ Vehicle Fault / Damage Modal */}
      {showFaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <h3 className="font-bold text-slate-950">Nahlásit Závadu na Vozidle / Vozíku</h3>
              </div>
              <button
                onClick={() => setShowFaultModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendVehicleFault} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vyberte Vozidlo / Vozík*</label>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Název závady / Poruchy*</label>
                <input
                  type="text"
                  placeholder="Např. Defekt pneu, svítí kontrolka motoru, poškozené světlo..."
                  value={faultTitle}
                  onChange={(e) => setFaultTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Závažnost poruchy</label>
                <select
                  value={faultSeverity}
                  onChange={(e) => setFaultSeverity(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                >
                  <option value="LOW">Lehká (Vozidlo normálně pojízdné)</option>
                  <option value="MEDIUM">Střední (Nutná oprava v nejbližších dnech)</option>
                  <option value="HIGH">Vysoká (Předat do servisu)</option>
                  <option value="CRITICAL">🚨 Kritická (Vozidlo nepojízdné / odstavit)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Podrobný popis závady</label>
                <textarea
                  rows={2}
                  placeholder="Popište přesný stav a okolnosti poruchy..."
                  value={faultDescription}
                  onChange={(e) => setFaultDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fotodokumentace poškození</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <Camera size={16} />
                  <span>{imageUrl ? '📷 Fotka vybraná' : 'Vyfotit / Připojit fotku poruchy'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFaultModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Zrušit
                </button>

                <button
                  type="submit"
                  disabled={sending || !faultTitle.trim()}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white hover:bg-rose-500 shadow-md transition disabled:opacity-50"
                >
                  Nahlásit Závadu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🛒 FLOATING ACTION BUTTON IN BOTTOM RIGHT CORNER (Plovoucí tlačítko vpravo dole) */}
      <button
        type="button"
        onClick={() => setShowShoppingModal(true)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 px-4 py-3 text-xs font-black text-slate-950 shadow-2xl shadow-orange-500/50 ring-4 ring-slate-950 hover:scale-105 active:scale-95 transition"
        title="🛒 Firemní nákupy (Kancelář & Dílna)"
      >
        <ShoppingBag size={20} className="shrink-0" />
        <span className="font-black tracking-tight">🛒 Firemní nákupy</span>
      </button>

      {/* Company Shopping List Modal */}
      <CompanyShoppingListModal
        isOpen={showShoppingModal}
        onClose={() => setShowShoppingModal(false)}
        currentUserName={currentUser.name}
      />
    </div>
  );
}
