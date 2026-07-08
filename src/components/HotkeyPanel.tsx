import { useEffect, useState } from 'react';
import { LOCALE, cycleLocale, setLocale, t as tr, type Locale } from '../i18n';
import styled from 'styled-components';
import { LAYOUT_MODES, type LayoutMode } from '../layouts';
import { glassSurface } from './glass';

interface HotkeyPanelProps {
  layout: LayoutMode;
  onChange: (mode: LayoutMode) => void;
  /** True while a hero is open — the panel slips away and its hotkeys go
      dormant so nothing competes with the fullscreen card. */
  hidden: boolean;
}

// Bottom-right corner: HandControls owns top-left, PerfHud top-right, the
// theme chips sit bottom-center.
const Wrap = styled.div<{ $hidden: boolean }>`
  position: fixed;
  right: 16px;
  bottom: 18px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  transform: translateY(${(p) => (p.$hidden ? '14px' : '0')});
  opacity: ${(p) => (p.$hidden ? 0 : 1)};
  pointer-events: ${(p) => (p.$hidden ? 'none' : 'auto')};
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
`;

// The card floats above the toggle (absolutely, so its footprint never
// inflates the Wrap's hit area over the bottom-center filter chips) and
// animates in from just below it; collapsed it takes no space and no clicks.
const Panel = styled.div<{ $open: boolean }>`
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: 232px;
  padding: 14px 16px;
  border-radius: 16px;
  ${glassSurface}
  transform-origin: bottom right;
  transform: translateY(${(p) => (p.$open ? '0' : '8px')})
    scale(${(p) => (p.$open ? 1 : 0.96)});
  opacity: ${(p) => (p.$open ? 1 : 0)};
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition:
    opacity 0.25s ease,
    transform 0.25s ease,
    visibility 0.25s;
`;

const Group = styled.div`
  & + & {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
`;

// Accordion header: the whole title row toggles its section.
const GroupTitle = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: ${(p) => (p.$open ? '8px' : '0')};
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-family: inherit;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-align: left;
  cursor: pointer;
  transition: color 0.18s ease;

  &:hover {
    color: rgba(255, 255, 255, 0.7);
  }
`;

const Chevron = styled.span<{ $open: boolean }>`
  font-size: 8px;
  transform: rotate(${(p) => (p.$open ? '90deg' : '0deg')});
  transition: transform 0.2s ease;
`;

// Fold body: rows collapse to zero height when the section is closed.
const GroupBody = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${(p) => (p.$open ? '1fr' : '0fr')};
  transition: grid-template-rows 0.22s ease;

  & > div {
    overflow: hidden;
  }
`;

// A shortcut line: key badge on the left, description on the right. Formation
// rows are buttons, the static hints plain divs — same grid either way.
const Row = styled.button<{ $active?: boolean; $static?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 5px 6px;
  border: none;
  border-radius: 8px;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.24)' : 'transparent')};
  color: ${(p) =>
    p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.72)'};
  font-family: inherit;
  text-align: left;
  cursor: ${(p) => (p.$static ? 'default' : 'pointer')};
  transition:
    background 0.18s ease,
    color 0.18s ease;

  &:hover {
    background: ${(p) =>
      p.$static ? 'transparent' : 'rgba(255, 255, 255, 0.08)'};
  }
`;

const Keycap = styled.span<{ $active?: boolean }>`
  flex: none;
  min-width: 22px;
  padding: 3px 6px;
  border-radius: 5px;
  border: 1px solid
    ${(p) => (p.$active ? 'rgba(120, 170, 255, 0.6)' : 'rgba(255, 255, 255, 0.18)')};
  background: ${(p) =>
    p.$active ? 'rgba(57, 135, 229, 0.3)' : 'rgba(255, 255, 255, 0.06)'};
  color: ${(p) => (p.$active ? '#e4efff' : 'rgba(255, 255, 255, 0.85)')};
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.04em;
  text-align: center;
`;

const Label = styled.span`
  font-size: 12px;
  line-height: 1.25;
`;

const Toggle = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border-radius: 999px;
  ${glassSurface}
  color: ${(p) => (p.$open ? '#cfe4ff' : 'rgba(255, 255, 255, 0.85)')};
  font: 500 12px/1 inherit;
  font-family: inherit;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: rgba(20, 28, 46, 0.7);
    border-color: rgba(255, 255, 255, 0.35);
  }
`;

// Static shortcuts the app already listens for elsewhere (Carousel3D). Listed
// here purely so a presenter can discover them; the panel only *drives* the
// formation rows.
// Native language names — never translated, so every visitor can find their
// own language regardless of the current locale.
const LANGUAGES: { id: Locale; label: string }[] = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'it', label: 'Italiano' },
];

const HINTS: { keys: string; label: string }[] = [
  { keys: '␣', label: 'Rotation pausieren' },
  { keys: '←  →', label: 'Nachbar-Panel' },
  { keys: '+  −', label: 'Zoom' },
  { keys: 'Esc', label: 'Panel schließen' },
  { keys: 'L', label: 'Sprache wechseln' },
];

/**
 * Collapsible keyboard-shortcut legend that doubles as the formation switcher.
 * The formations live here as interactive rows carrying their 1–4 hotkeys, so
 * they no longer need a bar of their own. Number keys pick a formation.
 */
type Section = 'formation' | 'sprache' | 'steuerung';

export function HotkeyPanel({ layout, onChange, hidden }: HotkeyPanelProps) {
  const [open, setOpen] = useState(false);
  // Independent accordion folds; the long static hint list starts collapsed
  // so the two switchers stay above the fold.
  const [folds, setFolds] = useState<Record<Section, boolean>>({
    formation: true,
    sprache: true,
    steuerung: false,
  });
  const toggleFold = (k: Section) => setFolds((f) => ({ ...f, [k]: !f[k] }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // With the panel dismissed behind a hero, the hotkeys would mutate the
      // formation invisibly — swallow them until the hero closes.
      if (hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // "?" (or "/") folds the panel open/closed so it is discoverable
      // without ever reaching for the mouse.
      if (e.key === '?' || e.key === '/') {
        setOpen((v) => !v);
        return;
      }
      // Cycle de → en → fr → it; the pick is stored and survives reloads.
      if (e.key === 'l' || e.key === 'L') {
        cycleLocale();
        return;
      }
      const i = Number(e.key) - 1;
      if (i >= 0 && i < LAYOUT_MODES.length) onChange(LAYOUT_MODES[i].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Wrap $hidden={hidden}>
      <Panel $open={open} role="region" aria-label={tr('Tastenkürzel')}>
        <Group>
          <GroupTitle
            type="button"
            $open={folds.formation}
            aria-expanded={folds.formation}
            onClick={() => toggleFold('formation')}
          >
            {tr('FORMATION')} <Chevron $open={folds.formation}>▶</Chevron>
          </GroupTitle>
          <GroupBody $open={folds.formation}>
            <div>
              {LAYOUT_MODES.map((mode, i) => (
                <Row
                  key={mode.id}
                  type="button"
                  $active={layout === mode.id}
                  onClick={() => onChange(mode.id)}
                >
                  <Keycap $active={layout === mode.id}>{i + 1}</Keycap>
                  <Label>{tr(mode.label)}</Label>
                </Row>
              ))}
            </div>
          </GroupBody>
        </Group>
        <Group>
          <GroupTitle
            type="button"
            $open={folds.sprache}
            aria-expanded={folds.sprache}
            onClick={() => toggleFold('sprache')}
          >
            {tr('SPRACHE')} <Chevron $open={folds.sprache}>▶</Chevron>
          </GroupTitle>
          <GroupBody $open={folds.sprache}>
            <div>
              {LANGUAGES.map((lang) => (
                <Row
                  key={lang.id}
                  type="button"
                  $active={LOCALE === lang.id}
                  onClick={() => setLocale(lang.id)}
                >
                  <Keycap $active={LOCALE === lang.id}>{lang.id.toUpperCase()}</Keycap>
                  <Label>{lang.label}</Label>
                </Row>
              ))}
            </div>
          </GroupBody>
        </Group>
        <Group>
          <GroupTitle
            type="button"
            $open={folds.steuerung}
            aria-expanded={folds.steuerung}
            onClick={() => toggleFold('steuerung')}
          >
            {tr('STEUERUNG')} <Chevron $open={folds.steuerung}>▶</Chevron>
          </GroupTitle>
          <GroupBody $open={folds.steuerung}>
            <div>
              {HINTS.map((h) => (
                <Row key={h.label} as="div" $static>
                  <Keycap>{h.keys}</Keycap>
                  <Label>{tr(h.label)}</Label>
                </Row>
              ))}
            </div>
          </GroupBody>
        </Group>
      </Panel>
      <Toggle
        type="button"
        $open={open}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⌨ {tr('Tasten')}
      </Toggle>
    </Wrap>
  );
}
