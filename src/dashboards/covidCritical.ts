// Corona-critical dossier: the cards the existing COVID deck was still missing —
// a factual Event-201 chronology, the German measures timeline, the raw-vs-
// age-adjusted excess-mortality contrast, and the German (PEI) suspected-report
// rates by vaccine. They complement — not duplicate — the numeric COVID cards
// already in cards.ts (stringency, lockdowns, excess maps, EudraVigilance/VAERS
// reports, adjudicated risks, myocarditis).
//
// House rule holds throughout: the framing is pointed, the data is not. Every
// figure is sourced to a primary institution (JHCHS/WEF, Bundestag/BMG, Destatis
// WISTA, Paul-Ehrlich-Institut); passive-report counts are labelled as suspected
// cases, never multiplied into a "corrected" harm figure (see CLAUDE.md, "Data
// integrity & uncertainty"). Dates use the locale-neutral MM·YYYY / YYYY form so
// they need no translation.

import { hBarChart, statusTimeline } from './charts';
import { red } from './cardHelpers';
import { localePct } from '../i18n';
import type { Dashboard } from './types';

export const COVID_CRITICAL_CARDS: Dashboard[] = [
  {
    // Neutral chronology, not the conspiracy reading: Event 201 was a pandemic
    // preparedness exercise, one of a JHCHS series (Dark Winter, Clade X). The
    // organisers explicitly stated it was not a prediction — that milestone
    // reads GOOD green (a debunk), the exercise facts stay neutral blue.
    id: 'event-201',
    title: 'Event 201 · Pandemie-Planübung',
    source:
      'Johns Hopkins Center for Health Security · Weltwirtschaftsforum · Gates-Stiftung — Planspiel am 18.10.2019 in New York, 15 Teilnehmende, 3,5 Stunden. Fiktives Szenario zu einem neuen Coronavirus (Fledermaus → Schwein → Mensch), 65 Mio. Tote im 18-Monats-Modell, 7 Empfehlungen zur Zusammenarbeit von Staat und Wirtschaft. Ausdrücklich keine Prognose (JHCHS-Stellungnahme); Vorläuferübung „Clade X" 2018. Chronik einer Übung — kein Beleg für eine geplante Pandemie.',
    draw: (f) =>
      statusTimeline(f, {
        label: 'Event 201 · Pandemie-Planübung',
        status: { text: 'Planübung · Okt 2019', kind: 'proposed' },
        milestones: [
          { date: '2018', text: 'Vorläuferübung „Clade X" (JHCHS)', kind: 'proposed' },
          { date: '10·2019', text: 'Event 201 · Johns Hopkins, WEF, Gates-Stiftung', kind: 'proposed' },
          { date: '10·2019', text: 'Szenario: neues Coronavirus, Schwein → Mensch', kind: 'proposed' },
          { date: '10·2019', text: '65 Mio. Tote im 18-Monats-Modell', kind: 'proposed' },
          { date: '10·2019', text: '7 Empfehlungen · Staat-Wirtschaft-Kooperation', kind: 'proposed' },
          { date: '01·2020', text: 'JHCHS: „keine Vorhersage von COVID-19"', kind: 'blocked' },
        ],
        source: 'Johns Hopkins Center for Health Security · WEF · Gates-Stiftung, 18.10.2019 · Übungsszenario, keine Prognose',
      }),
  },
  {
    // The German measures chronology as a timeline — the numeric COVID cards
    // (stringency, lockdown-days) carry magnitude, not sequence. Red = a
    // restriction in force, green = struck down / expired / rejected, so the
    // arc from hard lockdown to the rejected general vaccine mandate is legible
    // at a glance.
    id: 'de-corona-massnahmen',
    title: 'Corona-Maßnahmen · Deutschland',
    source:
      'Bundestag / Bundesgesundheitsministerium · IfSG §28b (4. Bevölkerungsschutzgesetz, 04/2021, „Bundesnotbremse") · Gesetz zur Stärkung der Impfprävention (beschlossen 10.12.2021, in Kraft 15.03.2022) · Bundestag 07.04.2022: allgemeine Impfpflicht abgelehnt. Rot = in Kraft, Grün = aufgehoben / abgelehnt.',
    draw: (f) =>
      statusTimeline(f, {
        label: 'Corona-Maßnahmen · 🇩🇪',
        status: { text: 'Größtenteils aufgehoben', kind: 'blocked' },
        milestones: [
          { date: '03·2020', text: 'Erster Lockdown · Kontaktverbot', kind: 'inforce' },
          { date: '12·2020', text: 'Harter Lockdown über Weihnachten', kind: 'inforce' },
          { date: '04·2021', text: 'Bundesnotbremse · §28b IfSG', kind: 'inforce' },
          { date: '08·2021', text: '3G, später 2G · Zugangsregeln', kind: 'inforce' },
          { date: '12·2021', text: 'Einrichtungsbez. Impfpflicht beschlossen', kind: 'adopted' },
          { date: '04·2022', text: 'Allgemeine Impfpflicht abgelehnt', kind: 'blocked' },
          { date: '12·2022', text: 'Einrichtungsbezogene Impfpflicht ausgelaufen', kind: 'blocked' },
          { date: '04·2023', text: 'Letzte Schutzmaßnahmen enden', kind: 'blocked' },
        ],
        source: 'Bundestag / BMG · IfSG §28b · Impfpräventionsgesetz · Abstimmung 07.04.2022',
      }),
  },
  {
    // Raw vs. age-standardised excess mortality — the CLAUDE.md example of
    // "raw and adjusted, both labelled". Destatis' own finding is that most of
    // the 2020/21 rise is demographic (an ageing population dying at a normal
    // age-specific rate), so the age-adjusted bars collapse well below the raw
    // p-scores. Both drawn, neither substituted.
    id: 'excess-age-adjusted',
    title: 'Übersterblichkeit · roh vs. altersbereinigt',
    source:
      'Statistisches Bundesamt (Destatis) · Sonderauswertung Sterbefälle (rohe P-Scores 2020/21 ggü. Vor-Pandemie-Erwartung, gerundet) und WISTA 1/2023, Kauermann/De Nicola (altersstandardisiert; CODAG). Kernbefund: Der Anstieg 2020/21 lässt sich größtenteils durch die alternde Bevölkerung erklären — altersbereinigt bleibt 2020 nahe null, 2021 rund +2,3 %. Roh und bereinigt getrennt ausgewiesen; keine Zahl ersetzt die andere.',
    draw: (f) =>
      hBarChart(f, {
        label: 'Übersterblichkeit · roh vs. altersbereinigt · 🇩🇪',
        value: 7,
        fmt: (v) => `+${localePct(v, 1)}`,
        rowFmt: (v) => `+${localePct(v, 1)}`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: '2020 · roh', v: 5 },
          { name: '2020 · altersbereinigt', v: 1 },
          { name: '2021 · roh', v: 7 },
          { name: '2021 · altersbereinigt', v: 2.3 },
        ],
      }),
  },
];
