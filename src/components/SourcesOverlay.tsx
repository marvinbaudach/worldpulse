import styled from 'styled-components';
import { SOURCE_GROUPS, SOURCE_DISCLAIMER } from '../dashboards/cardSources';
import { glassSurface } from './glass';

// Global "Quellen" panel: the full, grouped list of every data source, with a
// link to each institution. One responsive component shared by desktop and
// mobile — it centres in the viewport, caps its height and scrolls inside, so
// it works on a phone (safe-area padded) and on a wide screen alike.

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(3, 5, 9, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const Panel = styled.div`
  ${glassSurface}
  width: min(560px, 100%);
  max-height: min(80vh, 100%);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom, 0px);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
`;

const Title = styled.h2`
  margin: 0;
  color: #eaf2ff;
  font: 700 15px/1.2 inherit;
  letter-spacing: 0.14em;
  text-transform: uppercase;
`;

const Close = styled.button`
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #cfe4ff;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
`;

const Body = styled.div`
  overflow-y: auto;
  padding: 6px 18px 18px;
`;

const Group = styled.section`
  margin-top: 14px;
`;

const GroupTitle = styled.h3`
  margin: 0 0 6px;
  color: #8fb2e0;
  font: 700 10px/1.3 inherit;
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const Item = styled.a`
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.86);
  text-decoration: none;
  font: 400 13px/1.35 inherit;

  &:hover {
    color: #cfe4ff;
  }
`;

const Link = styled.span`
  margin-left: auto;
  color: rgba(120, 170, 240, 0.85);
  font-size: 11px;
  white-space: nowrap;
`;

const Foot = styled.p`
  margin: 16px 0 0;
  color: rgba(255, 255, 255, 0.45);
  font: 400 10.5px/1.5 inherit;
`;

/** Strip the scheme so the shown link stays short (fis vs. https://…). */
const short = (url: string) => url.replace(/^https?:\/\//, '');

interface SourcesOverlayProps {
  onClose: () => void;
}

export function SourcesOverlay({ onClose }: SourcesOverlayProps) {
  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Head>
          <Title>Quellen</Title>
          <Close onClick={onClose} aria-label="Schließen">
            ×
          </Close>
        </Head>
        <Body>
          {SOURCE_GROUPS.map((group) => (
            <Group key={group.title}>
              <GroupTitle>{group.title}</GroupTitle>
              {group.items.map((s) =>
                s.url ? (
                  <Item key={s.name} href={s.url} target="_blank" rel="noreferrer noopener">
                    <span>{s.name}</span>
                    <Link>{short(s.url)}</Link>
                  </Item>
                ) : (
                  <Item key={s.name} as="div">
                    <span>{s.name}</span>
                  </Item>
                ),
              )}
            </Group>
          ))}
          <Foot>{SOURCE_DISCLAIMER}</Foot>
        </Body>
      </Panel>
    </Backdrop>
  );
}
