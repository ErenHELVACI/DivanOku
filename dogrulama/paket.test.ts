import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dogrula } from './dogrula.ts';

const paketler = readdirSync('veri', { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`veri/${d.name}/siirler.json`))
  .map((d) => d.name);

for (const kitap of paketler) {
  test(`${kitap}: kabul kontrolleri`, () => {
    const inceleme = existsSync(`veri/${kitap}/inceleme.json`)
      ? JSON.parse(readFileSync(`veri/${kitap}/inceleme.json`, 'utf8')).beklenenSorunSayisi
      : {};
    for (const r of dogrula(kitap)) {
      if (r.tamam) continue;
      const bilinen = inceleme[r.kontrol];
      assert.ok(bilinen !== undefined && bilinen === r.ayrinti?.length,
        `${r.kontrol}: ${r.bulunan} (incelemede kayıtlı değil veya sayı değişti)`);
    }
  });
}
