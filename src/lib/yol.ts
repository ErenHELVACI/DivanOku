// Site bir alt yolda yayınlanırsa (ör. GitHub Pages'te /DivanOku/) tüm adresler bu önekle başlar.
// Kökte yayınlanırsa (yerelde ve ErenHELVACI.github.io'da) TEMEL boştur ve hiçbir şey değişmez.
export const TEMEL: string = import.meta.env.BASE_URL.replace(/\/+$/, '');
export const yol = (p: string): string => TEMEL + p;
