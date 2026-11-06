// Servis işçisinin mantığını (kurulum, önbelleğe alma, çevrimdışı açma) gerçek tarayıcı olmadan sınar:
// dist/sw.js bir sanal ortamda çalıştırılır; fetch dist klasöründen okur, önbellek bellekte tutulur.
// dist/ yoksa (derleme yapılmamışsa) test atlanır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const var_ = existsSync('dist/sw.js') && existsSync('dist/index.html');

class SahteOnbellek {
  kayit = new Map<string, Response>();
  private yol = (r: Request | string) => new URL(typeof r === 'string' ? r : r.url, 'http://yerel').pathname;
  async match(r: Request | string) { const y = this.kayit.get(this.yol(r)); return y?.clone(); }
  async put(r: Request | string, y: Response) { this.kayit.set(this.yol(r), y.clone()); }
  async keys() { return [...this.kayit.keys()].map((p) => new Request(`http://yerel${p}`)); }
}

function dosyaYaniti(yol: string): Response {
  const temiz = yol.split('?')[0];
  const aday = temiz.endsWith('/') ? `dist${temiz}index.html` : `dist${temiz}`;
  if (!existsSync(aday)) return new Response('yok', { status: 404 });
  const tur = aday.endsWith('.html') ? 'text/html' : aday.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  return new Response(readFileSync(aday), { status: 200, headers: { 'Content-Type': tur } });
}

function ortamKur(cevrimici: { acik: boolean }) {
  const onbellekler = new Map<string, SahteOnbellek>();
  const olaylar: Record<string, (o: any) => void> = {};
  const baglam: any = {
    URL, Response, Request, Set, Promise, Map,
    location: { origin: 'http://yerel' },
    caches: {
      open: async (ad: string) => { if (!onbellekler.has(ad)) onbellekler.set(ad, new SahteOnbellek()); return onbellekler.get(ad)!; },
      keys: async () => [...onbellekler.keys()],
      delete: async (ad: string) => onbellekler.delete(ad),
    },
    fetch: async (r: Request | string) => {
      if (!cevrimici.acik) throw new TypeError('ağ yok');
      return dosyaYaniti(new URL(typeof r === 'string' ? r : r.url, 'http://yerel').pathname);
    },
    self: null as any,
  };
  baglam.self = { ...baglam, addEventListener: (ad: string, f: (o: any) => void) => { olaylar[ad] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {} }, caches: baglam.caches };
  runInNewContext(readFileSync('dist/sw.js', 'utf8'), { ...baglam, self: baglam.self, addEventListener: undefined });
  return { onbellekler, olaylar };
}

async function olay(ad: string, olaylar: Record<string, (o: any) => void>, ek: any = {}) {
  let bekle: Promise<any> = Promise.resolve();
  let yanit: Promise<Response> | null = null;
  olaylar[ad]({ ...ek, waitUntil: (p: Promise<any>) => { bekle = p; }, respondWith: (p: Promise<Response>) => { yanit = p; } });
  await bekle;
  return yanit ? await yanit : null;
}

test('servis işçisi: kurulumda çekirdek önbelleğe alınır, internet kesilince ziyaret edilen ve çekirdek sayfalar açılır', { skip: !var_ }, async () => {
  const cevrimici = { acik: true };
  const { onbellekler, olaylar } = ortamKur(cevrimici);
  await olay('install', olaylar);
  await olay('activate', olaylar);
  const onbellek = onbellekler.get('divan-icerik')!;
  assert.ok(onbellek, 'önbellek açılmadı');
  const adresler = [...onbellek.kayit.keys()];
  for (const gerekli of ['/', '/ara/', '/sozluk/', '/cevrimdisi/', '/arama/indeks.json', '/manifest.webmanifest']) assert.ok(adresler.includes(gerekli), `çekirdekte yok: ${gerekli}`);
  assert.ok(adresler.some((a) => a.startsWith('/_astro/') && a.endsWith('.css')), 'stil dosyası önbelleğe alınmadı');
  assert.ok(adresler.some((a) => /\.woff2?$/.test(a)), 'yazı tipi önbelleğe alınmadı');

  // Çevrimiçiyken bir şiir sayfası gezilir: önbelleğe girer
  const siir = '/niyazi-misri/d-3/';
  const y1 = await olay('fetch', olaylar, { request: new Request(`http://yerel${siir}`, { method: 'GET' }) });
  assert.equal(y1?.status, 200);
  await new Promise((r) => setTimeout(r, 50)); // arka plandaki önbellek yazımı
  assert.ok(onbellek.kayit.has(siir), 'gezilen şiir önbelleğe girmedi');

  // İnternet kesilir: aynı şiir, çekirdek sayfalar ve arama dizini hâlâ açılır
  cevrimici.acik = false;
  for (const a of [siir, '/', '/ara/', '/arama/indeks.json']) {
    const y = await olay('fetch', olaylar, { request: new Request(`http://yerel${a}`, { method: 'GET' }) });
    assert.equal(y?.status, 200, `çevrimdışı açılmadı: ${a}`);
  }
  // Önbellekte olmayan bir şiir: çevrimdışı yedek sayfa ("indirilmemiş")
  const nav = new Request('http://yerel/yunus-emre/d-100/', { method: 'GET' });
  Object.defineProperty(nav, 'mode', { value: 'navigate' });
  const y2 = await olay('fetch', olaylar, { request: nav });
  assert.equal(y2?.status, 200);
  assert.match(await y2!.text(), /İnternetsiz okuma/);
});
