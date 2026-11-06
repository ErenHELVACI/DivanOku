// Eşrefoğlu Rûmî: PDF'teki tanıtım bölümlerini (Ön Söz; Eşrefoğlu Abdullâh Rûmî: hayatı, eserleri) çıkarır.
// Girdi (değiştirilmez): dokum/esrefoglu-rumi/metin-layout.txt (pdftotext -enc UTF-8 -layout). Çıktı: veri/esrefoglu-rumi/sair.json
// Düz akan metindir: paragraf başı girintili satırdır, devam satırları girintisizdir; satır sonu tireleri birleştirilir
// ("yet-"+"kin" -> "yetkin"). Sayfa altı dipnotları basılı numarayla ("3 Bursalı Mehmed ...") işaretlere bağlanır.
// Kural: sözcükler değişmez; yalnız satır sonu tireleme ve satır kırıkları birleştirilir.
import { readFileSync, writeFileSync } from 'node:fs';

const KITAP = 'esrefoglu-rumi';
const sayfalar = readFileSync(`dokum/${KITAP}/metin-layout.txt`, 'utf8').replace(/\r/g, '').split('\f');
const uyarilar: string[] = [];

type Oge = { t: 'ust' | 'alt' | 'p' | 'alinti'; m: string };
type Bolum = { baslik: string; ogeler: Oge[] };

const ustBilgi = /^\s*(\d+\s+EŞREFOĞLU ABDULLÂH RÛMÎ|DÎVÂN-I İLÂHİYÂT(\s+\d+)?|\d+)\s*$/;
const ALT_BASLIKLAR = new Set(['Hayatı', 'Eşrefoğlu Rûmî’nin Eserleri', 'Dîvân-ı İlâhiyât’ın nüshaları', '2. Müzekki’n-nüfûs', '3. Tarîkatnâme', '4. Diğer eserleri']);
const ATLA = new Set(['Eşrefoğlu Hazretleri’nin İznik’teki kabr-i şerîfi', '(Yâ Hazret-i Sultân Pîr Eşrefzâde Abdullâh Rûmî)']); // görsel altyazıları
const dipnotlar: { no: number; metin: string }[] = [];
let sonrakiNo = 1;

// Satır listesini paragraf metnine birleştirir: satır sonu tiresi sözcüğü birleştirir, aksi halde boşlukla.
const birlestir = (satirlar: string[]) => satirlar.map((l) => l.trim()).filter(Boolean)
  .reduce((a, b) => (!a ? b : /[\p{L}]-$/u.test(a) ? a.slice(0, -1) + b : `${a} ${b}`), '');

function bolumCikar(ilk: number, son: number, baslik: string, baslikSatiri?: string, bas: Oge[] = []): Bolum {
  const bolum: Bolum = { baslik, ogeler: [...bas] };
  let acik: string[] | null = null; // açık paragrafın satırları (sayfa sınırını aşabilir)
  const kapat = () => { if (acik && acik.length) bolum.ogeler.push({ t: 'p', m: birlestir(acik) }); acik = null; };

  for (let p = ilk; p <= son; p++) {
    const satirlar = sayfalar[p].split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => !ustBilgi.test(l));

    // Bu sayfadaki dipnotlar: sıradaki numarayla başlayan girintisiz satırlar, sayfa sonuna kadar
    const baslangic: number[] = [];
    let beklenen = sonrakiNo;
    satirlar.forEach((l, i) => {
      if (new RegExp(`^${beklenen}\\s+\\S`).test(l) && !/^\s/.test(l) && (baslangic.length || i > 0)) { baslangic.push(i); beklenen++; }
    });
    const govde = baslangic.length ? satirlar.slice(0, baslangic[0]) : [...satirlar];
    const numaralar = baslangic.map((_, j) => sonrakiNo + j);
    baslangic.forEach((b, j) => {
      const bitis = j + 1 < baslangic.length ? baslangic[j + 1] : satirlar.length;
      const parca = satirlar.slice(b, bitis);
      parca[0] = parca[0].replace(/^\d+\s+/, '');
      dipnotlar.push({ no: numaralar[j], metin: birlestir(parca) });
    });
    sonrakiNo += baslangic.length;

    // İşaretler: dipnot numarasıyla aynı rakam, harfe ya da noktalamaya yapışık
    let kullanilan = 0;
    // (İşaretin önünde harf, noktalama ya da boşluk olabilir; yanlış eşleşmeyi sıradaki dipnot numarası şartı önler.)
    const isaretle = (l: string) => l.replace(/(\D)(\d{1,2})(?=[”"’\s.,;:!?)]|$)/gu, (m, c: string, n: string) => {
      if (kullanilan < numaralar.length && Number(n) === numaralar[kullanilan]) { kullanilan++; return `${c}⟦${n}⟧`; }
      return m;
    });

    // Sayfa başındaki/sonundaki boş satırlar paragrafı bölmez: paragraf sayfa sınırını aşabilir (girinti yeni paragrafı gösterir).
    while (govde.length && !govde[0].trim()) govde.shift();
    while (govde.length && !govde[govde.length - 1].trim()) govde.pop();
    for (const ham of govde) {
      const t = ham.trim();
      if (!t) { kapat(); continue; }
      if (ATLA.has(t)) { kapat(); continue; }
      if (ALT_BASLIKLAR.has(t)) { kapat(); bolum.ogeler.push({ t: 'alt', m: t }); continue; }
      if (baslikSatiri && t === baslikSatiri) { kapat(); continue; }
      const girinti = ham.length - ham.trimStart().length;
      const yeniParagraf = (girinti >= 3 && girinti <= 8) || (girinti === 0 && t.startsWith('-')) || girinti > 20;
      if (yeniParagraf || !acik) { kapat(); acik = []; }
      acik!.push(isaretle(t));
    }
    if (kullanilan !== numaralar.length) uyarilar.push(`sayfa ${p}: ${numaralar.length} dipnot gövdesi, ${kullanilan} işaret`);
  }
  kapat();
  return bolum;
}

const onSoz = bolumCikar(9, 12, 'Ön Söz', 'ÖN SÖZ');
const hayat = bolumCikar(15, 34, 'Eşrefoğlu Abdullâh Rûmî', 'EŞREFOĞLU ABDULLÂH RÛMÎ',
  [{ t: 'alinti', m: 'Yâ Hazret-i Pîr Eşref-zâde Meded' }]);

writeFileSync(`veri/${KITAP}/sair.json`, JSON.stringify({ kaynakDosyalar: [9, 10, 11, 12, 14, ...Array.from({ length: 20 }, (_, i) => 15 + i)], bolumler: [onSoz, hayat], dipnotlar }, null, 1) + '\n');
const say = (b: Bolum) => b.ogeler.filter((o) => o.t === 'p').length;
console.log(`${KITAP}: Ön Söz ${say(onSoz)} paragraf, Hayatı/Eserleri ${say(hayat)} paragraf, ${dipnotlar.length} dipnot, ${uyarilar.length} uyarı`);
for (const u of uyarilar) console.log('   ', u);
