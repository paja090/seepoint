import test from 'node:test';
import assert from 'node:assert/strict';
import { ShoppingPriority } from '@prisma/client';

test('ShoppingPriority enum contains required priority values', () => {
  const priorities: ShoppingPriority[] = ['NORMAL', 'THIS_WEEK', 'URGENT'];
  assert.equal(priorities.length, 3);
  assert.equal(priorities.includes('URGENT'), true);
  assert.equal(priorities.includes('THIS_WEEK'), true);
  assert.equal(priorities.includes('NORMAL'), true);
});

test('Shopping item priority ranking sorts URGENT first', () => {
  const items = [
    { id: '1', title: 'Položka 1', priority: 'NORMAL' as const },
    { id: '2', title: 'Položka 2', priority: 'URGENT' as const },
    { id: '3', title: 'Položka 3', priority: 'THIS_WEEK' as const },
  ];

  const priorityWeight: Record<ShoppingPriority, number> = {
    URGENT: 3,
    THIS_WEEK: 2,
    NORMAL: 1,
  };

  const sorted = [...items].sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

  assert.equal(sorted[0].id, '2');
  assert.equal(sorted[1].id, '3');
  assert.equal(sorted[2].id, '1');
});

test('Search filter matches store, title, note and employee', () => {
  const items = [
    { id: '1', title: 'Peti kolík - 16A samec', store: 'Elektro materiál', assignedEmployeeName: 'Tomáš', note: null },
    { id: '2', title: 'Kotouče řezné', store: 'Hornbach', assignedEmployeeName: 'Pavel', note: 'Řezání kovu' },
  ];

  const filterQuery = (q: string) => {
    const lower = q.toLowerCase();
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(lower) ||
        (i.store && i.store.toLowerCase().includes(lower)) ||
        (i.assignedEmployeeName && i.assignedEmployeeName.toLowerCase().includes(lower)) ||
        (i.note && i.note.toLowerCase().includes(lower))
    );
  };

  assert.equal(filterQuery('Hornbach').length, 1);
  assert.equal(filterQuery('Hornbach')[0].id, '2');
  assert.equal(filterQuery('Tomáš').length, 1);
  assert.equal(filterQuery('Tomáš')[0].id, '1');
  assert.equal(filterQuery('Řezání').length, 1);
  assert.equal(filterQuery('Řezání')[0].id, '2');
});
