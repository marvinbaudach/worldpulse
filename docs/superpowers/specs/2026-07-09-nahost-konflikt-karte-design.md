# Naher Osten · Konflikt — Karten-Dashboard (Design)

**Datum:** 2026-07-09
**Status:** Design, freigegeben zur Planung
**Card-ID:** `mideast` · Titel (DE): „Naher Osten · Konflikt"

## Ziel

Ein neues Dashboard-Panel für den Worldpulse-Ring: eine regionale Nahost-Karte,
die den Konflikt in Zahlen zeigt — Getötete, ein Hormus-Kennwert und ein
Raketen-/Angriffe-Kontextwert. Ein Panel, drei Kennzahlen, ehrlich nach
Datenstatus beschriftet (live vs. gebündelt).

## Datenrealität (recherchiert 2026-07-09)

Nur **eine** der drei gewünschten Metriken ist keyless + CORS live abrufbar. Der
Rest wird gebündelt und klar datiert geführt — passend zum Projekt-Ethos (jedes
Panel fällt offline auf gebündelte Daten zurück und nennt seine Quelle).

| Metrik | Quelle | Status | Abruf |
|---|---|---|---|
| Getötete · Gaza & Westjordanland (+ Kinder, Verletzte, Tages-Trend) | Tech for Palestine | **LIVE** | `fetch()` direkt, `Access-Control-Allow-Origin: *`, keyless, ~täglich |
| Straße von Hormus — Öldurchsatz (~20 Mio. Barrel/Tag) + Tanker/Tag | EIA World Oil Transit Chokepoints | **gebündelt** | statisch in `geo.ts`, datiert auf `DATA_VINTAGE` |
| Raketen / Luftangriffe — regionaler Kontextwert | seriöser, zu recherchierender Bericht (OCHA/Presse) | **gebündelt** | statisch in `geo.ts`, mit Quelle + Datum |

**Verworfen:** GDELT (reiche Event-Daten, sendet aber **kein** CORS-Header →
bräuchte einen Proxy/Backend, das es hier nicht gibt), ACLED (API-Key nötig),
AIS-Live-Schiffszählung durch Hormus (alle Anbieter kostenpflichtig/keyed).

## Live-Endpunkte (Tech for Palestine)

- Snapshot: `https://data.techforpalestine.org/api/v3/summary.min.json`
  — Felder u.a. `gaza.killed.{total,children,women}`, `gaza.injured.total`,
  `gaza.last_update`; `west_bank.killed.{total,children}`, `west_bank.injured`.
- Tages-Reihe: `https://data.techforpalestine.org/api/v2/casualties_daily.min.json`
  — Array mit `report_date`, `killed`, `killed_cum`, `injured`, `injured_cum`.
- Es werden ausschließlich die kompakten `.min.json`-Varianten genutzt.

## Genauigkeits-Leitplanken (wichtig beim Thema)

- Die Getöteten-Kennzahl ist präzise als **„Gaza & Westjordanland"** zu
  beschriften — **nicht** als „Nahost-Krieg gesamt". Der Feed deckt nur
  palästinensische Zahlen ab (keine iranische/israelische Seite).
- Live vs. gebündelt ist visuell klar getrennt: Casualties tragen ein
  „LIVE · Stand \<last_update\>"-Label, gebündelte Werte ein „Stand \<Jahr/Datum\>".
- `drawSource`-Fußzeile nennt alle drei Quellen.
- Der Ton ist sachlich und belegt, nicht reißerisch. CRITICAL-Rot ausschließlich
  semantisch für die Getöteten (im Projekt reservierte Farbe).

## Rendering

Neuer Renderer `mideastMap(f, cfg)` in `src/dashboards/charts/map.ts`, gebaut
nach dem Muster von `nukeMap`/`choroplethMap`:

- **Projektion:** vorhandene äquirektanguläre `px/py` mit regionalem `bounds`
  ≈ `{ lonMin: 32, lonMax: 60, latMin: 22, latMax: 38 }` — Rahmen von Gaza
  (34.5°E/31.5°N) bis Straße von Hormus (56.4°E/26.6°N).
- **Länderumrisse:** aus dem gebündelten `WORLD` (kein Fetch), auf das Karten-Rect
  geclippt; dünne dunkle Naht zwischen Ländern wie in `choroplethMap`.
- **Hotspot-Marker** mit Radar-Ping (aus `nukeMap`):
  - Gaza → `CRITICAL`-Rot, an die Live-Getöteten gekoppelt.
  - Straße von Hormus → ruhige Serienfarbe (Öl/Schifffahrt, kein Alarm-Rot).
- **Readouts:** drei Kennzahlblöcke mit Status-Label; Getötete zusätzlich mit
  Kinder-Anteil, Verletzten und einer Tages-Trend-Sparkline aus `daily`.
- Zeichnet in „units" (`u = w/512`), damit Ring-Panel (512px) und Hero (1024px)
  scharf sind. Funktioniert unverändert auf Desktop (`Carousel3D`) und Mobile
  (`MobileDeck`), da beide dieselbe Canvas-2D-`draw(frame)` nutzen.

## Datenfluss (folgt der Ein-Weg-Pipeline)

1. **`data/sources.ts`** — neuer `fetchMideast()` + `LIVE_FEEDS`-Eintrag. Holt
   Snapshot + Tages-Reihe, leitet `{ killed, children, injured, lastUpdate,
   daily: number[] }` ab, cached via `data/cache.ts` (localStorage), schreibt in
   `live.mideast`, **schluckt eigene Fehler**.
2. **`data/store.ts`** — neues typisiertes Feld `mideast?: MideastLive` in
   `LiveData`; bleibt bei Fehler `undefined`.
3. **`geo.ts`** — gebündelte Konstanten für Hormus (EIA) und Raketen/Angriffe
   (recherchierte, datierte, zitierte Zahl) mit Quell-Kommentaren, an
   `DATA_VINTAGE` gebunden.
4. **`dashboards/cards.ts`** — `POOL`-Eintrag; Chart-Config **innerhalb `draw`**
   gebaut, liest `live.mideast` pro Frame, mit gebündeltem Seed-Fallback für
   jeden `live.*`-Zugriff. `dynamic: true` (Redraw wenn Casualty-Daten landen),
   `live` bleibt aus.
5. **`dashboards/index.ts`** — `TAGS_BY_ID`-Eintrag. **Nicht** in `FEATURED`.

## i18n

Deutsche Quellstrings in Card + Renderer; dieselben Keys in
`src/i18n/{en,fr,it}.ts` ergänzen. Zusammengesetzte Labels (`A · B`) werden pro
Segment übersetzt. Fehlende Keys fallen auf Deutsch zurück.

## Offene Arbeits-Tasks (in der Umsetzung zu erledigen)

- **Raketen-/Angriffe-Zahl recherchieren:** belegbare, datierte Zahl aus
  seriöser Quelle (OCHA/Presse-Aggregat) ermitteln und mit Quellenangabe in
  `geo.ts` eintragen. Akzeptanz: Zahl hat eine benennbare Quelle **und** ein
  Stand-Datum; kein ungedeckter Schätzwert.
- **Hormus-Zahlen fixieren:** konkrete EIA-Werte (Öldurchsatz + grober
  Tanker/Tag-Wert) mit Jahr in `geo.ts` eintragen.
- **Live-Shape verifizieren:** `fetchMideast()` gegen den echten Endpunkt prüfen
  (Feldnamen, `last_update`-Format, `daily`-Länge).

## Test / Verifikation

- Type-checked Build (`npm run build`) muss grün sein — CI erzwingt es.
- `npm run lint` (oxlint) grün; `import/no-cycle` beachten (Grenze
  `dashboards` ↔ `data`).
- In `npm run dev` bei Ring- und Hero-Größe sichten; Offline-Fallback prüfen
  (Netzwerk aus → Karte rendert mit Seed, keine kaputten Felder).
- Live-Fetch einmal real gegen den Endpunkt bestätigen.

## Bewusst nicht enthalten (YAGNI)

- Kein CORS-Proxy/Backend für GDELT.
- Keine Live-AIS-Schiffszählung.
- Keine iranische/israelische Opferseite (keine keyless-Live-Quelle; würde die
  präzise Beschriftung sprengen).
- Kein FEATURED-Rang, keine `live: true`-Dauerbewegung.
