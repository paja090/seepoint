import { detectOperationTypeFromText } from './kml-parser';
import { normalizeOperation } from './task-spec';
/** Migration/review only. Heuristics never authorize scheduling or execution. */
export function classifyLegacyOperation(description: string | null) {
  const text = description ?? '';
  const explicit = text.match(/\[Operace:\s*(Odvoz na sklad|Sklad|Demontáž|Převoz na jiné místo|Převoz|Přemístění|Relokace|Výměna plachty|Jen plachta|Plachta|Jiná práce)\s*\]/i)
    || text.match(/\[(FULL_REMOVAL|BANNER_CHANGE|RELOCATION|OTHER)\]/i);
  const suggestion = normalizeOperation(detectOperationTypeFromText(explicit ? explicit[0] : text));
  return { operationType: explicit ? suggestion : null, suggestedOperation: suggestion, reviewRequired: true };
}
