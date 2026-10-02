import { offerBrandLogo, offerBrandName, type OfferBranding } from '@/lib/offers/branding';

export function OfferBrandMark({ branding, className = 'h-9 max-w-44 object-contain' }: { branding: OfferBranding; className?: string }) {
  const logo = offerBrandLogo(branding);
  const name = offerBrandName(branding);
  return logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img alt={name} className={className} src={logo} />
    : <span className="font-bold">{name}</span>;
}
