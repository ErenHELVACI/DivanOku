// Derleme sırasında veri/<kitap>/*.json dosyalarını okur. Site yalnızca bu paketlerden üretilir.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normallestir } from './normallestir.ts';

const KOK = join(process.cwd(), 'veri');
const oku = <T,>(kitap: string, ad: string): T => JSON.parse(readFileSync(join(KOK, kitap, `${ad}.json`), 'utf8'));

export type Kunye = {
  slug: string; baslik: string; tamBaslik?: string; sair: string; editor: string; yayinci: string; seri?: string;
  baski: string; baskiYili: number; isbn: string; telifNotu: string;
  izin: { durum: string; kaynak: string; tarih: string };
  siirSayisi: number | Record<string, number>;
  siirKaynakOnekleri: Record<string, string>;
};
export type Siir = {
  id: string; kitap: string; kaynak: string; no: number; tur: 'aruz' | 'hece' | 'arapca' | 'belirsiz';
  vezinler: string[]; baslikNotlari: string[];
  bentler: { no: number; dizeler: string[] }[];
  anlamlar: { no: number; metin: string }[]; kaynakNotu: string | null;
};
export type Dipnot = { no: number; siir: string; metin: string };
export type SozlukMaddesi = { madde: string; tanim: string };
export type SairOge = { t: 'ust' | 'alt' | 'p' | 'alinti'; m: string };
export type Sair = { bolumler: { baslik: string; ogeler: SairOge[] }[]; dipnotlar: { no: number; metin: string }[] };
export type Kitap = { kunye: Kunye; siirler: Siir[]; dipnotlar: Dipnot[]; sozluk: SozlukMaddesi[]; sair: Sair | null };

let onbellek: Kitap[] | null = null;

export function kitaplar(): Kitap[] {
  if (onbellek) return onbellek;
  onbellek = readdirSync(KOK, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(KOK, d.name, 'siirler.json')))
    .map((d) => ({
      kunye: oku<Kunye>(d.name, 'kunye'),
      siirler: oku<Siir[]>(d.name, 'siirler'),
      dipnotlar: oku<Dipnot[]>(d.name, 'dipnotlar'),
      sozluk: oku<SozlukMaddesi[]>(d.name, 'sozluk'),
      sair: existsSync(join(KOK, d.name, 'sair.json')) ? oku<Sair>(d.name, 'sair') : null,
    }))
    .sort((a, b) => a.kunye.baslik.localeCompare(b.kunye.baslik, 'tr'));
  return onbellek;
}

export const kitapBul = (slug: string) => kitaplar().find((k) => k.kunye.slug === slug)!;

export function bolumAdi(k: Kitap, kaynak: string): string {
  return k.kunye.siirKaynakOnekleri[kaynak] ?? kaynak;
}

export function siirBasligi(k: Kitap, s: Siir): string {
  const coklu = Object.keys(k.kunye.siirKaynakOnekleri).length > 1;
  return coklu ? `${bolumAdi(k, s.kaynak)} · ${s.no}` : `Şiir ${s.no}`;
}

export const ilkDize = (s: Siir) => s.bentler[0].dizeler[0].replace(/⟦\d+⟧/g, '');

export const turAdi: Record<Siir['tur'], string> = { aruz: 'Aruz', hece: 'Hece', arapca: 'Arapça', belirsiz: 'Vezni belirtilmemiş' };

// ---- Sözlük eşleştirme (Aşama 2: yalnızca tam eşleşme) ----
// Yalnızca tek kelimelik madde başları dizeye otomatik eşleşir; çok kelimeli maddeler sözlük sayfasında kalır.
// "âb(f)" -> "âb"; "Âbâd/âbâdân(f)" -> iki yazılış. Aynı yazılışta birden çok madde varsa hepsi tutulur.
export function sozlukIndeksi(k: Kitap): Map<string, SozlukMaddesi[]> {
  const idx = new Map<string, SozlukMaddesi[]>();
  for (const m of k.sozluk) {
    if (!m.tanim) continue; // boş tanımlı madde gösterilmez
    const govde = m.madde.replace(/\s*\([^)]*\)\s*$/, '');
    for (const parca of govde.split('/')) {
      const p = parca.trim();
      if (!p || /[\s-]/.test(p)) continue;
      const anahtar = normallestir(p);
      if (!anahtar) continue;
      const liste = idx.get(anahtar) ?? [];
      if (!liste.includes(m)) liste.push(m);
      idx.set(anahtar, liste);
    }
  }
  return idx;
}
