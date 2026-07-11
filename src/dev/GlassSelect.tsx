// Dev-only review gallery — the design-system dropdown. Native <select> popups
// are OS-drawn and can't take backdrop-filter, so the toolbar's selects would
// never match the rest of the frosted-glass chrome. This is a custom listbox:
// the trigger reuses the shared `controlCss` (so it's identical to the other
// glass controls), and the popup is a real glass panel with the same accent
// hover/selected glow as the context menu — one cohesive component system.
//
// Accessible: button + role=listbox/option, full keyboard nav (Arrows / Home /
// End / Enter / Esc / type-to-open), click-outside close, and it stops its own
// keys from bubbling to the app's global `g` toggle.

import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { glassSurface, RADIUS } from '../components/glass';
import { controlCss, ACCENT, ACCENT_RGB, INK } from './galleryChrome';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  minWidth?: number;
}

const Wrap = styled.div`
  position: relative;
  display: inline-flex;
`;

const Trigger = styled.button<{ $minWidth?: number }>`
  ${controlCss}
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: ${(p) => (p.$minWidth ? `${p.$minWidth}px` : 'auto')};

  .chev {
    flex: none;
    transition: transform 0.16s ease;
    color: ${ACCENT};
  }
  &[aria-expanded='true'] {
    border-color: ${ACCENT};
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      0 0 0 3px rgba(${ACCENT_RGB}, 0.22),
      0 0 22px -2px rgba(${ACCENT_RGB}, 0.5);
  }
  &[aria-expanded='true'] .chev {
    transform: rotate(180deg);
  }
`;

const Menu = styled.ul`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 40;
  margin: 0;
  padding: 5px;
  min-width: 100%;
  max-height: 320px;
  overflow-y: auto;
  /* Keep wheel momentum inside the menu — no scroll-chaining to the page once an
     end is reached, which reads as a stall. */
  overscroll-behavior: contain;
  list-style: none;
  ${glassSurface}
  /* Denser than a bare panel: a menu floats over busy grid content, so it needs
     more opacity to stay readable while the blur still diffuses what's behind. */
  background: linear-gradient(
    180deg,
    rgba(22, 28, 42, 0.9) 0%,
    rgba(12, 16, 24, 0.88) 100%
  );
  /* The fill above is ~89% opaque, so the glassSurface blur barely shows — but a
     backdrop-filter on a *scrolling* element forces the browser to re-blur the
     grid behind it every frame, which is what makes the wheel feel sluggish.
     Drop it here; the near-opaque gradient carries the look. */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-radius: ${RADIUS.menu};
  animation: ddIn 130ms cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes ddIn {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Opt = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 10px;
  border-radius: ${RADIUS.item};
  color: ${INK};
  font: 13px/1.4 ${MONO};
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.12s ease,
    box-shadow 0.12s ease,
    color 0.12s ease;

  .check {
    opacity: 0;
    color: ${ACCENT};
  }
  &[aria-selected='true'] .check {
    opacity: 1;
  }
  /* Active = keyboard/hover focus — the same accent glow as the context menu. */
  &[data-active='true'] {
    background: linear-gradient(
      180deg,
      rgba(${ACCENT_RGB}, 0.24),
      rgba(${ACCENT_RGB}, 0.12)
    );
    box-shadow:
      inset 0 0 0 1px rgba(${ACCENT_RGB}, 0.35),
      0 0 16px -4px rgba(${ACCENT_RGB}, 0.5);
    color: #fff;
  }
`;

function Chevron() {
  return (
    <svg
      className="chev"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 3.5 5 6.5 8 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlassSelect({ value, options, onChange, ariaLabel, minWidth }: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  const openMenu = (): void => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const close = (): void => setOpen(false);
  const commit = (i: number): void => {
    const opt = options[i];
    if (opt) onChange(opt.value);
    close();
  };

  // Keep the active option scrolled into view as it moves.
  useEffect(() => {
    if (open) (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  // Outside pointer / scroll closes.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        openMenu();
      }
      return;
    }
    // Swallow keys while open so they don't reach the app's global shortcuts.
    e.stopPropagation();
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(active);
        break;
      case 'Tab':
        close();
        break;
    }
  };

  return (
    <Wrap ref={rootRef} onKeyDown={onKeyDown}>
      <Trigger
        type="button"
        $minWidth={minWidth}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
      >
        <span>{selected?.label ?? ''}</span>
        <Chevron />
      </Trigger>
      {open && (
        <Menu ref={listRef} role="listbox" aria-label={ariaLabel}>
          {options.map((o, i) => (
            <Opt
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(i)}
            >
              <span>{o.label}</span>
              <span className="check">✓</span>
            </Opt>
          ))}
        </Menu>
      )}
    </Wrap>
  );
}
