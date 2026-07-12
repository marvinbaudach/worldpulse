// Desktop gallery chrome — shared styled primitives so the whole gallery GUI
// reads as one frosted-glass system over the aubergine backdrop, built on the
// app-wide `glassSurface`. This is the production desktop UI (see DesktopApp).

import styled, { css } from 'styled-components';
import { glassSurface, ACCENT, ACCENT_RGB, INK, DIM, RADIUS } from '../../components/glass';

// Re-export the shared glass tokens so gallery modules keep one import site.
export { ACCENT, ACCENT_RGB, ACCENT_TEXT, INK, DIM, RADIUS, SPACE } from '../../components/glass';

/** The desktop backdrop's Ubuntu-aubergine ramp (bright bloom → near-black
    ground). Chrome tokens, not chart colors — the CVD-validated SERIES palette
    in dashboards/theme.ts stays reserved for data marks. One definition here so
    the backdrop and the progress bar can never drift apart. */
export const AUBERGINE = {
  bloom: '#7a1f6b',
  plum: '#571b52',
  deep: '#3d0f39',
  ground0: '#2c001e',
  ground1: '#1c0518',
  ground2: '#120311',
  ember: '#b5432f',
} as const;

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** A frosted control (input/select/button): denser than the bare panel so it
    reads as sitting on top of it, with a top sheen and an accent glow that
    blooms on hover and lights up fully on focus. */
export const controlCss = css`
  appearance: none;
  -webkit-appearance: none;
  background: linear-gradient(
    180deg,
    rgba(28, 36, 54, 0.6) 0%,
    rgba(14, 18, 28, 0.55) 100%
  );
  backdrop-filter: blur(18px) saturate(1.7);
  -webkit-backdrop-filter: blur(18px) saturate(1.7);
  color: ${INK};
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: ${RADIUS.control};
  padding: 6px 10px;
  font: 13px/1.4 ${MONO};
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.3);
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease,
    transform 0.16s ease;

  &:hover {
    border-color: rgba(${ACCENT_RGB}, 0.65);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      0 2px 10px rgba(0, 0, 0, 0.34),
      0 0 18px -2px rgba(${ACCENT_RGB}, 0.42);
  }
  &:focus,
  &:focus-visible {
    outline: none;
    border-color: ${ACCENT};
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      0 0 0 3px rgba(${ACCENT_RGB}, 0.22),
      0 0 22px -2px rgba(${ACCENT_RGB}, 0.5);
  }
`;

export const TextInput = styled.input`
  ${controlCss}
  min-width: 210px;
`;

export const Button = styled.button`
  ${controlCss}
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:hover {
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.5;
    cursor: progress;
    transform: none;
  }
`;

// A <span>, not a <label>: it wraps the custom GlassSelect widget (a button +
// listbox that carries its own aria-label), not a native form control. A real
// <label> would forward any click inside it — including a click on a menu
// option — to its labelable control, re-firing the trigger and reopening the
// dropdown the moment you pick something. The visible word stays decorative.
export const Label = styled.span`
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: ${DIM};
  font: 13px/1.4 ${MONO};
`;

/** The large frosted pane behind grouped chrome (toolbar, lightbox info). */
export const glassPanel = css`
  ${glassSurface}
  border-radius: ${RADIUS.panel};
`;
