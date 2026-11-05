// Ortak yardımcılar: ePUB okuma ve metin temizliği.
// KURALLAR.md: kitap metnine dokunulmaz. Burada yalnızca boşluk düzeni
// (baştaki/sondaki boşluk, art arda gelen boşlukların tek boşluğa inmesi) normalleştirilir.
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

export function epubAc(yol: string): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(readFileSync(yol)));
}

export function metinOku(dosyalar: Record<string, Uint8Array>, ad: string): string {
  const d = dosyalar[ad];
  if (!d) throw new Error(`ePUB içinde yok: ${ad}`);
  return strFromU8(d);
}

export function bosluk(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
