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
