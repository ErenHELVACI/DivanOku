import { diyanetAyristir } from './diyanet.ts';
// Seçmeler: şiirler iki dosyada (10: dîvân şiirleri, 11: Dolâbnâme) ama numara 1'den 182'ye kesintisiz sürer.
diyanetAyristir({ kitap: 'kaygusuz-abdal', dosyaOnEki: 'KaygusuzAbdal', siirDosyalari: [10, 11], kaynak: 'd', dizinDosya: 13, sozlukDosya: 14 });
