// Tech-future dossiers: milestone chronologies (LLM → AGI, humanoid robots)
// that have no clean numeric series — documented history as filled dots, the
// "we are here" anchor, then forecasts as dashed hollow dots. The honesty is
// structural: a prediction never renders like a measurement, and the spread
// between forecast sources (community ~2033 vs. researcher median 2047) is
// itself the information, not noise to be averaged away.
//
// Dates use locale-neutral year forms so they need no translation.

import { statusTimeline } from './charts';
import type { Dashboard } from './types';

export const TECH_FUTURE_CARDS: Dashboard[] = [
  {
    id: 'agi-path',
    title: 'Der Weg zur Superintelligenz',
    source:
      'Meilensteine: dokumentierte Modell-Releases · Prognosen: Metaculus Frage 5121, Community-Median Ende 2032 (Stand 07/2026) und Grace et al. 2024 — 2.778 befragte KI-Forscher, Median für „High-Level Machine Intelligence“ 2047. Prognosen sind keine Messungen; die Spreizung der Quellen ist die eigentliche Auskunft.',
    draw: (f) =>
      statusTimeline(f, {
        label: 'Von LLM zu AGI · wo wir stehen',
        status: { text: 'Wir stehen hier: Agenten-Ära', kind: 'now' },
        milestones: [
          { date: '2012', text: 'AlexNet — Deep Learning zündet', kind: 'past' },
          { date: '2020', text: 'GPT-3 — Sprachmodelle skalieren', kind: 'past' },
          { date: '2022', text: 'ChatGPT — KI für alle', kind: 'past' },
          { date: '2024', text: 'Reasoning-Modelle denken vor dem Antworten', kind: 'past' },
          { date: '2026', text: 'Agenten schaffen Aufgaben von Stunden', kind: 'now' },
          { date: '~2033', text: 'AGI? — Wettmarkt-Median (Metaculus)', kind: 'forecast' },
          { date: '2047', text: 'AGI? — Median von 2.778 KI-Forschern', kind: 'forecast' },
          { date: '?', text: 'Superintelligenz — kein seriöses Datum', kind: 'forecast' },
        ],
        source: 'Metaculus · Grace et al. 2024 · METR',
      }),
  },
  {
    id: 'humanoids',
    title: 'Humanoide Roboter · vom Labor in die Fabrik',
    source:
      'Meilensteine: Waseda-Universität, Honda, Boston Dynamics/DARPA, Tesla, Unitree, Figure/BMW (Hersteller- und Pressearchive) · Verkäufe 2025: ~13.000 Humanoide weltweit (Omdia) · Prognosen: Goldman Sachs Research 2024 (1,4 Mio Stück/Jahr und 38 Mrd $ Markt bis 2035), Morgan Stanley 2025 (~1 Mrd. im Einsatz, 5 Bio $ Markt bis 2050) — Prognosen, keine Messungen.',
    draw: (f) =>
      statusTimeline(f, {
        label: 'Humanoide · 1973 → heute → Prognose',
        status: { text: 'Serienfertigung läuft an', kind: 'now' },
        milestones: [
          { date: '1973', text: 'WABOT-1 — erster Humanoide (Waseda)', kind: 'past' },
          { date: '2000', text: 'ASIMO — Honda lässt ihn gehen', kind: 'past' },
          { date: '2022', text: 'Tesla Optimus — erster Prototyp', kind: 'past' },
          { date: '2024', text: 'Unitree G1 ab 16.000 $ — Massenmarktpreis', kind: 'past' },
          { date: '2025', text: 'Figure 02 arbeitet im BMW-Werk', kind: 'past' },
          { date: '2026', text: '~13.000 verkauft im Jahr 2025 (Omdia)', kind: 'now' },
          { date: '2035', text: '1,4 Mio pro Jahr? — Goldman Sachs', kind: 'forecast' },
          { date: '2050', text: '1 Mrd. im Einsatz? — Morgan Stanley', kind: 'forecast' },
        ],
        source: 'Hersteller-Archive · Omdia · Goldman Sachs · Morgan Stanley',
      }),
  },
];
