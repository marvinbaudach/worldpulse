// Dev-only review gallery — shared styled primitives so the whole gallery GUI
// reads as one frosted-glass system over the aurora backdrop, matching the
// app's overlays (PerfHud, DevGalleryLink) via the same `glassSurface`.
// Not part of the app bundle (loaded only under import.meta.env.DEV; see
// DevGallery + App.tsx).

import styled, { css } from 'styled-components';
import { glassSurface } from '../components/glass';

// The gallery's signature blue — the loader globe / app accent — used for
// focus rings, hover glows and the active-control state.
export const ACCENT = '#3870f8';
export const ACCENT_RGB = '56, 112, 248';
export const INK = '#dfe3ec';
export const DIM = '#8b93a3';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** A frosted control (input/select/button): denser than the bare panel so it
    reads as sitting on top of it, with an accent focus ring. */
export const controlCss = css`
  appearance: none;
  -webkit-appearance: none;
  background: rgba(14, 18, 28, 0.55);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  color: ${INK};
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  padding: 6px 10px;
  font: 13px/1.4 ${MONO};
  transition:
    border-color 0.14s ease,
    box-shadow 0.14s ease,
    transform 0.14s ease;

  &:hover {
    border-color: ${ACCENT};
  }
  &:focus,
  &:focus-visible {
    outline: none;
    border-color: ${ACCENT};
    box-shadow: 0 0 0 3px rgba(${ACCENT_RGB}, 0.18);
  }
`;

export const TextInput = styled.input`
  ${controlCss}
  min-width: 210px;
`;

export const Select = styled.select`
  ${controlCss}
  padding-right: 28px;
  cursor: pointer;
  /* Custom chevron so the frosted fill survives appearance:none. */
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 3.5 5 6.5 8 3.5' fill='none' stroke='%238b93a3' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 9px center;

  /* The popup list is OS-drawn; color-scheme:dark + these fills keep it dark. */
  option {
    background: #10141f;
    color: ${INK};
  }
  option:checked {
    background: rgba(${ACCENT_RGB}, 0.32);
    color: #fff;
  }
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
  border-radius: 14px;
`;
