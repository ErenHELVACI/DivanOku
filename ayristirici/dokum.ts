// 2. adım: ePUB'tan ham XHTML/OPF/NCX dosyalarını olduğu gibi dokum/<kitap>/ altına çıkarır.
// Kullanım: node ayristirici/dokum.ts <kitap>
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { epubAc } from './ortak.ts';

const kitap = process.argv[2];
if (!kitap) throw new Error('Kullanım: node ayristirici/dokum.ts <kitap>');
const dosyalar = epubAc(`kaynak/${kitap}/kaynak.epub`);
let n = 0;
for (const [ad, veri] of Object.entries(dosyalar)) {
  if (!/\.(xhtml|opf|ncx|css)$/.test(ad)) continue;
  const hedef = join('dokum', kitap, ad);
  mkdirSync(dirname(hedef), { recursive: true });
  writeFileSync(hedef, veri);
  n++;
}
console.log(`${kitap}: ${n} dosya dokum/${kitap}/ altına çıkarıldı`);
