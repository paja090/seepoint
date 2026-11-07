export type B2bEmailTemplateId =
  | 'NAVIGATION_VO'
  | 'OOH_AGENCY'
  | 'PRINT_FIELD'
  | 'DEMO_FOLLOWUP';

export interface B2bEmailTemplateDefinition {
  id: B2bEmailTemplateId;
  label: string;
  segmentBadge: string;
  defaultSubject: (companyName?: string) => string;
  defaultMessage: (params: { contactName?: string; companyName?: string }) => string;
  highlights: string[];
  ctaLabel: string;
  ctaUrl: string;
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (char) => entities[char]);
}

export const B2B_EMAIL_TEMPLATES: Record<B2bEmailTemplateId, B2bEmailTemplateDefinition> = {
  NAVIGATION_VO: {
    id: 'NAVIGATION_VO',
    label: '1. Provozovatelé navigace a cedulí na sloupech VO',
    segmentBadge: 'Navigační systémy & VO',
    defaultSubject: (company) =>
      company
        ? `Správa navigačních cedulí a nabídek pro ${company} (bez výjezdů do terénu)`
        : 'Správa navigačních cedulí, smluv s městy a nabídek na jednom místě',
    defaultMessage: ({ contactName, companyName }) => {
      const greeting = contactName?.trim() ? `Dobrý den, ${contactName.trim()},` : 'Dobrý den,';
      const firmRef = companyName?.trim() ? ` ve společnosti ${companyName.trim()}` : '';
      return [
        greeting,
        '',
        `sami v Ostravě a Havířově provozujeme orientační a navigační systémy na sloupech veřejného osvětlení. Z vlastní praxe víme, kolik času zabere objíždění sloupů v terénu, hlídání smluv s městy a ruční skládání nabídek v PDF.`,
        '',
        `Vyvinuli jsme proto systém SeePoint OS, ve kterém dnes celou agendu řídíme na jednom místě – a nyní jej zpřístupňujeme i dalším provozovatelům${firmRef}.`,
        '',
        `Rád Vám během 15 minut přes sdílenou obrazovku ukážu, jak v systému naklikáme nabídku přímo přes Google Street View za 3 minuty a jak si ji klient sám schválí na mobilu. Pokud Vám to bude dávat smysl, zapneme Vám celý systém na 30 dní zdarma k otestování.`,
        '',
        `Hodilo by se Vám krátké online spojení tento nebo příští týden?`,
      ].join('\n');
    },
    highlights: [
      'Tvorba nabídky od stolu přes integrované Google Street View (bez nutnosti výjezdu technika)',
      'Interaktivní klientský portál: klient si body na mapě sám zaškrtne a jedním klikem schválí',
      'Kompletní evidence smluv s městy, obsazenosti sloupů, fakturace nájmů a fotodokumentace',
    ],
    ctaLabel: 'Prohlédnout SeePoint OS',
    ctaUrl: 'https://seepoint.cz',
  },
  OOH_AGENCY: {
    id: 'OOH_AGENCY',
    label: '2. Billboardové a venkovní reklamní agentury (OOH)',
    segmentBadge: 'Billboardy, Bigboardy & CLV',
    defaultSubject: (company) =>
      company
        ? `Interaktivní nabídky reklamních ploch pro klienty ${company} (místo PDF)`
        : 'Jak dnes poslat nabídku volných ploch za 3 minuty (se schválením v mobilu)',
    defaultMessage: ({ contactName, companyName }) => {
      const greeting = contactName?.trim() ? `Dobrý den, ${contactName.trim()},` : 'Dobrý den,';
      const firmRef = companyName?.trim() ? ` v ${companyName.trim()}` : '';
      return [
        greeting,
        '',
        `posíláte ještě klientům${firmRef} nabídky volných reklamních ploch v dlouhých PDF souborech nebo tabulkách z Excelu?`,
        '',
        `Pro vlastní provoz venkovní reklamy jsme postavili platformu SeePoint OS, která celý proces zkracuje z hodin na minuty. Obchodník vybere volné nosiče na mapě, AI doplní prodejní argumentaci lokalit a klient dostane zabezpečený živý odkaz.`,
        '',
        `Klient si na telefonu nebo počítači prohlédne mapu se Street View, zaškrtne plochy, které chce, a jedním kliknutím nabídku schválí.`,
        '',
        `Můžu Vám poslat krátkou ukázku nebo Vám systém na 15 minut předvést naživo (včetně 30denního zkušebního provozu zdarma)?`,
      ].join('\n');
    },
    highlights: [
      'Živý klientský odkaz s mapou a výběrem nosičů místo nepřehledných 30stránkových PDF',
      'Přehled obsazenosti sítě, rezervací a automatické hlídání končících kampaní',
      'AI Inbox, který sám páruje poptávkové e-maily ke klientům a zakázkám',
    ],
    ctaLabel: 'Ukázka platformy SeePoint OS',
    ctaUrl: 'https://seepoint.cz',
  },
  PRINT_FIELD: {
    id: 'PRINT_FIELD',
    label: '3. Výroba reklamy, tiskárny a montážní týmy',
    segmentBadge: 'Výroba, Výjezdy & Fotodokumentace',
    defaultSubject: (company) =>
      company
        ? `Plánování montážních výjezdů a klientská fotodokumentace pro ${company}`
        : 'Dispečink montáží, trasy techniků a okamžitá fotodokumentace pro klienty',
    defaultMessage: ({ contactName, companyName }) => {
      const greeting = contactName?.trim() ? `Dobrý den, ${contactName.trim()},` : 'Dobrý den,';
      const firmRef = companyName?.trim() ? ` v ${companyName.trim()}` : '';
      return [
        greeting,
        '',
        `řešíte${firmRef} po každém výjezdu montážníků ruční stahování fotek z telefonů, jejich třídění do složek a rozesílání klientům jako důkaz realizace?`,
        '',
        `V systému SeePoint OS jsme propojili obchod, přípravu tisku, plánování tras výjezdů a mobilní aplikaci pro techniky v terénu. Technik vyfotí hotovou instalaci přímo na místě a klient okamžitě vidí čistou fotodokumentaci na zabezpečeném odkazu pod logem Vaší firmy.`,
        '',
        `Rád Vám ukážu, jak tímto postupem ušetříte hodiny administrativy každý týden. Máte tento týden 15 minut na krátkou online ukázku?`,
      ].join('\n');
    },
    highlights: [
      'Dispečink a optimalizace tras montážních posádek na mapě',
      'Mobilní focení z terénu s okamžitým propisem do klientského fotoalba (pod Vaším logem)',
      'Přehled výkazů práce, sazeb techniků a návaznosti na fakturaci',
    ],
    ctaLabel: 'Prohlédnout SeePoint OS',
    ctaUrl: 'https://seepoint.cz',
  },
  DEMO_FOLLOWUP: {
    id: 'DEMO_FOLLOWUP',
    label: '4. Odpověď na poptávku dema z webu + 30 dní zdarma',
    segmentBadge: 'Živá ukázka & 30denní Pilot',
    defaultSubject: (company) =>
      company
        ? `SeePoint OS pro ${company} – návrh termínu 15min ukázky a zkušební přístup`
        : 'SeePoint OS – návrh termínu 15min ukázky a zkušební přístup na 30 dní',
    defaultMessage: ({ contactName, companyName }) => {
      const greeting = contactName?.trim() ? `Dobrý den, ${contactName.trim()},` : 'Dobrý den,';
      const firmRef = companyName?.trim() ? ` pro společnost ${companyName.trim()}` : '';
      return [
        greeting,
        '',
        `děkuji za Váš zájem o platformu SeePoint OS${firmRef}.`,
        '',
        `Rád Vám systém osobně ukážu během krátkého 15minutového online hovoru – přímo na příkladu Vašeho města a typu reklamních nosičů. Hned po ukázce Vám můžeme aktivovat vlastní firemní prostor s tarifem BUSINESS na 30 dní zdarma.`,
        '',
        `Napište mi prosím do odpovědi, který den a čas Vám nejlépe vyhovuje, případně mi kdykoliv zavolejte přímo na +420 777 807 717.`,
      ].join('\n');
    },
    highlights: [
      '15minutová praktická ukázka na míru Vaší firmě (bez zbytečné teorie)',
      'Vlastní firemní prostor (White-label s Vaším logem a barvami) na 30 dní zdarma',
      'Pomoc s prvotním importem Vašich nosičů z Excelu během několika minut',
    ],
    ctaLabel: 'Otevřít web SeePoint OS',
    ctaUrl: 'https://seepoint.cz',
  },
};

export interface RenderB2bEmailInput {
  segmentBadge?: string;
  subject: string;
  message: string;
  highlights?: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  senderName?: string;
  senderRole?: string;
  senderPhone?: string;
  senderEmail?: string;
}

export function renderB2bOutreachEmailHtml(input: RenderB2bEmailInput): string {
  const badge = escapeHtml(input.segmentBadge || 'SeePoint OS · B2B Platforma');
  const paragraphs = input.message
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#1e293b;white-space:pre-line">${escapeHtml(
          block
        )}</p>`
    )
    .join('');

  const highlightsList = (input.highlights ?? []).filter((item) => item.trim().length > 0);
  const highlightsHtml =
    highlightsList.length > 0
      ? `<div style="margin:24px 0;padding:18px 20px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0">
          <p style="margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#6d28d9">
            Hlavní přínosy v praxi
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
            ${highlightsList
              .map(
                (item) => `<tr>
                  <td style="padding:5px 10px 5px 0;vertical-align:top;color:#10b981;font-weight:900;font-size:14px;width:18px">✓</td>
                  <td style="padding:5px 0;vertical-align:top;font-size:13.5px;line-height:1.5;color:#334155;font-weight:600">${escapeHtml(
                    item
                  )}</td>
                </tr>`
              )
              .join('')}
          </table>
        </div>`
      : '';

  const safeCtaUrl = input.ctaUrl?.trim() ? escapeHtml(input.ctaUrl.trim()) : '';
  const safeCtaLabel = escapeHtml(input.ctaLabel?.trim() || 'Prohlédnout SeePoint OS');
  const ctaHtml = safeCtaUrl
    ? `<div style="margin:26px 0 22px">
        <a href="${safeCtaUrl}" style="display:inline-block;border-radius:12px;background:#0f172a;padding:13px 24px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;box-shadow:0 2px 6px rgba(15,23,42,0.18)">
          ${safeCtaLabel} &rarr;
        </a>
      </div>`
    : '';

  const senderName = escapeHtml(input.senderName || 'Pavel Šubert');
  const senderRole = escapeHtml(input.senderRole || 'Zakladatel & obchodní kontakt · SeePoint OS');
  const senderPhone = escapeHtml(input.senderPhone || '+420 777 807 717');
  const senderEmail = escapeHtml(input.senderEmail || 'info@seepoint.cz');

  return `<div style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a">
    <div style="max-width:640px;margin:0 auto;border-radius:20px;background:#ffffff;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(15,23,42,0.06)">
      <div style="background:linear-gradient(135deg,#0f172a 0%,#3b0764 100%);padding:22px 32px;color:#ffffff">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
          <tr>
            <td style="vertical-align:middle">
              <span style="font-size:19px;font-weight:900;letter-spacing:-0.02em;color:#ffffff">SeePoint</span>
              <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:6px;background:rgba(168,85,247,0.28);border:1px solid rgba(216,180,254,0.35);font-size:10px;font-weight:800;color:#e9d5ff;text-transform:uppercase;letter-spacing:0.06em">OS</span>
            </td>
            <td style="vertical-align:middle;text-align:right">
              <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.1);font-size:11px;font-weight:600;color:#cbd5e1">
                ${badge}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding:32px">
        ${paragraphs}
        ${highlightsHtml}
        ${ctaHtml}

        <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e2e8f0">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
            <tr>
              <td style="width:52px;padding-right:14px;vertical-align:middle">
                <div style="width:48px;height:48px;border-radius:999px;background:#0f172a;color:#ffffff;font-size:16px;font-weight:800;line-height:48px;text-align:center">
                  PŠ
                </div>
              </td>
              <td style="vertical-align:middle">
                <p style="margin:0 0 2px;font-size:15px;font-weight:800;color:#0f172a">${senderName}</p>
                <p style="margin:0 0 5px;font-size:12px;color:#64748b">${senderRole}</p>
                <p style="margin:0;font-size:13px;color:#334155">
                  <a href="tel:${senderPhone.replace(/\s+/g, '')}" style="color:#0284c7;text-decoration:none;font-weight:700">${senderPhone}</a>
                  &nbsp;&middot;&nbsp;
                  <a href="mailto:${senderEmail}" style="color:#0284c7;text-decoration:none;font-weight:600">${senderEmail}</a>
                  &nbsp;&middot;&nbsp;
                  <a href="https://seepoint.cz" style="color:#64748b;text-decoration:none">seepoint.cz</a>
                </p>
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </div>`;
}
