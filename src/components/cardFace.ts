import { BackSide, FrontSide, ShaderMaterial, Vector2, type Side, type Texture } from 'three';
import { auroraBackdrop } from './auroraBackdrop';

// The dashboard face and its frosted backdrop, merged into one material. The
// old build layered a drei <Image> over a separate FrostPlate mesh; on a
// fill-rate-bound scene that second transparent layer, spanning the whole panel
// on every card, was pure overdraw. Here the face shader samples the aurora
// backdrop itself (screen space) wherever the chart surface is translucent, so
// the milk glass costs one layer instead of two.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// macOS-material shaping on the blurred backdrop sample (matches the retired
// FrostPlate): saturation boost so the glass looks vivid, then a gain + cool
// lift so a pane always reads as lit milk glass.
const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;    // the dashboard chart (frost-backed: surface < 1 alpha)
  uniform sampler2D uFrost;  // the tiny aurora backdrop buffer
  uniform vec2 uRes;         // drawing-buffer size, for the screen-space sample
  uniform vec2 uHalf;        // world half-extents (width/2, height/2)
  uniform float uRadius;     // world corner radius
  uniform float uCardAlpha;  // whole-card fade (lifecycle): 0 gone, 1 present
  uniform float uChartMix;   // chart vs. frost: depth dimming pushes this down
  uniform float uGray;       // desaturation of the chart (back panels)
  uniform float uZoom;       // chart zoom (back panels pull back slightly)
  uniform float uFlip;       // 1 on the back face: mirror U so the chart reads right
  varying vec2 vUv;

  const float SAT = 1.45;
  const float GAIN = 1.1;
  const vec3 LIFT = vec3(0.025, 0.032, 0.05);

  // Rounded-rect coverage in world units, so corners stay circular on the 4:5
  // panel and match the old alpha-mask radius.
  float roundedMask(vec2 uv) {
    vec2 p = (uv - 0.5) * uHalf * 2.0;
    vec2 d = abs(p) - (uHalf - uRadius);
    float dist = length(max(d, 0.0)) - uRadius;
    return 1.0 - smoothstep(-0.008, 0.008, dist);
  }

  void main() {
    float mask = roundedMask(vUv);
    if (mask < 0.001) discard;

    // Chart sample: zoom around the center, mirror U on the back face.
    vec2 uv = (vUv - 0.5) / uZoom + 0.5;
    uv.x = mix(uv.x, 1.0 - uv.x, uFlip);
    vec4 tex = texture2D(uMap, uv);
    float g = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    vec3 chart = mix(tex.rgb, vec3(g), uGray);

    // Frost: the aurora backdrop, upsampled from its 64px buffer at this
    // fragment's screen position — that upsample IS the heavy blur.
    vec3 frost = texture2D(uFrost, gl_FragCoord.xy / uRes).rgb;
    float luma = dot(frost, vec3(0.299, 0.587, 0.114));
    frost = mix(vec3(luma), frost, SAT) * GAIN + LIFT;

    // Where the chart surface is translucent (tex.a < 1), the frost shows
    // through. The card is otherwise opaque — the frost fills the holes, so no
    // sharp background pokes through (that was the whole point of the pane).
    vec3 col = mix(frost, chart, tex.a * uChartMix);
    gl_FragColor = vec4(col, uCardAlpha * mask);
  }
`;

/** The animated uniforms CarouselItem drives each frame, shared by both faces
    of one card (front + back reference the same objects, so one write updates
    both). uFlip and `side` are the only per-face differences. */
export interface CardFaceUniforms {
  uCardAlpha: { value: number };
  uChartMix: { value: number };
  uGray: { value: number };
  uZoom: { value: number };
  uFrost: { value: Texture | null };
  uRes: { value: Vector2 };
}

export interface CardFaceMaterials {
  front: ShaderMaterial;
  back: ShaderMaterial;
  uniforms: CardFaceUniforms;
  dispose: () => void;
}

/** Build the front + back face materials for one card. They share the animated
    uniforms; only side (FrontSide/BackSide via DoubleSide + polygon facing) and
    uFlip differ. Both are DoubleSide-safe by using FrontSide/BackSide culling
    to keep exactly one face per card in the draw. */
export function createCardFaceMaterials(
  texture: Texture,
  width: number,
  height: number,
): CardFaceMaterials {
  const shared: CardFaceUniforms = {
    uCardAlpha: { value: 0 },
    uChartMix: { value: 0 },
    uGray: { value: 0 },
    uZoom: { value: 1 },
    uFrost: { value: null },
    uRes: { value: new Vector2(1, 1) },
  };
  const statics = {
    uMap: { value: texture },
    uHalf: { value: new Vector2(width / 2, height / 2) },
    uRadius: { value: 0.06 },
  };
  const make = (flip: number, side: Side) =>
    new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...shared, ...statics, uFlip: { value: flip } },
      transparent: true,
      side,
    });
  // Front face shows the chart; back face mirrors it (uFlip = 1) so a card
  // turned away reads right. Culling keeps exactly one per view.
  const front = make(0, FrontSide);
  const back = make(1, BackSide);

  return {
    front,
    back,
    uniforms: shared,
    dispose: () => {
      front.dispose();
      back.dispose();
    },
  };
}

/** Refresh the per-frame frost inputs on a card's shared uniforms. */
export function updateCardFrost(u: CardFaceUniforms, res: Vector2): void {
  u.uFrost.value = auroraBackdrop.tex;
  u.uRes.value.copy(res);
}
