// PDF kaynaklı kitaplar için döküm (2. adım): her sayfadaki metin parçalarını konumlarıyla birlikte
// dokum/<kitap>/ogeler.json içine yazar. Çift sütunlu sayfalar (sözlük) bu konumlardan okunur.
// Ham metin değiştirilmez; yalnızca pdf.js'in verdiği parçalar ve koordinatlar kaydedilir.
// Kullanım: node ayristirici/dokum-pdf.ts <kitap>
import { readFileSync, writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const kitap = process.argv[2];
if (!kitap) throw new Error('Kullanım: node ayristirici/dokum-pdf.ts <kitap>');
const veri = new Uint8Array(readFileSync(`kaynak/${kitap}/kaynak.pdf`));
const pdf = await getDocument({ data: veri, useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise;

const sayfalar: { genislik: number; yukseklik: number; ogeler: { s: string; x: number; y: number; g: number }[] }[] = [];
for (let i = 1; i <= pdf.numPages; i++) {
  const sayfa = await pdf.getPage(i);
  const [, , genislik, yukseklik] = sayfa.view;
  const icerik = await sayfa.getTextContent();
  const ogeler = (icerik.items as any[])
    .filter((o) => typeof o.str === 'string' && o.str.trim() !== '')
    .map((o) => ({ s: o.str as string, x: Math.round(o.transform[4] * 10) / 10, y: Math.round(o.transform[5] * 10) / 10, g: Math.round(o.width * 10) / 10 }));
  sayfalar.push({ genislik, yukseklik, ogeler });
}
writeFileSync(`dokum/${kitap}/ogeler.json`, JSON.stringify(sayfalar));
console.log(`${kitap}: ${pdf.numPages} sayfa, ${sayfalar.reduce((n, s) => n + s.ogeler.length, 0)} metin parçası -> dokum/${kitap}/ogeler.json`);
