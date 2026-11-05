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
  assert.match(content, /handleCaptureSnapshot/, 'should have Street View snapshot capture function');
  assert.match(content, /Vyfotit pro vizualizaci/, 'should have snapshot button in modal');
});

test('Navigation Street View Capture: API route exists and handles snapshot storage', () => {
  const routePath = path.join(process.cwd(), 'app/api/offers/navigation/streetview-capture/route.ts');
  assert.ok(fs.existsSync(routePath), 'streetview-capture API route should exist');

  const content = fs.readFileSync(routePath, 'utf8');
  assert.match(content, /export async function POST/, 'should handle POST requests');
  assert.match(content, /requireApiAccess\('offers'\)/, 'should require offers access');
  assert.match(content, /storeTenantPhoto/, 'should persist snapshot into tenant storage');
  assert.match(content, /maps\.googleapis\.com\/maps\/api\/streetview/, 'should call Google Street View Static API');
  assert.match(content, /sitePhotoId/, 'should associate captured photo with navigation point');
});

test('Navigation Combined Arrow Directions: schema, types, specialized and pdf support expanded directions', () => {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  assert.match(schemaContent, /STRAIGHT_LEFT/, 'schema should contain STRAIGHT_LEFT');
  assert.match(schemaContent, /STRAIGHT_RIGHT/, 'schema should contain STRAIGHT_RIGHT');
  assert.match(schemaContent, /LEFT_STRAIGHT/, 'schema should contain LEFT_STRAIGHT');
  assert.match(schemaContent, /RIGHT_STRAIGHT/, 'schema should contain RIGHT_STRAIGHT');
  assert.match(schemaContent, /LEFT_RIGHT/, 'schema should contain LEFT_RIGHT');

  const specPath = path.join(process.cwd(), 'lib/offers/specialized.ts');
  const specContent = fs.readFileSync(specPath, 'utf8');
  assert.match(specContent, /'STRAIGHT_LEFT'/, 'specialized.ts should include STRAIGHT_LEFT in validArrows');
  assert.match(specContent, /'STRAIGHT_RIGHT'/, 'specialized.ts should include STRAIGHT_RIGHT in validArrows');
  assert.match(specContent, /'LEFT_STRAIGHT'/, 'specialized.ts should include LEFT_STRAIGHT in validArrows');
  assert.match(specContent, /'RIGHT_STRAIGHT'/, 'specialized.ts should include RIGHT_STRAIGHT in validArrows');

  const pdfPath = path.join(process.cwd(), 'lib/offers/pdf.ts');
  const pdfContent = fs.readFileSync(pdfPath, 'utf8');
  assert.match(pdfContent, /case 'STRAIGHT_LEFT': return '⬆⬅ Rovně a vlevo'/, 'pdf.ts should format STRAIGHT_LEFT');
  assert.match(pdfContent, /case 'STRAIGHT_RIGHT': return '⬆➔ Rovně a vpravo'/, 'pdf.ts should format STRAIGHT_RIGHT');

  const visualizerPath = path.join(process.cwd(), 'components/navigation-documentation/NavigationSignVisualizer.tsx');
  const visualizerContent = fs.readFileSync(visualizerPath, 'utf8');
  assert.match(visualizerContent, /case 'STRAIGHT_LEFT': return '⬆⬅'/, 'visualizer should render combined arrow ⬆⬅');
  assert.match(visualizerContent, /case 'STRAIGHT_RIGHT': return '⬆➔'/, 'visualizer should render combined arrow ⬆➔');
  assert.match(visualizerContent, /'⬆⬅'/, 'visualizer button grid should contain ⬆⬅');
});

test('Navigation Map Step: integrates 360 Street View modal, toolbar trigger, and visualizer handoff', () => {
  const stepPath = path.join(process.cwd(), 'components/offers/navigation-cockpit/NavigationMapStep.tsx');
  const content = fs.readFileSync(stepPath, 'utf8');

  assert.match(content, /import\s*\{\s*NavigationStreetViewModal\s*\}\s*from '\.\/NavigationStreetViewModal'/, 'should import NavigationStreetViewModal');
  assert.match(content, /const \[streetViewPoint, setStreetViewPoint\] = useState/, 'should maintain streetViewPoint state');
  assert.match(content, /360° Street View \(průzkum VO\)/, 'should provide toolbar button for Street View survey');
  assert.match(content, /onOpenStreetView=\{\(pt\) => setStreetViewPoint\(pt\)\}/, 'should pass onOpenStreetView to NavigationPointList and Drawer');
  assert.match(content, /onOpenVisualizer=\{onOpenVisualizer\}/, 'should pass onOpenVisualizer to NavigationStreetViewModal');
  assert.match(content, /<NavigationStreetViewModal/, 'should render NavigationStreetViewModal when point is selected');
});

test('Navigation Point Drawer: includes Street View inspection card, VO lookup, and Ze Street View photo button', () => {
  const drawerPath = path.join(process.cwd(), 'components/offers/navigation-cockpit/NavigationPointDrawer.tsx');
  const content = fs.readFileSync(drawerPath, 'utf8');

  assert.match(content, /onOpenStreetView\?: \(point: DraftPoint\) => void/, 'prop should be typed in NavigationPointDrawerProps');
  assert.match(content, /360° Street View průzkum sloupu VO/, 'should have 360 Street View card in Section 1');
  assert.match(content, /Hledat štítek/, 'should have VO sticker lookup shortcut button next to pillarNumber');
  assert.match(content, /Ze Street View/, 'should have quick Street View photo capture button in Section 4');
  assert.match(content, /STRAIGHT_LEFT/, 'select should offer STRAIGHT_LEFT option');
  assert.match(content, /STRAIGHT_RIGHT/, 'select should offer STRAIGHT_RIGHT option');
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

test('Navigation Offer Public View: includes Street View link and combined arrow badges', () => {
  const publicViewPath = path.join(process.cwd(), 'components/offers/NavigationOfferPublicView.tsx');
  const content = fs.readFileSync(publicViewPath, 'utf8');

  assert.match(content, /layer=c&cbll=\$\{point\.latitude\},\$\{point\.longitude\}/, 'should provide Street View link for client');
  assert.match(content, /Street View ↗/, 'should show Street View text link');
  assert.match(content, /case 'STRAIGHT_LEFT':/, 'ArrowBadge should handle STRAIGHT_LEFT');
  assert.match(content, /case 'STRAIGHT_RIGHT':/, 'ArrowBadge should handle STRAIGHT_RIGHT');
  assert.match(content, /ROVNĚ A VLEVO/, 'ArrowBadge should display ROVNĚ A VLEVO');
  assert.match(content, /ROVNĚ A VPRAVO/, 'ArrowBadge should display ROVNĚ A VPRAVO');
});
