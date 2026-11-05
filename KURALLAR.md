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
