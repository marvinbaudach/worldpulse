// Curated nature clips from the Pexels CDN (hotlinkable, CORS-enabled).
// Each panel shows the clip's poster frame; hovering swaps in the video
// loop itself, so the motion continues exactly where the still left off.

// Poster dimensions: high enough that the enlarged hero card stays crisp.
const WIDTH = 1200;
const HEIGHT = 1500;

interface Clip {
  id: number;
  /** Frame rate encoded in the CDN file name of the SD variant. */
  fps: 24 | 25 | 30;
}

// Hand-picked for the nature theme; ids verified against the CDN.
const CLIPS: Clip[] = [
  { id: 856973, fps: 25 }, // lone tree at sunset
  { id: 857195, fps: 25 }, // snowy peak under a starry sky
  { id: 1409899, fps: 25 }, // surf breaking on a rocky coast (aerial)
  { id: 3571264, fps: 30 }, // turquoise waves (aerial)
  { id: 2098989, fps: 30 }, // jungle waterfalls
  { id: 1093662, fps: 30 }, // coastal rocks in golden light
  { id: 1526909, fps: 24 }, // seal resting on the beach
  { id: 1918465, fps: 24 }, // open-ocean swell (aerial)
  { id: 2711092, fps: 24 }, // sunlit forest floor
  { id: 2169880, fps: 30 }, // jungle coastline (aerial)
  { id: 857134, fps: 24 }, // milky way over the treeline
  { id: 856065, fps: 30 }, // cattle grazing at dusk
  { id: 3173312, fps: 30 }, // thundering waterfall edge
  { id: 855785, fps: 24 }, // drifting clouds
];

export interface CarouselImage {
  id: string;
  /** Poster still (4:5 crop) shown while the panel is idle. */
  url: string;
  /** Small mp4 loop (360p) played while the panel is hovered. */
  video: string;
  /** 720p variant for the enlarged hero card (same clip, same fps). */
  videoHd: string;
}

export const IMAGES: CarouselImage[] = CLIPS.map(({ id, fps }) => ({
  id: String(id),
  url: `https://images.pexels.com/videos/${id}/free-video-${id}.jpg?w=${WIDTH}&h=${HEIGHT}&fit=crop`,
  video: `https://videos.pexels.com/video-files/${id}/${id}-sd_640_360_${fps}fps.mp4`,
  videoHd: `https://videos.pexels.com/video-files/${id}/${id}-hd_1280_720_${fps}fps.mp4`,
}));
