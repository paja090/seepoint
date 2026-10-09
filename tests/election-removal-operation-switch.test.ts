import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectOperationTypeFromText,
  setPointOperationTypeInDescription,
} from '../lib/election-removal/kml-parser';
import { parsePointMetadata } from '../lib/election-removal/point-metadata';
import { calculateServiceMinutes } from '../lib/election-removal/constants';

describe('Election Removal Operation Switching and Detection', () => {
  it('detects operations from heuristic KML text', () => {
    assert.equal(detectOperationTypeFromText('Výměna plachet Tower'), 'BANNER_CHANGE');
    assert.equal(detectOperationTypeFromText('Převoz na jiné místo'), 'RELOCATION');
    assert.equal(detectOperationTypeFromText('Demontáž Áčka na sklad'), 'FULL_REMOVAL');
  });

  it('explicit tags take absolute priority over underlying text', () => {
    // If text originally mentioned "výměna plachty", but user explicitly set Odvoz na sklad:
    const textWithSkladOverride = '[Operace: Odvoz na sklad]\nPůvodní text: výměna plachty na stanovišti';
    assert.equal(detectOperationTypeFromText(textWithSkladOverride), 'FULL_REMOVAL');

    // If text mentioned "odvoz do skladu", but user explicitly set Převoz:
    const textWithPrevozOverride = '[Operace: Převoz na jiné místo]\nPůvodní text: odvoz do skladu';
    assert.equal(detectOperationTypeFromText(textWithPrevozOverride), 'RELOCATION');

    // If text mentioned "převoz", but user explicitly set Výměna plachty:
    const textWithPlachtaOverride = '[Operace: Výměna plachty]\nPůvodní text: převoz konstrukce';
    assert.equal(detectOperationTypeFromText(textWithPlachtaOverride), 'BANNER_CHANGE');
  });

  it('setPointOperationTypeInDescription updates and cleans tags correctly', () => {
    const originalDesc = 'Lokalita: Náměstí Republiky\nPoznámka: Pozor na schody';

    // 1. Switch to relocation with destination
    const descReloc = setPointOperationTypeInDescription(
      originalDesc,
      'RELOCATION',
      'Masarykova 10'
    );
    assert.ok(descReloc.includes('[Operace: Převoz na jiné místo]'));
    assert.ok(descReloc.includes('[Cíl převozu: Masarykova 10]'));
    assert.ok(descReloc.includes('Lokalita: Náměstí Republiky'));
    assert.equal(detectOperationTypeFromText(descReloc), 'RELOCATION');

    // 2. Switch from relocation back to warehouse removal
    const descSklad = setPointOperationTypeInDescription(descReloc, 'FULL_REMOVAL');
    assert.ok(descSklad.includes('[Operace: Odvoz na sklad]'));
    assert.ok(!descSklad.includes('[Cíl převozu:'));
    assert.ok(!descSklad.includes('[Operace: Převoz'));
    assert.equal(detectOperationTypeFromText(descSklad), 'FULL_REMOVAL');

    // 3. Switch to banner change
    const descBanner = setPointOperationTypeInDescription(descSklad, 'BANNER_CHANGE');
    assert.ok(descBanner.includes('[Operace: Výměna plachty]'));
    assert.ok(!descBanner.includes('[Operace: Odvoz na sklad]'));
    assert.equal(detectOperationTypeFromText(descBanner), 'BANNER_CHANGE');
  });

  it('parsePointMetadata extracts relocationDestination and keeps notes clean', () => {
    const desc = '[Operace: Převoz na jiné místo] [Cíl převozu: Park Lužánky]\nLokalita: Brno-střed\nPoznámka: Klíče u vrátného';
    const meta = parsePointMetadata(desc);

    assert.equal(meta.locality, 'Brno-střed');
    assert.equal(meta.relocationDestination, 'Park Lužánky');
    assert.equal(meta.otherNotes, 'Klíče u vrátného');
    assert.ok(!meta.otherNotes?.includes('Operace'));
    assert.ok(!meta.otherNotes?.includes('Cíl převozu'));
  });

  it('calculateServiceMinutes accurately reflects the operation type', () => {
    // MiniTower: 10 min full removal, 15 min relocation, 5 min banner change
    assert.equal(calculateServiceMinutes('MINI_TOWER', 1, null, 'FULL_REMOVAL').totalMinutes, 10);
    assert.equal(calculateServiceMinutes('MINI_TOWER', 1, null, 'RELOCATION').totalMinutes, 15);
    assert.equal(calculateServiceMinutes('MINI_TOWER', 1, null, 'BANNER_CHANGE').totalMinutes, 5);

    // Tower: 15 min full removal, 25 min relocation, 7 min banner change
    assert.equal(calculateServiceMinutes('TOWER', 1, null, 'FULL_REMOVAL').totalMinutes, 15);
    assert.equal(calculateServiceMinutes('TOWER', 1, null, 'RELOCATION').totalMinutes, 25);
    assert.equal(calculateServiceMinutes('TOWER', 1, null, 'BANNER_CHANGE').totalMinutes, 7);

    // Áčko: 5 min full removal, 8 min relocation, 4 min banner change
    assert.equal(calculateServiceMinutes('ACKO', 1, null, 'FULL_REMOVAL').totalMinutes, 5);
    assert.equal(calculateServiceMinutes('ACKO', 1, null, 'RELOCATION').totalMinutes, 8);
    assert.equal(calculateServiceMinutes('ACKO', 1, null, 'BANNER_CHANGE').totalMinutes, 4);
  });
});
