// COVID-19 world-map tables, generated from Our World in Data grapher CSVs
// (fetched 2026-07-09). Both series are effectively frozen — the vaccination
// campaigns and the excess-mortality model runs ended in mid-2024 — so the
// values ship bundled instead of being fetched live.

/** Share of the population with a complete initial vaccination protocol, in
    percent (series maximum per country, capped at 100 — late revisions in a
    few countries dip below the peak). Luxembourg is omitted: its series in
    this grapher is broken (peaks at 5.8%).
    https://ourworldindata.org/grapher/share-people-fully-vaccinated-covid */
export const VAX_RATE_BY_ISO: Record<string, number> = {
  ABW: 78.3, AFG: 45.3, AGO: 27, AIA: 73.1, ALB: 45.2, AND: 67.1, ARE: 95.6, ARG: 76.9,
  ARM: 35.8, ATG: 67.2, AUS: 82.6, AUT: 73.7, AZE: 47.2, BDI: 0.3, BEL: 78.8, BEN: 19.9,
  BES: 58.4, BFA: 23.2, BGD: 84, BGR: 30.4, BHR: 80, BHS: 42, BIH: 26.4, BLR: 69.9,
  BLZ: 55, BMU: 73.6, BOL: 51, BRA: 83.8, BRB: 54.9, BRN: 98.1, BTN: 86.8, BWA: 68.2,
  CAF: 48.7, CAN: 81.8, CHL: 90.5, CHN: 90.1, CIV: 40, CMR: 11.6, COD: 14.1, COG: 10.8,
  COK: 99.9, COL: 71.9, COM: 47.6, CPV: 59.4, CRI: 86, CUB: 90.9, CUW: 54.4, CYM: 84.8,
  CYP: 69.8, CZE: 64.6, DEU: 75.6, DJI: 35.3, DMA: 45.9, DNK: 79.8, DOM: 54.6, DZA: 14.3,
  ECU: 79.9, EGY: 37.6, ESP: 85.2, EST: 63.9, ETH: 34.8, FIN: 78.1, FJI: 69.7, FLK: 50.5,
  FRA: 80.3, FRO: 75.7, GAB: 10.6, GBR: 74.4, GEO: 33.6, GGY: 82.7, GHA: 32.5, GIB: 100,
  GIN: 41.7, GMB: 20.5, GNB: 26, GNQ: 11.9, GRC: 73.4, GRD: 33.4, GRL: 68.8, GTM: 40,
  GUY: 46.8, HKG: 91.1, HND: 55.9, HRV: 57.6, HTI: 3.2, HUN: 64.1, IDN: 62.7, IMN: 79.7,
  IND: 66.8, IRL: 79.6, IRN: 65.4, IRQ: 18, ISL: 78.3, ISR: 70.1, ITA: 83, JAM: 26.8,
  JEY: 79.1, JOR: 40.5, JPN: 82.8, KAZ: 53.1, KEN: 20.4, KGZ: 20.2, KHM: 85.4, KIR: 62.4,
  KNA: 57.8, KOR: 85.6, KWT: 72.9, LAO: 69.1, LBN: 42, LBR: 69.4, LBY: 17.1, LCA: 30.7,
  LKA: 64.6, LSO: 41, LTU: 66.8, LVA: 69.4, MAC: 91.2, MAR: 63, MCO: 65.9, MDA: 35.5,
  MDG: 8.6, MDV: 73.5, MEX: 63.6, MKD: 45.5, MLI: 15.7, MLT: 89.3, MMR: 66.9, MNE: 46.3,
  MNG: 64.5, MOZ: 65.3, MRT: 31.6, MSR: 43.6, MUS: 85.3, MWI: 20.8, MYS: 79.4, NAM: 19.1,
  NCL: 64.4, NER: 21.7, NGA: 36.4, NIC: 91, NIU: 88.7, NLD: 65.7, NOR: 74.4, NPL: 82.4,
  NRU: 96, NZL: 83.6, OMN: 64.5, PAK: 57.6, PAN: 72.2, PER: 85.8, PHL: 68.8, PNG: 3.1,
  POL: 59.2, PRT: 85.5, PRY: 52.5, PSE: 33.5, PYF: 66.6, QAT: 98.6, ROU: 42.3, RUS: 54.7,
  RWA: 76.2, SAU: 79, SDN: 27.2, SEN: 8.8, SGP: 92.9, SHN: 65.8, SLB: 32.6, SLE: 59.9,
  SLV: 70, SMR: 69.3, SOM: 43.1, SRB: 48.3, SSD: 38.8, STP: 49.5, SUR: 38.2, SVK: 51,
  SVN: 57.8, SWE: 72.4, SWZ: 35.1, SXM: 63.5, SYC: 66.6, SYR: 10.5, TCA: 67, TCD: 27.2,
  TGO: 19.3, THA: 74.6, TJK: 51, TKL: 95.3, TKM: 63.2, TLS: 58.6, TON: 73.7, TTO: 48.1,
  TUN: 52.8, TUR: 61.1, TUV: 94.9, TWN: 88.8, TZA: 49.7, UGA: 27.6, UKR: 38.3, URY: 85.6,
  USA: 67.5, UZB: 52.8, VCT: 31, VEN: 53, VGB: 47.6, VNM: 86.2, VUT: 51.8, WLF: 59.2,
  WSM: 82.7, YEM: 2.1, ZAF: 33.7, ZMB: 45.7, ZWE: 35.2,
};

/** Cumulative excess deaths per 100,000 people, 2020 through mid-2024 —
    central estimate of The Economist excess-mortality model via OWID.
    Negative values: fewer deaths than the pre-pandemic baseline predicted.
    https://ourworldindata.org/grapher/excess-deaths-cumulative-per-100k-economist */
export const EXCESS_100K_BY_ISO: Record<string, number> = {
  ABW: 485, AFG: 422, AGO: 149, AIA: 327, ALB: 551, AND: 224, ARE: 138, ARG: 615,
  ARM: 472, ASM: 177, ATG: -136, AUS: 163, AUT: 368, AZE: 322, BDI: 224, BEL: 321,
  BEN: 178, BES: 705, BFA: 195, BGD: 518, BGR: 965, BHR: 259, BHS: 410, BIH: 796,
  BLR: 852, BLZ: 194, BMU: 561, BOL: 547, BRA: 434, BRB: 342, BRN: 161, BTN: -66,
  BWA: 191, CAF: 175, CAN: 225, CHE: 299, CHL: 367, CHN: 185, CIV: 138, CMR: 218,
  COD: 332, COG: 135, COK: 7, COL: 408, COM: 216, CPV: 190, CRI: 202, CUB: 557,
  CUW: 455, CYM: 241, CYP: 216, CZE: 442, DEU: 354, DJI: 125, DMA: 130, DNK: 149,
  DOM: 49, DZA: 295, ECU: 504, EGY: 339, ERI: 231, ESH: 126, ESP: 384, EST: 460,
  ETH: 370, FIN: 364, FJI: 61, FLK: 79, FRA: 244, FRO: 103, FSM: 260, GAB: 123,
  GBR: 409, GEO: 662, GGY: 447, GHA: 276, GIB: 285, GIN: 169, GLP: 520, GMB: 170,
  GNB: 187, GNQ: 104, GRC: 356, GRD: 149, GRL: -286, GTM: 314, GUF: 436, GUM: 531,
  GUY: 461, HKG: 273, HND: 303, HRV: 695, HTI: 194, HUN: 490, IDN: 304, IMN: 291,
  IND: 430, IRL: 247, IRN: 341, IRQ: 326, ISL: 157, ISR: 203, ITA: 519, JAM: 220,
  JEY: 519, JOR: 130, JPN: 277, KAZ: 415, KEN: 336, KGZ: 188, KHM: 498, KIR: 81,
  KNA: 463, KOR: 190, KWT: 184, LAO: 470, LBN: 274, LBR: 153, LBY: 532, LCA: 291,
  LIE: 45, LKA: 299, LSO: 239, LTU: 1096, LUX: -3, LVA: 604, MAC: 211, MAF: 368,
  MAR: 257, MCO: 790, MDA: 569, MDG: 214, MDV: 154, MEX: 512, MHL: 157, MKD: 826,
  MLI: 209, MLT: 201, MMR: 379, MNE: 561, MNG: 16, MNP: 419, MOZ: 329, MRT: 156,
  MSR: 85, MTQ: 609, MUS: 200, MWI: 219, MYS: 148, MYT: 302, NAM: 149, NCL: 71,
  NER: 206, NGA: 244, NIC: 292, NIU: 31, NLD: 387, NOR: 222, NPL: 483, NRU: 19,
  NZL: 19, OMN: 70, PAK: 329, PAN: 253, PCN: -20, PER: 660, PHL: 276, PLW: -18,
  PNG: 175, POL: 410, PRI: 683, PRT: 419, PRY: 366, PSE: 114, PYF: 193, QAT: 84,
  REU: 488, ROU: 500, RUS: 1016, RWA: 250, SAU: 95, SDN: 337, SEN: 174, SGP: 177,
  SHN: -29, SLB: 151, SLE: 164, SLV: 364, SMR: 456, SOM: 220, SPM: 40, SRB: 857,
  SSD: 186, STP: 108, SUR: 338, SVK: 568, SVN: 310, SWE: 249, SWZ: 210, SXM: 440,
  SYC: -36, SYR: 136, TCA: 252, TCD: 223, TGO: 185, THA: 314, TJK: 242, TKL: -22,
  TKM: 191, TLS: 158, TON: -3, TTO: 360, TUN: 227, TUR: 349, TUV: 123, TWN: 184,
  TZA: 275, UGA: 276, UKR: 600, URY: 259, USA: 434, UZB: 229, VAT: 202, VCT: 262,
  VEN: 253, VGB: 264, VIR: 621, VNM: 428, VUT: -66, WLF: 57, WSM: 22, YEM: 182,
  ZAF: 511, ZMB: 304, ZWE: 315,
};
