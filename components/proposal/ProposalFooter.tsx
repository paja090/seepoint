import { MapPin, Globe, Linkedin, Facebook, Instagram, ShieldCheck } from 'lucide-react';

const certificates = ['ISO 9001', 'ISO 14001', 'ISO 27001'];

export function ProposalFooter() {
  return (
    <footer className="mx-auto mt-24 max-w-6xl px-6 pb-12 lg:mt-32">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 lg:p-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
                <MapPin className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                See<span className="text-brand">POINT</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              SeePOINT s.r.o.<br />
              Karlovo náměstí 10, 120 00 Praha 2<br />
              IČO: 24812345 · DIČ: CZ24812345
            </p>
            <a href="#" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <Globe className="h-4 w-4" /> www.seepoint.cz
            </a>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Certificates</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {certificates.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {c}
                </span>
              ))}
            </div>
          </div>

          <div className="md:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Follow us</p>
            <div className="mt-4 flex gap-2 md:justify-end">
              {[Linkedin, Facebook, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand/30 hover:text-brand"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© 2026 SeePOINT s.r.o. All rights reserved.</p>
          <p>This proposal is confidential and prepared exclusively for McDonald&apos;s Czech Republic.</p>
        </div>
      </div>
    </footer>
  );
}
