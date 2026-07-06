import { useEffect } from 'react';
import styled from 'styled-components';
import { LAYOUT_MODES, type LayoutMode } from '../layouts';

interface LayoutControlsProps {
  layout: LayoutMode;
  onChange: (mode: LayoutMode) => void;
  count: number;
  minCount: number;
  maxCount: number;
  onCountChange: (count: number) => void;
  /** True while a hero is open — the bar slips away so nothing competes
      with the fullscreen card. */
  hidden: boolean;
}

// Bottom center: HandControls owns the top-left, PerfHud the top-right.
const Bar = styled.div<{ $hidden: boolean }>`
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translate(-50%, ${(p) => (p.$hidden ? '14px' : '0')});
  opacity: ${(p) => (p.$hidden ? 0 : 1)};
  pointer-events: ${(p) => (p.$hidden ? 'none' : 'auto')};
  z-index: 10;
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(10, 14, 24, 0.55);
  backdrop-filter: blur(8px);
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
`;

const Mode = styled.button<{ $active: boolean }>`
  padding: 7px 14px;
  border: none;
  border-radius: 999px;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.28)' : 'transparent')};
  color: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.55)')};
  font: 600 11px/1 inherit;
  font-family: inherit;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    color: rgba(255, 255, 255, 0.9);
  }
`;

const Divider = styled.div`
  width: 1px;
  margin: 4px 3px;
  background: rgba(255, 255, 255, 0.14);
`;

const Step = styled.button`
  width: 28px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: 600 13px/1 inherit;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover:enabled {
    color: rgba(255, 255, 255, 0.9);
  }
  &:disabled {
    color: rgba(255, 255, 255, 0.18);
    cursor: default;
  }
`;

const Count = styled.div`
  min-width: 24px;
  align-self: center;
  text-align: center;
  color: #cfe4ff;
  font: 600 11px/1 inherit;
  font-family: inherit;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
`;

/**
 * Formation switcher and panel-count stepper. Hotkeys for presenting: 1-4
 * pick the formation, +/- adjust how many panels are on stage.
 */
export function LayoutControls({
  layout,
  onChange,
  count,
  minCount,
  maxCount,
  onCountChange,
  hidden,
}: LayoutControlsProps) {
  const step = (delta: number) =>
    onCountChange(Math.min(maxCount, Math.max(minCount, count + delta)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // With the bar hidden behind a hero, the hotkeys would mutate the
      // formation invisibly — swallow them until the hero closes.
      if (hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < LAYOUT_MODES.length) onChange(LAYOUT_MODES[i].id);
      if (e.key === '+') step(1);
      if (e.key === '-') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Bar $hidden={hidden}>
      {LAYOUT_MODES.map((mode) => (
        <Mode
          key={mode.id}
          $active={layout === mode.id}
          onClick={() => onChange(mode.id)}
        >
          {mode.label}
        </Mode>
      ))}
      <Divider />
      <Step onClick={() => step(-1)} disabled={count <= minCount}>
        −
      </Step>
      <Count>{count}</Count>
      <Step onClick={() => step(1)} disabled={count >= maxCount}>
        +
      </Step>
    </Bar>
  );
}
