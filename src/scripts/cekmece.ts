// Şiir sayfasındaki yan sekme: tüm şiirlerin listesi, açılıp kapanır, son tercih hatırlanır.
import { TEMEL } from '../lib/yol.ts';
const cekmece = document.getElementById('cekmece')!;
const perde = document.getElementById('cekmece-perde')!;
const dugme = document.getElementById('cekmece-dugme')!;
const liste = document.getElementById('cekmece-liste')!;
const ara = document.getElementById('cekmece-ara') as HTMLInputElement;
const GENIS = matchMedia('(min-width: 900px)');
let yuklendi = false;

const tr = (x: string) => x.toLocaleLowerCase('tr');
function kaydet(a: boolean) { try { localStorage.setItem('cekmece', a ? '1' : '0'); } catch {} }

async function yukle() {
  if (yuklendi) return;
  yuklendi = true;
  try {
    const r = await fetch(`${TEMEL}/${cekmece.dataset.kitap}/liste.json`);
    const v: { bolumler: Record<string, string>; siirler: { id: string; no: number; b: string; i: string }[] } = await r.json();
    const coklu = Object.keys(v.bolumler).length > 1;
    liste.replaceChildren();
    let son = '';
    for (const s of v.siirler) {
      if (coklu && s.b !== son) {
        const h = document.createElement('li');
        h.className = 'grup'; h.textContent = v.bolumler[s.b]; liste.append(h); son = s.b;
      }
      const li = document.createElement('li');
      li.dataset.m = tr(s.i);
      const a = document.createElement('a');
      a.href = `${TEMEL}/${cekmece.dataset.kitap}/${s.id}/`;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = String(s.no);
      const t = document.createElement('span'); t.textContent = s.i; // düz metin: HTML olarak basılmaz
      a.append(n, t);
      if (s.id === cekmece.dataset.aktif) { a.setAttribute('aria-current', 'page'); li.className = 'aktif'; }
      li.append(a); liste.append(li);
    }
  } catch {
    const li = document.createElement('li');
    li.className = 'kucuk soluk'; li.textContent = 'Liste yüklenemedi.';
    liste.replaceChildren(li); yuklendi = false;
  }
}

function ac(odak = true, hatirla = true) {
  yukle().then(() => liste.querySelector('.aktif')?.scrollIntoView({ block: 'center' }));
  cekmece.classList.add('acik'); cekmece.removeAttribute('inert'); cekmece.setAttribute('aria-hidden', 'false');
  dugme.setAttribute('aria-expanded', 'true'); document.body.classList.add('cekmece-acik');
  if (!GENIS.matches) perde.hidden = false;
  if (odak) ara.focus({ preventScroll: true });
  if (hatirla) kaydet(true);
}

function kapat(hatirla = true) {
  const odaktaydi = cekmece.contains(document.activeElement);
  cekmece.classList.remove('acik'); cekmece.setAttribute('inert', ''); cekmece.setAttribute('aria-hidden', 'true');
  dugme.setAttribute('aria-expanded', 'false'); perde.hidden = true; document.body.classList.remove('cekmece-acik');
  if (odaktaydi) dugme.focus();
  if (hatirla) kaydet(false);
}

dugme.addEventListener('click', () => (cekmece.classList.contains('acik') ? kapat() : ac()));
document.getElementById('cekmece-kapat')!.addEventListener('click', () => kapat());
perde.addEventListener('click', () => kapat());
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cekmece.classList.contains('acik') && document.getElementById('kart')!.hidden) kapat();
});
ara.addEventListener('input', () => {
  const q = tr(ara.value.trim());
  for (const li of liste.querySelectorAll<HTMLElement>('li[data-m]')) li.hidden = !!q && !li.dataset.m!.includes(q);
  for (const g of liste.querySelectorAll<HTMLElement>('li.grup')) g.hidden = !!q;
});

// Geniş ekranda son tercih hatırlanır: listeden gezerken sekme açık kalır.
try { if (GENIS.matches && localStorage.getItem('cekmece') === '1') ac(false, false); } catch {}
