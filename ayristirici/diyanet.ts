// Diyanet dîvân serisi (aynı ePUB şablonu) için ortak ayrıştırma çekirdeği.
// Her kitabın kendi betiği (ayristirici/<kitap>.ts) yalnızca hangi dosyada ne olduğunu söyler;
// kitaba özgü tuhaflıklar uyarilar.json ile görünür kılınır.
// Kural (KURALLAR.md): metne dokunulmaz. Şüpheli durumlar düzeltilmez, uyarıya yazılır.
import { readFileSync, writeFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { bosluk } from './ortak.ts';

export type Secenek = {
  kitap: string;
  dosyaOnEki: string; // dokum/<kitap>/OEBPS/<dosyaOnEki>-<n>.xhtml
  siirDosyalari: number[]; // şiirlerin bulunduğu dosyalar; numaralar bunlar boyunca kesintisiz sürer
  kaynak: string; // şiir kimliği öneki (ör. "d")
  // İsteğe bağlı: kitapta numaraları her birinde yeniden 1'den başlayan birden çok bölüm varsa
  // (Eşrefoğlu: Dîvân d, Mesnevîler m, Kıt'alar k). Verilirse siirDosyalari/kaynak yerine bu kullanılır;
  // şiir dizini de numaranın başa dönüşüne göre bu sırayla bölümlere ayrılır.
  bolumler?: { kaynak: string; dosya: number; kita?: boolean }[];
  // kita: true -> numarası "N-" ile ilk dizede basılmış, tek bentli kıt'a bölümü (her kıt'a ayrı şiir, şiir numarası = N).
  dizinDosya: number;
  sozlukDosya: number;
};

type Dipnot = { no: number; siir: string; metin: string };
type Bent = { no: number; dizeler: string[] };
type Siir = {
  id: string; kitap: string; kaynak: string; no: number;
  tur: 'aruz' | 'hece' | 'arapca' | 'belirsiz';
  vezinler: string[]; baslikNotlari: string[];
  bentler: Bent[]; anlamlar: { no: number; metin: string }[];
  kaynakNotu: string | null;
};
type Satir = { c: string; t: string };

const hecePattern = /Heceli/i;
// Aruz kalıbı satırı: her sözcük bir tef'ile adıyla başlar (Müstef'ilün, Mef'ûlü, Fâ'ilâtün, ...)
const tefile = /^(müstef|müfte|müsfe|mef|mâf|fe|fâ|fa)/i;
const vezinMi = (t: string) => hecePattern.test(t) || t.split(' ').every((w) => tefile.test(w));
// Yazma/varak göndermesi: "824/2a.", "AE 797/141b.", "İB K 606/55a.", "N Hk 12/3b; AE 4/1a."
const yazmaNotu = /^((AE|A|İB|K|N|Hk|[A-ZİÇŞĞÖÜ]{1,3})\s+)*\d+(-\d+)?\s*\/\s*\d+\s*[ab]?\.?(\s*[;,]\s*.*)?$/;

export function diyanetAyristir(o: Secenek) {
  const uyarilar: { siir?: string; mesaj: string }[] = [];
  const uyar = (mesaj: string, siir?: string) => uyarilar.push({ siir, mesaj });
  const yol = (n: number) => `dokum/${o.kitap}/OEBPS/${o.dosyaOnEki}-${n}.xhtml`;
  const siirler: Siir[] = [];
  const dipnotlar: Dipnot[] = [];

  let su: Siir | null = null;
  let evre: 'on' | 'bent' = 'on';
  let onSatirlar: Satir[] = [];
  let numarasizlar = new Set<Bent>(); // numarası kitapta basılmamış ilk-dize ile açılan bentler

  const notEkle = (s: Siir, t: string) => { s.kaynakNotu = s.kaynakNotu ? `${s.kaynakNotu}; ${t}` : t; };

  // İlk bent açılırken: şiirin başındaki satırlar vezin ve başlık notlarına ayrılır.
  function onuBitir() {
    if (!su || evre !== 'on') return;
    su.vezinler = onSatirlar.map((s) => s.t).filter(vezinMi);
    su.baslikNotlari = onSatirlar.map((s) => s.t).filter((t) => !vezinMi(t));
    onSatirlar = [];
    evre = 'bent';
  }

  // Hiç numaralı bendi olmayan şiir (kıt'a, müfred, numarasız mersiye): satırlar tek bent olur,
  // girintili ilk dize sınıfı ("5mm") yeni bent başlatır. Hepsi uyarıya yazılır; insan gözüyle bakılmalı.
  function bentsizSiir() {
    if (!su || su.bentler.length || !onSatirlar.length) return;
    const s = onSatirlar;
    const vi = s.findIndex((x) => vezinMi(x.t));
    let govde: Satir[];
    if (vi >= 0) {
      su.vezinler = s.filter((x) => vezinMi(x.t)).map((x) => x.t);
      const sonra = s.slice(vi + 1);
      if (sonra.length) { su.baslikNotlari = s.slice(0, vi).map((x) => x.t); govde = sonra; }
      else { su.baslikNotlari = s.slice(0, 1).map((x) => x.t); govde = s.slice(1, vi); }
    } else {
      const sonKolon = s.map((x) => x.t.endsWith(':')).lastIndexOf(true);
      su.baslikNotlari = s.slice(0, sonKolon + 1).map((x) => x.t);
      govde = s.slice(sonKolon + 1);
    }
    let b: Bent | null = null;
    for (const x of govde) {
      if (!b || /5mm/.test(x.c)) { b = { no: su.bentler.length + 1, dizeler: [] }; su.bentler.push(b); }
      b.dizeler.push(x.t);
    }
    if (govde.some((x) => /5mm/.test(x.c)) === false && su.bentler.length > 1) { /* tek bent */ }
    uyar(`numaralı bent yok; satırlar ${su.bentler.length} bent olarak ayrıldı (sınıfa göre)`, su.id);
    onSatirlar = [];
  }

  // Numarasız ilk dizeler: sıradaki numarada boşluk varsa yeni bent, yoksa önceki bendin devamı.
  function numarasizlariCoz() {
    if (!su || !numarasizlar.size) return;
    const yeni: Bent[] = [];
    const b = su.bentler;
    for (let i = 0; i < b.length; i++) {
      if (!numarasizlar.has(b[i])) { yeni.push(b[i]); continue; }
      const onceki = yeni[yeni.length - 1];
      const sonraki = b.slice(i + 1).find((x) => !numarasizlar.has(x));
      if (onceki && sonraki && sonraki.no === onceki.no + 2) {
        b[i].no = onceki.no + 1; yeni.push(b[i]);
        uyar(`bent numarası kitapta yok; boşluğa göre ${b[i].no} verildi`, su.id);
      } else if (onceki) {
        onceki.dizeler.push(...b[i].dizeler); // önceki bendin devamı (ör. tahmîs bendi)
      } else {
        b[i].no = 1; yeni.push(b[i]);
        uyar('ilk bendin numarası kitapta yok; 1 verildi', su.id);
      }
    }
    su.bentler = yeni;
    numarasizlar = new Set();
  }

  function siiriBitir() {
    if (!su) return;
    if (evre === 'on') bentsizSiir();
    numarasizlariCoz();
  }

  const bolumler = o.bolumler ?? o.siirDosyalari.map((dosya) => ({ kaynak: o.kaynak, dosya }));
  for (const { kaynak, dosya, kita: kitaBolumu } of bolumler) {
    if (su && su.kaynak !== kaynak) { siiriBitir(); su = null; } // yeni bölüm: numara 1'den başlar
    const kita = !!kitaBolumu;
    const $ = cheerio.load(readFileSync(yol(dosya), 'utf8'));
    const dipnotMetni = new Map<string, string>();
    $('aside.\\_idFootnote').each((_, a) => {
      const p = $(a).find('p');
      p.find('a').remove();
      dipnotMetni.set($(a).attr('id')!, bosluk(p.text()));
    });
    $('div.\\_idFootnotes').remove();

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

    let bekleyenBaslik: cheerio.Cheerio<any> | null = null; // kıt'a bölümü: sonraki şiire bağlanacak bölüm başlığı
    $('body > div > p').each((_, e) => {
      const p = $(e);
      const sinif = p.attr('class') ?? '';
      const html = $.html(p);
      const ham = bosluk(p.text());

      if (kita) {
        if (sinif === 'ortayazi') { bekleyenBaslik = p; return; }
        if (sinif === 'resim') return;
        if (sinif === 'normalnesililk') {
          const m = bosluk(p.text()).match(/^(\d+)\.?\s*-?\s*/);
          if (!m) { uyar(`kıt'a numarası okunamadı: ${ham.slice(0, 40)}`, su?.id); return; }
          siiriBitir();
          const no = Number(m[1]);
          su = { id: `${kaynak}-${no}`, kitap: o.kitap, kaynak, no, tur: 'belirsiz', vezinler: [],
            baslikNotlari: [], bentler: [], anlamlar: [], kaynakNotu: null };
          if (siirler.some((x) => x.id === su!.id)) uyar('yinelenen şiir kimliği', su.id);
          siirler.push(su); evre = 'bent'; onSatirlar = [];
          if (bekleyenBaslik) { su.baslikNotlari.push(metinVeDipnot(bekleyenBaslik, su.id)); bekleyenBaslik = null; }
          su.bentler.push({ no: 1, dizeler: [metinVeDipnot(p, su.id).replace(/^\d+\s*-?\s*/, '')] });
          return;
        }
        if (sinif.startsWith('normalnesil') && su) { su.bentler[0].dizeler.push(metinVeDipnot(p, su.id)); return; }
        uyar(`beklenmeyen satır (${sinif}): ${ham.slice(0, 40)}`, su?.id);
        return;
      }

      // Şiir numarası: üst/alt süs görselleri arasındaki rakam ya da yalnız rakamlı "ortaitalik" satırı.
      // Bazı şiirlerde numara iki paragrafa bölünmüş (üst görsel ayrı, rakam+alt görsel ayrı).
      const susVar = /image\/(ust|alt)\.png/.test(html);
      const rakam = ham.match(/^(\d+)$/);
      if ((susVar || sinif === 'ortaitalik') && rakam) {
        siiriBitir();
        const no = Number(rakam[1]);
        su = { id: `${kaynak}-${no}`, kitap: o.kitap, kaynak, no, tur: 'belirsiz', vezinler: [],
          baslikNotlari: [], bentler: [], anlamlar: [], kaynakNotu: null };
        if (siirler.some((x) => x.id === su!.id)) uyar('yinelenen şiir kimliği', su.id);
        siirler.push(su); evre = 'on'; onSatirlar = [];
        return;
      }
      if (susVar && !ham) return; // numaranın yalnız üst süsü
      if (!su) return;
      const id = su.id;

      if (sinif === 'resim') return; // görsel (yazma sayfası vb.); altyazısı "resimalti" olarak alınır
      if (sinif === 'resimalti') { notEkle(su, metinVeDipnot(p, id)); return; }
      if (sinif === 'ortayazi') { uyar(`şiir içinde başlık satırı: ${ham.slice(0, 40)}`, id); return; }

      if (sinif === 'normalnesililk') {
        const t = metinVeDipnot(p, id);
        // "1.-Bu gönül…": kitapta bazı bent numaralarından sonra nokta basılmış (Eşrefoğlu d-1); numara ön ekinin parçası sayılır.
        const m = t.match(/^(\d+)\.?\s*-?\s*(.*)$/s);
        const eksik = !m ? t.match(/^-\s*(.*)$/s) : null;
        if (eksik && eksik[1] && vezinMi(eksik[1]) && su.bentler.length === 0 && evre === 'on') {
          onSatirlar.push({ c: sinif, t: eksik[1] });
          uyar(`vezin satırı ilk-dize sınıfıyla basılmış: ${eksik[1].slice(0, 40)}`, id);
          return;
        }
        onuBitir();
        if (m) {
          su.bentler.push({ no: Number(m[1]), dizeler: [m[2]] });
        } else {
          const b: Bent = { no: su.bentler.length + 1, dizeler: [eksik ? eksik[1] : t] };
          numarasizlar.add(b);
          su.bentler.push(b);
        }
        return;
      }
      if (sinif.startsWith('normalnesil') || sinif === 'indentmetin') {
        const t = metinVeDipnot(p, id);
        if (yazmaNotu.test(t)) { notEkle(su, t); return; }
        if (evre === 'on') { onSatirlar.push({ c: sinif, t }); return; }
        const son = su.bentler[su.bentler.length - 1];
        if (son) { son.dizeler.push(t); return; }
      }
      uyar(`beklenmeyen satır (${sinif}): ${ham.slice(0, 40)}`, id);
    });
    if (kita) {
      for (const x of siirler.filter((x) => x.kaynak === kaynak && x.bentler[0].dizeler.length !== 4)) {
        uyar(`kıt'a ${x.bentler[0].dizeler.length} dizeden oluşuyor (4 beklenir); kitaptaki gibi tek bent bırakıldı`, x.id);
      }
    }
  }
  siiriBitir();

  for (const s of siirler) {
    if (s.vezinler.some((v) => hecePattern.test(v))) s.tur = 'hece';
    else if (s.vezinler.length) s.tur = 'aruz';
  }

  // ---- Şiir dizini ----
  const $d = cheerio.load(readFileSync(yol(o.dizinDosya), 'utf8'));
  const dizin: { kaynak?: string; no: number; ilkDize: string }[] = [];
  const dizinBolumSirasi = [...new Set(bolumler.map((b) => b.kaynak))];
  let dizinBolum = 0, dizinSon = 0;
  $d('body > div > p.normalnesililk').each((_, e) => {
    const t = bosluk($d(e).text());
    const m = t.match(/^(\d+)\.?\s*-?\s*(.*)$/s);
    if (m) {
      const no = Number(m[1]);
      if (dizinBolumSirasi.length > 1) {
        if (no <= dizinSon && dizinBolum < dizinBolumSirasi.length - 1) dizinBolum++; // numara başa döndü: sonraki bölüm
        dizinSon = no;
        dizin.push({ kaynak: dizinBolumSirasi[dizinBolum], no, ilkDize: m[2] });
      } else dizin.push({ no, ilkDize: m[2] });
    }
    else {
      // Numarasız ilk-dize satırı: önceki kaydın ikinci dizesi ilk-dize sınıfıyla basılmış (ör. 102 → "Fenâdan son fenâ buldu").
      uyar(`dizinde numarasız satır önceki kaydın devamı sayıldı: ${t.slice(0, 40)}`);
    }
  });

  // ---- Sözlük ----
  const $s = cheerio.load(readFileSync(yol(o.sozlukDosya), 'utf8'));
  const sozluk: { madde: string; tanim: string }[] = [];
  let sozlukNotu: string | null = null;
  let devam = 0; // önceki maddenin devamı olan satırlar ("2. Bilen, tanıyan.")
  $s('body > div > p.normalnesil').each((_, e) => {
    const p = $s(e);
    const kalin = p.find('span.idebold, span.idebolditalik').first();
    const kalinMadde = kalin.length ? bosluk(kalin.text()).replace(/:$/, '') : '';
    if (kalinMadde) {
      kalin.remove();
      sozluk.push({ madde: kalinMadde, tanim: bosluk(p.text()) });
      return;
    }
    // Bu kitaplarda maddeler çoğu zaman kalın yazılmamış: "Abâ: Yünden yapılan ..."
    const t = bosluk(p.text());
    const m = t.match(/^([^:]{1,45}):\s*(.*)$/s);
    if (m && !/^\d/.test(t) && !/[.!?]/.test(m[1].replace(/\b(Hz|bk|C)\./g, ''))) {
      sozluk.push({ madde: m[1].trim(), tanim: m[2] });
      return;
    }
    if (sozluk.length === 0) { if (sozlukNotu === null) sozlukNotu = t; return; }
    // Maddesiz satır: öncekinin devamıdır (numaralı ikinci anlam gibi). Yapı korunur, sayısı notta tutulur.
    sozluk[sozluk.length - 1].tanim += ` ${t}`;
    devam++;
  });
  if (devam) uyar(`sözlükte ${devam} satır önceki maddenin devamı sayıldı (maddesiz satır)`);

  const yaz = (ad: string, v: unknown) => writeFileSync(`veri/${o.kitap}/${ad}.json`, JSON.stringify(v, null, 1) + '\n');
  yaz('siirler', siirler);
  yaz('dipnotlar', dipnotlar);
  yaz('siir-dizini', dizin);
  yaz('sozluk', sozluk);
  yaz('sozluk-notu', { metin: sozlukNotu });
  yaz('uyarilar', uyarilar);
  console.log(`${o.kitap}: ${siirler.length} şiir, ${dipnotlar.length} dipnot, ${dizin.length} dizin kaydı, ${sozluk.length} sözlük maddesi, ${uyarilar.length} uyarı`);
  return { siirler, dipnotlar, dizin, sozluk, uyarilar };
}
