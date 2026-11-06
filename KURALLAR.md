# KURALLAR (her oturumda ilk bu dosya okunur)

1. Kitap metnine asla dokunulmaz; yalnızca ayrıştırılır. Yapay zeka metni "düzeltmez".
2. `kaynak/` klasörü yalnız okunur. Ham dosyalar değiştirilmez.
3. Her kitabın `veri/<kitap>/kunye.json` dosyasında yayıncı, baskı, telif ve izin durumu bulunur.
4. Her değişiklikten önce testler çalışır: `npm test`.

## Kararlar
- Kalıcı kimlik: kitap kodu + şiir kodu, ör. `yunus-emre` / `d-10`; adres `/yunus-emre/d-10`. Bir kez verilen kimlik değişmez.
- Dipnot işareti dizede `⟦n⟧`; arama dizinine girmeden önce temizlenir.
- Sözlük ve anlamlar yalnızca kitabın kendisinden alınır.
- Bir seferde bir aşama; her aşamadan sonra git kaydı.

## Veri şeması (Aşama 1)
- Şemalar `veri/sema/*.sema.json` altındadır; her veri dosyası kendi şemasından geçmek zorundadır (`npm run dogrula <kitap>`).
- Şiir kimliği `<kaynak>-<no>` (ör. `d-10`); kaynak öneki `kunye.json > siirKaynakOnekleri` içinde tanımlıdır. Numaralar her kaynak bölümünde 1'den başlar, bu yüzden kimlik yalnızca numara değildir.
- Doğrulama hata bulursa düzeltme yapılmaz, listelenir. Kitapta olduğu gibi duran farklar `veri/<kitap>/inceleme.json` içinde sayıyla kayıtlıdır ve karar insanındır.

## Arama ve internetsiz okuma (Aşama 3)
- Arama metni ve sorgu aynı biçime getirilir (`src/lib/normallestir.ts`): küçük harf (Türkçe kurallarıyla), â/î/û → a/i/u, ı → i, kesme/ayn işaretleri atılır; aramada ayrıca ş/ç/ğ/ö → s/c/g/o. Sözlük eşleştirmesi bu geniş katlamayı kullanmaz.
- Arama dizini `/arama/indeks.json` (derlemede üretilir, ~1,3 MB); sonuçta eşleşen kısım özgün (aksanlı) metin üzerinde işaretlenir.
- Servis işçisi (`/sw.js`) yalnız yayın sürümünde kaydedilir; HTTPS (ya da localhost) gerekir. Önbellek adı sabit: `divan-icerik`.
- `/cevrimdisi/` sayfası tüm sayfaları (yaklaşık 36 MB) önbelleğe indirir ve siler. Her derlemeden sonra `npm test` servis işçisinin mantığını sınar (`dogrulama/sw.test.ts`).
