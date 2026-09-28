import type { Recipe } from '@/db/types';
import type { Lang } from '@/i18n';
import { translate } from '@/i18n';
import { imageUrl } from '@/platform/images';
import { formatIngredientLine } from './format';
import { scaleIngredient } from './portions';
import { formatDuration } from './timerDetect';

const W = 1080;
const H = 1350;

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Word-wraps `text` and returns the lines that fit in `maxLines`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    line = w;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1]!;
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function drawPot(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  for (const x of [-22, 0, 22]) {
    ctx.beginPath();
    ctx.moveTo(x, -70);
    ctx.bezierCurveTo(x - 10, -60, x + 10, -50, x, -40);
    ctx.stroke();
  }
  roundRect(ctx, -60, -26, 120, 14, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -32, 8, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, -52, -12, 104, 70, 26);
  ctx.fill();
  roundRect(ctx, -72, 0, 24, 16, 8);
  ctx.fill();
  roundRect(ctx, 48, 0, 24, 16, 8);
  ctx.fill();
  ctx.restore();
}

/** Renders a shareable 1080×1350 recipe card (PNG). */
export async function renderRecipeCard(r: Recipe, lang: Lang, servings = r.servings): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  const tr = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) =>
    translate(lang, k, v);

  const surface = cssVar('--md-surface', '#fff8f6');
  const onSurface = cssVar('--md-on-surface', '#231a16');
  const variant = cssVar('--md-on-surface-variant', '#53433d');
  const primary = cssVar('--md-primary', '#9a4521');
  const primaryContainer = cssVar('--md-primary-container', '#ffdbcd');
  const onPrimaryContainer = cssVar('--md-on-primary-container', '#7b2e0c');
  const serif = '"Roboto Serif", "Noto Serif", Georgia, serif';
  const sans = 'Roboto, "Segoe UI", system-ui, sans-serif';

  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, W, H);

  // Photo (or illustrated placeholder)
  const pad = 56;
  const photoH = 560;
  ctx.save();
  roundRect(ctx, pad, pad, W - pad * 2, photoH, 48);
  ctx.clip();
  let drewPhoto = false;
  if (r.photo) {
    try {
      const img = await loadImage(await imageUrl(r.photo));
      const scale = Math.max((W - pad * 2) / img.width, photoH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, pad + (W - pad * 2 - w) / 2, pad + (photoH - h) / 2, w, h);
      drewPhoto = true;
    } catch {
      drewPhoto = false;
    }
  }
  if (!drewPhoto) {
    ctx.fillStyle = primaryContainer;
    ctx.fillRect(pad, pad, W - pad * 2, photoH);
    drawPot(ctx, W / 2, pad + photoH / 2 + 30, 2.6, onPrimaryContainer);
  }
  ctx.restore();

  // Title
  let y = pad + photoH + 88;
  ctx.fillStyle = onSurface;
  ctx.font = `600 64px ${serif}`;
  for (const line of wrap(ctx, r.title, W - pad * 2, 2)) {
    ctx.fillText(line, pad, y);
    y += 76;
  }

  // Meta line
  const meta = [tr('share.servings', { count: servings })];
  const total = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
  if (total) meta.push(`⏱ ${formatDuration(total)}`);
  if (r.rating) meta.push('★'.repeat(r.rating));
  ctx.fillStyle = primary;
  ctx.font = `500 34px ${sans}`;
  ctx.fillText(meta.join('  ·  '), pad, y);
  y += 64;

  // Ingredients in two columns
  const factor = r.servings > 0 ? servings / r.servings : 1;
  const items = r.sections
    .flatMap((s) => s.items)
    .map((i) => formatIngredientLine(scaleIngredient(i, factor), lang));
  ctx.fillStyle = variant;
  ctx.font = `400 30px ${sans}`;
  const colW = (W - pad * 2 - 40) / 2;
  const rowsAvail = Math.floor((H - y - 120) / 44);
  const maxItems = rowsAvail * 2;
  const shown = items.length > maxItems ? items.slice(0, maxItems - 1) : items;
  const perCol = Math.ceil(shown.length / 2);
  shown.forEach((text, i) => {
    const col = i < perCol ? 0 : 1;
    const row = col === 0 ? i : i - perCol;
    const [line] = wrap(ctx, `• ${text}`, colW, 1);
    ctx.fillText(line ?? '', pad + col * (colW + 40), y + row * 44);
  });
  if (items.length > shown.length) {
    ctx.fillText(`+ ${items.length - shown.length}…`, pad + colW + 40, y + (perCol - 1) * 44 + 44);
  }

  // Footer
  ctx.fillStyle = primary;
  drawPot(ctx, pad + 26, H - 64, 0.34, primary);
  ctx.font = `600 32px ${serif}`;
  ctx.fillText('Mijote', pad + 62, H - 52);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'),
  );
}
