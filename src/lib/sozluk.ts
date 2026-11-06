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
      if (!p || /[\s-]/.test(p)) continue;
      const a = normallestir(p);
      if (!a) continue;
      const liste = tek.get(a) ?? [];
      if (!liste.includes(m)) liste.push(m);
      tek.set(a, liste);
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
