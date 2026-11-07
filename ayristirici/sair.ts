// Şair ve eser hakkındaki bölümleri (hayatı, dîvân hakkında) ePUB'lardan çıkarır: veri/<kitap>/sair.json
// Girdi: dokum/<kitap>/OEBPS/*.xhtml (değiştirilmez). Görseller ve altyazıları alınmaz.
// Kural (KURALLAR.md): metne dokunulmaz; yalnız boşluk düzeni sadeleşir, dipnotlar ⟦n⟧ ile bağlanır.
// Kullanım: node ayristirici/sair.ts [kitap]   (kitap verilmezse hepsi)
import { readFileSync, writeFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { bosluk } from './ortak.ts';

// kitap -> [dosya öneki, şair/eser hakkındaki dosya numaraları]
const KITAPLAR: Record<string, [string, number[]]> = {
  'yunus-emre': ['YunusEmreDivani', [6, 7, 8]],
  'niyazi-misri': ['NiyaziMisriHalveti', [8, 10]],
  'kaygusuz-abdal': ['KaygusuzAbdal', [6, 8]],
  'ummi-sinan': ['UmmiSinanHalveti', [8]],
  'vahib-ummi': ['VahibUmmiHalveti', [7, 9, 10]],
  'esrefoglu-rumi': ['EsrefogluRumi', [4, 7]],
};

type Oge = { t: 'ust' | 'alt' | 'p' | 'alinti'; m: string };
type Bolum = { baslik: string; ogeler: Oge[] };

function cikar(kitap: string) {
  const [onek, dosyalar] = KITAPLAR[kitap];
  const bolumler: Bolum[] = [];
  const dipnotlar: { no: number; metin: string }[] = [];
  const uyarilar: string[] = [];
  let sayac = 0;

  for (const n of dosyalar) {
    const $ = cheerio.load(readFileSync(`dokum/${kitap}/OEBPS/${onek}-${n}.xhtml`, 'utf8'));
    const gövdeler = new Map<string, string>();
    $('aside.\\_idFootnote').each((_, a) => {
      const p = $(a).find('p');
      p.find('a').remove();
      gövdeler.set($(a).attr('id')!, bosluk(p.text()));
    });
    $('div.\\_idFootnotes').remove();

    const metin = (el: cheerio.Cheerio<any>): string => {
      const c = el.clone();
      c.find('br').replaceWith(' '); // satır sonları (ör. başlık altındaki dörtlük) sözcükleri birbirine yapıştırmasın
      c.find('sup').each((_, s) => {
        const a = $(s).find('a').first();
        const hedef = (a.attr('href') ?? '').split('#')[1];
        // Dipnot bağlantısı olmayan üst simge (ör. "XVI.yy", "m²") dipnot değildir; metni olduğu gibi kalır.
        if (!a.length || !hedef) { $(s).replaceWith($(s).text()); return; }
        const g = gövdeler.get(hedef);
        if (g === undefined) { uyarilar.push(`${onek}-${n}: dipnot gövdesi yok (${hedef})`); $(s).remove(); return; }
        sayac++;
        dipnotlar.push({ no: sayac, metin: g });
        $(s).replaceWith(`⟦${sayac}⟧`);
      });
      return bosluk(c.text());
    };

    const bolum: Bolum = { baslik: '', ogeler: [] };
    $('body > div > *').each((_, e) => {
      const el = $(e);
      const sinif = el.attr('class') ?? '';
      if (e.tagName === 'div' || /^(resim|resimalti|ortaitalik)$/.test(sinif)) return; // görsel ve altyazıları
      const m = metin(el);
      if (!m) return;
      if (e.tagName === 'h1' || sinif === 'ortayazi') {
        if (!bolum.baslik) bolum.baslik = m; else bolum.ogeler.push({ t: 'ust', m });
      } else if (e.tagName === 'h2' || sinif === 'solbaslik') bolum.ogeler.push({ t: 'alt', m });
      else if (/5mmbefore/.test(sinif)) bolum.ogeler.push({ t: 'alinti', m });
      else if (sinif.startsWith('normalnesil') || sinif === 'sagnormal') bolum.ogeler.push({ t: 'p', m });
      else uyarilar.push(`${onek}-${n}: bilinmeyen öğe ${e.tagName}.${sinif}`);
    });
    if (!bolum.baslik) bolum.baslik = `Bölüm ${n}`;
    bolumler.push(bolum);
  }
  writeFileSync(`veri/${kitap}/sair.json`, JSON.stringify({ kaynakDosyalar: dosyalar, bolumler, dipnotlar }, null, 1) + '\n');
  const ogeSayisi = bolumler.reduce((a, b) => a + b.ogeler.length, 0);
  console.log(`${kitap}: ${bolumler.length} bölüm, ${ogeSayisi} öğe, ${dipnotlar.length} dipnot, ${uyarilar.length} uyarı`);
  for (const u of uyarilar.slice(0, 5)) console.log('   ', u);
}

for (const k of process.argv[2] ? [process.argv[2]] : Object.keys(KITAPLAR)) cikar(k);
