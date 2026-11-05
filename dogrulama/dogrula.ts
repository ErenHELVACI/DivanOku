// 4. adım: kabul kontrolleri. Hiçbir şeyi düzeltmez; yalnızca ölçer ve listeler.
import { readFileSync, existsSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

export type Sonuc = { kontrol: string; beklenen: string; bulunan: string; tamam: boolean; ayrinti?: string[] };

// Dizin kaydı ilk dizeyle birebir aynı olmalı. Dörtlük bentli şiirlerde dizin, ilk dizenin ardından
// ikinci dizeyi de verebilir ("a/b" ya da bitişik "ab"): ilk dizeyle başlıyorsa eşleşmiş sayılır.
function dizinEslesir(ilk: string | undefined, kayit: string): boolean {
  if (!ilk) return false;
  const t = ilk.replace(/⟦\d+⟧/g, '');
  return kayit === t || kayit.startsWith(t);
}

// Şemalar veri/sema/ altında; her veri dosyası kendi şemasından geçmek zorundadır.
const SEMALAR: [dosya: string, sema: string][] = [
  ['kunye.json', 'kunye'], ['siirler.json', 'siir'], ['dipnotlar.json', 'dipnot'],
  ['siir-dizini.json', 'siir-dizini'], ['sozluk.json', 'sozluk'],
];

function semaKontrol(d: string): Sonuc {
  const Ajv = (Ajv2020 as any).default ?? Ajv2020;
  const ajv = new Ajv({ allErrors: true, strict: true });
  const hatalar: string[] = [];
  for (const [dosya, sema] of SEMALAR) {
    const dogrulayici = ajv.compile(JSON.parse(readFileSync(`veri/sema/${sema}.sema.json`, 'utf8')));
    if (!dogrulayici(JSON.parse(readFileSync(`${d}/${dosya}`, 'utf8'))))
      for (const e of dogrulayici.errors ?? []) hatalar.push(`${dosya}${e.instancePath}: ${e.message}`);
  }
  return { kontrol: 'Şema', beklenen: `${SEMALAR.length} dosya şemadan geçer`, bulunan: hatalar.length ? `${hatalar.length} hata` : `${SEMALAR.length}/${SEMALAR.length} dosya geçti`, tamam: hatalar.length === 0, ayrinti: hatalar };
}

const oku = (yol: string) => JSON.parse(readFileSync(yol, 'utf8'));

export function dogrula(kitap: string): Sonuc[] {
  const d = `veri/${kitap}`;
  const kunye = oku(`${d}/kunye.json`);
  const siirler: any[] = oku(`${d}/siirler.json`);
  const dipnotlar: any[] = oku(`${d}/dipnotlar.json`);
  const dizin: any[] = oku(`${d}/siir-dizini.json`);
  const sozluk: any[] = oku(`${d}/sozluk.json`);
  const s: Sonuc[] = [semaKontrol(d)];

  // Şiir sayısı: künyede sayı ya da kaynak-öneki başına sayılar olabilir.
  const beklenenler: Record<string, number> = typeof kunye.siirSayisi === 'number' ? { d: kunye.siirSayisi } : kunye.siirSayisi;
  const bulunanlar: Record<string, number> = {};
  for (const p of siirler) bulunanlar[p.kaynak] = (bulunanlar[p.kaynak] ?? 0) + 1;
  const sayiFark = Object.keys({ ...beklenenler, ...bulunanlar }).filter((k) => beklenenler[k] !== bulunanlar[k]);
  const ozet = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(' ');
  s.push({ kontrol: 'Şiir sayısı', beklenen: `${ozet(beklenenler)} (künye)`, bulunan: ozet(bulunanlar), tamam: sayiFark.length === 0 });

  // Numaralar her kaynak bölümünde 1…N kesintisiz olmalı (çevirili/ikinci bölümlerde yeniden 1'den başlayabilir).
  const kopuk: string[] = [];
  for (const k of Object.keys(bulunanlar)) {
    siirler.filter((p) => p.kaynak === k).forEach((p, i) => { if (p.no !== i + 1) kopuk.push(`${k}-${p.no}`); });
  }
  s.push({ kontrol: 'Şiir numaraları', beklenen: 'her bölümde 1…N kesintisiz', bulunan: kopuk.length ? `kopukluk: ${kopuk.slice(0, 10)}` : 'kesintisiz',
    tamam: kopuk.length === 0 });

  // Şiir dizini: dizindeki kayıtlar "d" bölümünün şiirleriyle sırayla eşleşir.
  const dizinSorun: string[] = [];
  const dSiirler = siirler.filter((p) => p.kaynak === 'd');
  if (dizin.length !== dSiirler.length) dizinSorun.push(`dizin ${dizin.length} kayıt, şiir ${dSiirler.length}`);
  for (const k of dizin) {
    const p = dSiirler.find((x) => x.no === k.no);
    const ilk = p?.bentler?.[0]?.dizeler?.[0];
    if (!p) dizinSorun.push(`dizinde ${k.no} var, şiir yok`);
    else if (!dizinEslesir(ilk, k.ilkDize))
      dizinSorun.push(`${k.no}: dizin «${k.ilkDize}» ≠ şiir «${ilk}»`);
  }
  s.push({ kontrol: 'Şiir dizini', beklenen: 'ilk dizeler eşleşir', bulunan: dizinSorun.length ? `${dizinSorun.length} fark` : `${dizin.length} = ${dSiirler.length}, tümü eşleşti`,
    tamam: dizinSorun.length === 0, ayrinti: dizinSorun });

  // Dipnot: metindeki ⟦n⟧ işaretleri ile dipnot metinleri aynı küme, her biri bir kez.
  const isaretler: number[] = [];
  for (const p of siirler)
    for (const t of [...p.bentler.flatMap((b: any) => b.dizeler), ...p.anlamlar.map((a: any) => a.metin), p.kaynakNotu ?? '', ...p.baslikNotlari, ...p.vezinler])
      for (const m of t.matchAll(/⟦(\d+)⟧/g)) isaretler.push(Number(m[1]));
  const nolar = dipnotlar.map((x) => x.no);
  const yinelenen = [...new Set(nolar.filter((n, i) => nolar.indexOf(n) !== i))];
  const farkA = isaretler.filter((n) => !nolar.includes(n));
  const farkB = nolar.filter((n) => !isaretler.includes(n));
  const dipSorun = [...farkA.map((n) => `işaret var, metin yok: ${n}`), ...farkB.map((n) => `metin var, işaret yok: ${n}`), ...yinelenen.map((n) => `yinelenen dipnot no: ${n}`)];
  s.push({ kontrol: 'Dipnot sayısı', beklenen: 'metindeki işaret = dipnot metni', bulunan: `${isaretler.length} işaret, ${dipnotlar.length} metin` + (dipSorun.length ? `, ${dipSorun.length} sorun` : ', tümü eşleşti'),
    tamam: isaretler.length === dipnotlar.length && dipSorun.length === 0, ayrinti: dipSorun });

  // Beyit yapısı: dağılım ve 2 dizeli olmayan bentleri içeren şiirler.
  const dagilim: Record<number, number> = {};
  const farkli: string[] = [];
  for (const p of siirler) {
    const say: Record<number, number> = {};
    for (const b of p.bentler) {
      dagilim[b.dizeler.length] = (dagilim[b.dizeler.length] ?? 0) + 1;
      say[b.dizeler.length] = (say[b.dizeler.length] ?? 0) + 1;
    }
    // Şiirin kendi çoğunluk bent boyu ile ayrışan bentleri ve genel olarak 2 dizeli olmayan şiirleri listele.
    const norm = Number(Object.entries(say).sort((a, b) => b[1] - a[1])[0]?.[0]);
    const sapan = p.bentler.filter((b: any) => b.dizeler.length !== norm).map((b: any) => `${b.no}(${b.dizeler.length})`);
    if (norm !== 2 || sapan.length) farkli.push(`şiir ${p.no}: genelde ${norm} dizeli` + (sapan.length ? `; farklı bentler: ${sapan.join(' ')}` : ''));
  }
  s.push({ kontrol: 'Beyit yapısı', beklenen: 'çoğu 2 dize; diğerleri listelenir', bulunan: Object.entries(dagilim).map(([k, v]) => `${k} dizeli: ${v}`).join(', '),
    tamam: true, ayrinti: farkli });

  const ceviri = siirler.filter((p) => p.anlamlar.length);
  const ceviriSorun = ceviri.filter((p) => p.anlamlar.length !== p.bentler.length || p.anlamlar.some((a: any, i: number) => a.no !== i + 1))
    .map((p) => `şiir ${p.no}: ${p.bentler.length} bent, ${p.anlamlar.length} anlam`);
  s.push({ kontrol: 'Çevirili şiirler', beklenen: 'bent sayısı = anlam satırı', bulunan: `${ceviri.length} şiir, ${ceviriSorun.length} sorun`, tamam: ceviriSorun.length === 0, ayrinti: ceviriSorun });

  // Bent numaraları 1'den ardışık mı (kayma, ikinci kez 1'den başlama tuzağı)
  const bentSorun: string[] = [];
  for (const p of siirler) {
    p.bentler.forEach((b: any, i: number) => { if (b.no !== i + 1) bentSorun.push(`şiir ${p.no}: ${i + 1}. bent numarası ${b.no}`); });
    if (!p.bentler.length) bentSorun.push(`şiir ${p.no}: bent yok`);
  }
  s.push({ kontrol: 'Bent numaraları', beklenen: 'her şiirde 1…n ardışık', bulunan: bentSorun.length ? `${bentSorun.length} sorun` : 'tümü ardışık', tamam: bentSorun.length === 0, ayrinti: bentSorun });

  const bos = sozluk.filter((m) => !m.tanim).map((m) => m.madde);
  const sayac = new Map<string, number>();
  for (const m of sozluk) sayac.set(m.madde + '\u0000' + m.tanim, (sayac.get(m.madde + '\u0000' + m.tanim) ?? 0) + 1);
  const ayniTam = [...sayac].filter(([, n]) => n > 1).map(([k]) => k.split('\u0000')[0]);
  const aykiri = [...bos.map((m) => `boş tanım: ${m}`), ...ayniTam.map((m) => `birebir yinelenen: ${m}`)];
  s.push({ kontrol: 'Sözlük', beklenen: 'yinelenen ve boş madde aykırı', bulunan: `${sozluk.length} madde, ${aykiri.length} aykırı`, tamam: aykiri.length === 0, ayrinti: aykiri });

  const ua = existsSync(`${d}/uyarilar.json`) ? oku(`${d}/uyarilar.json`) : [];
  s.push({ kontrol: 'Ayrıştırıcı uyarıları', beklenen: '0 uyarı', bulunan: `${ua.length} uyarı`, tamam: ua.length === 0,
    ayrinti: ua.map((u: any) => (u.siir ? `[${u.siir}] ` : '') + u.mesaj) });
  return s;
}

if (process.argv[1]?.endsWith('dogrula.ts')) {
  const kitap = process.argv[2];
  for (const r of dogrula(kitap)) {
    console.log(`${r.tamam ? 'GEÇTİ ' : 'KALDI '} ${r.kontrol}: ${r.bulunan}  (beklenen: ${r.beklenen})`);
    for (const a of (r.ayrinti ?? []).slice(0, 25)) console.log('        - ' + a);
    if ((r.ayrinti?.length ?? 0) > 25) console.log(`        … ${r.ayrinti!.length - 25} satır daha`);
  }
}
