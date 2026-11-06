// Türkçe metni karşılaştırma için ortak biçime getirir.
// Kurallar (KURALLAR.md, arama ve sözlük): küçük harf (Türkçe kurallarıyla), â/î/û → a/i/u, ı → i, kesme ve
// noktalama atılır. Görüntülenen metin değişmez; yalnızca eşleştirme anahtarı üretilir.
export function normallestir(s: string, genis = false): string {
  const sonuc = s
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
  return genis ? sonuc.replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o') : sonuc;
}

// Aynı normalleştirme, ama her normalleşmiş karakterin özgün metindeki yeri de verilir.
// Arama sonuçlarında eşleşen kısmı özgün (aksanlı) yazılışı üzerinde işaretlemek için kullanılır.
// `genis`: aramada, Türkçe klavyesiz yazanlar için ş/ç/ğ/ö de s/c/g/o sayılır (1'e 1, konumlar korunur).
// Sözlük eşleştirmesi bunu KULLANMAZ ("aşk" ile "ask" sözlükte karışmasın).
// Kural: normalHarita(s, g).n === normallestir(s, g) (test edilir).
export function normalHarita(s: string, genis = false): { n: string; idx: number[] } {
  let n = '';
  const idx: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '⟦') { // ⟦12⟧ dipnot işareti: tümüyle atlanır
      const son = s.indexOf('⟧', i);
      if (son > i && /^\d+$/.test(s.slice(i + 1, son))) { i = son; continue; }
    }
    let k = c === 'İ' ? 'i' : c === 'I' ? 'ı' : c.toLowerCase();
    k = k.replace(/[âä]/g, 'a').replace(/[îï]/g, 'i').replace(/[ûü]/g, 'u').replace(/ı/g, 'i');
    if (genis) k = k.replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o');
    if (/[’‘'`´ʿʾ]/.test(k)) continue;
    if (/\s/.test(k)) { if (n && !n.endsWith(' ')) { n += ' '; idx.push(i); } continue; }
    if (!/[\p{L}\p{N}-]/u.test(k)) continue;
    for (const ch of k) { n += ch; idx.push(i); }
  }
  if (n.endsWith(' ')) { n = n.slice(0, -1); idx.pop(); }
  return { n, idx };
}
