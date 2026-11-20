// Stroke icons for the gallery chrome: inline SVG on currentColor, same 24px
// grid, 2px round stroke and construction as the mobile deck's menu icons, so
// both surfaces draw their glyphs from one family instead of Unicode symbols.

import styled from 'styled-components';

const Icon = styled.svg.attrs({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})`
  width: 16px;
  height: 16px;
  flex: none;
`;

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Icon>
);

export const DownloadIcon = () => (
  <Icon>
    <path d="M12 3v12" />
    <path d="m8 11 4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Icon>
);

/** Chevron pointing left (`dir="prev"`) or right (`dir="next"`). */
export const ChevronIcon = ({ dir }: { dir: 'prev' | 'next' }) => (
  <Icon>
    <path d={dir === 'prev' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
  </Icon>
);
