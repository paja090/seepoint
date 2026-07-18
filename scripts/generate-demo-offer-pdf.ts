import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createOfferPdf } from '../lib/offers/pdf.ts';
import type { ProposalOffer } from '../lib/offers/presentation.ts';

const demo: ProposalOffer = {
  id: 'NAB-2026-030',
  status: 'SENT',
  title: 'Letní kampaň Brno 2026',
  subtitle: 'Prémiová venkovní komunikace v centru a klíčových dopravních uzlech',
  intro: 'Připravili jsme kombinaci citylightů, city posterů a navigačních ploch, která značku ACME Development zviditelní v místech s vysokou koncentrací pěších i automobilové dopravy.',
  campaignFrom: '1. 8. 2026',
  campaignTo: '31. 8. 2026',
  campaignDays: 31,
  validUntil: '24. 7. 2026',
  cities: ['Brno'],
  client: { id: 'demo-client', name: 'ACME Development a.s.', logoLabel: 'AD', contactPerson: 'Jan Novák', email: 'jan.novak@example.cz' },
  salesperson: { id: 'demo-sales', name: 'Petr Svoboda', role: 'Obchodní kontakt SeePOINT', phone: '+420 777 123 456', email: 'petr.svoboda@seepoint.cz' },
  heroImage: '', heroImageAlt: '',
  stats: { carriers: 6, mediaTypes: 3, locations: 5, photos: 6, total: 170_126, days: 31 },
  mediaMix: [],
  carriers: [
    { id: '1', code: 'BR-CLV-014', mediaType: 'CITYLIGHT', city: 'Brno', locality: 'Hlavní nádraží', description: 'Citylight u hlavního pěšího tahu', dimensions: '118,5 × 175 cm', status: 'AVAILABLE', image: '', imageAlt: '', mapX: 20, mapY: 30 },
    { id: '2', code: 'BR-CP-027', mediaType: 'CITY_POSTER', city: 'Brno', locality: 'Česká / Joštova', description: 'City Poster v přestupním uzlu MHD', dimensions: '118,5 × 175 cm', status: 'AVAILABLE', image: '', imageAlt: '', mapX: 40, mapY: 45 },
    { id: '3', code: 'BR-CLV-041', mediaType: 'CITYLIGHT', city: 'Brno', locality: 'Galerie Vaňkovka', description: 'Podsvícená plocha u vstupu do centra', dimensions: '118,5 × 175 cm', status: 'AVAILABLE', image: '', imageAlt: '', mapX: 55, mapY: 60 },
    { id: '4', code: 'BR-NAV-008', mediaType: 'NAVIGATION_SIGN', city: 'Brno', locality: 'Heršpická', description: 'Navigační plocha – příjezd od D1', dimensions: '100 × 150 cm', status: 'AVAILABLE', image: '', imageAlt: '', mapX: 70, mapY: 72 },
    { id: '5', code: 'BR-CP-052', mediaType: 'CITY_POSTER', city: 'Brno', locality: 'Moravské náměstí', description: 'Plocha u parku a tramvajové zastávky', dimensions: '118,5 × 175 cm', status: 'AVAILABLE', image: '', imageAlt: '', mapX: 35, mapY: 25 },
    { id: '6', code: 'BR-CLV-063', mediaType: 'CITYLIGHT', city: 'Brno', locality: 'Mendlovo náměstí', description: 'Citylight v dopravním uzlu', dimensions: '118,5 × 175 cm', status: 'AVAILABLE', image: '', imageAlt: '', mapX: 25, mapY: 70 },
  ],
  pricing: [
    { label: 'Pronájem reklamních ploch', amount: 108_000, note: '6 ploch · 31 dní' },
    { label: 'Tisk a výroba', amount: 18_600, note: '6 ks tiskových výstupů' },
    { label: 'Instalace', amount: 12_000, note: 'Doprava a instalace všech ploch' },
    { label: 'Deinstalace', amount: 6_000, note: 'Demontáž po skončení kampaně' },
    { label: 'Sleva', amount: -4_000, emphasis: 'discount' },
    { label: 'Cena bez DPH', amount: 140_600, emphasis: 'subtotal' },
    { label: 'DPH 21 %', amount: 29_526 },
    { label: 'Celkem včetně DPH', amount: 170_126, emphasis: 'total' },
  ],
  benefits: [], references: [], caseStudies: [],
  conditions: [
    { id: 'validity', text: 'Nabídka je platná do 24. 7. 2026.' },
    { id: 'availability', text: 'Dostupnost a aktivní stav všech ploch byly ověřeny při odeslání nabídky.' },
    { id: 'reservation', text: 'Závazná rezervace vzniká po schválení nabídky a automatickém převodu do obsazenosti.' },
    { id: 'graphics', text: 'Tisková data dodá klient nejpozději 10 pracovních dnů před zahájením kampaně.' },
    { id: 'scope', text: 'Cena zahrnuje pouze položky výslovně uvedené v cenové kalkulaci.' },
  ],
};

const outputDirectory = resolve('output/pdf');
await mkdir(outputDirectory, { recursive: true });
const output = resolve(outputDirectory, 'demo-nabidka-seepoint.pdf');
await writeFile(output, await createOfferPdf(demo));
console.log(output);
