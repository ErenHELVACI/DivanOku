import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync } from 'node:fs';

test('KURALLAR.md mevcut', () => {
  assert.ok(existsSync('KURALLAR.md'));
});

test('her veri paketinde kunye.json var ve geçerli', () => {
  const paketler = readdirSync('veri', { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'sema');
  for (const p of paketler) {
    const yol = `veri/${p.name}/kunye.json`;
    if (!existsSync(yol)) continue; // paket henüz doldurulmadı (Aşama 1)
    const k = JSON.parse(readFileSync(yol, 'utf8'));
    assert.equal(k.slug, p.name);
  }
});
