import { Phone, Mail, CalendarCheck } from 'lucide-react';
import { salesperson } from '@/lib/proposal-data';

export function ContactCard() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6 lg:mt-28">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-lift">
        <div className="grid items-center gap-8 p-8 lg:grid-cols-[auto_1fr_auto] lg:p-10">
          <div className="flex items-center gap-5">
            <img
              src={salesperson.image || '/placeholder.svg'}
              alt={salesperson.name}
              className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/20"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-100/80">Your contact</p>
              <p className="mt-1 text-xl font-semibold">{salesperson.name}</p>
              <p className="text-sm text-slate-300">{salesperson.role}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:gap-8">
            <a href={`tel:${salesperson.phone}`} className="flex items-center gap-2.5 text-sm text-slate-200 transition hover:text-white">
              <Phone className="h-4 w-4 text-brand-100" /> {salesperson.phone}
            </a>
            <a href={`mailto:${salesperson.email}`} className="flex items-center gap-2.5 text-sm text-slate-200 transition hover:text-white">
              <Mail className="h-4 w-4 text-brand-100" /> {salesperson.email}
            </a>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-700">
            <CalendarCheck className="h-4 w-4" /> Schedule meeting
          </button>
        </div>
      </div>
    </section>
  );
}
