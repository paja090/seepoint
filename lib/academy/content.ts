import type { LessonCapability } from './policy';

export type AcademyStep = { id: string; title: string; instruction: string; warning?: string };
export type AcademyContent = { prerequisites: string[]; steps: AcademyStep[]; sourcePaths: string[] };
export type AcademyPilot = { slug: string; category: { slug: string; title: string }; title: string; summary: string; capability: LessonCapability; durationMinutes: number; content: AcademyContent };
const step = (id: string, title: string, instruction: string, warning?: string): AcademyStep => ({ id, title, instruction, ...(warning ? { warning } : {}) });
export const academyPilots: readonly AcademyPilot[] = [
  { slug: 'organizace-a-role', category: { slug: 'zaciname', title: 'Začínáme' }, title: 'Ověřit organizaci a aktivní roli', summary: 'Zjistěte, proč může být vaše nabídka funkcí jiná než u kolegy.', capability: 'basics', durationMinutes: 2, content: {
    prerequisites: ['Aktivovaný účet a platné členství v organizaci.'],
    steps: [step('organization', 'Zkontrolujte organizaci', 'Po přihlášení ověřte název firmy v navigaci. Pokud nesouhlasí, nepokračujte v zadávání dat.'), step('profile', 'Ověřte svůj profil', 'Otevřete Můj profil a ověřte svoji identitu.'), step('role', 'Ověřte pracovní roli', 'Účet může mít více přidělených rolí. Aktivní role určuje přístup k funkcím; přepínat lze pouze mezi přidělenými rolemi.'), step('modules', 'Najděte svou agendu', 'Chybějící funkce může být způsobena oprávněním nebo vypnutým modulem. Obraťte se na správce organizace.')],
    sourcePaths: ['lib/auth.ts', 'lib/rbac.ts', 'components/AppNavigation.tsx'],
  } },
  { slug: 'fotografie-s-gps', category: { slug: 'fotodokumentace', title: 'Focení a fotodokumentace' }, title: 'Vyfotit existující nosič s GPS', summary: 'Uložte fotografii ke správné ploše a ověřte výsledek.', capability: 'fieldPhoto', durationMinutes: 3, content: {
    prerequisites: ['Oprávnění k mobilnímu focení.', 'Existující nosič s plochou, povolená kamera a GPS, připojení k síti.'],
    steps: [step('gps', 'Zkontrolujte GPS', 'Otevřete Mobilní foto a povolte polohu. Vyčkejte na zobrazení Moje GPS.'), step('carrier', 'Vyberte nosič a plochu', 'Ověřte kód a místo nosiče. U příslušné plochy použijte Vyfotit výlep nebo Pře-fotit.'), step('photo', 'Zkontrolujte snímek', 'Určete vyfocenou stranu a účel. Zkontrolujte náhled a GPS razítko.'), step('save', 'Uložte a ověřte výsledek', 'Zvolte Uložit fotku s GPS a vyčkejte na zprávu. Případný návrh přiřazení ověřte a zkontrolujte galerii.', 'Selhání vedlejší zprávy do chatu nemusí znamenat selhání uložení fotky. Neodesílejte ji automaticky znovu.')],
    sourcePaths: ['components/navigation/MobilePhotoFieldAppView.tsx', 'app/api/mobile-photos/upload/route.ts'],
  } },
  { slug: 'vyber-lokalit-navigace', category: { slug: 'navigace', title: 'Navigační zakázky' }, title: 'Nechat klienta vybrat lokality', summary: 'První fáze výběru bodů ještě není objednávkou realizace.', capability: 'navigationSelection', durationMinutes: 3, content: {
    prerequisites: ['Navigační nabídka ve fázi LOCATION_SELECTION.', 'Body s GPS a skutečnými terénními fotografiemi; kontrola všech cílových provozoven.'],
    steps: [step('phase', 'Ověřte fázi nabídky', 'Zkontrolujte, že jde o lokační výběr bez cen. Ověřte jednotlivé cíle a provozovny.'), step('points', 'Zkontrolujte body', 'Doplňte GPS, názvy a terénní fotografie a vyřešte chyby připravenosti.'), step('selection', 'Klient vybere body', 'V klientském náhledu se vybírá alespoň jeden bod. Potvrzení tohoto výběru slouží k nacenění.', 'Souhlas s lokalitami není souhlas s cenou ani objednávka výroby.'), step('review', 'Ověřte zaznamenaný výběr', 'V interní nabídce zkontrolujte vybrané body a historii. Následuje cenová kalkulace, nikoli okamžitá realizace.')],
    sourcePaths: ['components/offers/NavigationOfferPublicView.tsx', 'app/api/proposals/[token]/selection/route.ts', 'lib/offers/service.ts'],
  } },
  { slug: 'predani-navigace-do-realizace', category: { slug: 'navigace', title: 'Navigační zakázky' }, title: 'Předat cenovou nabídku do realizace', summary: 'Ověřte navazující zakázku, vybrané body a další povolený krok.', capability: 'navigationHandoff', durationMinutes: 3, content: {
    prerequisites: ['Oprávnění administrátora nebo manažera pro interní přijetí.', 'Finální PRICED_QUOTE s platnou cenou; ověřený výběr lokalit.'],
    steps: [step('price', 'Zkontrolujte cenovou fázi', 'Ověřte platnou cenovou kalkulaci a přesný seznam vybraných bodů.'), step('accept', 'Rozlišujte školení a skutečné přijetí', 'Skutečné přijetí nabídky provádí oprávněná osoba. Pro nácvik používejte pouze testovací zakázku.', 'Návod ani průvodce nesmí sám potvrdit obchodně závaznou akci.'), step('order', 'Ověřte navázanou zakázku', 'V detailu navigační zakázky ověřte klienta, cíle, vybrané body a fotografie. Nevytvářejte druhou zakázku po obnovení stránky.'), step('next', 'Zjistěte další krok', 'Přečtěte aktuální stav a jeho blokace. Změny přijaté zakázky řešte řízeným změnovým postupem.')],
    sourcePaths: ['lib/offers/domain.ts', 'lib/navigation/navigation-service.ts', 'lib/navigation/workflow-service.ts'],
  } },
  { slug: 'novy-bod-field-survey', category: { slug: 'field-survey', title: 'Terénní průzkum Field Survey' }, title: 'Zaznamenat novou plochu', summary: 'Samostatný průzkumný bod s GPS a fotografiemi.', capability: 'fieldSurvey', durationMinutes: 3, content: {
    prerequisites: ['Založený průzkum, oprávnění Field Survey, GPS a kamera.'],
    steps: [step('survey', 'Otevřete správný průzkum', 'V Terénním průzkumu ploch otevřete Mobilní focení příslušného průzkumu.', 'Jde o nové kandidátní místo, nikoli fotografii existujícího nosiče.'), step('gps', 'Doplňte bod', 'Počkejte na GPS, ověřte souřadnice a přesnost, zvolte typ plochy a doplňte poznámku.'), step('photos', 'Vyfoťte místo', 'Použijte Fotit plochu nebo Přidat další fotku. Počkejte na optimalizaci a zkontrolujte náhledy.'), step('save', 'Uložte a zkontrolujte bod', 'Zvolte Uložit bod a vyčkejte na dokončení nahrávání fotografií. Ověřte bod v průzkumu.', 'Průzkumný bod automaticky neznamená nový reklamní nosič v evidenci.')],
    sourcePaths: ['components/field-survey/MobileFieldSurveyView.tsx', 'lib/field-survey/data.ts'],
  } },
];

// Reject damaged/unsupported content rather than render arbitrary HTML or URLs.
export function parseAcademyContent(value: unknown): AcademyContent {
  if (!value || typeof value !== 'object') throw new Error('Nepodporovaný obsah lekce.');
  const v = value as Record<string, unknown>;
  const strings = (x: unknown): x is string[] => Array.isArray(x) && x.length <= 30 && x.every(y => typeof y === 'string' && y.length <= 3000);
  if (!strings(v.prerequisites) || !strings(v.sourcePaths) || !Array.isArray(v.steps) || v.steps.length < 1 || v.steps.length > 30) throw new Error('Nepodporovaný obsah lekce.');
  const ids = new Set<string>();
  const steps = v.steps.map(raw => {
    if (!raw || typeof raw !== 'object') throw new Error('Neplatný krok.');
    const s = raw as Record<string, unknown>;
    if (typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(s.id) || ids.has(s.id) || typeof s.title !== 'string' || s.title.length > 200 || typeof s.instruction !== 'string' || s.instruction.length > 3000 || (s.warning !== undefined && (typeof s.warning !== 'string' || s.warning.length > 1000))) throw new Error('Neplatný krok.');
    ids.add(s.id);
    return { id: s.id, title: s.title, instruction: s.instruction, ...(typeof s.warning === 'string' ? { warning: s.warning } : {}) };
  });
  return { prerequisites: v.prerequisites, sourcePaths: v.sourcePaths, steps };
}
