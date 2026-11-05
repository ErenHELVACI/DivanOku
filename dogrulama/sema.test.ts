import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const Ajv = (Ajv2020 as any).default ?? Ajv2020;
const derle = (ad: string) => new Ajv({ allErrors: true, strict: true }).compile(JSON.parse(readFileSync(`veri/sema/${ad}.sema.json`, 'utf8')));
const iyi = {
  id: 'd-1', kitap: 'ornek-kitap', kaynak: 'd', no: 1, tur: 'aruz', vezinler: ['Fâilâtün Fâilâtün'],
  baslikNotlari: [], bentler: [{ no: 1, dizeler: ['bir', 'iki'] }], anlamlar: [], kaynakNotu: null,
};

test('şema: geçerli şiir kabul edilir', () => {
  assert.equal(derle('siir')([iyi]), true);
});

test('şema: bozuk şiirler reddedilir', () => {
  const siir = derle('siir');
  const bozuklar: [string, object][] = [
    ['kimlik biçimi', { ...iyi, id: 'yunus-d-1' }],
    ['bilinmeyen alan', { ...iyi, ekstra: 1 }],
    ['bent yok', { ...iyi, bentler: [] }],
    ['boş dize', { ...iyi, bentler: [{ no: 1, dizeler: [''] }] }],
    ['Arapça şiirde anlam yok', { ...iyi, tur: 'arapca' }],
    ['aruz şiirde vezin yok', { ...iyi, vezinler: [] }],
    ['geçersiz tür', { ...iyi, tur: 'serbest' }],
  ];
  for (const [ad, s] of bozuklar) assert.equal(siir([s]), false, `reddedilmeliydi: ${ad}`);
});

test('şema: izin "yazili-izin-var" ise kaynak ve tarih zorunlu', () => {
  const kunye = derle('kunye');
  const tam = JSON.parse(readFileSync('veri/yunus-emre/kunye.json', 'utf8'));
  assert.equal(kunye(tam), true);
  assert.equal(kunye({ ...tam, izin: { durum: 'yazili-izin-var', kaynak: '', tarih: '' } }), false);
  assert.equal(kunye({ ...tam, izin: { durum: 'yazili-izin-var', kaynak: 'yazisma-1.pdf', tarih: '2026-12-01' } }), true);
});
