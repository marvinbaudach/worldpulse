// Picsum returns consistently high-quality photos. A fresh random seed per
// panel is generated on every load, so the carousel shows new images each time.
const COUNT = 16;

// Image dimensions: high enough that the enlarged hero card stays crisp.
const WIDTH = 1200;
const HEIGHT = 1500;

export interface CarouselImage {
  id: string;
  url: string;
}

// Random, collision-unlikely seed -> a different Picsum photo every load.
function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const IMAGES: CarouselImage[] = Array.from({ length: COUNT }, () => {
  const seed = randomSeed();
  return {
    id: seed,
    url: `https://picsum.photos/seed/${seed}/${WIDTH}/${HEIGHT}`,
  };
});

export const IMAGE_COUNT = IMAGES.length;
