// Favori şiirler: tarayıcıda (localStorage) tutulur, hesap gerektirmez; sunucuya hiçbir şey gönderilmez.
// Tek liste, kitap başına sayılır. Kayıt: { k: kitap kodu, id: şiir kimliği, t: eklenme zamanı }.
// Her değişiklikte pencereye "favori-degisti" olayı gönderilir; başka sekmede değişince de (storage olayıyla) aynı olay gelir.
export type Favori = { k: string; id: string; t: number };
export const ANAHTAR = 'divan-favoriler';

export function oku(): Favori[] {
  try {
    const ham = JSON.parse(localStorage.getItem(ANAHTAR) ?? '[]');
    return Array.isArray(ham) ? ham.filter((f) => f && typeof f.k === 'string' && typeof f.id === 'string') : [];
  } catch { return []; }
}

function yaz(liste: Favori[]) {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(liste)); } catch { /* depolama yoksa/doluysa değişiklik bu oturumda kaybolur */ }
  dispatchEvent(new CustomEvent('favori-degisti'));
}

export const varMi = (k: string, id: string) => oku().some((f) => f.k === k && f.id === id);

// Ekler ya da çıkarır; yeni durumu döndürür (true: artık favori)
export function degistir(k: string, id: string): boolean {
  const liste = oku();
  const i = liste.findIndex((f) => f.k === k && f.id === id);
  if (i >= 0) { liste.splice(i, 1); yaz(liste); return false; }
  liste.push({ k, id, t: Date.now() }); yaz(liste); return true;
}

export function sil(k: string, id: string) { yaz(oku().filter((f) => !(f.k === k && f.id === id))); }
export function hepsiniSil() { yaz([]); }

export function kitapSayilari(): Record<string, number> {
  const s: Record<string, number> = {};
  for (const f of oku()) s[f.k] = (s[f.k] ?? 0) + 1;
  return s;
}

// Başka sekmede değişiklik olursa bu sayfayı da güncelle
addEventListener('storage', (e) => { if (e.key === ANAHTAR || e.key === null) dispatchEvent(new CustomEvent('favori-degisti')); });
