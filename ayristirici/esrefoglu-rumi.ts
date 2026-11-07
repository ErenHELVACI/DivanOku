// Eşrefoğlu Rûmî Dîvân-ı İlâhiyât: ePUB'tan ayrıştırma (Diyanet şablonu, çekirdek: diyanet.ts).
// Girdi: kaynak/esrefoglu-rumi/kaynak.epub -> node ayristirici/dokum.ts esrefoglu-rumi -> dokum/esrefoglu-rumi/OEBPS/
// Üç bölüm var; şiir numaraları her birinde 1'den başlar: Dîvân (d), Mesnevîler (m), Kıt'alar (k).
import { diyanetAyristir } from './diyanet.ts';
diyanetAyristir({
  kitap: 'esrefoglu-rumi', dosyaOnEki: 'EsrefogluRumi', siirDosyalari: [], kaynak: 'd',
  bolumler: [{ kaynak: 'd', dosya: 9 }, { kaynak: 'm', dosya: 11 }, { kaynak: 'k', dosya: 13, kita: true }],
  dizinDosya: 15, sozlukDosya: 17,
});
