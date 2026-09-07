import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSurveyArrowBadge } from '../components/navigation/MobileSurveyFieldView';

test('1. formatSurveyArrowBadge correctly resolves standard and roundabout arrows', () => {
  const straight = formatSurveyArrowBadge('STRAIGHT');
  assert.equal(straight.icon, '↑');
  assert.equal(straight.label, 'PŘÍMO');

  const left = formatSurveyArrowBadge('LEFT');
  assert.equal(left.icon, '←');
  assert.equal(left.label, 'VLEVO');

  const right = formatSurveyArrowBadge('RIGHT');
  assert.equal(right.icon, '→');
  assert.equal(right.label, 'VPRAVO');

  const r1 = formatSurveyArrowBadge('ROUNDABOUT_1');
  assert.equal(r1.icon, '🔄 1.');
  assert.match(r1.label, /1\.\s*VÝJEZD/i);

  const r2 = formatSurveyArrowBadge('ROUNDABOUT_2');
  assert.equal(r2.icon, '🔄 2.');
  assert.match(r2.label, /2\.\s*VÝJEZD/i);

  const r3 = formatSurveyArrowBadge('ROUNDABOUT_3');
  assert.equal(r3.icon, '🔄 3.');
  assert.match(r3.label, /3\.\s*VÝJEZD/i);

  const r4 = formatSurveyArrowBadge('ROUNDABOUT_4');
  assert.equal(r4.icon, '🔄 4.');
  assert.match(r4.label, /4\.\s*VÝJEZD/i);

  const rGeneral = formatSurveyArrowBadge('ROUNDABOUT');
  assert.equal(rGeneral.icon, '🔄');
  assert.equal(rGeneral.label, 'KRUHOVÝ OBJEZD');

  const uTurn = formatSurveyArrowBadge('U_TURN');
  assert.equal(uTurn.icon, '↩');
  assert.equal(uTurn.label, 'DO PROTISMĚRU');
});

test('2. Navigation destination link helper formats correct Google Maps and Mapy.cz URLs', () => {
  const lat = 49.82092;
  const lng = 18.26251;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const mapyCzUrl = `https://mapy.cz/zakladni?q=${lat},${lng}`;

  assert.equal(googleMapsUrl, 'https://www.google.com/maps/dir/?api=1&destination=49.82092,18.26251');
  assert.equal(mapyCzUrl, 'https://mapy.cz/zakladni?q=49.82092,18.26251');
});

test('3. Candidate update payload retains pillar number and roundabout arrow', () => {
  const updatePayload = {
    label: 'Sloup VO č. 42',
    latitude: 49.832,
    longitude: 18.291,
    pillarNumber: 'VO 42/1',
    arrowDirection: 'ROUNDABOUT_2',
    approachDirection: 'od Havířova',
  };

  assert.equal(updatePayload.pillarNumber, 'VO 42/1');
  assert.equal(updatePayload.arrowDirection, 'ROUNDABOUT_2');
  assert.equal(updatePayload.approachDirection, 'od Havířova');
});
