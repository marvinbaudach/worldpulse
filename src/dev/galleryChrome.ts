// Dev-only review gallery — shared styled primitives so the whole gallery GUI
// reads as one frosted-glass system over the aurora backdrop, matching the
// app's overlays (PerfHud, DevGalleryLink) via the same `glassSurface`.
// Not part of the app bundle (loaded only under import.meta.env.DEV; see
// DevGallery + App.tsx).

import styled, { css } from 'styled-components';
import { glassSurface, ACCENT, ACCENT_RGB, INK, DIM, RADIUS } from '../components/glass';

// Re-export the shared glass tokens so gallery modules keep one import site.
export { ACCENT, ACCENT_RGB, ACCENT_TEXT, INK, DIM, RADIUS } from '../components/glass';

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

export const Label = styled.label`
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
