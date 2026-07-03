import { SRGBColorSpace, VideoTexture } from 'three';
import type { Texture, Vector2 } from 'three';

/** A muted, looping video element paired with its GPU texture. */
export interface VideoLoop {
  el: HTMLVideoElement;
  tex: VideoTexture;
}

/**
 * Shape of drei's `<Image>` shader material, as far as the video swap needs it.
 * Not exported by drei, hence typed structurally here.
 */
export interface ImageMaterial {
  opacity: number;
  grayscale: number;
  zoom: number;
  map: Texture | null;
  /** Texture dimensions the shader uses for its cover-fit math. */
  imageBounds: Vector2;
}

/**
 * Create a detached, muted video loop plus texture. With `preload: auto` the
 * browser prefetches the clip in the background, so playback can start
 * instantly later. Decoding only happens while the video actually plays.
 */
export function createVideoLoop(src: string): VideoLoop {
  const el = document.createElement('video');
  el.src = src;
  el.muted = true;
  el.loop = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  const tex = new VideoTexture(el);
  tex.colorSpace = SRGBColorSpace;
  return { el, tex };
}

/** Stop playback, release the decoder and free the GPU texture. */
export function disposeVideoLoop({ el, tex }: VideoLoop): void {
  el.pause();
  el.removeAttribute('src');
  el.load();
  tex.dispose();
}

/**
 * Upload the current video frame to the GPU when one is decodable. three
 * relies on requestVideoFrameCallback, which browsers do not reliably fire
 * for video elements that are not in the DOM — without the manual upload the
 * texture would freeze on its first frame.
 */
export function uploadVideoFrame({ el, tex }: VideoLoop): void {
  if (!el.paused && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    tex.needsUpdate = true;
  }
}
