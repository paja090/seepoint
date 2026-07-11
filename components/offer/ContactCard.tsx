import { Mail, Phone } from 'lucide-react';
import type { MockSalesperson } from '@/lib/mock-offer-data';

export function ContactCard({
  salesperson,
  onQuestion,
}: {
  salesperson: MockSalesperson;
  onQuestion: () => void;
}) {
  return (
    <section
      aria-labelledby="contact-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8"
    >
      <h2 className="text-xl font-semibold tracking-tight text-slate-950" id="contact-heading">
        Váš kontaktní obchodník
      </h2>
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`Fotografie – ${salesperson.name}`}
            className="h-full w-full object-cover"
            src={salesperson.avatar || '/placeholder.svg'}
          />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900">{salesperson.name}</p>
          <p className="text-sm text-slate-500">{salesperson.role}</p>
          <div className="mt-3 flex flex-col gap-2">
            <a
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-sky-700"
              href={`tel:${salesperson.phone.replace(/\s/g, '')}`}
            >
              <Phone aria-hidden size={16} />
              {salesperson.phone}
            </a>
            <a
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-sky-700"
              href={`mailto:${salesperson.email}`}
            >
              <Mail aria-hidden size={16} />
              {salesperson.email}
            </a>
          </div>
        </div>
      </div>
      <button
        className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 print:hidden"
        onClick={onQuestion}
        type="button"
      >
        <Mail aria-hidden size={16} />
        Napište mi zprávu
      </button>
    </section>
  );
}
