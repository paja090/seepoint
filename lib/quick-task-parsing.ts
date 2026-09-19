/** Treat all model output as untrusted; only active employees from this tenant may be assigned. */
export function normalizeQuickTasks(raw: unknown[], activeEmployeeIds: Set<string>, fallbackId: string) {
  if (!activeEmployeeIds.has(fallbackId)) throw new Error('No active employee available');
  return raw.slice(0, 50).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const task = value as Record<string, unknown>;
    if (typeof task.title !== 'string' || !task.title.trim()) return [];
    const date = typeof task.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? new Date(task.dueDate) : null;
    return [{
      title: task.title.trim().slice(0, 200),
      description: typeof task.description === 'string' ? task.description.slice(0, 5000) : null,
      assignedToEmployeeId: typeof task.assignedToEmployeeId === 'string' && activeEmployeeIds.has(task.assignedToEmployeeId) ? task.assignedToEmployeeId : fallbackId,
      priority: task.priority === 'HIGH' || task.priority === 'LOW' ? task.priority : 'MEDIUM',
      dueDate: date && Number.isFinite(date.getTime()) ? date : null,
    }];
  });
}
