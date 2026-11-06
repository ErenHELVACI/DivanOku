import { test } from 'node:test';
import assert from 'node:assert/strict';

// Tarayıcı ortamını taklit et: localStorage ve pencere olayları
const depo = new Map<string, string>();
const dinleyiciler: Record<string, ((e: any) => void)[]> = {};
(globalThis as any).localStorage = { getItem: (k: string) => depo.get(k) ?? null, setItem: (k: string, v: string) => void depo.set(k, v), removeItem: (k: string) => void depo.delete(k) };
(globalThis as any).addEventListener = (ad: string, f: (e: any) => void) => { (dinleyiciler[ad] ??= []).push(f); };
(globalThis as any).dispatchEvent = (e: Event) => { for (const f of dinleyiciler[e.type] ?? []) f(e); return true; };

const F = await import('../src/scripts/favoriler.ts');

test('favoriler: ekle, çıkar, say, sil', () => {
  let olay = 0;
  addEventListener('favori-degisti', () => olay++);
  assert.equal(F.varMi('yunus-emre', 'd-1'), false);
  assert.equal(F.degistir('yunus-emre', 'd-1'), true);   // eklendi
  assert.equal(F.degistir('niyazi-misri', 'd-5'), true);
  assert.equal(F.degistir('yunus-emre', 'a-3'), true);
  assert.equal(F.varMi('yunus-emre', 'd-1'), true);
  assert.deepEqual(F.kitapSayilari(), { 'yunus-emre': 2, 'niyazi-misri': 1 });
  assert.equal(F.degistir('yunus-emre', 'd-1'), false);  // çıkarıldı
  assert.equal(F.varMi('yunus-emre', 'd-1'), false);
  F.sil('niyazi-misri', 'd-5');
  assert.deepEqual(F.kitapSayilari(), { 'yunus-emre': 1 });
  F.hepsiniSil();
  assert.equal(F.oku().length, 0);
  assert.ok(olay >= 6, 'her değişiklikte olay gönderilmeli');
});

test('favoriler: bozuk kayıt sayfayı bozmaz', () => {
  depo.set(F.ANAHTAR, '{bozuk json');
  assert.deepEqual(F.oku(), []);
  depo.set(F.ANAHTAR, JSON.stringify([{ k: 'x', id: 'd-1', t: 1 }, { k: 5 }, null, 'metin']));
  assert.equal(F.oku().length, 1); // yalnız geçerli kayıt kalır
  depo.set(F.ANAHTAR, JSON.stringify({ a: 1 }));
  assert.deepEqual(F.oku(), []);
});
