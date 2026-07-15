import { Mail, Phone } from 'lucide-react';

export function PublicOfferFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300 print:hidden">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="SeePOINT" className="h-10 w-auto" src="/seepoint-logo.svg" />
        </div>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
          <a className="inline-flex items-center gap-2 transition hover:text-white" href="mailto:info@seepoint.cz">
            <Mail aria-hidden size={16} />
            info@seepoint.cz
          </a>
          <a className="inline-flex items-center gap-2 transition hover:text-white" href="tel:+420595123456">
            <Phone aria-hidden size={16} />
            +420 595 123 456
          </a>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} SeePOINT. Všechna práva vyhrazena.</p>
      </div>
    </footer>
  );
}
