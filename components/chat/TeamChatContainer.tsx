'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
  initialChannel?: string;
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

export function TeamChatContainer({ currentUser, vehicles, teamMembers = [], initialChannel = 'general' }: TeamChatContainerProps) {
  const [activeChannel, setActiveChannel] = useState(() => channels.some((channel) => channel.id === initialChannel) ? initialChannel : 'general');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageFailed, setPreviewImageFailed] = useState(false);

  // Fuel modal form state
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [fuelAmount, setFuelAmount] = useState('');
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [fuelNote, setFuelNote] = useState('');
  const [aiScanningFuel, setAiScanningFuel] = useState(false);

  // Vehicle fault modal state
  const [faultTitle, setFaultTitle] = useState('');
  const [faultDescription, setFaultDescription] = useState('');
  const [faultSeverity, setFaultSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousMessageCount = useRef<number>(0);

  useEffect(() => {
    if (!previewImageUrl) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImageUrl(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [previewImageUrl]);

  function openImagePreview(url: string) {
    setPreviewImageFailed(false);
    setPreviewImageUrl(url);
  }

  // Compress camera/gallery photo on client side to max 1600px / ~300KB to prevent HTTP 413 errors
  function compressImageForChat(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
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

      // If fuel modal is open, trigger AI OCR analysis
      if (showFuelModal) {
        setAiScanningFuel(true);
        fetch('/api/fuel/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: compressedDataUrl }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.ok && data.data) {
              if (data.data.amountCzk) setFuelAmount(String(data.data.amountCzk));
              if (data.data.liters) setFuelLiters(String(data.data.liters));
              if (data.data.vendor) setFuelNote(`${data.data.vendor} (${data.data.fuelType || 'Palivo'})`);
            }
          })
          .catch(() => null)
          .finally(() => setAiScanningFuel(false));
      }
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
  async function fetchMessages(isPolling = false, isInitial = false) {
    try {
      const res = await fetch(`/api/chat/messages?channel=${activeChannel}`);
      if (!res.ok) return;
      const data: ChatMessageData[] = await res.json();

      if (data.length < 50) {
        setHasMoreOlder(false);
      }

      if (isPolling) {
        if (data.length > 0) {
          const newest = data[data.length - 1];
          setMessages((prev) => {
            if (prev.length === 0) return data;
            const lastKnown = prev[prev.length - 1];
            if (newest && lastKnown && newest.id !== lastKnown.id) {
              if (newest.userId !== currentUser.id) {
                playNewMessageChime();
              }
              const existingIds = new Set(prev.map((m) => m.id));
              const newItems = data.filter((m) => !existingIds.has(m.id));
              if (newItems.length === 0) return prev;
              return [...prev, ...newItems];
            }
            return prev;
          });

          const container = messagesContainerRef.current;
          if (container) {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
            if (isNearBottom) {
              requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
              });
            }
          }
        }
      } else {
        setMessages(data);
        if (isInitial) {
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          });
        }
      }
    } catch {
      // Ignore polling errors
    }
  }

  // Load older messages on demand
  async function loadOlderMessages() {
    if (loadingOlder || !messages.length || !hasMoreOlder) return;
    const firstMsgId = messages[0].id;
    try {
      setLoadingOlder(true);
      const res = await fetch(`/api/chat/messages?channel=${activeChannel}&before=${firstMsgId}`);
      if (!res.ok) return;
      const olderData: ChatMessageData[] = await res.json();

      if (!olderData.length || olderData.length < 50) {
        setHasMoreOlder(false);
      }

      if (olderData.length > 0) {
        const container = messagesContainerRef.current;
        const oldScrollHeight = container ? container.scrollHeight : 0;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueOlder = olderData.filter((m) => !existingIds.has(m.id));
          return [...uniqueOlder, ...prev];
        });

        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - oldScrollHeight;
          }
        });
      }
    } catch {
      // Ignore
    } finally {
      setLoadingOlder(false);
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
    setMessages([]);
    setHasMoreOlder(true);
    fetchMessages(false, true);
    fetchPresence();
    const interval = setInterval(() => {
      fetchMessages(true, false);
      fetchPresence();
    }, 4000);
    return () => clearInterval(interval);
  }, [activeChannel]);

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
    <div className="flex flex-col lg:flex-row h-full min-h-0 flex-1 rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden">
      {/* 📱 Mobile Sleek Header Bar (< lg) */}
      <div className="flex lg:hidden flex-col border-b border-slate-800 bg-slate-950 p-2.5 space-y-2 shrink-0">
        {/* Horizontal Channel Tabs */}
        <div className="flex overflow-x-auto gap-1.5 scrollbar-none py-0.5">
          {channels.map((ch) => {
            const isActive = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannel(ch.id)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  isActive ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {ch.label}
              </button>
            );
          })}
        </div>

        {/* Mobile Quick Action Buttons Bar */}
        <div className="flex overflow-x-auto gap-2 pt-1.5 border-t border-slate-900 scrollbar-none">
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

          <Link
            href="/mobile-photos"
            className="flex items-center gap-1.5 shrink-0 rounded-xl bg-teal-950/80 border border-teal-800/80 px-3 py-1.5 text-xs font-bold text-teal-300 active:scale-95 transition"
          >
            <Camera size={14} />
            <span>📷 Mobilní focení ploch</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowFaultModal(true)}
            className="flex items-center gap-1.5 shrink-0 rounded-xl bg-rose-950/80 border border-rose-800/80 px-3 py-1.5 text-xs font-bold text-rose-300 active:scale-95 transition"
          >
            <AlertTriangle size={14} />
            <span>⚠️ Závada auta</span>
          </button>
        </div>

        {/* Mobile Active Presence Bar */}
        {activeUsers.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1.5 border-t border-slate-900 scrollbar-none text-xs shrink-0">
            <span className="font-extrabold text-[10px] text-emerald-400 shrink-0 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" />
              <span>Aktivní v týmu ({activeUsers.length}):</span>
            </span>
            {activeUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-slate-200 shrink-0 border border-slate-800"
              >
                <span>{u.name}</span>
              </span>
            ))}
          </div>
        )}
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
            <Link
              href="/mobile-photos"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-950/60 border border-teal-800/60 px-4 py-2.5 text-xs font-bold text-teal-300 hover:bg-teal-600 hover:text-white active:scale-95 transition"
            >
              <Camera size={16} />
              <span>📷 Otevřít mobilní focení ploch</span>
            </Link>

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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-slate-50">
        {/* Active Channel Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5 shadow-xs shrink-0">
          <div>
            <h3 className="font-bold text-slate-950">
              {channels.find((c) => c.id === activeChannel)?.label}
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-sm">
              {channels.find((c) => c.id === activeChannel)?.description}
            </p>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 space-y-4" ref={messagesContainerRef}>
          {hasMoreOlder && messages.length > 0 && (
            <div className="flex justify-center py-1">
              <button
                type="button"
                onClick={loadOlderMessages}
                disabled={loadingOlder}
                className="rounded-full bg-white border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition disabled:opacity-50"
              >
                {loadingOlder ? '⏳ Načítám starší zprávy…' : '📜 Načíst starší zprávy'}
              </button>
            </div>
          )}

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
                        <button
                          type="button"
                          className="block w-full cursor-zoom-in bg-slate-950"
                          onClick={() => openImagePreview(msg.imageUrl!)}
                          aria-label="Zvětšit přiloženou fotografii"
                        >
                          <img
                            src={msg.imageUrl}
                            alt="Příloha fotka z terénu"
                            className="max-h-64 w-full object-cover transition hover:opacity-90"
                          />
                        </button>
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
        <form onSubmit={handleSendMessage} className="sticky bottom-0 z-30 border-t border-slate-200 bg-white p-3 sm:p-4 space-y-2 shrink-0 shadow-lg">
          {imageUrl && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-2 border border-emerald-200 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileImage size={16} className="text-emerald-700 shrink-0" />
                <span className="font-bold text-emerald-900 truncate">📷 Fotka z fotoaparátu / galerii připojena</span>
              </div>
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="text-slate-500 hover:text-red-600 font-bold shrink-0 ml-2"
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
              title="Vyfotit fotoaparátem nebo vybrat fotku"
            >
              <Camera size={20} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Napište zprávu do skupiny ${channels.find((c) => c.id === activeChannel)?.label}...`}
              className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />

            <button
              type="submit"
              disabled={sending || (!inputText.trim() && !imageUrl)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-black text-slate-950 shadow-md hover:bg-emerald-400 active:scale-95 transition disabled:opacity-50 shrink-0"
            >
              <Send size={16} />
              <span>Odeslat</span>
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
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Fotka účtenky *</span>
                  {aiScanningFuel && (
                    <span className="text-[10px] font-extrabold text-amber-600 flex items-center gap-1 animate-pulse">
                      <Sparkles size={12} /> AI čte účtenku...
                    </span>
                  )}
                  {!aiScanningFuel && imageUrl && (
                    <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-1">
                      <Sparkles size={12} /> ✨ AI automaticky vyčetla údaje
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <Camera size={16} />
                  <span>{imageUrl ? '📷 Účtenka nahrána' : '✨ Vyfotit účtenku (AI přečte cenu i litry)'}</span>
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

      {/* Company Shopping List Modal */}
      <CompanyShoppingListModal
        isOpen={showShoppingModal}
        onClose={() => setShowShoppingModal(false)}
        currentUserName={currentUser.name}
      />

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/95 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Náhled fotografie z chatu"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-slate-900/80 text-white shadow-xl transition hover:bg-slate-800"
            onClick={() => setPreviewImageUrl(null)}
            aria-label="Zavřít náhled fotografie"
          >
            <X size={22} />
          </button>
          <div className="flex max-h-full max-w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
            {previewImageFailed ? (
              <div className="rounded-2xl border border-rose-700 bg-rose-950/90 p-6 text-center text-sm font-bold text-rose-100">
                Fotografii se nepodařilo načíst.
              </div>
            ) : (
              <img
                src={previewImageUrl}
                alt="Zvětšená fotografie z chatu"
                className="max-h-[calc(100dvh-3rem)] max-w-[calc(100vw-3rem)] rounded-xl object-contain shadow-2xl"
                onError={() => setPreviewImageFailed(true)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
