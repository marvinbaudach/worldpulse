// Reference datasets for the map panels: nuclear arsenals with their rough
// country-center anchors, and the two per-country value maps (corruption,
// EU debt). Estimates with no live API — revised yearly at best.

/**
 * Estimated nuclear warhead inventories (Federation of American Scientists,
 * 2025 status). No live API exists for this — estimates change yearly.
 */
export const NUKE_STATES = [
  { name: 'Russland', iso: 'RUS', lon: 60, lat: 60, count: 5449 },
  { name: 'USA', iso: 'USA', lon: -98, lat: 39, count: 5277 },
  { name: 'China', iso: 'CHN', lon: 104, lat: 35, count: 600 },
  { name: 'Frankreich', iso: 'FRA', lon: 2.5, lat: 46.5, count: 290 },
  { name: 'Großbritannien', iso: 'GBR', lon: -1.5, lat: 53, count: 225 },
  { name: 'Indien', iso: 'IND', lon: 79, lat: 22, count: 180 },
  { name: 'Pakistan', iso: 'PAK', lon: 69, lat: 30, count: 170 },
  { name: 'Israel', iso: 'ISR', lon: 35.2, lat: 31.5, count: 90 },
  { name: 'Nordkorea', iso: 'PRK', lon: 127, lat: 40, count: 50 },
];

export const NUKE_TOTAL = NUKE_STATES.reduce((sum, s) => sum + s.count, 0);

// Transparency International CPI 2024 scores (100 = clean), stored
// inverted and shifted so the cleanest country (Denmark, 90) sits at the
// neutral end of the red ramp and the most corrupt render darkest.
export const CPI_INVERTED: Record<string, number> = Object.fromEntries(
  Object.entries({
    DNK: 90, FIN: 88, NZL: 83, SGP: 84, NOR: 81, CHE: 81, SWE: 80,
    NLD: 78, AUS: 77, IRL: 77, ISL: 77, EST: 76, URY: 76, DEU: 75,
    CAN: 75, GBR: 71, JPN: 71, BEL: 69, ARE: 68, FRA: 67, AUT: 67,
    USA: 65, ISR: 64, KOR: 64, CHL: 63, LTU: 63, ESP: 56, ITA: 54,
    POL: 53, GEO: 53, MYS: 50, CRI: 58, RWA: 57, BWA: 57, SAU: 59,
    QAT: 59, CZE: 56, SVK: 49, GRC: 49, JOR: 49, NAM: 49, HRV: 47,
    ROU: 46, KWT: 46, CIV: 45, SEN: 45, JAM: 45, CHN: 43, BGR: 43,
    GHA: 42, ZAF: 41, TZA: 41, HUN: 41, CUB: 41, KAZ: 40, VNM: 40,
    COL: 39, ZMB: 39, TUN: 39, IND: 38, ARG: 37, IDN: 37, MAR: 37,
    ETH: 37, DOM: 36, SRB: 35, UKR: 35, TUR: 34, THA: 34, DZA: 34,
    NPL: 34, BRA: 34, PHL: 33, PAN: 33, MNG: 33, BLR: 33, KEN: 32,
    UZB: 32, LKA: 32, ECU: 32, AGO: 32, PER: 31, EGY: 30, SLV: 30,
    BOL: 28, PAK: 27, IRQ: 26, NGA: 26, UGA: 26, CMR: 26, MEX: 26,
    MDG: 26, KGZ: 25, LAO: 25, MOZ: 25, GTM: 25, PRY: 24, BGD: 23,
    IRN: 23, RUS: 22, AZE: 22, LBN: 22, HND: 22, KHM: 21, ZWE: 21,
    COD: 20, TJK: 19, TKM: 17, AFG: 17, HTI: 16, MMR: 16, SDN: 15,
    PRK: 15, NIC: 14, YEM: 13, LBY: 13, SYR: 12, VEN: 10, SOM: 9,
    SSD: 8,
  }).map(([iso, score]) => [iso, 90 - score]),
);

// Absolute general government gross debt, EU members, in EUR (Eurostat 2024,
// rounded to the billion) — non-EU countries stay neutral on the Europe map.
// Absolute rather than debt-to-GDP so the map reads as systemic threat: a big
// economy carrying trillions weighs heavier than a small, highly indebted one.
const BN = 1e9;
export const EU_DEBT_ABS: Record<string, number> = {
  FRA: 3305 * BN, ITA: 2970 * BN, DEU: 2690 * BN, ESP: 1620 * BN,
  BEL: 635 * BN, NLD: 480 * BN, POL: 470 * BN, AUT: 394 * BN,
  GRC: 370 * BN, PRT: 282 * BN, IRL: 218 * BN, FIN: 217 * BN,
  SWE: 190 * BN, ROU: 180 * BN, HUN: 145 * BN, CZE: 130 * BN,
  DNK: 100 * BN, SVK: 78 * BN, HRV: 48 * BN, SVN: 46 * BN,
  LTU: 30 * BN, BGR: 25 * BN, CYP: 24 * BN, LUX: 22 * BN,
  LVA: 20 * BN, MLT: 11 * BN, EST: 9 * BN,
};

// WHO Pandemic Agreement, World Health Assembly, 20 May 2025: adopted by
// consensus after a committee vote of 124 in favour, 0 against, 11
// abstentions. These are the 11 that abstained (did NOT back it) — the honest
// "held back" set, not "refused to sign", since signing/ratification is a
// separate later process. Source: WHO / WHA May 2025.
export const WHO_PANDEMIC_ABSTAIN: Record<string, number> = {
  RUS: 1, IRN: 1, ISR: 1, ITA: 1, POL: 1, NLD: 1, SVK: 1, BGR: 1, EGY: 1,
  PRY: 1, JAM: 1,
};

// US military presence abroad: active-duty personnel by host country (rough
// DoD Defense Manpower Data Center figures, revised quarterly). The map shades
// every host country by troop count; smaller base hosts get a token value so
// they still light up, matching the SIPER "≥ 42 foreign countries" picture.
// USA itself is left out — this is the footprint on *foreign* soil.
// Source: DoD DMDC / Base Structure Report, via SIPER.
export const US_TROOPS_ABROAD: Record<string, number> = {
  JPN: 53700, DEU: 35000, KOR: 24000, KWT: 13500, ITA: 12500,
  POL: 10000, GBR: 9800, QAT: 8000, BHR: 7000, DJI: 4000,
  ARE: 3500, ESP: 3200, JOR: 3000, SAU: 2700, IRQ: 2500,
  AUS: 1700, TUR: 1700, ROU: 1500, NLD: 1500, BEL: 1000,
  CUB: 900, NOR: 700, OMN: 500, PRT: 500, GRC: 500,
  HND: 500, PHL: 500, THA: 300, BGR: 300, SGP: 200,
  CAN: 150, DNK: 150, HUN: 100, ISL: 100, NER: 100,
};

// EU gross government debt as a share of GDP, % (Eurostat 2024). The ratio,
// not the absolute pile: small, heavily-indebted states (Greece, Italy) burn
// darker than large economies with more moderate ratios (Germany).
export const EU_DEBT_GDP: Record<string, number> = {
  GRC: 154, ITA: 135, FRA: 112, BEL: 105, ESP: 102, PRT: 95, FIN: 82,
  AUT: 78, HUN: 74, CYP: 71, SVN: 67, HRV: 61, DEU: 63, SVK: 59,
  POL: 55, ROU: 52, MLT: 47, CZE: 45, LVA: 45, NLD: 44, IRL: 42,
  LTU: 38, SWE: 33, DNK: 30, LUX: 27, BGR: 24, EST: 24,
};

// States criminalising consensual same-sex acts (ILGA World 2025), graded by
// maximum penalty: 3 = death penalty possible (12 states, incl. sharia
// jurisdictions in Nigeria and Uganda's 2023 "aggravated homosexuality" law),
// 2 = long or life imprisonment, 1 = shorter prison terms or fines (Egypt via
// "debauchery" laws, Indonesia partial/Aceh). Simplified — the legal map keeps
// moving in both directions: Iraq recriminalised 2024, Trinidad's appeals
// court re-instated its ban 2025, while Mauritius, Namibia, Dominica and
// St. Vincent struck theirs down 2023–24.
export const LGBT_CRIMINAL: Record<string, number> = {
  // Death penalty possible
  IRN: 3, SAU: 3, YEM: 3, AFG: 3, PAK: 3, QAT: 3, ARE: 3, MRT: 3,
  NGA: 3, SOM: 3, UGA: 3, BRN: 3,
  // Long or life imprisonment
  TZA: 2, KEN: 2, MWI: 2, ZMB: 2, GMB: 2, SLE: 2, GUY: 2, JAM: 2,
  BGD: 2, MMR: 2, MYS: 2, PNG: 2, SLB: 2, KIR: 2, TON: 2, SDN: 2,
  SSD: 2, ETH: 2, IRQ: 2, LKA: 2, MDV: 2, PSE: 2, GRD: 2, LCA: 2,
  TTO: 2, TUV: 2,
  // Prison terms or fines
  EGY: 1, LBY: 1, KWT: 1, OMN: 1, SYR: 1, IDN: 1, TCD: 1, CMR: 1,
  SEN: 1, GIN: 1, GHA: 1, TGO: 1, DZA: 1, MAR: 1, TUN: 1, COM: 1,
  ZWE: 1, SWZ: 1, BDI: 1, UZB: 1, TKM: 1, LBN: 1, WSM: 1, ERI: 1,
};

// ---------------------------------------------------------------------------
// Nahost-Karte ("Naher Osten · Konflikt"). The casualty figures are fetched
// live (Tech for Palestine, see data/sources.ts); everything below is bundled
// because no keyless, CORS-enabled live feed exists for it.

/** Map hotspots, lon/lat, for the regional Middle-East map. */
export const MIDEAST_HOTSPOTS = {
  gaza: { lon: 34.45, lat: 31.5 },
  hormuz: { lon: 56.4, lat: 26.6 },
};

// Strait of Hormuz throughput. Oil: EIA "Today in Energy" (16 Jun 2025, 2024
// data) — ~20 million barrels/day, more than a quarter of global seaborne oil
// trade. Vessels: no authoritative live count exists (all AIS data is keyed/
// paywalled), so ~100 ships/day is the normal pre-2026 baseline from Reuters/
// CNN (~3,000 vessels/month) and Britannica (80–130/day). A dated reference,
// not a live number.
export const HORMUZ = {
  oilBarrelsPerDay: 20e6,
  shipsPerDay: 100,
  vintage: '2024',
  source: 'EIA 2024 · Reuters',
};

// Ballistic missiles fired by Iran at Israel during the 12-day war,
// 13–24 June 2025 (FPRI / Wall Street Journal analysis; some trackers count up
// to ~591). A dated context figure — no live feed.
export const IRAN_ISRAEL_MISSILES = {
  count: 500,
  route: 'Iran → Israel',
  period: 'Juni 2025',
  source: 'FPRI / WSJ',
};

// Offline/boot fallback for the live casualty block, so the card never renders
// broken before (or without) the Tech-for-Palestine fetch. Snapshot values,
// dated — the live feed overwrites them the moment it lands.
export const MIDEAST_FALLBACK = {
  killed: 73110,
  children: 20179,
  injured: 173599,
  westBankKilled: 1094,
  lastUpdate: '2026-07-08',
  // A gently varying seed so the sparkline reads as a trend, not a flat line.
  daily: [62, 48, 71, 55, 39, 84, 90, 67, 52, 45, 73, 61, 58, 42, 96, 70, 63, 51, 47, 38, 55, 44, 33, 29, 41, 26, 22, 18, 12, 8],
};

// Recorded executions in 2024 (Amnesty International, "Death Sentences and
// Executions 2024"): at least 1,518 across 15 states — the highest since
// 2015, with Iran, Saudi Arabia and Iraq accounting for over 90% of the
// recorded total. China is a floor estimate: execution numbers are a state
// secret, believed to run into the thousands — more than the rest of the
// world combined. North Korea and Vietnam also execute but publish nothing,
// so they stay off the map. Minimum figures throughout.
export const EXECUTIONS_2024: Record<string, number> = {
  CHN: 2000, IRN: 972, SAU: 345, IRQ: 63, SOM: 34, USA: 25,
  EGY: 13, SGP: 9, KWT: 6, AFG: 6, YEM: 1,
};
