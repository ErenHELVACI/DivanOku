// Birleşik sözlük: altı kitabın sözlüğü yan yana durur, TANIMLAR BİRLEŞTİRİLMEZ.
// Her madde kendi kitabının etiketiyle (şair adı) taşınır; anlamlar kitaplardan olduğu gibi alınır.
import { kitaplar } from './veri.ts';
import { normallestir } from './normallestir.ts';

export type KaynakliMadde = { kitap: string; sair: string; madde: string; tanim: string };
export type SozlukGrubu = { anahtar: string; baslik: string; harf: string; maddeler: KaynakliMadde[] };

const dilEki = /\s*\([^)]*\)\s*$/; // "(f)", "(a)", "(f. a)" gibi dil etiketi

let tumMaddeler: KaynakliMadde[] | null = null;
function maddeler(): KaynakliMadde[] {
  if (tumMaddeler) return tumMaddeler;
  tumMaddeler = [];
  for (const k of kitaplar()) {
    const gorulen = new Set<string>();
    for (const m of k.sozluk) {
      if (!m.tanim) continue; // boş tanımlı madde gösterilmez
      const anahtar = `${m.madde}\u0000${m.tanim}`;
      if (gorulen.has(anahtar)) continue; // aynı kitapta birebir yinelenen
      gorulen.add(anahtar);
      tumMaddeler.push({ kitap: k.kunye.slug, sair: k.kunye.sair, madde: m.madde, tanim: m.tanim });
    }
  }
  return tumMaddeler;
}

// Şiirdeki kelimenin eşleşeceği tek kelimelik yazılışlar (tüm kitaplar):
// "âb(f)" -> "âb"; "Âbâd/âbâdân(f)" -> iki yazılış; çok kelimeli ya da tireli maddeler hariç.
let tek: Map<string, KaynakliMadde[]> | null = null;
export function tekKelimeIndeksi(): Map<string, KaynakliMadde[]> {
  if (tek) return tek;
  tek = new Map();
  for (const m of maddeler()) {
    for (const parca of m.madde.replace(dilEki, '').split('/')) {
      const p = parca.trim();
      if (!p || /\s/.test(p)) continue; // boşluklu (çok kelimeli) maddeler dizeye otomatik eşleşmez
      const a = normallestir(p);
      if (!a) continue;
      // Tireli madde ("Bed-nâm") hem tireli hem tiresiz yazılışla aranabilir ("bed-nam", "bednam").
      for (const anahtar of new Set([a, a.replace(/-/g, '')])) {
        if (!anahtar || anahtar === '-') continue;
        const liste = tek.get(anahtar) ?? [];
        if (!liste.includes(m)) liste.push(m);
        tek.set(anahtar, liste);
      }
    }
  }
  return tek;
}

// Tüm sözlük sayfası: tam madde başına (tireli ve çok kelimeli dahil) gruplanır, Türkçe harf sırasıyla.
let genel: SozlukGrubu[] | null = null;
export function genelSozluk(): SozlukGrubu[] {
  if (genel) return genel;
  const gruplar = new Map<string, SozlukGrubu>();
  for (const m of maddeler()) {
    const baslik = m.madde.replace(dilEki, '').trim();
    const anahtar = normallestir(baslik);
    if (!anahtar) continue;
    let g = gruplar.get(anahtar);
    if (!g) {
      const harf = (anahtar.match(/\p{L}/u)?.[0] ?? '#').toLocaleUpperCase('tr');
      g = { anahtar, baslik, harf, maddeler: [] };
      gruplar.set(anahtar, g);
    }
    g.maddeler.push(m);
  }
  genel = [...gruplar.values()].sort((a, b) => a.anahtar.localeCompare(b.anahtar, 'tr'));
  return genel;
}

// Bir sözcüğün farklı anlamları: kaynak kitap gösterilmez ve hiçbir anlam iki kez yazılmaz.
// Her tanım önce ayrı anlamlara bölünür ("1. … 2. …", ";" ve cümle sonları), her anlam virgüllü eş anlam
// parçalarına ayrılır; daha önce gösterilmiş bir parça tekrar gösterilmez, boşalan anlam hiç gösterilmez.
// Sözcüklerin kendisi değişmez; yalnız yinelenenler ayıklanır ve noktalama yeniden kurulur.
// `once`: okunan kitap. Onun anlamları önce işlenir ve `k: true` ile işaretlenir (arayüzde altı çizilir).
export type Anlam = { t: string; k: boolean };

const KISALTMA = /\b(Hz|bk|Bk|C|vb|vs|Bl|Yz|Ktp|nr|vr|Hk|Nu|s|S|ö|b|a|f|t)\.(?=\s)/g;
const DIL_ETIKETI = /^\(\s*[aft]\.?(\s*[aft]\.?)?\s*\)\s*/i;

function anlamlaraBol(tanim: string): string[] {
  let x = tanim.replace(DIL_ETIKETI, '').replace(KISALTMA, (m) => m.replace('.', '\u0001'));
  x = x.replace(/(^|[\s.;!?])\d{1,2}\.\s+(?=[\p{L}(])/gu, '$1\u0002'); // "1. İçki. 2. An" numaraları
  return x
    .split(/\u0002|;|(?<=[.!?])\s+(?=[\p{Lu}(‘’“"])/u)
    .map((p) => p.replace(/\u0001/g, '.').replace(DIL_ETIKETI, '').trim().replace(/[.\s]+$/, ''))
    .filter(Boolean);
}

export function farkliAnlamlar(liste: KaynakliMadde[], once?: string): Anlam[] {
  const sirali = [...liste].sort((a, b) => Number(b.kitap === once) - Number(a.kitap === once));
  const gorulen = new Set<string>();
  const gorulenKumeler: Set<string>[] = [];
  const ortusme = (x: Set<string>, y: Set<string>) => {
    let ort = 0;
    for (const w of x) if (y.has(w)) ort++;
    return ort / (x.size + y.size - ort);
  };
  const out: Anlam[] = [];
  for (const m of sirali) {
    for (const anlam of anlamlaraBol(m.tanim)) {
      const parcalar = anlam.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
      const kalan = parcalar.filter((p) => {
        const a = normallestir(p);
        if (!a || gorulen.has(a)) return false;
        // Uzun parçalarda küçük yazım/çoğul farkıyla aynı anlam ("ermiş kişi" / "ermiş kişiler") tekrar sayılır.
        const kume = new Set(a.split(' ').map((w) => w.slice(0, 5)));
        if (kume.size >= 4 && gorulenKumeler.some((o) => ortusme(o, kume) >= 0.6)) return false;
        gorulen.add(a);
        gorulenKumeler.push(kume);
        return true;
      });
      if (!kalan.length) continue;
      out.push({ t: `${kalan.join(', ')}.`, k: m.kitap === once });
    }
  }
  return out;
}

// Tamlamalar ve çok sözcüklü maddeler ("Hacc-ı ekber", "Âb-ı hayât", "Afv etmek"): şiirde ardışık sözcükler olarak aranır.
// Anahtar: maddenin parçaları (boşluk ve tireyle bölünür, normalleştirilir) tek boşlukla birleştirilir: "hacc i ekber".
let ifade: { harita: Map<string, KaynakliMadde[]>; enUzun: number } | null = null;
export function ifadeIndeksi() {
  if (ifade) return ifade;
  const harita = new Map<string, KaynakliMadde[]>();
  let enUzun = 0;
  for (const m of maddeler()) {
    const baslik = m.madde.replace(dilEki, '').trim();
    if (!/\s/.test(baslik) || baslik.includes('/')) continue; // tek sözcükler ve "a/b" biçimli alternatifler başka yoldan
    const parcalar = normallestir(baslik).split(/[\s-]+/).filter(Boolean);
    if (parcalar.length < 2) continue;
    const anahtar = parcalar.join(' ');
    const liste = harita.get(anahtar) ?? [];
    if (!liste.includes(m)) liste.push(m);
    harita.set(anahtar, liste);
    enUzun = Math.max(enUzun, parcalar.length);
  }
  ifade = { harita, enUzun };
  return ifade;
}
