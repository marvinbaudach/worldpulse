import { lazy, Suspense } from 'react';
import styled from 'styled-components';
import { GlobalStyle } from './GlobalStyle';
import { useIsMobile } from './hooks/useIsMobile';

const MobileApp = lazy(() => import('./mobile/MobileApp'));
const DesktopApp = lazy(() => import('./desktop/DesktopApp'));

const Stage = styled.main`
  position: fixed;
  inset: 0;
  background: #080b14;
  overflow: hidden;
  & canvas {
    display: block;
    /* The !important clamp is behavior, not just styling: the mobile loader's
       StarCanvas asks for 106% (edge bleed) and has always been clamped to the
       viewport by this rule — dropping it would change the shipped mobile look. */
    width: 100% !important;
    height: 100% !important;
    touch-action: none; /* drag must not collide with page scroll */
  }
`;

export default function App() {
  const isMobile = useIsMobile();
  return (
    <Stage>
      <GlobalStyle />
      <Suspense fallback={null}>{isMobile ? <MobileApp /> : <DesktopApp />}</Suspense>
    </Stage>
  );
}
