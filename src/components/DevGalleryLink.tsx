import styled from 'styled-components';
import { glassSurface, ACCENT, ACCENT_RGB, ACCENT_TEXT, RADIUS } from './glass';

// Dev-only shortcut that toggles the in-app card review gallery (a single-page
// view that fades in over the ring — no page navigation, no state lost). The
// gallery itself is desktop-only and code-split behind import.meta.env.DEV, so
// this button and everything it opens never ship to production. App decides
// when to render it (desktop, dev, and only while the gallery is closed).
const Button = styled.button`
  position: fixed;
  left: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
  z-index: 13;
  padding: 7px 12px;
  border-radius: ${RADIUS.control};
  color: ${ACCENT_TEXT};
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em;
  cursor: pointer;
  opacity: 0.62;
  transition:
    opacity 0.14s ease,
    transform 0.14s ease,
    border-color 0.14s ease;
  ${glassSurface}

  &:hover,
  &:focus-visible {
    opacity: 1;
    transform: translateY(-1px);
    /* Same accent + glow shape as the gallery's controls (controlCss), so the
       launcher and everything it opens share one glow. */
    border-color: ${ACCENT};
    box-shadow:
      0 14px 44px -14px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      0 0 22px -2px rgba(${ACCENT_RGB}, 0.5);
    outline: none;
  }
`;

interface DevGalleryLinkProps {
  onOpen: () => void;
}

export function DevGalleryLink({ onOpen }: DevGalleryLinkProps) {
  if (!import.meta.env.DEV) return null;
  return (
    <Button type="button" onClick={onOpen} aria-label="Karten-Galerie öffnen (Dev)">
      ⧉ Gallery
    </Button>
  );
}
