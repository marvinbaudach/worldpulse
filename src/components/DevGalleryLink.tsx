import styled from 'styled-components';
import { glassSurface } from './glass';

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
  border-radius: 12px;
  color: #cfe4ff;
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
    border-color: rgba(122, 162, 255, 0.7);
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
