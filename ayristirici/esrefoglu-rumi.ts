// Eşrefoğlu Rûmî Dîvân-ı İlâhiyât: PDF kaynaklı (ePUB yok), kitaba özel ayrıştırıcı.
// Girdi (hiçbiri değiştirilmez): dokum/esrefoglu-rumi/metin-layout.txt (pdftotext -enc UTF-8 -layout),
//                                 dokum/esrefoglu-rumi/ogeler.json (pdf.js; çift sütunlu sözlük için konumlar).
// Kitap üç bölümden oluşur; numaralar her bölümde 1'den başlar:
//   d: Dîvân-ı İlâhiyât (">N" işaretli, 135 şiir)   m: Mesnevîler (">N", 7)   k: Kıt'alar (numaralı dörtlükler, 64)
// Kural: metne dokunulmaz. Şüpheli durumlar düzeltilmez, uyarılara yazılır.
import { readFileSync, writeFileSync } from 'node:fs';
import { bosluk } from './ortak.ts';

const KITAP = 'esrefoglu-rumi';
const uyarilar: { siir?: string; mesaj: string }[] = [];
const uyar = (mesaj: string, siir?: string) => uyarilar.push({ siir, mesaj });

type Dipnot = { no: number; siir: string; metin: string };
type Bent = { no: number; dizeler: string[] };
type Siir = {
  id: string; kitap: string; kaynak: string; no: number;
  tur: 'aruz' | 'hece' | 'arapca' | 'belirsiz';
  vezinler: string[]; baslikNotlari: string[];
  bentler: Bent[]; anlamlar: { no: number; metin: string }[];
  kaynakNotu: string | null;
};

// pdftotext Windows'ta satır sonlarını CRLF yazar; yalnız satır sonu işareti atılır, metin değişmez.
const sayfalar = readFileSync(`dokum/${KITAP}/metin-layout.txt`, 'utf8').replace(/\r/g, '').split('\f');
const bos = (s: string) => s.trim() === '';
const yalniz = (i: number) => sayfalar[i].split('\n').map((l) => l.trim()).filter(Boolean);
const tekSatirSayfa = (metin: string, sonra = 0) =>
  sayfalar.findIndex((_, i) => i > sonra && yalniz(i).length === 1 && yalniz(i)[0] === metin);

const bas = sayfalar.findIndex((p) => /^\s*>\s*1\s*$/m.test(p));
const dizinBas = tekSatirSayfa('ŞİİR DİZİNİ', bas);
const sozlukBas = tekSatirSayfa('SÖZLÜK', dizinBas);
const kaynakBas = tekSatirSayfa('KAYNAKLAR', sozlukBas);
if ([bas, dizinBas, sozlukBas, kaynakBas].some((x) => x < 0)) throw new Error('bölüm sayfaları bulunamadı');

// Sayfa üst bilgisi: "82  EŞREFOĞLU ABDULLÂH RÛMÎ", "DÎVÂN-I İLÂHİYÂT  83", yalnız sayfa numarası, bölüm başlığı
const ustBilgi = /^\s*(\d+\s+EŞREFOĞLU ABDULLÂH RÛMÎ|DÎVÂN-I İLÂHİYÂT(\s+\d+)?|\d+)\s*$/;
// Dipnot işareti: kelimenin sonuna yapışık 1-2 haneli rakam ("anla1", "KIT’ALAR1")
const isaretRe = /([\p{L}’‘”"»)])(\d{1,2})(?=[\s.,;:!?)]|$)/gu;

const siirler: Siir[] = [];
const dipnotlar: Dipnot[] = [];
let bolum: 'd' | 'm' | 'k' = 'd';
let su: Siir | null = null;
let sonBent: Bent | null = null;
let dipnotSayaci = 0;
let numarasizBentler = false; // bu şiirde bentler numarasız (satır çiftleri boş satırla ayrılmış)
const sonNo: Record<string, number> = { d: 0, m: 0, k: 0 };

function yeniSiir(kaynak: string, no: number) {
  if (no <= sonNo[kaynak]) {
    const yeni = sonNo[kaynak] + 1;
    uyar(`kitapta numara ${no} yinelenmiş (önceki ${sonNo[kaynak]}); sıraya göre ${yeni} verildi`, `${kaynak}-${yeni}`);
    no = yeni;
  } else if (no !== sonNo[kaynak] + 1) {
    uyar(`numara atlamış: ${sonNo[kaynak]} → ${no}`, `${kaynak}-${no}`);
  }
  sonNo[kaynak] = no;
  su = { id: `${kaynak}-${no}`, kitap: KITAP, kaynak, no, tur: 'belirsiz', vezinler: [], baslikNotlari: [], bentler: [], anlamlar: [], kaynakNotu: null };
  siirler.push(su); sonBent = null;
  return su;
}

const notEkle = (s: Siir, t: string) => { s.kaynakNotu = s.kaynakNotu ? `${s.kaynakNotu}; ${t}` : t; };
const birlestir = (satirlar: string[]) => satirlar.map((s) => s.trim()).reduce((a, b) => (a.endsWith('-') && !a.endsWith(' -') ? a.slice(0, -1) + b : a ? `${a} ${b}` : b), '');
let bekleyenBaslik: string | null = null; // bölüm başlığı: o bölümün ilk şiirine başlık notu olur

for (let p = bas; p < dizinBas; p++) {
  // Boş satırlar blok sınırı olarak korunur; yalnız satır sonu boşlukları atılır.
  const satirlar = sayfalar[p].split('\n').filter((l) => !ustBilgi.test(l)).map((l) => l.replace(/\s+$/, ''));

  // Bu sayfadaki dipnot işaretleri: kitapta basılı numaralar (bölüm içinde sürer, Kıt'alar'da yeniden 1'den başlar)
  const basili = [...satirlar.join('\n').matchAll(isaretRe)].map((m) => Number(m[2]));
  const k = basili.length;
  // Dipnot gövdeleri sayfanın sonundadır: sondan başlayarak her numaranın SON "n metin" satırı bulunur
  const govdeler: string[] = [];
  let icerik = satirlar;
  if (k > 0) {
    const baslangic: number[] = [];
    let ara = satirlar.length;
    for (let j = k - 1; j >= 0; j--) {
      let i = ara - 1;
      while (i >= 0 && !(new RegExp(`^${basili[j]}\\s`).test(satirlar[i]) && !/^\s/.test(satirlar[i]))) i--;
      if (i < 0) break;
      baslangic[j] = i; ara = i;
    }
    if (baslangic.length === k && baslangic.every((x) => x !== undefined)) {
      for (let j = 0; j < k; j++) {
        const son = j + 1 < k ? baslangic[j + 1] : satirlar.length;
        const parca = satirlar.slice(baslangic[j], son).filter((l) => !bos(l));
        govdeler.push(birlestir([parca[0].replace(/^\d+\s+/, ''), ...parca.slice(1)]));
      }
      icerik = satirlar.slice(0, baslangic[0]);
    } else uyar(`sayfa ${p}: ${k} dipnot işareti (${basili.join(',')}) var ama dipnot satırları bulunamadı`);
  }

  let sayfaIsaret = 0;
  const isaretle = (satir: string, siirId: string) => satir.replace(isaretRe, (_m, harf: string) => {
    const g = govdeler[sayfaIsaret++];
    if (g === undefined) { uyar(`sayfa ${p}: dipnot gövdesi yok`, siirId); return harf; }
    dipnotSayaci++;
    dipnotlar.push({ no: dipnotSayaci, siir: siirId, metin: g });
    return `${harf}⟦${dipnotSayaci}⟧`;
  });

  let blokBasi = true;
  for (let li = 0; li < icerik.length; li++) {
    const ham = icerik[li];
    if (bos(ham)) { blokBasi = true; continue; }
    const t = ham.trim();
    const girintili = /^\s{3,}/.test(ham);
    const idHedef = su?.id ?? `${bolum}-?`;
    const ilkBlok = blokBasi; blokBasi = false;
    const sonrakiSatir = icerik.slice(li + 1).find((x) => !bos(x)) ?? '';

    let m = t.match(/^>\s*(\d+)$/);
    if (m) {
      yeniSiir(bolum, Number(m[1])); numarasizBentler = false;
      if (bekleyenBaslik && su) { su.baslikNotlari.push(bekleyenBaslik); bekleyenBaslik = null; }
      continue;
    }
    if (t === 'MESNEVÎLER') { bolum = 'm'; su = null; bekleyenBaslik = t; continue; }
    const kt = t.match(/^KIT’ALAR(\d*)$/);
    if (kt) {
      bolum = 'k'; su = null;
      // Başlığın sonundaki dipnot işareti de metnin parçası: birinci kıt'anın başlık notunda tutulur.
      bekleyenBaslik = isaretle(t, 'k-1');
      continue;
    }
    if (!girintili && /^(Dîvân|Dîvân-ı)/.test(t) && /(Yz\.|vr\.|Ktp\.)/.test(t)) {
      if (su) notEkle(su, t); else uyar(`şiirsiz kaynak notu: ${t.slice(0, 40)}`);
      continue;
    }
    m = ham.match(/^(\d+)\.?\s+(.*)$/);
    if (m && !girintili) {
      const metin = m[2];
      if (bolum === 'k') {
        yeniSiir('k', Number(m[1]));
        if (bekleyenBaslik && su) { su.baslikNotlari.push(bekleyenBaslik); bekleyenBaslik = null; }
        sonBent = { no: 1, dizeler: [] };
        su!.bentler.push(sonBent);
        sonBent.dizeler.push(isaretle(metin, su!.id));
      } else {
        if (!su) { uyar(`şiir işareti yokken bent: ${t.slice(0, 40)}`); continue; }
        sonBent = { no: Number(m[1]), dizeler: [isaretle(metin, su.id)] };
        su.bentler.push(sonBent);
      }
      continue;
    }
    if (girintili && su) {
      // Numaralı ilk dizeden önce, hemen ardından numaralı bent gelen tek satır: şiirin başlığı (ör. "Münâcât")
      if (!sonBent && /^(\d+)\.?\s+/.test(sonrakiSatir) && !/^\s/.test(sonrakiSatir)) { su.baslikNotlari.push(isaretle(t, su.id)); continue; }
      // Numarasız bentler: her blok yeni bent
      if (!sonBent || (numarasizBentler && ilkBlok)) {
        if (!numarasizBentler) uyar('numaralı bent yok; satır grupları (boş satırla ayrılmış) bent olarak alındı', su.id);
        numarasizBentler = true;
        sonBent = { no: su.bentler.length + 1, dizeler: [] };
        su.bentler.push(sonBent);
      }
      sonBent.dizeler.push(isaretle(t, idHedef));
      continue;
    }
    uyar(`beklenmeyen satır: ${t.slice(0, 50)}`, su?.id);
  }
  if (sayfaIsaret !== govdeler.length) uyar(`sayfa ${p}: ${govdeler.length} dipnot gövdesi, ${sayfaIsaret} işaret`);
}

// ---------- Şiir dizini (düzen metni) ----------
const dizin: { kaynak: string; no: number; ilkDize: string }[] = [];
let dbolum: 'd' | 'm' | 'k' = 'd';
for (let p = dizinBas; p < sozlukBas; p++) {
  for (const ham of sayfalar[p].split('\n')) {
    const t = ham.trim();
    if (!t || ustBilgi.test(ham) || t === 'ŞİİR DİZİNİ') continue;
    if (t === 'MESNEVÎLER') { dbolum = 'm'; continue; }
    if (/^KIT’ALAR/.test(t)) { dbolum = 'k'; continue; }
    const m = ham.match(/^(\d+)\.?\s+(.*)$/);
    if (m && !/^\s{3,}/.test(ham)) dizin.push({ kaynak: dbolum, no: Number(m[1]), ilkDize: m[2].trim() });
  }
}

// ---------- Sözlük (pdf.js konumlarından, iki sütun) ----------
type Oge = { s: string; x: number; y: number; g: number };
const ogeSayfalari: { genislik: number; yukseklik: number; ogeler: Oge[] }[] = JSON.parse(readFileSync(`dokum/${KITAP}/ogeler.json`, 'utf8'));
const sozluk: { madde: string; tanim: string }[] = [];
const sozlukSatirlari: string[] = [];
for (let p = sozlukBas + 1; p < kaynakBas; p++) {
  const s = ogeSayfalari[p];
  const govde = s.ogeler.filter((o) => o.y < s.yukseklik * 0.9); // üst bilgi (sayfa no, "DÎVÂN-I İLÂHİYÂT") dışarıda
  const yGruplari: Oge[][] = [];
  for (const o of [...govde].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const g = yGruplari.find((x) => Math.abs(x[0].y - o.y) < 1.5);
    if (g) g.push(o); else yGruplari.push([o]);
  }
  // Her y grubunu sütun boşluğundan böl; parçanın başlangıç x'ine göre sütuna ata
  const orta = s.genislik / 2;
  const sutunlar: { x: number; y: number; metin: string }[][] = [[], []];
  for (const g of yGruplari) {
    g.sort((a, b) => a.x - b.x);
    const parcalar: Oge[][] = [[g[0]]];
    for (let i = 1; i < g.length; i++) {
      const onceki = g[i - 1];
      if (g[i].x - (onceki.x + onceki.g) > 8) parcalar.push([g[i]]); else parcalar[parcalar.length - 1].push(g[i]);
    }
    for (const pr of parcalar) {
      let metin = '';
      let sonSag = pr[0].x;
      for (const o of pr) { metin += (o.x - sonSag > 0.9 && metin ? ' ' : '') + o.s; sonSag = o.x + o.g; }
      sutunlar[pr[0].x < orta - 6 ? 0 : 1].push({ x: pr[0].x, y: pr[0].y, metin: metin.replace(/\s+/g, ' ').trim() });
    }
  }
  for (const sutun of sutunlar) for (const l of sutun.sort((a, b) => b.y - a.y)) sozlukSatirlari.push(l.metin);
}
const harfBasligi = /^[A-ZÂÎÛÇŞĞÖÜİ]$/;
const maddeRe = /^(\S.{0,44}?)\s*\(([^()]{1,10})\):\s*(.*)$/;
for (const t of sozlukSatirlari) {
  if (!t || harfBasligi.test(t)) continue;
  const m = t.match(maddeRe);
  if (m) { sozluk.push({ madde: `${m[1].trim()} (${m[2]})`, tanim: m[3] }); continue; }
  if (!sozluk.length) { uyar(`sözlükte ilk maddeden önce satır: ${t.slice(0, 40)}`); continue; }
  const son = sozluk[sozluk.length - 1];
  son.tanim = son.tanim.endsWith('-') ? son.tanim.slice(0, -1) + t : `${son.tanim} ${t}`; // satır sonu tireleme birleştirilir
}

for (const sp of siirler) sp.tur = 'belirsiz'; // kitapta vezin satırı basılmamış

const yaz = (ad: string, v: unknown) => writeFileSync(`veri/${KITAP}/${ad}.json`, JSON.stringify(v, null, 1) + '\n');
yaz('siirler', siirler);
yaz('dipnotlar', dipnotlar);
yaz('siir-dizini', dizin);
yaz('sozluk', sozluk);
yaz('uyarilar', uyarilar);
const say = (k: string) => siirler.filter((x) => x.kaynak === k).length;
console.log(`${KITAP}: d:${say('d')} m:${say('m')} k:${say('k')} şiir, ${dipnotlar.length} dipnot, ${dizin.length} dizin kaydı, ${sozluk.length} sözlük maddesi, ${uyarilar.length} uyarı`);
