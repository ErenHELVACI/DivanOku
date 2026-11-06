import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { normallestir, normalHarita } from '../src/lib/normallestir.ts';

test('arama: aynı sözcüğün yazılış biçimleri aynı anahtara iner', () => {
  const esit = ['murâd', 'Murad', 'MURÂD', 'murad'];
  assert.equal(new Set(esit.map(normallestir)).size, 1);
  assert.equal(normallestir('Ya‘ni'), normallestir('yani'));
  assert.equal(normallestir('Tahte’l-ulâ'), normallestir('tahte’l-‘ulâ'));
  assert.equal(normallestir('ISIK'), normallestir('ısık')); // I/ı ve İ/i Türkçe kuralıyla
  assert.equal(normallestir('İşte'), normallestir('işte'));
  assert.equal(normallestir('göz⟦12⟧'), 'goz'.replace('o', 'ö')); // dipnot işareti atılır, ö korunur
});

test('arama: geniş katlama ş/ç/ğ/ö de katlar, sözlük normalleştirmesi katlamaz', () => {
  assert.equal(normallestir('aşk', true), normallestir('ask', true));
  assert.equal(normallestir('gönül', true), normallestir('gonul', true));
  assert.notEqual(normallestir('aşk'), normallestir('ask'));
  const a = normalHarita('Gönül ‘Aşk', true);
  assert.equal(a.n, 'gonul ask');
  assert.equal(a.idx.length, a.n.length);
});

test('normalHarita: normallestir ile birebir aynı metni üretir ve konumlar özgün metinde doğru harfi gösterir', () => {
  const ornekler = ['Ya‘ni, Murâd!  ', '  ‘Aşk—i İlâhî ⟦3⟧ ey Hû', 'Tanrı’nın Uçmağ’ı', 'Ümmî-i Sinân (a)'];
  const dizeler: string[] = [];
  for (const d of existsSync('veri') ? readdirSync('veri', { withFileTypes: true }) : []) {
    if (!d.isDirectory() || !existsSync(`veri/${d.name}/siirler.json`)) continue;
    for (const p of JSON.parse(readFileSync(`veri/${d.name}/siirler.json`, 'utf8'))) for (const b of p.bentler) dizeler.push(...b.dizeler);
  }
  for (const s of [...ornekler, ...dizeler]) {
    const h = normalHarita(s);
    assert.equal(h.n, normallestir(s), `farklı: ${s}`);
    assert.equal(h.idx.length, h.n.length);
    // her normalleşmiş harfin konumu özgün metinde, o harfin (harf büyüklüğü/aksan farkıyla) aynı harfi göstermeli
    for (let i = 0; i < h.n.length; i++) {
      if (h.n[i] === ' ' || h.n[i] === '-') continue;
      assert.equal(normallestir(s[h.idx[i]]), h.n[i], `konum: ${s} @${i}`);
    }
  }
});
