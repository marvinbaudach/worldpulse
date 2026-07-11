// CPU-Rennen: Apples ARM-Kerne gegen Intel und AMD. Four static, bundled cards —
// there is no keyless public benchmark API, so every figure is a real, cited
// published score (no live read, no fallback needed):
//   1. single-core snapshot (who has the fastest core today — Apple M5),
//   2. multi-core snapshot (raw throughput — x86 still edges it),
//   3. efficiency / "Stromhunger" (compute per watt — Apple's ARM lead),
//   4. the 2016→2026 race (Intel stagnates, AMD's Zen comeback, Apple's leap).
// The process node each flagship runs on rides along as the per-row `sub` — the
// twist being that Apple, AMD *and* even Intel's newest all lean on TSMC's
// leading nodes; only Intel's older 14900K used Intel's own node.
//
// Sources (July 2026): Geekbench 6 (single-core), Cinebench 2024 (multi-core),
// package power from reviews (Notebookcheck et al.). M5 family launched with
// TSMC N3P; M5 Max (18 cores) tops the Geekbench single- and multi-core charts,
// while x86 desktop parts still edge raw Cinebench throughput at ~4× the power.
//
// Colours: Apple = blue, AMD = red, Intel = yellow, efficiency = green — all
// well-separated SERIES slots, assigned by identity. Node/chip names are
// locale-invariant (see i18n/identical.ts); German prose is translated.

import { hBarChart, lineChart } from './charts';
import { blue, eraMarkers, green, red, yellow } from './cardHelpers';
import { localeNum } from '../i18n';
import type { Dashboard } from './types';

/** Geekbench-6 single-core axis top, so real scores normalise to 0..1. The M5
    (~4260) pushed the ceiling up, so the axis runs to 4500. */
const GB6_SC_AXIS = 4500;
const norm = (scores: number[]): number[] => scores.map((s) => s / GB6_SC_AXIS);

// Best single-core result per vendor per year, 2016→2026, on the Geekbench-6
// scale (indicative — GB6 dates from 2023, older chips back-computed). The
// shape is the story: Intel ahead and flat on 14nm, AMD's Zen climb overtaking
// it by 2020 (Zen 3), Apple entering in 2020 with the M1 and pulling ahead,
// reaching the M5 (~4260) in 2026.
const INTEL_SC = [1900, 2050, 2250, 2350, 2450, 2750, 2950, 3020, 3250, 3260, 3280];
const AMD_SC = [1300, 1650, 1850, 2150, 2450, 2500, 2950, 2980, 3370, 3380, 3400];
// Apple starts in 2020 (M1) — seven points (M1→M5), drawn from startAt so the
// line is never padded with values from before the chip existed.
const APPLE_SC = [2350, 2380, 2650, 3080, 3870, 3900, 4260];
const APPLE_START = (2020 - 2016) / (2026 - 2016);

export const CPU_RACE_CARDS: Dashboard[] = [
  {
    id: 'cpu-single-core',
    title: 'Schnellste CPU-Kerne 2026',
    source:
      'Geekbench 6 · Single-Core-Score der aktuellen Flaggschiff-Chips (Apple M5, Ryzen 9 9950X, Core Ultra 9 285K), M1 als Referenz von 2020. Single-Core misst die Leistung eines einzelnen Kerns (IPC × Takt) — der sauberste Vergleich der Kern-Architektur über Plattformen hinweg; hier führt Apples ARM klar, seit dem M5 (N3P) mit über 4.200 Punkten. Der Zusatz je Balken nennt die Fertigungsstruktur des Compute-Chips: Apple, AMD und selbst Intels Neuestes fertigen bei TSMC. Werte gerundet.',
    draw: (f) =>
      hBarChart(f, {
        label: 'Schnellste Kerne · Geekbench 6 Single-Core',
        value: 4260,
        delta: null,
        color: blue,
        unit: '',
        rowFmt: (v) => localeNum(v, 0),
        rows: [
          { name: 'Apple M5', v: 4260, sub: 'TSMC N3P · 3 nm' },
          { name: 'AMD Ryzen 9 9950X', v: 3370, sub: 'TSMC N4P · 4 nm' },
          { name: 'Intel Core Ultra 9 285K', v: 3250, sub: 'TSMC N3B · 3 nm' },
          { name: 'Apple M1', v: 2350, sub: 'TSMC N5 · 5 nm · 2020' },
        ],
      }),
  },
  {
    id: 'cpu-multi-core',
    title: 'Meiste CPU-Rechenkraft 2026',
    source:
      'Cinebench 2024 · Multi-Core-Score (alle Kerne unter Rendering-Last) der Flaggschiff-Chips. Multi-Core misst den rohen Gesamtdurchsatz — hier führen die x86-Vielkerner von Intel und AMD knapp, doch Apples M5 Max (18 Kerne) ist bis auf Schlagdistanz heran und zieht dafür nur ein Viertel des Stroms (siehe Effizienz-Karte); in Geekbench 6 Multi liegt das M5 Max sogar vorn. Der Zusatz je Balken nennt Kernzahl und Leistungsaufnahme unter Volllast. Werte gerundet.',
    draw: (f) =>
      hBarChart(f, {
        label: 'Meiste Rechenkraft · Cinebench 2024 Multi-Core',
        value: 2500,
        delta: null,
        color: red,
        unit: '',
        rowFmt: (v) => localeNum(v, 0),
        rows: [
          { name: 'Intel Core Ultra 9 285K', v: 2500, sub: '24× · 240 W' },
          { name: 'AMD Ryzen 9 9950X', v: 2350, sub: '16× · ~200 W' },
          { name: 'Apple M5 Max', v: 2255, sub: '18× · ~60 W' },
          { name: 'Apple M4 Max', v: 1702, sub: '16× · ~55 W' },
        ],
      }),
  },
  {
    id: 'cpu-efficiency',
    title: 'Effizienz — Leistung pro Watt',
    source:
      'Rechenleistung pro Watt: Cinebench-2024-Multi-Score geteilt durch die Package-Leistungsaufnahme unter Volllast (gerundet). Apples ARM-Chips liefern ihre Leistung bei einem Bruchteil des Stroms — das M5 Max erreicht rund die vierfache Effizienz des Intel 285K, der unter Volllast 240 W zieht, während das M5 Max bei etwa 60 W bleibt. x86-Desktop-Chips sind auf maximalen Durchsatz getrimmt, nicht auf Effizienz. Package-Werte aus Reviews (u. a. Notebookcheck), lastabhängig — Größenordnungen, keine Laborpräzision.',
    draw: (f) =>
      hBarChart(f, {
        label: 'Effizienz · Rechenleistung pro Watt',
        value: 38,
        delta: null,
        color: green,
        unit: '',
        rowFmt: (v) => `${localeNum(v, 0)} pt/W`,
        rows: [
          { name: 'Apple M5 Max', v: 38, sub: '2255 pt · ~60 W' },
          { name: 'Apple M4 Max', v: 31, sub: '1702 pt · ~55 W' },
          { name: 'AMD Ryzen 9 9950X', v: 12, sub: '2350 pt · ~200 W' },
          { name: 'Intel Core Ultra 9 285K', v: 10, sub: '2500 pt · 240 W' },
        ],
      }),
  },
  {
    id: 'cpu-race',
    title: 'Das CPU-Comeback-Rennen',
    source:
      'Bestes Single-Core-Ergebnis je Hersteller und Jahr, auf die Geekbench-6-Skala normiert (indikativ — Geekbench 6 gibt es erst seit 2023, ältere Chips zurückgerechnet). Intel führt und stagniert lange auf 14 nm; AMDs Zen-Architektur (ab 2017) überholt 2020 mit Zen 3; Apple steigt 2020 mit dem M1 (ARM) ein und zieht bis 2026 (M5) an allen vorbei. Apple-Linie erst ab 2020, nicht rückwärts aufgefüllt.',
    draw: (f) =>
      lineChart(f, {
        label: 'Das Comeback-Rennen · Single-Core seit 2016',
        value: 4260,
        unit: '',
        delta: null,
        fmt: (v) => localeNum(v, 0),
        seed: 617,
        series: [
          { name: 'Intel', color: yellow, data: norm(INTEL_SC) },
          { name: 'AMD', color: red, data: norm(AMD_SC) },
          { name: 'Apple (ARM)', color: blue, data: norm(APPLE_SC), startAt: APPLE_START },
        ],
        ticks: ['0', '1500', '3000', '4500'],
        xLabels: ['2016', '2019', '2023', '2026'],
        markers: eraMarkers(2016, 2026, [
          [2017, 'Zen'],
          [2020, 'Apple M1'],
        ]),
      }),
  },
];
