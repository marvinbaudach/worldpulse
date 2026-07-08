// User-initiated refresh (pull-to-refresh on the mobile deck). Lives outside
// sources.ts so the fetcher module stays single-purpose; imports only its
// public surface.
import { clearDataCache } from './cache';
import { LIVE_FEEDS } from './sources';
import { emitLiveUpdate } from './store';

let refreshing = false;

/** Drop the cache and re-run every feed. Resolves when all feeds settled;
    failures keep their demo data as usual. */
export async function refreshLiveData(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    clearDataCache();
    await Promise.allSettled(
      LIVE_FEEDS.map((feed) =>
        feed.load().then(
          () => emitLiveUpdate('data'),
          (err) => console.warn(`[live-data] refresh ${feed.source} ${feed.item} failed`, err),
        ),
      ),
    );
  } finally {
    // Never leave the guard latched — a throw would otherwise disable
    // pull-to-refresh for the rest of the session.
    refreshing = false;
  }
}
