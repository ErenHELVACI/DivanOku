// Uygulama ikonlarını üretir (public/ikon-192.png, ikon-512.png, ikon-maskeli-512.png): lacivert zemin, yaldız sekiz köşeli yıldız.
// Kullanım: node ayristirici/ikon.ts
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const ZEMIN = [13, 18, 36];
const ALTIN = [212, 168, 74];

function yildizMi(u: number, v: number, r: number) {
  const k = Math.SQRT1_2;
  return (Math.abs(u) <= r && Math.abs(v) <= r) || (Math.abs((u + v) * k) <= r && Math.abs((u - v) * k) <= r);
}

function ciz(boyut: number, olcek: number): Buffer {
  const SS = 4; // her piksel 4x4 alt örnek: kenarlar yumuşak
  const satirlar: Buffer[] = [];
  for (let y = 0; y < boyut; y++) {
    const satir = Buffer.alloc(1 + boyut * 3); // ilk bayt: filtre türü 0
    for (let x = 0; x < boyut; x++) {
      let altin = 0;
      for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) {
        const u = (((x + (a + 0.5) / SS) / boyut) * 2 - 1) / olcek;
        const v = (((y + (b + 0.5) / SS) / boyut) * 2 - 1) / olcek;
        const dis = yildizMi(u, v, 0.62);
        const ic = yildizMi(u, v, 0.5);
        const nokta = u * u + v * v <= 0.07 * 0.07 * 4;
        if ((dis && !ic) || nokta) altin++;
      }
      const t = altin / (SS * SS);
      for (let c = 0; c < 3; c++) satir[1 + x * 3 + c] = Math.round(ZEMIN[c] * (1 - t) + ALTIN[c] * t);
    }
    satirlar.push(satir);
  }
  const parca = (tip: string, veri: Buffer) => {
    const uzunluk = Buffer.alloc(4); uzunluk.writeUInt32BE(veri.length);
    const govde = Buffer.concat([Buffer.from(tip), veri]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(govde) >>> 0);
    return Buffer.concat([uzunluk, govde, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(boyut, 0); ihdr.writeUInt32BE(boyut, 4); ihdr[8] = 8; ihdr[9] = 2; // 8 bit, RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), parca('IHDR', ihdr), parca('IDAT', deflateSync(Buffer.concat(satirlar))), parca('IEND', Buffer.alloc(0))]);
}

writeFileSync('public/ikon-192.png', ciz(192, 0.95));
writeFileSync('public/ikon-512.png', ciz(512, 0.95));
writeFileSync('public/ikon-maskeli-512.png', ciz(512, 0.72)); // maskeli ikon: içerik güvenli alanda kalsın
console.log('ikonlar yazıldı: public/ikon-192.png, ikon-512.png, ikon-maskeli-512.png');
