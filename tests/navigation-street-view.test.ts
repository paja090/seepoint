import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Navigation Street View: component file exists and exports NavigationStreetViewModal', () => {
  const modalPath = path.join(process.cwd(), 'components/offers/navigation-cockpit/NavigationStreetViewModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'NavigationStreetViewModal.tsx should exist');

  const content = fs.readFileSync(modalPath, 'utf8');
  assert.match(content, /export function NavigationStreetViewModal/, 'should export NavigationStreetViewModal');
  assert.match(content, /StreetViewPanorama/, 'should instantiate StreetViewPanorama');
  assert.match(content, /StreetViewService/, 'should query StreetViewService for nearby panoramas');
  assert.match(content, /pillarNumber/, 'should have pillarNumber field for rapid VO assignment');
  assert.match(content, /pillarType/, 'should have pillarType field for VO construction type');
  assert.match(content, /google\.com\/maps\?q=&layer=c&cbll=/, 'should provide direct Google Maps 360 link fallback');
});

test('Navigation Map Step: integrates 360 Street View modal and toolbar trigger', () => {
  const stepPath = path.join(process.cwd(), 'components/offers/navigation-cockpit/NavigationMapStep.tsx');
  const content = fs.readFileSync(stepPath, 'utf8');

  assert.match(content, /import\s*\{\s*NavigationStreetViewModal\s*\}\s*from '\.\/NavigationStreetViewModal'/, 'should import NavigationStreetViewModal');
  assert.match(content, /const \[streetViewPoint, setStreetViewPoint\] = useState/, 'should maintain streetViewPoint state');
  assert.match(content, /360° Street View \(průzkum VO\)/, 'should provide toolbar button for Street View survey');
  assert.match(content, /onOpenStreetView=\{\(pt\) => setStreetViewPoint\(pt\)\}/, 'should pass onOpenStreetView to NavigationPointList and Drawer');
  assert.match(content, /<NavigationStreetViewModal/, 'should render NavigationStreetViewModal when point is selected');
});

test('Navigation Point Drawer: includes Street View inspection card and VO pole lookup', () => {
  const drawerPath = path.join(process.cwd(), 'components/offers/navigation-cockpit/NavigationPointDrawer.tsx');
  const content = fs.readFileSync(drawerPath, 'utf8');

  assert.match(content, /onOpenStreetView\?: \(point: DraftPoint\) => void/, 'prop should be typed in NavigationPointDrawerProps');
  assert.match(content, /360° Street View průzkum sloupu VO/, 'should have 360 Street View card in Section 1');
  assert.match(content, /Hledat štítek/, 'should have VO sticker lookup shortcut button next to pillarNumber');
});

test('Navigation Point List: includes Street View action button and VO pill badge', () => {
  const listPath = path.join(process.cwd(), 'components/offers/navigation-cockpit/NavigationPointList.tsx');
  const content = fs.readFileSync(listPath, 'utf8');

  assert.match(content, /onOpenStreetView\?: \(point: DraftPoint\) => void/, 'prop should be typed in NavigationPointListProps');
  assert.match(content, /Street View/, 'should have Street View inspection button on point cards');
  assert.match(content, /VO #/, 'should indicate VO pillar number on point badge');
});

test('Google Navigation Offer Map: enables streetViewControl', () => {
  const mapPath = path.join(process.cwd(), 'components/offers/GoogleNavigationOfferMap.tsx');
  const content = fs.readFileSync(mapPath, 'utf8');

  assert.match(content, /streetViewControl:\s*true/, 'streetViewControl should be enabled on Google Map');
});

test('Navigation Offer Public View: includes Street View link on client point cards', () => {
  const publicViewPath = path.join(process.cwd(), 'components/offers/NavigationOfferPublicView.tsx');
  const content = fs.readFileSync(publicViewPath, 'utf8');

  assert.match(content, /layer=c&cbll=\$\{point\.latitude\},\$\{point\.longitude\}/, 'should provide Street View link for client');
  assert.match(content, /Street View ↗/, 'should show Street View text link');
});
