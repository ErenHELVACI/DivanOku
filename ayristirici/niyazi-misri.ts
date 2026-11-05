// 3. adım: Niyâzî-i Mısrî Halvetî Dîvânı'na özel ayrıştırıcı.
// Girdi: dokum/niyazi-misri/OEBPS/*.xhtml (değiştirilmez). Çıktı: veri/niyazi-misri/*.json
// Kural: metne dokunulmaz. Şüpheli durumlar düzeltilmez, "uyarilar" listesine yazılır.
import { readFileSync, writeFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { bosluk } from './ortak.ts';

const KITAP = 'niyazi-misri';
const D = `dokum/${KITAP}/OEBPS/NiyaziMisriHalveti-`;
const uyarilar: { siir?: string; mesaj: string }[] = [];
const uyar = (mesaj: string, siir?: string) => uyarilar.push({ siir, mesaj });

function yukle(n: number) {
  return cheerio.load(readFileSync(`${D}${n}.xhtml`, 'utf8'));
}

type Dipnot = { no: number; siir: string; metin: string };
type Bent = { no: number; dizeler: string[] };
type Siir = {
  id: string; kitap: string; kaynak: string; no: number;
  tur: 'aruz' | 'hece' | 'arapca' | 'belirsiz';
  vezinler: string[]; baslikNotlari: string[];
  bentler: Bent[]; anlamlar: { no: number; metin: string }[];
  kaynakNotu: string | null;
};

// ---------- Dîvân (dosya 12) ----------
const $ = yukle(12);
const dipnotMetni = new Map<string, string>(); // aside id -> metin
$('aside.\_idFootnote').each((_, a) => {
  const p = $(a).find('p');
  p.find('a').remove();
  dipnotMetni.set($(a).attr('id')!, bosluk(p.text()));
});
$('div.\_idFootnotes').remove();

const siirler: Siir[] = [];
const dipnotlar: Dipnot[] = [];
let su: Siir | null = null;
let evre: 'on' | 'bent' | 'anlam' | 'son' = 'on';
let sonBent: Bent | null = null;
let bekleyenGorsel: string | null = null;
const onSatirlar: string[] = [];

const hecePattern = /\d+\s*Heceli/i;
// Aruz kalıbı satırı: her sözcük bir tef'ile adıyla başlar (Müstef'ilün, Mef'ûlü, Fâ'ilâtün, ...)
const tefile = /^(müstef|müfte|mef|fe|fâ|fa)/i;
const vezinMi = (t: string) =>
  hecePattern.test(t) || t.split(' ').every((w) => tefile.test(w));

// Şiirin başındaki satırlar: vezin satır(lar)ı ve başlık notları. Sıra kitaptaki gibi korunur.
function onuBitir() {
  if (!su || evre !== 'on') return; // yalnız bent öncesi evresinde, bir kez
  su.vezinler = onSatirlar.filter(vezinMi);
  su.baslikNotlari = onSatirlar.filter((t) => !vezinMi(t));
  onSatirlar.length = 0;
}

function metinVeDipnot(el: cheerio.Cheerio<any>, siirId: string): string {
  const c = el.clone();
  c.find('sup').each((_, s) => {
    const a = $(s).find('a').first();
    const no = Number(a.text().replace(/\D/g, ''));
    const hedef = (a.attr('href') ?? '').split('#')[1];
    const m = dipnotMetni.get(hedef);
    if (m === undefined) uyar(`dipnot gövdesi bulunamadı: ${hedef}`, siirId);
    else dipnotlar.push({ no, siir: siirId, metin: m });
    $(s).replaceWith(`⟦${no}⟧`);
  });
  return bosluk(c.text());
}

$('body > div > p').each((_, e) => {
  const p = $(e);
  const sinif = p.attr('class') ?? '';
  const ham = bosluk(p.text());
  if (sinif === 'ortayazi') return; // kitap başlığı
  if (sinif === 'ortaitalik' && /^\d+$/.test(ham)) {
    onuBitir();
    const no = Number(ham);
    su = { id: `d-${no}`, kitap: KITAP, kaynak: 'd', no, tur: 'belirsiz', vezinler: [],
      baslikNotlari: [], bentler: [], anlamlar: [], kaynakNotu: null };
    siirler.push(su); evre = 'on'; sonBent = null; bekleyenGorsel = null;
    return;
  }
  if (!su) return;
  const id = su.id;
  if (sinif === 'resim') {
    if (evre === 'on') onuBitir();
    const src = p.find('img').attr('src') ?? '';
    bekleyenGorsel = src;
    evre = src.endsWith('124.png') || src.endsWith('127.png') ? 'anlam' : 'son';
    return;
  }
  if (sinif === 'resimalti') { su.kaynakNotu = metinVeDipnot(p, id); return; }
  if (sinif === 'normalnesililk') {
    if (evre === 'on') onuBitir();
    const t = metinVeDipnot(p, id);
    const m = t.match(/^(\d+) (.*)$/);
    if (m) {
      sonBent = { no: Number(m[1]), dizeler: [m[2]] };
      su.bentler.push(sonBent);
    } else if (sonBent) {
      sonBent.dizeler.push(t); // numarasız ilk-dize sınıfı: aynı bendin devamı
    } else uyar(`numarasız ilk dize, bent yok: ${t.slice(0, 40)}`, id);
    evre = 'bent';
    return;
  }
  if (sinif === 'normalnesil') {
    const t = metinVeDipnot(p, id);
    if (evre === 'on') { onSatirlar.push(t); return; }
    if (evre === 'bent') {
      if (sonBent) sonBent.dizeler.push(t); else uyar('bent öncesi dize', id);
      return;
    }
    if (evre === 'anlam') {
      const m = t.match(/^(\d+) (.*)$/);
      if (m) su.anlamlar.push({ no: Number(m[1]), metin: m[2] });
      else uyar(`numarasız anlam satırı: ${t.slice(0, 40)}`, id);
      return;
    }
    uyar(`görselden sonra beklenmeyen satır: ${t.slice(0, 40)}`, id);
    return;
  }
  uyar(`bilinmeyen sınıf: ${sinif}`, id);
});
onuBitir();

// tür: Arapça (anlam bloğu olan) / hece ("N Heceli") / aruz (diğer vezinli) / belirsiz (vezin yok)
for (const s of siirler) {
  if (s.anlamlar.length) s.tur = 'arapca';
  else if (s.vezinler.some((v) => hecePattern.test(v))) s.tur = 'hece';
  else if (s.vezinler.length) s.tur = 'aruz';
  else s.tur = 'belirsiz';
}

// ---------- Şiir dizini (dosya 14) ----------
const $d = yukle(14);
const dizin: { no: number; ilkDize: string }[] = [];
$d('body > div > p.normalnesililk').each((_, e) => {
  const m = bosluk($d(e).text()).match(/^(\d+) (.*)$/);
  if (m) dizin.push({ no: Number(m[1]), ilkDize: m[2] });
});

// ---------- Sözlük (dosya 16) ----------
const $s = yukle(16);
const sozluk: { madde: string; tanim: string }[] = [];
$s('body > div > p.normalnesil').each((_, e) => {
  const p = $s(e);
  const kalin = p.find('span.idebold').first();
  const madde = bosluk(kalin.text()).replace(/:$/, '');
  kalin.remove();
  const tanim = bosluk(p.text());
  if (!madde) { uyar(`sözlükte maddesiz satır: ${tanim.slice(0, 40)}`); return; }
  sozluk.push({ madde, tanim });
});

const yaz = (ad: string, v: unknown) =>
  writeFileSync(`veri/${KITAP}/${ad}.json`, JSON.stringify(v, null, 1) + '\n');
yaz('siirler', siirler);
yaz('dipnotlar', dipnotlar);
yaz('siir-dizini', dizin);
yaz('sozluk', sozluk);
yaz('uyarilar', uyarilar);
console.log(`${KITAP}: ${siirler.length} şiir, ${dipnotlar.length} dipnot, ${dizin.length} dizin kaydı, ${sozluk.length} sözlük maddesi, ${uyarilar.length} uyarı`);
