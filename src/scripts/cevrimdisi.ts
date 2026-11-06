// İnternetsiz okuma sayfası: sayfaları servis işçisinin kullandığı önbelleğe toptan indirir, durumu gösterir, siler.
const ONBELLEK = 'divan-icerik'; // src/pages/sw.js.ts ile aynı ad
type Grup = { slug: string; ad: string; adresler: string[] };
let genel: string[] = [];
let kitaplar: Grup[] = [];
let calisiyor = false;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const baglidurum = $('bagli-durum');
const ilerlemeKap = $('ilerleme-kap');
const ilerleme = $('ilerleme') as unknown as HTMLProgressElement;
const ilerlemeYazi = $('ilerleme-yazi');
const depoDurum = $('depo-durum');
const liste = $('kitap-listesi');
const hepsi = $('hepsini-indir') as HTMLButtonElement;
const sil = $('sil') as HTMLButtonElement;

const mb = (b: number) => `${(b / 1048576).toFixed(0)} MB`;

async function onbellekDurumu(): Promise<Set<string>> {
  if (!('caches' in window)) return new Set();
  const c = await caches.open(ONBELLEK);
  return new Set((await c.keys()).map((r) => new URL(r.url).pathname));
}

async function durumuYenile() {
  baglidurum.textContent = navigator.onLine ? 'Bağlısınız.' : 'Çevrimdışısınız: yalnızca indirilmiş sayfalar açılır.';
  baglidurum.dataset.durum = navigator.onLine ? 'acik' : 'kapali';
  const var_ = await onbellekDurumu();
  liste.replaceChildren();
  for (const k of kitaplar) {
    const inen = k.adresler.filter((a) => var_.has(a)).length;
    const li = document.createElement('li');
    const ad = document.createElement('span'); ad.textContent = k.ad;
    const say = document.createElement('span'); say.className = 'soluk kucuk';
    say.textContent = inen === k.adresler.length ? ' · tamamı indirildi' : ` · ${inen}/${k.adresler.length} sayfa`;
    const d = document.createElement('button'); d.type = 'button'; d.className = 'dugme'; d.textContent = inen === k.adresler.length ? 'Yenile' : 'İndir'; d.disabled = calisiyor || !navigator.onLine;
    d.addEventListener('click', () => indir([...genelSayfalar(), ...k.adresler]));
    li.append(ad, say, d); liste.append(li);
  }
  try {
    const t = await navigator.storage?.estimate?.();
    depoDurum.textContent = `Cihazda ${var_.size.toLocaleString('tr')} sayfa kayıtlı${t?.usage ? ` (yaklaşık ${mb(t.usage)} kullanılıyor)` : ''}.`;
  } catch { depoDurum.textContent = `Cihazda ${var_.size.toLocaleString('tr')} sayfa kayıtlı.`; }
  hepsi.disabled = calisiyor || !navigator.onLine;
  sil.disabled = calisiyor;
}

const genelSayfalar = () => genel;

// Bir sayfanın ya da varlığın başvurduğu /_astro/ dosyaları (komut dosyası, stil, yazı tipi; göreli "./parca.js" içe aktarmaları dahil)
function varlikBul(adres: string, metin: string): string[] {
  const bulunan = new Set<string>([...metin.matchAll(/\/_astro\/[^"'\s)\\]+/g)].map((m) => m[0]));
  if (adres.endsWith('.js')) for (const m of metin.matchAll(/["'`]\.\/([^"'`\s]+\.(?:js|css|woff2?))["'`]/g)) bulunan.add(`/_astro/${m[1]}`);
  return [...bulunan].filter((b) => !/(cyrillic|greek|vietnamese)|\.woff$/.test(b)); // Türkçe için latin ve latin-ext yeter; eski .woff gerekmez
}

async function indir(adresler: string[]) {
  if (calisiyor || !navigator.onLine) return;
  calisiyor = true; hepsi.disabled = true; sil.disabled = true;
  ilerlemeKap.hidden = false;
  try { await navigator.storage?.persist?.(); } catch { /* izin verilmezse sessizce devam */ }
  const c = await caches.open(ONBELLEK);
  const tekil = [...new Set(adresler)];
  let bitti = 0, hata = 0;
  const guncelle = () => {
    ilerleme.max = tekil.length; ilerleme.value = bitti;
    ilerlemeYazi.textContent = ` ${bitti.toLocaleString('tr')} / ${tekil.length.toLocaleString('tr')} sayfa${hata ? `, ${hata} hata` : ''}`;
  };
  guncelle();
  const varliklar = new Set<string>();
  let sira = 0;
  const isci = async () => {
    while (sira < tekil.length) {
      const a = tekil[sira++];
      try {
        const yanit = await fetch(a);
        if (!yanit.ok) throw new Error(String(yanit.status));
        if (/\/$/.test(a) && varliklar.size < 400) for (const v of varlikBul(a, await yanit.clone().text())) varliklar.add(v);
        await c.put(a, yanit);
      } catch { hata++; }
      bitti++; if (bitti % 8 === 0 || bitti === tekil.length) guncelle();
    }
  };
  await Promise.all(Array.from({ length: 6 }, isci));
  // Varlıklar: bulunanların kendi başvurduklarına kadar (stil -> yazı tipi, komut dosyası -> parçalar)
  const kuyruk = [...varliklar];
  while (kuyruk.length) {
    const v = kuyruk.shift()!;
    try {
      const y = await fetch(v); if (!y.ok) continue;
      if (/\.(js|css)$/.test(v)) for (const b of varlikBul(v, await y.clone().text())) if (!varliklar.has(b)) { varliklar.add(b); kuyruk.push(b); }
      await c.put(v, y);
    } catch { /* varlık indirilemezse sayfalar yine de açılır */ }
  }
  calisiyor = false;
  ilerlemeYazi.textContent = `Tamamlandı: ${bitti.toLocaleString('tr')} sayfa${hata ? `, ${hata} hata` : ''}.`;
  await durumuYenile();
}

async function yukle() {
  try {
    const r = await fetch('/sayfalar.json');
    const v = await r.json();
    genel = v.genel; kitaplar = v.kitaplar;
  } catch {
    depoDurum.textContent = 'Sayfa listesi alınamadı (bağlantı yok olabilir).';
  }
  hepsi.addEventListener('click', () => indir([...genel, ...kitaplar.flatMap((k) => k.adresler)]));
  sil.addEventListener('click', async () => {
    if (!confirm('İndirilen tüm sayfalar cihazdan silinsin mi? (Okuduğunuz sayfalar yeniden otomatik kaydedilir.)')) return;
    await caches.delete(ONBELLEK);
    ilerlemeKap.hidden = true;
    await durumuYenile();
  });
  addEventListener('online', durumuYenile);
  addEventListener('offline', durumuYenile);
  await durumuYenile();
}

// Uygulama olarak kur (Chrome/Android/Edge)
let kurmaOlayi: any = null;
const kur = $('kur') as HTMLButtonElement;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); kurmaOlayi = e; kur.hidden = false; });
kur.addEventListener('click', async () => { if (!kurmaOlayi) return; kurmaOlayi.prompt(); await kurmaOlayi.userChoice; kurmaOlayi = null; kur.hidden = true; });

yukle();
