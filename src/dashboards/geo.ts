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
