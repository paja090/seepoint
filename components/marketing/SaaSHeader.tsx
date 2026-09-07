'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Menu, X, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSHeader({
  onOpenDemoModal,
  isLoggedIn = false,
}: {
  onOpenDemoModal: () => void;
  isLoggedIn?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Produkt', href: '#produkt' },
    { label: 'Jak to funguje', href: '#workflow' },
    { label: 'AI', href: '#ai' },
    { label: 'Ceník', href: '#cenik' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-slate-900 p-0.5 shadow-lg group-hover:scale-105 transition transform">
            <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
              <span className="font-black text-lg tracking-tighter text-white">SP</span>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xl tracking-tight text-white">SeePoint</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black tracking-wider uppercase bg-purple-950 text-purple-300 border border-purple-800/80">
                OS
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-300 -mt-0.5">Operační systém pro outdoor</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-full border border-slate-800/80 backdrop-blur-md">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-4 py-2 rounded-full text-sm font-bold text-slate-200 hover:text-white hover:bg-slate-800/80 transition"
              onClick={() => {
                if (item.href === '#ai') trackSaaSEvent('ai_section_viewed');
                if (item.href === '#cenik') trackSaaSEvent('pricing_viewed');
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm border border-slate-700 transition"
            >
              <User className="w-4 h-4 text-purple-400" />
              <span>Přejít do aplikace</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-bold text-sm border border-slate-750 transition"
            >
              <span>Přihlásit se</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              trackSaaSEvent('demo_cta_clicked', { source: 'header' });
              onOpenDemoModal();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg transition transform active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
            <span>Domluvit ukázku</span>
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-2xl bg-slate-900 text-slate-300 border border-slate-800"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-6 py-6 space-y-4 shadow-2xl animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded-2xl text-sm font-bold text-slate-200 hover:bg-slate-900"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="w-full text-center py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm border border-slate-800"
              >
                Přejít do aplikace
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full text-center py-3 rounded-2xl bg-slate-900 text-slate-300 font-bold text-sm border border-slate-800"
              >
                Přihlásit se do SeePoint OS
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                trackSaaSEvent('demo_cta_clicked', { source: 'mobile_header' });
                onOpenDemoModal();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>Domluvit ukázku</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
