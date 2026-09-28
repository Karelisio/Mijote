import { saveImage } from '@/platform/images';

/** Flat illustrations (drawn for Mijote) used as photos of the sample recipes. */
const CREPES = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<rect width="800" height="600" fill="#F6D98B"/>
<circle cx="120" cy="90" r="160" fill="#F9E3A6"/><circle cx="720" cy="560" r="200" fill="#F2CB6E"/>
<ellipse cx="400" cy="345" rx="265" ry="175" fill="#FFFFFF"/><ellipse cx="400" cy="345" rx="225" ry="145" fill="#F4F1EA"/>
<path d="M205 360c40-90 160-130 250-110 60 14 110 52 140 104-70 40-160 60-250 52-60-5-110-20-140-46z" fill="#E9B45C"/>
<path d="M225 330c50-70 150-100 230-80 50 12 92 42 118 84-70 30-150 44-230 36-50-5-92-18-118-40z" fill="#F3C876"/>
<path d="M250 305c50-50 130-70 200-54 40 9 74 32 96 62-60 24-130 32-196 24-44-6-78-16-100-32z" fill="#F8D992"/>
<circle cx="320" cy="300" r="7" fill="#DDA046"/><circle cx="410" cy="282" r="6" fill="#DDA046"/><circle cx="480" cy="310" r="8" fill="#DDA046"/><circle cx="370" cy="330" r="5" fill="#DDA046"/>
<path d="M300 268c30 20 80 26 130 12s80-10 110 8" stroke="#7B3F12" stroke-width="10" fill="none" stroke-linecap="round"/>
<g fill="#E0463C"><path d="M560 240c22-6 40 8 40 28s-20 38-34 38-30-20-30-38 8-24 24-28z"/><path d="M600 300c20-4 36 8 36 26s-18 34-30 34-28-18-28-34 6-22 22-26z"/></g>
<g fill="#4E8B3A"><path d="M575 236l-12-14 18 6 6-16 6 16 18-6-12 14z"/><path d="M612 296l-10-12 15 5 5-13 5 13 15-5-10 12z"/></g>
<rect x="150" y="470" width="120" height="14" rx="7" fill="#C9C3B6" transform="rotate(-18 210 477)"/>
</svg>`;

const QUICHE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<rect width="800" height="600" fill="#C98B5A"/>
<g stroke="#B97A4A" stroke-width="6" opacity="0.6"><path d="M0 120h800M0 250h800M0 380h800M0 510h800"/></g>
<rect x="60" y="70" width="680" height="470" rx="40" fill="#EFE6D8"/>
<circle cx="400" cy="305" r="215" fill="#C27A36"/>
<g fill="#D4914A">${Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2;
  return `<circle cx="${(400 + Math.cos(a) * 205).toFixed(1)}" cy="${(305 + Math.sin(a) * 205).toFixed(1)}" r="22"/>`;
}).join('')}</g>
<circle cx="400" cy="305" r="180" fill="#F2C35B"/>
<circle cx="400" cy="305" r="180" fill="url(#g)"/>
<defs><radialGradient id="g" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#FAD978"/><stop offset="1" stop-color="#E3A43E"/></radialGradient></defs>
<g fill="#B5452C">${[
  [330, 250],
  [440, 230],
  [500, 300],
  [360, 350],
  [450, 380],
  [300, 320],
  [400, 300],
  [520, 360],
  [350, 420],
  [420, 175],
]
  .map(
    ([x, y]) =>
      `<rect x="${x}" y="${y}" width="26" height="16" rx="6" transform="rotate(${(x! + y!) % 50} ${x} ${y})"/>`,
  )
  .join('')}</g>
<g fill="#FFFFFF" opacity="0.35"><ellipse cx="350" cy="240" rx="40" ry="16"/><ellipse cx="470" cy="340" rx="26" ry="10"/></g>
<g fill="#4E8B3A"><circle cx="380" cy="270" r="5"/><circle cx="470" cy="270" r="5"/><circle cx="330" cy="380" r="5"/><circle cx="420" cy="410" r="5"/></g>
</svg>`;

const CURRY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<rect width="800" height="600" fill="#2F5D57"/>
<circle cx="700" cy="80" r="180" fill="#356A63"/><circle cx="80" cy="560" r="160" fill="#29524C"/>
<ellipse cx="400" cy="330" rx="260" ry="220" fill="#F3EDE3"/>
<ellipse cx="400" cy="320" rx="220" ry="185" fill="#E6DCCB"/>
<path d="M190 330c10-90 110-160 210-160s200 70 210 160c-10 80-100 150-210 150s-200-70-210-150z" fill="#E88A2E"/>
<path d="M215 320c20-70 100-120 185-120s170 50 190 120c-30 60-110 110-190 110s-160-50-185-110z" fill="#F0A13F"/>
<g fill="#FFF4DC"><path d="M200 330c30-60 90-90 150-80 20 40 10 110-40 150-60-10-100-40-110-70z"/></g>
<g fill="#FFFFFF" opacity="0.9">${Array.from({ length: 16 }, (_, i) => `<ellipse cx="${230 + (i % 5) * 22}" cy="${280 + Math.floor(i / 5) * 24}" rx="9" ry="4" transform="rotate(${i * 23} ${230 + (i % 5) * 22} ${280 + Math.floor(i / 5) * 24})"/>`).join('')}</g>
<g fill="#F7D9A8">${[
  [430, 270],
  [500, 300],
  [460, 350],
  [540, 360],
  [410, 380],
  [480, 240],
]
  .map(([x, y]) => `<rect x="${x}" y="${y}" width="40" height="30" rx="10"/>`)
  .join('')}</g>
<g fill="#FFF6E5" opacity="0.8"><path d="M390 250c40-12 90-8 130 10" stroke="#FFF6E5" stroke-width="6" fill="none" stroke-linecap="round"/></g>
<g fill="#5BA343">${[
  [450, 300],
  [520, 330],
  [470, 390],
  [540, 270],
  [420, 340],
]
  .map(([x, y]) => `<path d="M${x} ${y}c10-14 28-14 34 0-10 12-24 12-34 0z"/>`)
  .join('')}</g>
<g fill="#C0392B"><circle cx="560" cy="310" r="5"/><circle cx="445" cy="265" r="4"/><circle cx="505" cy="385" r="5"/></g>
</svg>`;

const SVGS = [CREPES, QUICHE, CURRY];

async function rasterize(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.88),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Renders and stores the sample photos; failures just leave a recipe without photo. */
export async function createSamplePhotos(): Promise<(string | null)[]> {
  return Promise.all(
    SVGS.map(async (svg) => {
      try {
        return await saveImage(await rasterize(svg), false);
      } catch {
        return null;
      }
    }),
  );
}
