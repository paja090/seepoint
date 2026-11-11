import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractOrderRouteMap,
  type PlanForMapping,
  type OrderForMapping,
} from '../lib/field-planning/order-route-mapper';

function isWorkshopOrder(order: { locationNote?: string | null; mediaLabel?: string | null; carrierCode?: string | null; title?: string }) {
  const text = `${order.locationNote || ''} ${order.mediaLabel || ''} ${order.title || ''}`.toLowerCase();
  return Boolean(
    text.includes('díln') ||
    text.includes('diln') ||
    text.includes('tisk') ||
    text.includes('grafik') ||
    text.includes('faktur') ||
    text.includes('kancelář') ||
    text.includes('kancelar') ||
    (!order.carrierCode && !order.locationNote)
  );
}

test('isWorkshopOrder accurately distinguishes workshop/office tasks from field routes', () => {
  assert.equal(isWorkshopOrder({ locationNote: 'Dílna Ostrava - tisk banneru' }), true);
  assert.equal(isWorkshopOrder({ mediaLabel: 'Tisk plakátů' }), true);
  assert.equal(isWorkshopOrder({ locationNote: 'Příprava grafiky' }), true);
  assert.equal(isWorkshopOrder({ locationNote: null, carrierCode: null }), true);

  // Field tasks
  assert.equal(isWorkshopOrder({ locationNote: 'Havířov, Dlouhá tř.', carrierCode: null }), false);
  assert.equal(isWorkshopOrder({ locationNote: null, carrierCode: 'BB01' }), false);
  assert.equal(isWorkshopOrder({ locationNote: 'Montáž u klienta v prodejně', carrierCode: null }), false);
});

test('extractOrderRouteMap finds crew and stop info for work order in field route', () => {
  const plans: PlanForMapping[] = [
    {
      id: 'plan-101',
      date: '2026-11-11',
      status: 'APPROVED',
      version: 1,
      planningSummary: {
        crews: [
          {
            id: 'crew-alpha',
            name: 'Posádka 1 (Tomáš, Pavel)',
            names: ['Tomáš', 'Pavel'],
            vehicleName: 'Renault Trafic (AUTO 6)',
            stops: [
              {
                workOrderId: 'order-field-1',
                routeOrder: 2,
                arrivalAt: '09:45',
                startAt: '09:50',
              },
            ],
          },
        ],
      },
    },
  ];

  const orders: OrderForMapping[] = [
    { id: 'order-field-1', status: 'IN_PROGRESS' },
    { id: 'order-other', status: 'PLANNED' },
  ];

  const { orderRouteMap } = extractOrderRouteMap(plans, orders, '2026-11-11');

  const mapped = orderRouteMap.get('order-field-1');
  assert.ok(mapped);
  assert.equal(mapped.planId, 'plan-101');
  assert.equal(mapped.planDate, '2026-11-11');
  assert.equal(mapped.planStatus, 'APPROVED');
  assert.equal(mapped.crewName, 'Posádka 1 (Tomáš, Pavel)');
  assert.equal(mapped.vehicleName, 'Renault Trafic (AUTO 6)');
  assert.equal(mapped.routeOrder, 2);
  assert.equal(mapped.arrivalAt, '09:45');

  // Other order has no route
  assert.equal(orderRouteMap.has('order-other'), false);
});

test('extractOrderRouteMap supports parentWorkOrderId for multi-item work orders', () => {
  const plans: PlanForMapping[] = [
    {
      id: 'plan-202',
      date: '2026-11-12',
      status: 'ACTIVE',
      version: 1,
      planningSummary: {
        crews: [
          {
            id: 'crew-beta',
            name: 'Posádka 2',
            names: ['Ondra'],
            vehicleName: 'Dodávka',
            stops: [
              {
                parentWorkOrderId: 'order-parent-99',
                workOrderItemId: 'item-1',
                routeOrder: 1,
                arrivalAt: '08:00',
              },
            ],
          },
        ],
      },
    },
  ];

  const orders: OrderForMapping[] = [{ id: 'order-parent-99', status: 'PLANNED' }];

  const { orderRouteMap } = extractOrderRouteMap(plans, orders, '2026-11-12');
  const mapped = orderRouteMap.get('order-parent-99');
  assert.ok(mapped);
  assert.equal(mapped.planId, 'plan-202');
  assert.equal(mapped.routeOrder, 1);
  assert.equal(mapped.planStatus, 'ACTIVE');
});
