// Tüm kitapların şiir metni, arama sayfası için tek dosyada (yaklaşık 1 MB metin).
// Biçim: { k: [[slug, şair, kitapAdı], ...], s: [[kitapSırası, şiirKimliği, şiirBaşlığı, [[dize, dize], [bent2…]]], ...] }
// Dipnot işaretleri (⟦n⟧) çıkarılır; metin başka hiçbir şekilde değiştirilmez.
import type { APIRoute } from 'astro';
import { kitaplar, siirBasligi } from '../../lib/veri.ts';

export const GET: APIRoute = () => {
  const liste = kitaplar();
  const govde = {
    k: liste.map((k) => [k.kunye.slug, k.kunye.sair, k.kunye.baslik]),
    s: liste.flatMap((k, i) => k.siirler.map((s) => [i, s.id, siirBasligi(k, s), s.bentler.map((b) => b.dizeler.map((d) => d.replace(/⟦\d+⟧/g, '')))])),
  };
  return new Response(JSON.stringify(govde), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
