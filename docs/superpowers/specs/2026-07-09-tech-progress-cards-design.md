# Design: Vier Log-Achsen-Karten „technischer Fortschritt"

**Datum:** 2026-07-09
**Status:** freigegeben (Design), Implementierung ausstehend

## Ziel

Vier neue Dashboard-Karten für Worldpulse, die den exponentiellen technischen
Fortschritt der Chip- und Rechentechnik zeigen. Sie reihen sich in die
bestehende Tech-Gruppe (`tech`-Tag) und die „langer-Zeitraum-Fortschritt"-Reihe
(Weltbevölkerung, Lebenserwartung, Holozän-Temperatur) ein.

Deckt die Nutzeranfrage ab: „Transistorenstruktur-Entwicklung, Breite und Anzahl
auf dem Chip" + „Grafiken zum technischen Fortschritt der Menschheit".

## Nicht im Umfang

- **KI-Trainings-Rechenleistung** — existiert bereits als Karte `ai-compute`
  („KI-Training · Rechenleistung", FLOP, Log-Achse). Nicht duplizieren.
- Keine Zwei-Serien-/Dual-Achsen-Charts (bewusst verworfen, siehe Entscheidungen).
- Keine Änderungen am Chart-Renderer.

## Ansatz

Alle vier Karten folgen exakt dem bestehenden `ai-compute`-Muster:

- Ein gebündeltes `TrendSeries`-Panel in `src/data/bundled.ts`, dessen Werte als
  **`log10(wert)`** gespeichert sind. Damit wird geometrisches Wachstum zur
  geraden Linie — das ist die Aussage.
- Als Formatter für `trend()` dient `pow10Label` (bereits vorhanden) bzw. eine
  kleine Ableitung, sodass die y-Achsen-Ticks als `10ˣ` erscheinen.
- Die Karte selbst ist ein `trendCard(...)`-Aufruf (Single-Series-Area) mit
  `eraMarkers(...)`. Das Headline-Value rechnet der Karten-Formatter mit
  `10 ** v` in die echte Größenordnung zurück (freundliche Einheit, z. B.
  „208 Mrd." statt „10¹¹·³").

**Kein neuer Helper, keine Renderer-Änderung** — der Chart nimmt bereits ein
normalisiertes `data`-Array (0..1) und vorformatierte `ticks`-Strings; ob die
Abbildung linear oder log ist, ist ihm egal.

## Die vier Karten

| # | ID | Titel | Reihe (log10) | Verlauf | Farbe | Tags |
|---|-----|-------|---------------|---------|-------|------|
| 1 | `moore` | Moore's Gesetz · Transistoren pro Chip | 2 300 (4004, 1971) → ~208 Mrd. (B200, 2024) | steigend | blue | tech |
| 2 | `process-node` | Strukturbreite · Chip-Fertigung | 10 µm (1971) → 2 nm (2025) | fallend | aqua | tech |
| 3 | `compute-cost` | Rechenkosten · $ pro GFLOPS | ~$1,9·10¹⁰ (1961) → ~$0,006 (2023) | fallend | yellow | tech, geld |
| 4 | `genome-cost` | Kosten · ein Genom sequenzieren | $95 Mio. (2001) → ~$200 (2025) | fallend | green | tech |

### Karte 1 — `moore` (Transistoren pro Chip)

Anker (repräsentative Mikroprozessoren, Wikipedia *Transistor count*), gespeichert
als `log10(count)`:

```
1971 Intel 4004        2 300
1978 Intel 8086        29 000
1985 Intel 80386       275 000
1989 Intel 80486       1 180 000
1993 Pentium           3 100 000
2000 Pentium 4         42 000 000
2006 Core 2 Duo        291 000 000
2010 Core i7           1 170 000 000
2017 AMD Epyc          19 200 000 000
2020 Apple M1          16 000 000 000
2022 Apple M1 Ultra    114 000 000 000
2023 Apple M2 Ultra    134 000 000 000
2024 NVIDIA B200       208 000 000 000
```

Marker (`eraMarkers(1971, 2024, …)`): Pentium '93, Core 2 '06, Apple M1 '20,
NVIDIA B200 '24. Headline-Formatter: `Mrd.`/`Mio` je nach Größe.
Quelle: Wikipedia *Transistor count*; repräsentative Chips, keine lückenlose Reihe.

### Karte 2 — `process-node` (Strukturbreite nm)

Anker (Intel/TSMC-Node-Roadmap), gespeichert als `log10(nm)`, fallend:

```
1971 10 000 nm (10 µm)   1985 1 000 nm (1 µm)   2001 130 nm   2004 90 nm
2010 32 nm   2014 14 nm   2018 7 nm   2020 5 nm   2022 3 nm   2025 2 nm
```

Marker: 1 µm '85, 90 nm '04, 5 nm '20, 2 nm '25. Headline: `µm`/`nm` je nach Größe.
**Ehrlichkeits-Hinweis im `source:`-Feld:** Ab ~22 nm sind die „nm"-Node-Namen
Marketing-Labels, keine physische Gate-Länge — wie die übrigen Karten sauber
gekennzeichnet.

### Karte 3 — `compute-cost` ($ pro GFLOPS)

Anker (Wikipedia *FLOPS – cost of computing*), `log10($)`, fallend:

```
1961 1,87·10¹⁰   1984 1,88·10⁷   1997 30 000   2003 100
2007 52   2011 1,80   2015 0,08   2020 0,01   2023 0,006
```

Marker sparsam (z. B. „PC-Ära", „GPU-Ära '07"). Headline: `$`-Formatter über den
gesamten Bereich (Bio./Mrd./Mio./k/¢). Quelle: Wikipedia *FLOPS*, Kosten je
GFLOPS zu Anschaffungspreisen, inflationsbereinigt gerundet.

### Karte 4 — `genome-cost` ($ pro Genom)

Anker (NHGRI *Sequencing Cost*), `log10($)`, fallend:

```
2001 95 000 000   2007 10 000 000   2008 3 000 000   2010 50 000
2012 7 000   2015 1 400   2019 940   2022 525   2025 200
```

Marker: Humangenom-Projekt '03, Next-Gen-Sprung '08, „1000-$-Genom" '14,
sub-$200 '23. Headline: `$`-Formatter. **Story im `source:`-Feld:** Die Kurve
fällt schneller als Moore's Law — der berühmte Kontrast, in Textform statt als
zweite Linie (bewusste Entscheidung).

## Betroffene Dateien (rein additiv)

- `src/data/bundled.ts` — vier neue `*_PANEL`-Konstanten (log10-Anker +
  Quellenkommentar). Ggf. eine kleine Formatter-Variante neben `pow10Label`.
- `src/dashboards/cards.ts` — vier `trendCard(...)`-Einträge im Tech-Block,
  Panel-Imports ergänzen.
- `src/dashboards/index.ts` — `TAGS_BY_ID` (`moore`/`process-node`/`genome-cost`
  → `['tech']`, `compute-cost` → `['tech','geld']`); `ADDED_BY_ID` mit
  `2026-07-09` (NEU-Chip zeigt sie zuerst); optional in `FEATURED`.
- `src/i18n/{en,fr,it}.ts` — neue Keys für jeden neuen deutschen String
  (Titel, Labels, Marker-Texte). Fehlende Keys fallen auf Deutsch zurück.
- `src/data/vintage.ts` — `DATA_VINTAGE` bumpen (statische Karten dazugekommen),
  gemäß der Checkliste in der Datei.

## Konventionen / Leitplanken

- Farben ausschließlich aus `dashboards/theme.ts` (`SERIES`), keine Hex von Hand.
- Deutsch als Quellsprache; Code/Kommentare/Commits Englisch. Kein Gendern.
- `import/no-cycle` beachten (Grenze `dashboards` ↔ `data`).
- Jede Karte bekommt ein `source:`-Feld wie die Nachbarkarten.

## Datenqualität

Exakte Anker werden bei der Implementierung gegen die Primärquellen finalisiert
(Wikipedia *Transistor count*, Intel/TSMC-Node-Roadmap, Wikipedia *FLOPS*,
NHGRI *Sequencing Cost*). Die oben gelisteten Werte sind bereits belastbar und
enthalten keine Platzhalter.

## Verifikation

1. `npm run lint && npm run build` müssen grün sein (CI-Gate).
2. Dev-Server (`npm run dev`), die vier Panels visuell prüfen:
   - y-Ticks erscheinen als `10ˣ`-Dekaden,
   - exponentielle Reihen lesen sich als (annähernd) gerade Linie,
   - Era-Marker sitzen auf der Kurve, nicht auf der Achse,
   - Headline-Value zeigt echte Größenordnung (z. B. „208 Mrd.", „2 nm").
3. Beide Ausspielungen kurz sichten (Desktop-Ring + Mobile-Deck).

## Bewusst getroffene Entscheidungen

- **Log-Achse statt linear:** Bei 8–15 Größenordnungen wäre eine lineare Achse
  eine flache Linie mit Endstich — die Regelmäßigkeit (Verdopplung/Verzehnfachung)
  verschwände. Log entspricht auch der bestehenden `ai-compute`-Karte.
- **Single-Series statt Dual-Achsen** (Struktur­breite eigenständig, nicht mit
  Moore kombiniert) — Konsistenz mit dem Deck, einfachster Code.
- **Genom ohne Moore-Referenzlinie** — der Kontrast steht im Quellen-Hinweis.
