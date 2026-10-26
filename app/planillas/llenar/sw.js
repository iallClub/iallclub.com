/* Planillas · llenado · service worker
   Deja la pantalla de llenado disponible sin señal.
   - La página: primero la red (para recibir actualizaciones); si no hay señal, la copia guardada.
   - Tipografías de Google: se guardan la primera vez y se usan desde el equipo.
   - Las llamadas a Supabase no pasan por acá: la página maneja su propia cola. */
const CACHE = 'planillas-llenar-2026-10-25a';
const PAGINA = new URL('./', self.registration.scope).href;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(PAGINA, { cache: 'reload' }))).catch(() => {}));
});

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('planillas-llenar-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && req.mode === 'navigate' && url.href.split('?')[0].split('#')[0].replace(/index\.html$/, '') === PAGINA) {
    e.respondWith(pagina(req));
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(guardadoPrimero(req));
  }
});

async function pagina(req) {
  const c = await caches.open(CACHE);
  const red = fetch(req).then(r => { if (r.ok) c.put(PAGINA, r.clone()); return r; });
  try {
    // si la red tarda mucho (señal débil), usa la copia guardada y la actualiza en segundo plano
    return await Promise.race([red, new Promise((_, mal) => setTimeout(() => mal(new Error('lento')), 6000))]);
  } catch (e) {
    const g = await c.match(PAGINA);
    if (g) { red.catch(() => {}); return g; }
    return red;
  }
}

async function guardadoPrimero(req) {
  const c = await caches.open(CACHE);
  const g = await c.match(req);
  if (g) return g;
  try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }
  catch (e) { return new Response('', { status: 504 }); }
}
