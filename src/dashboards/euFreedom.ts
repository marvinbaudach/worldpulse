// EU freedom-restriction dossier: legislative chronologies that the numeric
// deck can't carry (a proposal stalling for years is a timeline, not a series).
// These complement — not duplicate — the existing FREIHEIT cards (cash-limits,
// digital-id, cbdc, surveillance …); they cover the gaps the deck was missing:
// the Chat-Control regulation, the EU asset register, data retention and the
// Digital Services Act. Facts (dates, regulation numbers, court cases) are
// sourced to primary EU documents; the framing is pointed, the data is not.
//
// Dates use a locale-neutral MM·YYYY / YYYY form so they need no translation.

import { statusTimeline } from './charts';
import type { Dashboard } from './types';

export const EU_FREEDOM_CARDS: Dashboard[] = [
  {
    id: 'chatkontrolle',
    title: 'Chatkontrolle · CSA-Verordnung',
    source:
      'EU-Kommission COM(2022) 209 · Verfahren 2022/0155(COD) · EU-Rat / EU-Parlament; Stand Ende 2025. Aufdeckungsanordnungen würden Anbieter zum Scannen privater Nachrichten (auch verschlüsselter) verpflichten.',
    draw: (f) =>
      statusTimeline(f, {
        label: 'Chatkontrolle · Nachrichtenscan',
        status: { text: 'Vorerst gestoppt', kind: 'blocked' },
        milestones: [
          { date: '05·2022', text: 'Kommission schlägt Aufdeckungsanordnungen vor', kind: 'proposed' },
          { date: '11·2023', text: 'EU-Parlament schützt Verschlüsselung', kind: 'blocked' },
          { date: '06·2024', text: 'Rat zieht Abstimmung kurzfristig zurück', kind: 'blocked' },
          { date: '12·2024', text: 'Ungarns Ratsvorsitz scheitert erneut', kind: 'blocked' },
          { date: '10·2025', text: 'Sperrminorität kippt die Scan-Pflicht', kind: 'blocked' },
          { date: '10·2025', text: 'Dänemark macht das Scannen „freiwillig"', kind: 'proposed' },
        ],
        source: 'EU-Kommission · EU-Rat · Verfahren 2022/0155(COD)',
      }),
  },
  {
    id: 'asset-register',
    title: 'EU-Vermögensregister',
    source:
      'EU-Kommission (GD FISMA, Machbarkeitsstudie 2021) · Geldwäsche-Paket VO (EU) 2024/1624 · Geldwäschebehörde AMLA VO (EU) 2024/1620 (Sitz Frankfurt). Ein zentrales Register würde Eigentum an Immobilien, Firmen, Krypto und Gold verknüpfen.',
    draw: (f) =>
      statusTimeline(f, {
        label: 'Vermögensregister · EU',
        status: { text: 'In Vorbereitung', kind: 'proposed' },
        milestones: [
          { date: '2021', text: 'Kommission gibt Machbarkeitsstudie in Auftrag', kind: 'proposed' },
          { date: '2022', text: 'Studie: zentrales Register für alle Vermögen', kind: 'proposed' },
          { date: '05·2024', text: 'Geldwäsche-Paket beschlossen (VO 2024/1624)', kind: 'adopted' },
          { date: '2024', text: 'Geldwäschebehörde AMLA in Frankfurt gegründet', kind: 'adopted' },
          { date: '2025', text: 'AMLA nimmt Arbeit auf', kind: 'inforce' },
          { date: '2027', text: 'Behördenzugriff auf verknüpfte Daten geplant', kind: 'proposed' },
        ],
        source: 'EU-Kommission · VO (EU) 2024/1624 · AMLA VO (EU) 2024/1620',
      }),
  },
];
