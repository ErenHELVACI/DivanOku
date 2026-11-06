// Servis işçisi (/sw.js): ziyaret edilen sayfalar ve varlıklar önbelleğe alınır; internet yokken oradan açılır.
// Önbellek adı sabittir ("divan-icerik"): site güncellenince indirilen sayfalar silinmez, açılışta arka planda yenilenir.
// Sayfaları toptan indirme ve silme istemci tarafında yapılır (src/scripts/cevrimdisi.ts), aynı önbelleği kullanır.
import type { APIRoute } from 'astro';
import { kitaplar } from '../lib/veri.ts';

export const GET: APIRoute = () => {
  // Kurulumda önbelleğe alınan çekirdek: ana sayfalar, arama dizini, kitap sayfaları
  const cekirdek = ['/', '/ara/', '/sozluk/', '/cevrimdisi/', '/arama/indeks.json', '/manifest.webmanifest', '/favicon.svg', '/ikon-192.png',
    ...kitaplar().flatMap((k) => [`/${k.kunye.slug}/`, `/${k.kunye.slug}/liste.json`, `/${k.kunye.slug}/sozluk/`, ...(k.sair ? [`/${k.kunye.slug}/sair/`] : [])])];
  const kod = String.raw`// Dîvân servis işçisi (sürüm ${Date.now()})
const ONBELLEK = 'divan-icerik';
const CEKIRDEK = ${JSON.stringify(cekirdek)};

// Sayfaların ve varlıkların başvurduğu /_astro/ dosyaları: komut dosyaları, stiller, yazı tipleri ve bunların birbirine
// bağlantıları ("./parca.js" gibi göreli içe aktarmalar dahil) bulunana kadar taranır; hepsi önbelleğe alınır.
// Kullanılmayan yazı tipi altkümeleri (Kiril, Yunan, Vietnam) ve eski .woff biçimleri indirilmez: Türkçe için latin ve latin-ext yeter
const GEREKSIZ = /(cyrillic|greek|vietnamese)|\.woff$/;
function basvurular(adres, metin) {
  const bulunan = new Set();
  for (const m of metin.matchAll(/\/_astro\/[^"'\s)\\]+/g)) bulunan.add(m[0]);
  if (adres.endsWith('.js')) for (const m of metin.matchAll(/["'\x60]\.\/([^"'\x60\s]+\.(?:js|css|woff2?))["'\x60]/g)) bulunan.add('/_astro/' + m[1]);
  return new Set([...bulunan].filter((b) => !GEREKSIZ.test(b)));
}
async function varliklar(sayfalar, onbellek) {
  const gorulen = new Set(sayfalar);
  const kuyruk = [...sayfalar];
  while (kuyruk.length) {
    const adres = kuyruk.shift();
    try {
      const yanit = await fetch(adres);
      if (!yanit.ok) continue;
      await onbellek.put(adres, yanit.clone());
      if (/\.(js|css)$/.test(adres) || adres.endsWith('/')) {
        for (const b of basvurular(adres, await yanit.text())) if (!gorulen.has(b)) { gorulen.add(b); kuyruk.push(b); }
      }
    } catch (e) {}
  }
}

self.addEventListener('install', (olay) => {
  olay.waitUntil((async () => {
    const onbellek = await caches.open(ONBELLEK);
    await varliklar(CEKIRDEK.filter((a) => !a.endsWith('.json') && !a.endsWith('.png') && !a.endsWith('.svg') && !a.endsWith('.webmanifest')), onbellek);
    await Promise.all(CEKIRDEK.filter((a) => !(a.endsWith('/') )).map(async (a) => { try { const y = await fetch(a); if (y.ok) await onbellek.put(a, y); } catch (e) {} }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (olay) => {
  olay.waitUntil((async () => {
    for (const ad of await caches.keys()) if (ad !== ONBELLEK) await caches.delete(ad); // eski sürüm adları
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (olay) => {
  const istek = olay.request;
  if (istek.method !== 'GET') return;
  const adres = new URL(istek.url);
  if (adres.origin !== location.origin || adres.pathname === '/sw.js') return;

  const sayfaMi = istek.mode === 'navigate' || adres.pathname.endsWith('.json');
  olay.respondWith((async () => {
    const onbellek = await caches.open(ONBELLEK);
    const kayitli = await onbellek.match(istek, { ignoreSearch: true });
    if (sayfaMi) {
      // Önbellekten hemen ver, arka planda yenile (stale-while-revalidate); yoksa ağdan al
      const agdan = fetch(istek).then((y) => { if (y.ok) onbellek.put(istek.url.split('?')[0], y.clone()); return y; });
      if (kayitli) { agdan.catch(() => {}); return kayitli; }
      try { return await agdan; } catch (e) {
        if (istek.mode === 'navigate') { const yedek = await onbellek.match('/cevrimdisi/'); if (yedek) return yedek; }
        return new Response('Çevrimdışı', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    }
    // Varlıklar (/_astro/ dosyaları, yazı tipleri, görseller): önbellek önce
    if (kayitli) return kayitli;
    try { const y = await fetch(istek); if (y.ok) onbellek.put(istek, y.clone()); return y; } catch (e) { return new Response('', { status: 504 }); }
  })());
});
`;
  return new Response(kod, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Service-Worker-Allowed': '/' } });
};
