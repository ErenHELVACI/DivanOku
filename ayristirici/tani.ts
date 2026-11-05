// Yeni kitap ekleme, 1. adım: dökülmüş ePUB'ın yapısını gösterir. Hiçbir şeyi değiştirmez.
// Kullanım: node ayristirici/tani.ts <kitap>
// Her XHTML dosyası için: boyut, ilk başlık, <p> sınıf sayıları, dipnot sayıları, sayısal "ortaitalik" (şiir numarası) sayısı.
import { readdirSync, readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

const kitap = process.argv[2];
if (!kitap) throw new Error('Kullanım: node ayristirici/tani.ts <kitap>');
const kok = `dokum/${kitap}/OEBPS`;
const sirali = readdirSync(kok)
  .filter((f) => f.endsWith('.xhtml') && f !== 'toc.xhtml')
  .sort((a, b) => Number(a.match(/-(\d+)\.xhtml$/)?.[1] ?? -1) - Number(b.match(/-(\d+)\.xhtml$/)?.[1] ?? -1));

for (const f of sirali) {
  const h = readFileSync(`${kok}/${f}`, 'utf8');
  if (h.length < 3000) continue;
  const $ = cheerio.load(h);
  const sayac: Record<string, number> = {};
  $('p').each((_, e) => { const c = $(e).attr('class') ?? '-'; sayac[c] = (sayac[c] ?? 0) + 1; });
  const baslik = ($('h1').first().text() || $('p.ortayazi').first().text()).replace(/\s+/g, ' ').trim().slice(0, 60);
  const numara = $('p.ortaitalik').filter((_, e) => /^\d+$/.test($(e).text().trim())).length;
  const ilk = Object.entries(sayac).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`${f.replace(/^.*-(\d+)\.xhtml$/, '$1').padStart(3)} ${String(h.length).padStart(7)}B  «${baslik}»  [${ilk}]  numara:${numara}  dipnot:${$('aside[epub\\:type="footnote"], aside.\\_idFootnote').length}`);
}
