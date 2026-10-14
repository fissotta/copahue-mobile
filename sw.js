/* Copahue Mobile service worker: app shell precache, cache-first for static files, network-first for the HTML.
   Music is NOT precached: it is cached on first play (Range requests are passed through). */
const V='cfc-mobile-v2';
const SHELL=['./','index.html','mobile.css','manifest.webmanifest','js/world.js','js/game.js','js/fpgear.js','js/fpworld.js','js/hudmenu.js','js/mobile.js','js/radio.js','libs/three.min.js','libs/addons.js','data/data.js','data/sky/sky_stars.webp','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||r.headers.has('range'))return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(V).then(h=>h.put('index.html',c));return x;}).catch(()=>caches.match('index.html')));return;}
  const media=/\/music\//.test(u.pathname);   // music: cache-first; everything else: network-first so updates reach the phone, cache as offline fallback
  if(media){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(V).then(h=>h.put(r,c));}return x;})));return;}
  e.respondWith(fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(V).then(h=>h.put(r,c));}return x;}).catch(()=>caches.match(r)));});
