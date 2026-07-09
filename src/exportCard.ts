import { SETTLED_T, type Dashboard } from './dashboards';
import { CARD_SOURCES } from './dashboards/cardSources';
import { drawSource } from './dashboards/charts/shared';
import type { Frame } from './dashboards/draw';

// Card → PNG: the chart renderers are pure functions of (ctx, size, t), so an
// export is just one settled draw into an offscreen canvas at poster size.
// 1080×1350 (4:5) matches the ring panels' aspect and posts cleanly.
const EXPORT_W = 1080;
const EXPORT_H = 1350;

/**
 * A share image wants attribution, not methodology. Card sources follow the
 * "Institution · details; caveats" convention, so the institution is the
 * segment before the first separator. Registry names (CARD_SOURCES) take
 * precedence and are never trimmed — this only shortens the fallback.
 */
function shortSource(source: string): string {
  return source.split('·')[0].split(';')[0].split('—')[0].trim().replace(/\.$/, '');
}

/** Render a card's settled frame into a PNG blob (null if canvas is denied). */
export function cardToPngBlob(dashboard: Dashboard): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  // Full (non-compact) frame: the export should carry the source line even
  // though the mobile deck hides it behind the info button.
  const frame: Frame = { ctx, w: EXPORT_W, h: EXPORT_H, t: SETTLED_T, u: EXPORT_W / 512 };
  dashboard.draw(frame);
  // A shared PNG travels without the app UI, so it must carry its own
  // attribution: unless the chart painted a source line itself (maps/misc),
  // stamp the institution — or, failing that, the card's caveat text cut
  // down to its institution — bottom-left in the same muted footer style.
  if (!frame.sourceDrawn) {
    const source =
      CARD_SOURCES[dashboard.id]?.name ??
      (dashboard.source ? shortSource(dashboard.source) : undefined);
    if (source) drawSource(frame, source);
  }
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

/**
 * True when the browser can hand a PNG file to the native share sheet —
 * lets the UI label the action "share" vs "save" honestly.
 */
export function canShareFiles(): boolean {
  return (
    navigator.canShare?.({ files: [new File([], 'probe.png', { type: 'image/png' })] }) ?? false
  );
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
