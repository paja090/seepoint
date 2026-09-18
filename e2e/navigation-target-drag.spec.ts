/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps boundary fixture. */
import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

test('each store can move independently and retains its identity through geocoding and saving', async ({ page }) => {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {NavigationOfferForm} from './components/offers/NavigationOfferForm';
      window.markers = [];
      window.pendingGeocodes = [];
      window.google = {maps: {
        Map: class {addListener(event, handler) {window.mapClick = handler} fitBounds() {}},
        Marker: class {
          constructor(options) {this.options=options; this.handlers={}; window.markers.push(this)}
          setMap(map) {this.options.map=map}
          addListener(event, handler) {this.handlers[event]=handler}
        },
        Polyline: class {setMap() {}},
        Point: class {}, LatLngBounds: class {extend() {}},
        Geocoder: class {geocode(request, callback) {window.pendingGeocodes.push(callback)}}
      }};
      createRoot(document.getElementById('root')).render(<NavigationOfferForm
        clients={[{id:'client',name:'Test klient'}]}
        initialOffer={{id:'fixture',title:'Test navigace',clientId:'client',navigation:{
          targets:[{id:'a',name:'První prodejna',address:'Adresa A',latitude:49,longitude:16,note:'Poznámka A'},
                   {id:'b',name:'Druhá prodejna',address:'Adresa B',latitude:50,longitude:17,note:'Poznámka B'}],
          points:[{id:'point',label:'Směrovka',latitude:50.1,longitude:17.1,targetId:'b'}]
        }}}/>);
    ` }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY': '"fixture"', 'process.env': '{}' },
    plugins: [{ name: 'router-fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useRouter=()=>({push(){},refresh(){}});' }));
    } }],
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let saved: { targets: Array<{id:string; latitude:number; longitude:number; note:string}> } | undefined;
  const destinations: Array<{latitude:number;longitude:number}> = [];
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === 'http://navigation.test/') return route.fulfill({ contentType: 'text/html', body: `<div id="root"></div><script>${bundle.outputFiles[0].text}</script>` });
    if (url.includes('/api/offers/navigation/fixture')) {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { id: 'fixture' } });
    }
    if (url.endsWith('/api/route')) {
      destinations.push(route.request().postDataJSON().destination);
      return route.fulfill({json:{status:'OK',distanceMeters:1500,polyline:''}});
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('http://navigation.test/');
  const positions = (): Promise<Array<{title:string;draggable:boolean;lat:number;lng:number}>> => page.evaluate(() => (window as any).markers.filter((m:any) => m.options.map && m.options.title.startsWith('CÍL')).map((m:any) => ({title:m.options.title, draggable:m.options.draggable, ...m.options.position})));
  await expect.poll(positions).toHaveLength(2);
  expect((await positions()).every(m => m.draggable)).toBe(true);
  const drag = (name: string, lat: number, lng: number) => page.evaluate(({name,lat,lng}) => {
    const marker = (window as any).markers.find((m:any) => m.options.map && m.options.title.includes(name));
    marker.handlers.dragend({latLng:{lat:()=>lat,lng:()=>lng}});
  }, {name,lat,lng});
  const geocode = () => page.evaluate(() => (window as any).pendingGeocodes.shift()([{formatted_address:'Nová adresa'}], 'OK'));
  await drag('Druhá', 50.5, 17.5);
  // Switch selection while the asynchronous geocoder is still pending.
  await page.getByRole('button', {name:/^Druhá prodejna.*bodů$/}).click();
  await geocode();
  await expect.poll(positions).toEqual([
    {title:'CÍL (1): První prodejna',draggable:true,lat:49,lng:16},
    {title:'CÍL (2): Druhá prodejna',draggable:true,lat:50.5,lng:17.5},
  ]);
  await drag('První', 49.5, 16.5);
  await geocode();
  await expect.poll(async () => (await positions())[0].lat).toBe(49.5);
  await expect.poll(() => destinations.length).toBeGreaterThanOrEqual(2);
  expect(destinations.every(d => d.latitude === 50.5 && d.longitude === 17.5)).toBe(true);
  await page.getByRole('button', {name:'Uložit nabídku navigace',exact:true}).click();
  await expect.poll(() => saved?.targets).toEqual([
    expect.objectContaining({id:'a',latitude:49.5,longitude:16.5,note:'Poznámka A'}),
    expect.objectContaining({id:'b',latitude:50.5,longitude:17.5,note:'Poznámka B'}),
  ]);
  await page.getByRole('button', {name:/Přidat pobočku/}).click();
  await expect.poll(positions).toHaveLength(3);
  expect((await positions())[2].draggable).toBe(true);
  expect(errors).toEqual([]);
});
