import { OfferBrandMark } from '@/components/offer/OfferBrandMark';
import { Mail, Phone } from 'lucide-react';

export function PublicOfferFooter({ branding }: { branding?: { name: string; logoUrl?: string | null; email?: string | null; phone?: string | null } | null }) {
  const name = branding?.name || 'Dodavatel nabídky';
  const email = branding?.email || '';
  const phone = branding?.phone || '';
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300 print:hidden">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <OfferBrandMark branding={branding} />
        </div>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
          {email && <a className="inline-flex items-center gap-2 transition hover:text-white" href={`mailto:${email}`}>
            <Mail aria-hidden size={16} />
            {email}
          </a>}
          {phone && <a className="inline-flex items-center gap-2 transition hover:text-white" href={`tel:${phone.replace(/\s/g, '')}`}>
            <Phone aria-hidden size={16} />
            {phone}
          </a>}
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} {name}. Všechna práva vyhrazena.</p>
      </div>
    </footer>
  );
}
