// İnternetsiz okuma için: indirilecek tüm sayfaların listesi (genel sayfalar + kitap başına sayfalar).
import type { APIRoute } from 'astro';
import { kitaplar } from '../lib/veri.ts';

export const GET: APIRoute = () => {
  const genel = ['/', '/ara/', '/sozluk/', '/cevrimdisi/', '/arama/indeks.json'];
  const liste = kitaplar().map((k) => ({
    slug: k.kunye.slug,
    ad: k.kunye.baslik,
    adresler: [
      `/${k.kunye.slug}/`, `/${k.kunye.slug}/liste.json`, `/${k.kunye.slug}/sozluk/`,
      ...(k.sair ? [`/${k.kunye.slug}/sair/`] : []),
      ...k.siirler.map((s) => `/${k.kunye.slug}/${s.id}/`),
    ],
  }));
  return new Response(JSON.stringify({ genel, kitaplar: liste }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
