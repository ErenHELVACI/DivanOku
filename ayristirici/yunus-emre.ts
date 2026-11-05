// 3. adım: Yûnus Emre Dîvânı (Seçmeler) için kitaba özel ayrıştırıcı.
// Girdi: dokum/yunus-emre/OEBPS/*.xhtml (değiştirilmez). Çıktı: veri/yunus-emre/*.json
// Kitapta iki şiir bölümü var ve numaraları her birinde 1'den başlar (kılavuzdaki numara tuzağı):
//   dosya 9  -> "Yûnus Emre Dîvânı Seçmeler"            kaynak öneki "d" (d-1 … d-247)
//   dosya 12 -> "Âşık Yûnus'un Şiirlerinden Seçmeler"  kaynak öneki "a" (a-1 … a-21)
// Kural: metne dokunulmaz. Şüpheli durumlar düzeltilmez, "uyarilar" listesine yazılır.
import { readFileSync, writeFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { bosluk } from './ortak.ts';

const KITAP = 'yunus-emre';
const yol = (n: number) => `dokum/${KITAP}/OEBPS/YunusEmreDivani-${n}.xhtml`;
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

const siirler: Siir[] = [];
const dipnotlar: Dipnot[] = [];

function bolum(dosya: number, kaynak: string) {
  const $ = cheerio.load(readFileSync(yol(dosya), 'utf8'));
  const dipnotMetni = new Map<string, string>();
  $('aside.\_idFootnote').each((_, a) => {
    const p = $(a).find('p');
    p.find('a').remove();
    dipnotMetni.set($(a).attr('id')!, bosluk(p.text()));
  });
  $('div.\_idFootnotes').remove();

  let su: Siir | null = null;
  let sonBent: Bent | null = null;
  const baslarken = new Set<string>();

  const metinVeDipnot = (el: cheerio.Cheerio<any>, siirId: string): string => {
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
  };

  $('body > div > p').each((_, e) => {
    const p = $(e);
    const sinif = p.attr('class') ?? '';
    const ham = bosluk(p.text());
    if (sinif === 'ortaitalik' && /^\d+$/.test(ham)) {
      const no = Number(ham);
      su = { id: `${kaynak}-${no}`, kitap: KITAP, kaynak, no, tur: 'belirsiz', vezinler: [],
        baslikNotlari: [], bentler: [], anlamlar: [], kaynakNotu: null };
      if (baslarken.has(su.id)) uyar('yinelenen şiir kimliği', su.id);
      baslarken.add(su.id);
      siirler.push(su); sonBent = null;
      return;
    }
    if (!su) { uyar(`ilk şiirden önce beklenmeyen satır (${sinif}): ${ham.slice(0, 40)}`); return; }
    const id = su.id;
    if (sinif === 'normalnesil5mmbefore') {
      if (sonBent) uyar(`bent içinde vezin satırı: ${ham.slice(0, 40)}`, id);
      su.vezinler.push(metinVeDipnot(p, id));
      return;
    }
    if (sinif === 'normalnesililk') {
      const t = metinVeDipnot(p, id);
      const m = t.match(/^(\d+) (.*)$/);
      if (m) {
        sonBent = { no: Number(m[1]), dizeler: [m[2]] };
        su.bentler.push(sonBent);
      } else if (sonBent) sonBent.dizeler.push(t); // numarasız ilk-dize sınıfı: aynı bendin devamı
      else uyar(`numarasız ilk dize, bent yok: ${t.slice(0, 40)}`, id);
      return;
    }
    if (sinif === 'normalnesil') {
      const t = metinVeDipnot(p, id);
      if (sonBent) sonBent.dizeler.push(t);
      else su.baslikNotlari.push(t);
      return;
    }
    uyar(`bilinmeyen sınıf: ${sinif}: ${ham.slice(0, 40)}`, id);
  });
}

bolum(9, 'd');
bolum(12, 'a');

for (const s of siirler) s.tur = s.vezinler.length ? 'aruz' : 'belirsiz';

// ---------- Şiir dizini (dosya 14): yalnızca "d" bölümü için ----------
const $d = cheerio.load(readFileSync(yol(14), 'utf8'));
const dizin: { no: number; ilkDize: string }[] = [];
$d('body > div > p.normalnesil').each((_, e) => {
  const m = bosluk($d(e).text()).match(/^(\d+) (.*)$/);
  if (m) dizin.push({ no: Number(m[1]), ilkDize: m[2] });
  else uyar(`dizinde numarasız satır: ${bosluk($d(e).text()).slice(0, 40)}`);
});

// ---------- Sözlük (dosya 17) ----------
const $s = cheerio.load(readFileSync(yol(17), 'utf8'));
const sozluk: { madde: string; tanim: string }[] = [];
let sozlukNotu: string | null = null;
$s('body > div > p.normalnesil').each((_, e) => {
  const p = $s(e);
  const kalin = p.find('span.idebold, span.idebolditalik').first();
  if (!kalin.length) {
    if (sozluk.length === 0 && sozlukNotu === null) { sozlukNotu = bosluk(p.text()); return; }
    uyar(`sözlükte maddesiz satır: ${bosluk(p.text()).slice(0, 60)}`);
    return;
  }
  const madde = bosluk(kalin.text()).replace(/:$/, '');
  kalin.remove();
  sozluk.push({ madde, tanim: bosluk(p.text()) });
});

const yaz = (ad: string, v: unknown) =>
  writeFileSync(`veri/${KITAP}/${ad}.json`, JSON.stringify(v, null, 1) + '\n');
yaz('siirler', siirler);
yaz('dipnotlar', dipnotlar);
yaz('siir-dizini', dizin);
yaz('sozluk', sozluk);
yaz('sozluk-notu', { metin: sozlukNotu });
yaz('uyarilar', uyarilar);
const d = siirler.filter((s) => s.kaynak === 'd').length;
const a = siirler.filter((s) => s.kaynak === 'a').length;
console.log(`${KITAP}: ${d} d-şiir + ${a} a-şiir, ${dipnotlar.length} dipnot, ${dizin.length} dizin kaydı, ${sozluk.length} sözlük maddesi, ${uyarilar.length} uyarı`);
