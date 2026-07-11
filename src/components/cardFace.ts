import { BackSide, FrontSide, ShaderMaterial, Vector2, type Side, type Texture } from 'three';

// The dashboard face: one shader per side that samples the chart texture with
// rounded corners, depth desaturation and a slight zoom. The cards are solid
// dark panels — an earlier build merged a frosted aurora backdrop in here, but
// that milk-glass look was dropped, so the face is just the chart now.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;    // the dashboard chart (opaque)
  uniform vec2 uHalf;        // world half-extents (width/2, height/2)
  uniform float uRadius;     // world corner radius
  uniform float uCardAlpha;  // whole-card fade (lifecycle): 0 gone, 1 present
  uniform float uGray;       // desaturation of the chart (back panels)
  uniform float uZoom;       // chart zoom (back panels pull back slightly)
  uniform float uFlip;       // 1 on the back face: mirror U so the chart reads right
  varying vec2 vUv;

  // Rounded-rect coverage in world units, so corners stay circular on the 4:5
  // panel.
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
    vec3 col = mix(tex.rgb, vec3(g), uGray);

    gl_FragColor = vec4(col, uCardAlpha * mask * tex.a);
  }
`;

/** The animated uniforms CarouselItem drives each frame, shared by both faces
    of one card (front + back reference the same objects, so one write updates
    both). uFlip and `side` are the only per-face differences. */
export interface CardFaceUniforms {
  uCardAlpha: { value: number };
  uGray: { value: number };
  uZoom: { value: number };
}

export interface CardFaceMaterials {
  front: ShaderMaterial;
  back: ShaderMaterial;
  uniforms: CardFaceUniforms;
  dispose: () => void;
}

/** Build the front + back face materials for one card. They share the animated
    uniforms; only side (front/back culling) and uFlip differ. */
export function createCardFaceMaterials(
  texture: Texture,
  width: number,
  height: number,
): CardFaceMaterials {
  const shared: CardFaceUniforms = {
    uCardAlpha: { value: 0 },
    uGray: { value: 0 },
    uZoom: { value: 1 },
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
