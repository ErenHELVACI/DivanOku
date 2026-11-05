// Şiir sayfasındaki yan sekme için: kitabın tüm şiirlerinin kısa listesi (ilk dize ile).
// Her şiir sayfasına gömülmez; sekme ilk açıldığında bir kez indirilir.
import type { APIRoute } from 'astro';
import { kitaplar, kitapBul, ilkDize, bolumAdi } from '../../lib/veri.ts';

export function getStaticPaths() {
  return kitaplar().map((k) => ({ params: { kitap: k.kunye.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  const k = kitapBul(params.kitap!);
  const bolumler = Object.fromEntries(Object.keys(k.kunye.siirKaynakOnekleri).map((b) => [b, bolumAdi(k, b)]));
  const govde = { bolumler, siirler: k.siirler.map((s) => ({ id: s.id, no: s.no, b: s.kaynak, i: ilkDize(s) })) };
  return new Response(JSON.stringify(govde), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
