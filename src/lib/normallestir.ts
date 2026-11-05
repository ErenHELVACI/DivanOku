// Türkçe metni karşılaştırma için ortak biçime getirir.
// Kurallar (KURALLAR.md, arama ve sözlük): küçük harf (Türkçe kurallarıyla), â/î/û → a/i/u,
// ı → i, kesme ve noktalama atılır. Görüntülenen metin değişmez; yalnızca eşleştirme anahtarı üretilir.
export function normallestir(s: string): string {
  return s
    .replace(/⟦\d+⟧/g, '') // dipnot işaretleri aramaya girmez
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/[âä]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[ûü]/g, 'u')
    .replace(/ı/g, 'i')
    .replace(/[’‘'`´ʿʾ‘’]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
