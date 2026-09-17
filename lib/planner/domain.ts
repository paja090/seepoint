export type Visibility = 'FREE_BUSY' | 'WORK_DETAILS' | 'FULL';
export type SourceKind = 'WORK_TASK' | 'CRM_TASK' | 'QUICK_TASK';
export type Interval = { startAt: string; endAt: string };
export type PlannerItem = Interval & { id: string; title: string; source: 'GOOGLE' | 'INTERNAL' | 'ABSENCE'; busy: boolean; allDay?: boolean; location?: string; editable?: boolean; version?: number; category?: string };
export type PlannerTask = { id: string; sourceKind: SourceKind; title: string; dueAt: string | null; priority: string; href: string; plannedMinutes: number | null };
export type PlannerConfig = {
  timezone: string; workingDays: number[]; workingStart: string; workingEnd: string;
  lunchStart: string; lunchEnd: string; meetingBufferMinutes: number; defaultMeetingDuration: number;
  preferredFocusStart: string; preferredFocusEnd: string; preferredMeetingStart: string; preferredMeetingEnd: string;
  noMeetingBlocks: { day: number; start: string; end: string }[]; aiEnabled: boolean; autoSuggestions: boolean;
};
// Future AI tools receive only this already-authorized projection, never raw provider rows.
export type PlannerContext = { date: string; timezone: string; items: PlannerItem[]; tasks: PlannerTask[] };
export type PlannerProposal = { type: 'CREATE_BLOCK' | 'MOVE_BLOCK' | 'DELEGATE' | 'PREPARE_MEETING' | 'FOLLOW_UP'; reason: string; expiresAt: string; sourceReferences: { kind: SourceKind; id: string }[]; requiresConfirmation: true };

export class PlannerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function textInput(value: unknown, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new PlannerError('Vyplňte platný text.');
  return value.trim();
}
