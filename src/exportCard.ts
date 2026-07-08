import { SETTLED_T, type Dashboard } from './dashboards';

// Card → PNG: the chart renderers are pure functions of (ctx, size, t), so an
// export is just one settled draw into an offscreen canvas at poster size.
// 1080×1350 (4:5) matches the ring panels' aspect and posts cleanly.
const EXPORT_W = 1080;
const EXPORT_H = 1350;

/** Render a card's settled frame into a PNG blob (null if canvas is denied). */
export function cardToPngBlob(dashboard: Dashboard): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  // Full (non-compact) frame: the export should carry the source line even
  // though the mobile deck hides it behind the info button.
  dashboard.draw({ ctx, w: EXPORT_W, h: EXPORT_H, t: SETTLED_T, u: EXPORT_W / 512 });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Trigger a browser download of the card as PNG. */
export async function downloadCard(dashboard: Dashboard): Promise<void> {
  const blob = await cardToPngBlob(dashboard);
  if (blob) saveBlob(blob, `worldpulse-${dashboard.id}.png`);
}

/**
 * Share the card image via the Web Share API (mobile share sheet); browsers
 * without file sharing fall back to a plain PNG download. A canceled share
 * dialog is respected — it does not trigger the fallback.
 */
export async function shareCard(dashboard: Dashboard): Promise<void> {
  const blob = await cardToPngBlob(dashboard);
  if (!blob) return;
  const file = new File([blob], `worldpulse-${dashboard.id}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Worldpulse' });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return; // user closed the sheet
      // Real failure — fall through to the download.
    }
  }
  saveBlob(blob, file.name);
}
