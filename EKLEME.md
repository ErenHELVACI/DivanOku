# Yeni kitap ekleme (Aşama 4)

Bu prosedür, motor koduna (`src/`) dokunmadan yeni bir dîvân eklemeyi anlatır. Üç kitap (Vâhib Ümmî, Ümmî Sinân, Kaygusuz Abdâl) bu yolla, motorda **hiçbir değişiklik yapılmadan** eklendi; yalnız `ayristirici/`, `dogrulama/` ve `veri/` altına dosya geldi.

Önce `KURALLAR.md` okunur. Temel kural: kitabın metnine dokunulmaz, şüpheli yer düzeltilmez, listelenir.

## 0. Kaynağı değerlendir
- **ePUB tercih edilir** (metin düzgündür). Diyanet ePUB'ları aynı şablonu kullanır.
- Yalnız **PDF** varsa kitap eklenmez: önce ePUB bulunur (Diyanet dijital kitaplığında çoğu kitabın ePUB'u var). PDF hattı bu projeden kaldırıldı; Eşrefoğlu Rûmî de PDF'ten eklenmişti, ePUB bulununca ePUB'a geçildi ve PDF verisi silindi.

## 1. Kaynağı koy ve dök
```bash
mkdir kaynak/<slug>
cp "<dosya>.epub" kaynak/<slug>/kaynak.epub
chmod 444 kaynak/<slug>/kaynak.epub        # salt okunur
node ayristirici/dokum.ts <slug>           # dokum/<slug>/ altına ham XHTML
node ayristirici/tani.ts <slug>            # her dosyada ne var: sınıflar, numara sayısı, dipnot sayısı
```
`tani.ts` çıktısından şunları bul: şiirlerin hangi dosya(lar)da olduğu, şiir dizini ve sözlük dosyaları, dosya adı öneki (`dokum/<slug>/OEBPS/<Önek>-<n>.xhtml`).

## 2. Ayrıştırıcıyı yaz
Diyanet şablonunda yalnız şunu yaz (`ayristirici/<slug>.ts`):
```ts
import { diyanetAyristir } from './diyanet.ts';
diyanetAyristir({ kitap: '<slug>', dosyaOnEki: '<Önek>', siirDosyalari: [<n>], kaynak: 'd', dizinDosya: <n>, sozlukDosya: <n> });
```
Çekirdek (`ayristirici/diyanet.ts`) şunları bilir: şiir numarası (süs görselleri arasında ya da `ortaitalik`), bent numarası ön eki (`1-`, `1 `), dipnotlar (`⟦n⟧`), vezin ve başlık satırları, yazma/varak notları (`824/2a.`), numarasız ilk dizeler, numaralı bent olmayan şiirler, kalın yazılmamış sözlük maddeleri.

Şablon farklıysa (Yûnus ve Mısrî'de olduğu gibi) kitaba özel ayrıştırıcı yaz; ama önce çekirdeğe sığıp sığmadığına bak. Çekirdekte değişiklik gerekirse nedenini bir yorumla yaz ve **önceki kitapların doğrulamasını yeniden çalıştır**.
```bash
mkdir veri/<slug>
node ayristirici/<slug>.ts       # veri/<slug>/*.json + uyarilar.json
```

## 3. Künyeyi doldur
`veri/kunye.sablon.json` kopyalanıp `veri/<slug>/kunye.json` yapılır. Bilgiler ePUB'ın künye sayfasından (genelde `-1`/`-2.xhtml`) alınır: yayıncı, seri, baskı, ISBN, hazırlayan. `siirSayisi` kitabın kendi beyan ettiği sayıdır; ön sözde yoksa şiir dizinindeki kayıt sayısı, nereden alındığı `siirSayisiKaynagi` içinde yazılır. `izin.durum` "yok" kalır; Diyanet'ten yazılı izin gelince `yazili-izin-var`, kaynak ve tarihle işlenir.

## 4. Doğrula
```bash
npm run dogrula -- <slug>
```
Hiçbir şey düzeltilmez. Kalan farkları tek tek oku: kitabın kendi tutarsızlığı mı (dizinde yazım farkı, basılı bent numarası hatası), yoksa ayrıştırıcı hatası mı? Ayrıştırıcı hatasıysa ayrıştırıcıyı düzelt, veriyi elle değiştirme. Kitapta duran farklar:
```bash
node dogrulama/inceleme-yaz.ts <slug>    # sayıları veri/<slug>/inceleme.json içine sabitler
```
Bu "onay" değildir; sayı değişirse `npm test` kırılır ve insan bakar.

## 5. İnsan gözü
```bash
node dogrulama/ornek.ts <slug>           # rapor/<slug>-ornek.md
```
İlk, son, en uzun, Arapça, hece, kaynak notlu ve rastgele şiirleri **basılı kitapla yan yana** karşılaştır. Sayılar tutuyor diye veriyi doğru sanma.

## 6. Kayıt
```bash
npm test && npm run build
```
Site motoru yeni kitabı kendiliğinden bulur (`veri/*/siirler.json` olan her klasör). Ana sayfada cilt rengi sıradan atanır (`src/pages/index.astro`).

## Çok bölümlü kitap (Eşrefoğlu: Dîvân d, Mesnevîler m, Kıt'alar k)
Numaraları her bölümde 1'den başlayan kitaplarda `diyanetAyristir` çağrısına `bolumler: [{ kaynak, dosya, kita? }]` verilir (bkz. `ayristirici/esrefoglu-rumi.ts`). `kita: true` her kıt'ayı ayrı, tek bentli şiir yapar (şiir numarası ilk dizenin "N-" öneki). Şiir dizini numara başa döndükçe sıradaki bölüme atanır.

## Şair/eser tanıtımı (sair.json)
- ePUB'lar için: `ayristirici/sair.ts` içinde kitabın tanıtım dosyalarının numaraları listelenir, `node ayristirici/sair.ts <kitap>` çalıştırılır.
- `npm run dogrula -- <kitap>` şemayı ve dipnot işaretlerinin metinlerle eşleşmesini kontrol eder.
