import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOrderRouteMap, type PlanForMapping, type OrderForMapping } from '../lib/field-planning/order-route-mapper';

test('extractOrderRouteMap - correctly maps stops to work orders and respects status priority', () => {
  const plans: PlanForMapping[] = [
    {
      id: 'plan-draft',
      date: '2026-10-19',
      status: 'DRAFT',
      version: 1,
      planningSummary: {
        crews: [
          {
            id: 'crew-1',
            name: 'Posádka Sever',
            names: ['Jan Novák', 'Petr Svoboda'],
            vehicleName: 'Dodávka 1',
            stops: [
              {
                workOrderId: 'order-1',
                routeOrder: 1,
                arrivalAt: '08:30',
                startAt: '08:35',
              },
              {
                workOrderId: 'order-2',
                routeOrder: 2,
                arrivalAt: '10:00',
                startAt: '10:05',
              },
              {
                // Pitstop should be ignored
                isWarehousePitstop: true,
                routeOrder: 3,
                arrivalAt: '12:00',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'plan-approved',
      date: '2026-10-19',
      status: 'APPROVED',
      version: 2,
      planningSummary: {
        crews: [
          {
            id: 'crew-2',
            name: 'Posádka Jih',
            names: ['Karel Dvořák'],
            vehicleName: 'Dodávka 2',
            stops: [
              {
                // Overrides order-2 from DRAFT to APPROVED
                parentWorkOrderId: 'order-2',
                routeOrder: 1,
                arrivalAt: '09:15',
                startAt: '09:20',
              },
              {
                workOrderId: 'order-3',
                routeOrder: 2,
                arrivalAt: '11:30',
                startAt: '11:35',
              },
            ],
          },
        ],
      },
    },
  ];

  const orders: OrderForMapping[] = [
    { id: 'order-1', status: 'IN_PROGRESS' },
    { id: 'order-2', status: 'DONE' },
    { id: 'order-3', status: 'PENDING' },
  ];

  const { orderRouteMap, todayRoutes } = extractOrderRouteMap(plans, orders, '2026-10-19');

  // order-1 should be mapped to plan-draft
  const route1 = orderRouteMap.get('order-1');
  assert.ok(route1);
  assert.equal(route1.planId, 'plan-draft');
  assert.equal(route1.crewName, 'Posádka Sever');
  assert.equal(route1.routeOrder, 1);
  assert.equal(route1.arrivalAt, '08:30');

  // order-2 should be overridden by plan-approved because APPROVED > DRAFT
  const route2 = orderRouteMap.get('order-2');
  assert.ok(route2);
  assert.equal(route2.planId, 'plan-approved');
  assert.equal(route2.crewName, 'Posádka Jih');
  assert.equal(route2.routeOrder, 1);
  assert.equal(route2.arrivalAt, '09:15');

  // order-3 should be mapped to plan-approved
  const route3 = orderRouteMap.get('order-3');
  assert.ok(route3);
  assert.equal(route3.planId, 'plan-approved');
  assert.equal(route3.routeOrder, 2);

  // todayRoutes summaries
  assert.equal(todayRoutes.length, 2);
  const jihCrew = todayRoutes.find((c) => c.crewName === 'Posádka Jih');
  assert.ok(jihCrew);
  assert.equal(jihCrew.totalStops, 2);
  // order-2 is DONE, order-3 is PENDING => 1 completed stop
  assert.equal(jihCrew.completedStops, 1);

  const severCrew = todayRoutes.find((c) => c.crewName === 'Posádka Sever');
  assert.ok(severCrew);
  // 2 valid stops (pitstop ignored)
  assert.equal(severCrew.totalStops, 2);
  // order-1 is IN_PROGRESS, order-2 is DONE => 1 completed stop
  assert.equal(severCrew.completedStops, 1);
});

test('extractOrderRouteMap - handles empty plans or missing summary gracefully', () => {
  const { orderRouteMap, todayRoutes } = extractOrderRouteMap([], [], '2026-10-19');
  assert.equal(orderRouteMap.size, 0);
  assert.equal(todayRoutes.length, 0);

  const brokenPlans: PlanForMapping[] = [
    {
      id: 'plan-broken',
      date: '2026-10-19',
      status: 'APPROVED',
      version: 1,
      planningSummary: null,
    },
    {
      id: 'plan-empty',
      date: '2026-10-19',
      status: 'APPROVED',
      version: 2,
      planningSummary: { crews: [] },
    },
  ];

  const result = extractOrderRouteMap(brokenPlans, [], '2026-10-19');
  assert.equal(result.orderRouteMap.size, 0);
  assert.equal(result.todayRoutes.length, 0);
});
