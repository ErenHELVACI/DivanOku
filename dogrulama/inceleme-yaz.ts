// Doğrulamada kalan (kitapta olduğu gibi duran) fark sayılarını veri/<kitap>/inceleme.json içine kaydeder.
// Kullanım: node dogrulama/inceleme-yaz.ts <kitap>
// Bu, farkları "onaylamak" değildir: yalnız sayıyı sabitler; sayı değişirse test kırılır ve insan bakar.
import { writeFileSync } from 'node:fs';
import { dogrula } from './dogrula.ts';

const kitap = process.argv[2];
if (!kitap) throw new Error('Kullanım: node dogrulama/inceleme-yaz.ts <kitap>');
const sayilar: Record<string, number> = {};
for (const r of dogrula(kitap)) if (!r.tamam) sayilar[r.kontrol] = r.ayrinti?.length ?? 0;
writeFileSync(`veri/${kitap}/inceleme.json`, JSON.stringify({
  aciklama: 'İnsan incelemesi bekleyen, kitapta olduğu gibi duran farklar. Sayılar değişirse test kırılır; düzeltme yapılmaz, karar insanındır.',
  beklenenSorunSayisi: sayilar,
}, null, 2) + '\n');
console.log(kitap, sayilar);
