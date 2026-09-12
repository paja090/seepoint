'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui';

type QueryResultItem = {
  surfaceId: string;
  name: string;
  carrierCode: string;
  carrierCity: string;
  carrierAddress?: string | null;
  mediaType: string;
  status: string;
  activeOccupanciesCount?: number;
};

type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  filters?: {
    intent: string;
    city?: string;
    mediaType?: string;
    dateFrom?: string;
    dateTo?: string;
    minGapDays?: number;
    explanation?: string;
  };
  results?: QueryResultItem[];
  timestamp: string;
};

const SUGGESTED_QUERIES = [
  'Které plochy v Ostravě jsou volné v říjnu?',
  'Kde máme ležáky neobsazené déle než 60 dní?',
  'Které kampaně brzy končí a je třeba je prodloužit?',
  'Jsou v kalendáři nějaké kolize nebo dvojité rezervace?',
];

export function OccupancyAssistantChat() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Dobrý den! Jsem AI Asistent obsazenosti. Můžete se mě přirozenou češtinou zeptat na volné kapacity, končící kampaně, neobsazené plochy (ležáky) nebo kolize v kalendáři.',
      timestamp: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || query).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/occupancy/intelligence/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dotaz se nepodařilo zpracovat.');

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: data.answer || 'Zde jsou výsledky vašeho dotazu:',
        filters: data.parsedIntent,
        results: data.results,
        timestamp: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: `Omlouvám se, při zpracování dotazu došlo k chybě: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 via-white to-slate-50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">AI Asistent obsazenosti</h3>
            <p className="text-[11px] text-slate-500">Dotazy přirozenou řečí nad reálnými daty skladu nosičů</p>
          </div>
        </div>
        <button
          onClick={() =>
            setMessages([
              {
                id: 'welcome',
                sender: 'assistant',
                text: 'Konverzace byla resetována. Na co se chcete zeptat?',
                timestamp: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
              },
            ])
          }
          className="text-xs text-slate-400 hover:text-slate-600 transition"
        >
          Vymazat
        </button>
      </div>

      {/* Suggested chips */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50/40 p-3">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-1 pl-1">
          Rychlé dotazy:
        </span>
        {SUGGESTED_QUERIES.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-900 transition text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[280px] max-h-[500px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                m.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-xs'
                  : 'bg-slate-100 text-slate-900 rounded-bl-xs border border-slate-200/70'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>

              {/* Parsed criteria pills if available */}
              {m.filters && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex flex-wrap gap-1.5 text-[11px]">
                  {m.filters.city && (
                    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-medium text-slate-700 border border-slate-200">
                      <MapPin size={11} className="text-slate-400" /> {m.filters.city}
                    </span>
                  )}
                  {m.filters.mediaType && (
                    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-medium text-slate-700 border border-slate-200">
                      Médium: {m.filters.mediaType}
                    </span>
                  )}
                  {(m.filters.dateFrom || m.filters.dateTo) && (
                    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-medium text-slate-700 border border-slate-200">
                      <Calendar size={11} className="text-slate-400" /> {m.filters.dateFrom || 'Dnes'} - {m.filters.dateTo || 'konec'}
                    </span>
                  )}
                  {m.filters.minGapDays && (
                    <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-medium text-slate-700 border border-slate-200">
                      <Clock size={11} className="text-slate-400" /> &gt; {m.filters.minGapDays} dní
                    </span>
                  )}
                </div>
              )}

              {/* Structured list of results if available */}
              {m.results && m.results.length > 0 && (
                <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Nalezené plochy ({m.results.length}):
                  </span>
                  <div className="grid gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {m.results.map((r) => (
                      <div
                        key={r.surfaceId}
                        className="rounded-lg bg-white p-2 text-xs border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 block truncate max-w-[200px]" title={r.name}>
                            {r.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {r.carrierCode} • {r.carrierCity}
                          </span>
                        </div>
                        <a
                          href={`/occupancy?q=${encodeURIComponent(r.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium ml-2"
                        >
                          Detail <ArrowRight size={11} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-400 px-1 mt-1">{m.timestamp}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
            <Loader2 size={15} className="animate-spin text-indigo-600" />
            <span>AI vyhodnocuje dotaz a prohledává inventář nosičů...</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="border-t border-slate-200 bg-white p-3 flex items-center gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zadejte dotaz (např. 'volné billboardy v Ostravě v prosinci')..."
          className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={loading || !query.trim()}
          className="rounded-xl px-4 py-2.5"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </form>
    </div>
  );
}
