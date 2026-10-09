'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ExternalLink, X, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ActionableResolutionCardProps {
  title?: string;
  message: string;
  missingFields?: string[];
  severity?: 'error' | 'warning' | 'info' | 'success';
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
  };
  onDismiss?: () => void;
  className?: string;
}

export function ActionableResolutionCard({
  title,
  message,
  missingFields,
  severity = 'error',
  primaryAction,
  secondaryAction,
  onDismiss,
  className = '',
}: ActionableResolutionCardProps) {
  const styles = {
    error: {
      wrapper: 'bg-rose-50/90 border-rose-300 text-rose-950',
      icon: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />,
      badge: 'bg-rose-100 text-rose-800 border-rose-200',
      primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
      secondaryBtn: 'border-rose-300 bg-white hover:bg-rose-50 text-rose-900',
    },
    warning: {
      wrapper: 'bg-amber-50/90 border-amber-300 text-amber-950',
      icon: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />,
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs',
      secondaryBtn: 'border-amber-300 bg-white hover:bg-amber-50 text-amber-900',
    },
    info: {
      wrapper: 'bg-sky-50/90 border-sky-300 text-sky-950',
      icon: <AlertCircle className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />,
      badge: 'bg-sky-100 text-sky-800 border-sky-200',
      primaryBtn: 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs',
      secondaryBtn: 'border-sky-300 bg-white hover:bg-sky-50 text-sky-900',
    },
    success: {
      wrapper: 'bg-emerald-50/90 border-emerald-300 text-emerald-950',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
      secondaryBtn: 'border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900',
    },
  }[severity];

  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 shadow-xs transition-all ${styles.wrapper} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {styles.icon}
          <div className="space-y-1.5 flex-1">
            {title && <h4 className="text-xs font-bold uppercase tracking-wider">{title}</h4>}
            <p className="text-xs font-medium leading-relaxed">{message}</p>

            {/* Missing fields tags if available */}
            {missingFields && missingFields.length > 0 && (
              <div className="pt-1.5">
                <span className="text-[11px] font-semibold text-slate-700 mr-1.5">Chybějící položky:</span>
                <div className="inline-flex flex-wrap gap-1.5 mt-1">
                  {missingFields.map((field) => (
                    <span
                      key={field}
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${styles.badge}`}
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {(primaryAction || secondaryAction) && (
              <div className="flex flex-wrap items-center gap-2 pt-2.5">
                {primaryAction && (
                  primaryAction.href ? (
                    <Link
                      href={primaryAction.href}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${styles.primaryBtn}`}
                    >
                      {primaryAction.icon || <ArrowRight className="h-3.5 w-3.5" />}
                      <span>{primaryAction.label}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={primaryAction.onClick}
                      disabled={primaryAction.loading}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${styles.primaryBtn}`}
                    >
                      {primaryAction.icon || <ArrowRight className="h-3.5 w-3.5" />}
                      <span>{primaryAction.loading ? 'Zpracovávám…' : primaryAction.label}</span>
                    </button>
                  )
                )}

                {secondaryAction && (
                  secondaryAction.href ? (
                    <Link
                      href={secondaryAction.href}
                      target={secondaryAction.href.startsWith('http') ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${styles.secondaryBtn}`}
                    >
                      <span>{secondaryAction.label}</span>
                      {secondaryAction.icon || <ExternalLink className="h-3 w-3" />}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={secondaryAction.onClick}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${styles.secondaryBtn}`}
                    >
                      <span>{secondaryAction.label}</span>
                      {secondaryAction.icon || <ExternalLink className="h-3 w-3" />}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Zavřít upozornění"
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
