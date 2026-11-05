// İnsan gözü adımı için: sabit tohumla 20 şiir + uç durumlar, kitapla yan yana karşılaştırmak üzere.
// Kullanım: node dogrulama/ornek.ts <kitap>  -> rapor/<kitap>-ornek.md
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const kitap = process.argv[2];
const siirler: any[] = JSON.parse(readFileSync(`veri/${kitap}/siirler.json`, 'utf8'));
const dipnotlar: any[] = JSON.parse(readFileSync(`veri/${kitap}/dipnotlar.json`, 'utf8'));
let tohum = 20260511;
const rast = () => ((tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296);
const boy = (p: any) => p.bentler.reduce((n: number, b: any) => n + b.dizeler.length, 0);
const uc = new Map<number, string>(); // siirler dizisindeki sıra -> etiket (numaralar bölümlerde tekrar edebilir)
const sira = (p: any) => siirler.indexOf(p);
uc.set(0, 'ilk');
uc.set(siirler.length - 1, 'son');
uc.set(sira([...siirler].sort((a, b) => boy(b) - boy(a))[0]), 'en uzun');
const ar = siirler.find((p) => p.tur === 'arapca'); if (ar) uc.set(sira(ar), 'Arapça (ilk)');
const hece = siirler.find((p) => p.tur === 'hece'); if (hece) uc.set(sira(hece), 'hece (ilk)');
const nak = siirler.find((p) => p.bentler.some((b: any) => b.dizeler.length > 2) && p.tur === 'aruz' && p.baslikNotlari.length); if (nak) uc.set(sira(nak), 'başlık notlu/çok dizeli bent');
const kn = siirler.find((p) => p.kaynakNotu); if (kn) uc.set(sira(kn), 'kaynak notlu');
while (uc.size < 20 + 7) uc.set(Math.floor(rast() * siirler.length), 'rastgele');
let md = `# ${kitap}: örnek şiirler (kitapla yan yana karşılaştırılacak)\n\n`;
for (const no of [...uc.keys()].sort((a, b) => a - b)) {
  const p = siirler[no];
  md += `## Şiir ${p.id}: ${uc.get(no)} · tür: ${p.tur}\n`;
  if (p.baslikNotlari.length) md += `Başlık notu: ${p.baslikNotlari.join(' / ')}\n`;
  if (p.vezinler.length) md += `Vezin: ${p.vezinler.join(' / ')}\n`;
  md += '\n';
  for (const b of p.bentler) md += `${b.no}. bent\n` + b.dizeler.map((d: string) => `    ${d}`).join('\n') + '\n';
  if (p.anlamlar.length) md += '\nAnlam:\n' + p.anlamlar.map((a: any) => `    ${a.no} ${a.metin}`).join('\n') + '\n';
  if (p.kaynakNotu) md += `\nKaynak notu: ${p.kaynakNotu}\n`;
  const dn = dipnotlar.filter((d) => d.siir === p.id);
  if (dn.length) md += '\nDipnotlar:\n' + dn.map((d) => `    ⟦${d.no}⟧ ${d.metin}`).join('\n') + '\n';
  md += '\n';
}
mkdirSync('rapor', { recursive: true });
writeFileSync(`rapor/${kitap}-ornek.md`, md);
console.log(`rapor/${kitap}-ornek.md: ${uc.size} şiir`);
